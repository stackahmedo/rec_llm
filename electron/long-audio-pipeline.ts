/**
 * Enterprise Long-Audio Processing Pipeline
 *
 * Handles audio files up to 20+ hours via automatic chunked transcription.
 * Splits, processes, merges, and recovers gracefully.
 */

import { ipcMain, app } from 'electron';
import { annotateUtterancesWithGender } from './gender-detection';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import { filePathSchema, pipelineIdSchema, chunkIndexSchema, chunkDoneUtterancesSchema, chunkFailedErrorSchema, longAudioStartOptsSchema, validateSchema } from './shared/schemas';

// --- Types ---

export interface AudioAnalysis {
  duration: number;       // seconds
  sizeBytes: number;
  bitrate: number;        // kbps
  sampleRate: number;
  channels: number;
  codec: string;
  format: string;
  requiresChunking: boolean;
  reason?: string;
  estimatedChunks?: number;
}

export interface ChunkInfo {
  id: string;
  index: number;
  filePath: string;
  startTime: number;     // seconds from original
  endTime: number;       // seconds from original
  duration: number;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'failed' | 'retrying';
  transcriptId?: string;
  error?: string;
  retryCount: number;
  utterances?: any[];
}

export interface PipelineState {
  id: string;
  sourceFile: string;
  fileName: string;
  analysis: AudioAnalysis;
  chunks: ChunkInfo[];
  status: 'analyzing' | 'splitting' | 'processing' | 'merging' | 'done' | 'failed' | 'paused';
  startedAt: number;
  completedAt?: number;
  progress: number;       // 0-100
  currentChunk: number;
  totalChunks: number;
  concurrency: number;
  mergedTranscript?: MergedTranscript;
  error?: string;
}

export interface MergedTranscript {
  fullText: string;
  utterances: MergedUtterance[];
  totalDuration: number;
  speakerCount: number;
  chunkCount: number;
}

export interface MergedUtterance {
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
  chunkIndex: number;
}

// --- Constants ---

const CHUNK_DURATION_MINUTES = 45;       // Target chunk size for standard long audio (2–10h)
const MIN_CHUNK_MINUTES = 30;
const MAX_CHUNK_MINUTES = 90;
const LONG_AUDIO_THRESHOLD_HOURS = 2;    // Activate long-audio mode at 2 hours
const LONG_AUDIO_THRESHOLD_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_CONCURRENT_CHUNKS = 2;
const MAX_RETRIES = 3;
const SILENCE_DETECT_THRESHOLD = '-30dB';
const SILENCE_MIN_DURATION = '0.5';

// --- Enterprise Mode Constants (10–30h) ---
const ENTERPRISE_THRESHOLD_HOURS = 10;   // Force enterprise mode at 10 hours
const MAX_SUPPORTED_HOURS = 30;          // Hard block above 30 hours
const ENTERPRISE_CHUNK_MINUTES = 25;     // Smaller chunks for enterprise mode
const ENTERPRISE_CONCURRENCY = 1;        // Sequential only for enterprise
const MIN_DISK_SPACE_GB = 5;             // Minimum free disk space to start enterprise pipeline

type AudioTier = 'normal' | 'long_audio' | 'enterprise' | 'blocked';

function getAudioTier(durationHours: number): AudioTier {
  if (durationHours > MAX_SUPPORTED_HOURS) return 'blocked';
  if (durationHours >= ENTERPRISE_THRESHOLD_HOURS) return 'enterprise';
  if (durationHours >= LONG_AUDIO_THRESHOLD_HOURS) return 'long_audio';
  return 'normal';
}

function getChunkMinutes(tier: AudioTier): number {
  return tier === 'enterprise' ? ENTERPRISE_CHUNK_MINUTES : CHUNK_DURATION_MINUTES;
}

function getConcurrency(tier: AudioTier): number {
  return tier === 'enterprise' ? ENTERPRISE_CONCURRENCY : MAX_CONCURRENT_CHUNKS;
}

// --- State Management ---

const activePipelines = new Map<string, PipelineState>();

function getRecoveryDir(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'pipeline-recovery');
}

// Sanitize pipelineId to prevent path traversal
function sanitizePipelineId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_\-]/g, '');
}

async function ensureRecoveryDir() {
  const dir = getRecoveryDir();
  await fs.mkdir(dir, { recursive: true });
}

async function savePipelineState(state: PipelineState) {
  await ensureRecoveryDir();
  const safeId = sanitizePipelineId(state.id);
  const statePath = path.join(getRecoveryDir(), `${safeId}.json`);
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  activePipelines.set(state.id, state);
}

async function loadPipelineState(pipelineId: string): Promise<PipelineState | null> {
  const safeId = sanitizePipelineId(pipelineId);
  const statePath = path.join(getRecoveryDir(), `${safeId}.json`);
  try {
    const data = await fs.readFile(statePath, 'utf-8');
    return JSON.parse(data);
  } catch { return null; }
}

async function listRecoverablePipelines(): Promise<PipelineState[]> {
  await ensureRecoveryDir();
  const dir = getRecoveryDir();
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  const states: PipelineState[] = [];
  for (const file of files) {
    try {
      const data = await fs.readFile(path.join(dir, file), 'utf-8');
      const state = JSON.parse(data);
      if (state.status !== 'done' && state.status !== 'failed') {
        states.push(state);
      }
    } catch {}
  }
  return states;
}

async function cleanupPipeline(pipelineId: string) {
  const state = activePipelines.get(pipelineId);
  if (state) {
    // Delete temporary chunk files
    for (const chunk of state.chunks) {
      if (chunk.filePath) {
        try { await fs.unlink(chunk.filePath); } catch {}
      }
    }
    // Delete chunk directory
    const chunkDir = path.dirname(state.chunks[0]?.filePath || '');
    if (chunkDir && chunkDir.includes('recllm-chunks')) {
      try { await fs.rm(chunkDir, { recursive: true }); } catch {}
    }
  }
  // Remove recovery file
  const safeId = sanitizePipelineId(pipelineId);
  const statePath = path.join(getRecoveryDir(), `${safeId}.json`);
  try { await fs.unlink(statePath); } catch {}
  activePipelines.delete(pipelineId);
}

// --- FFmpeg Helpers ---

function getFfmpegPath(): string {
  const devPath = path.join(__dirname, '../node_modules/ffmpeg-static/ffmpeg');
  const unpackedPath = path.join(process.resourcesPath || '', 'ffmpeg');
  const unpackedPathExe = path.join(process.resourcesPath || '', 'ffmpeg.exe');
  if (fsSync.existsSync(devPath)) return devPath;
  if (fsSync.existsSync(unpackedPath)) return unpackedPath;
  if (fsSync.existsSync(unpackedPathExe)) return unpackedPathExe;
  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath && fsSync.existsSync(staticPath)) return staticPath;
  } catch {}
  throw new Error('FFmpeg not found.');
}

function getFfprobePath(): string {
  const platform = os.platform();
  const arch = os.arch();
  const devPath = path.join(__dirname, `../node_modules/ffprobe-static/bin/${platform}/${arch}/ffprobe`);
  const devPathAlt = path.join(__dirname, '../node_modules/ffprobe-static/bin/darwin/arm64/ffprobe');
  const unpackedPath = path.join(process.resourcesPath || '', 'ffprobe');
  const unpackedPathExe = path.join(process.resourcesPath || '', 'ffprobe.exe');
  if (fsSync.existsSync(devPath)) return devPath;
  if (fsSync.existsSync(devPathAlt)) return devPathAlt;
  if (fsSync.existsSync(unpackedPath)) return unpackedPath;
  if (fsSync.existsSync(unpackedPathExe)) return unpackedPathExe;
  try {
    const staticPath = require('ffprobe-static').path;
    if (staticPath && fsSync.existsSync(staticPath)) return staticPath;
  } catch {}
  throw new Error('FFprobe not found.');
}

function execPromise(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout || stderr);
    });
  });
}

// --- Phase 1: Audio Analysis ---

async function analyzeAudio(filePath: string): Promise<AudioAnalysis> {
  const ffprobe = getFfprobePath();
  const output = await execPromise(ffprobe, [
    '-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath,
  ]);
  const data = JSON.parse(output);
  const audioStream = data.streams?.find((s: any) => s.codec_type === 'audio') || {};
  const format = data.format || {};
  const sizeBytes = (await fs.stat(filePath)).size;
  const duration = parseFloat(format.duration || audioStream.duration || '0');
  const durationHours = duration / 3600;
  const tier = getAudioTier(durationHours);

  const requiresChunking = tier !== 'normal' && tier !== 'blocked';
  const chunkMinutes = getChunkMinutes(tier);
  const estimatedChunks = requiresChunking ? Math.ceil(duration / (chunkMinutes * 60)) : 1;

  let reason: string | undefined;
  if (tier === 'blocked') {
    reason = `Audio is ${durationHours.toFixed(1)} hours — exceeds maximum supported duration of ${MAX_SUPPORTED_HOURS} hours.`;
  } else if (tier === 'enterprise') {
    reason = `Audio is ${durationHours.toFixed(1)} hours. Enterprise Long Audio Mode activated (${estimatedChunks} chunks × ${chunkMinutes} min, sequential processing).`;
  } else if (tier === 'long_audio') {
    reason = `Audio is ${durationHours.toFixed(1)} hours. Long Audio Mode activated (${estimatedChunks} chunks × ${chunkMinutes} min).`;
  } else if (sizeBytes > LONG_AUDIO_THRESHOLD_BYTES) {
    reason = `File is ${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB. Chunked processing activated.`;
  }

  return {
    duration,
    sizeBytes,
    bitrate: Math.round(parseInt(format.bit_rate || '0', 10) / 1000),
    sampleRate: parseInt(audioStream.sample_rate || '0', 10),
    channels: audioStream.channels || 0,
    codec: audioStream.codec_name || 'unknown',
    format: format.format_name || path.extname(filePath).slice(1),
    requiresChunking,
    reason,
    estimatedChunks,
  };
}

// --- Phase 2: Smart Chunking ---

async function detectSilencePoints(filePath: string, maxDuration: number): Promise<number[]> {
  const ffmpeg = getFfmpegPath();
  try {
    const output = await execPromise(ffmpeg, [
      '-i', filePath,
      '-af', `silencedetect=noise=${SILENCE_DETECT_THRESHOLD}:d=${SILENCE_MIN_DURATION}`,
      '-f', 'null', '-',
    ]);
    // Parse silence_end timestamps
    const silencePoints: number[] = [];
    const regex = /silence_end: ([\d.]+)/g;
    let match;
    while ((match = regex.exec(output)) !== null) {
      silencePoints.push(parseFloat(match[1]));
    }
    return silencePoints;
  } catch {
    // Silence detection failed, return empty (will use fixed splits)
    return [];
  }
}

function findBestSplitPoint(silencePoints: number[], targetTime: number, tolerance: number = 300): number {
  // Find silence point closest to target within tolerance (±5 min)
  let best = targetTime;
  let bestDist = Infinity;
  for (const point of silencePoints) {
    const dist = Math.abs(point - targetTime);
    if (dist < bestDist && dist <= tolerance) {
      best = point;
      bestDist = dist;
    }
  }
  return best;
}

async function splitIntoChunks(filePath: string, analysis: AudioAnalysis): Promise<ChunkInfo[]> {
  const ffmpeg = getFfmpegPath();
  const baseName = path.basename(filePath, path.extname(filePath));
  const outputDir = path.join(os.tmpdir(), `recllm-chunks-${Date.now()}`);
  await fs.mkdir(outputDir, { recursive: true });

  const tier = getAudioTier(analysis.duration / 3600);
  const chunkDurationSec = getChunkMinutes(tier) * 60;
  const totalDuration = analysis.duration;
  const numChunks = Math.ceil(totalDuration / chunkDurationSec);

  // Detect silence points for smart splitting
  const silencePoints = await detectSilencePoints(filePath, totalDuration);

  // Calculate split points
  const splitPoints: number[] = [0];
  for (let i = 1; i < numChunks; i++) {
    const targetTime = i * chunkDurationSec;
    const splitPoint = silencePoints.length > 0
      ? findBestSplitPoint(silencePoints, targetTime)
      : targetTime;
    splitPoints.push(splitPoint);
  }
  splitPoints.push(totalDuration);

  // Split using ffmpeg
  const chunks: ChunkInfo[] = [];
  for (let i = 0; i < splitPoints.length - 1; i++) {
    const startTime = splitPoints[i];
    const endTime = splitPoints[i + 1];
    const duration = endTime - startTime;
    const chunkPath = path.join(outputDir, `${baseName}_part_${String(i + 1).padStart(3, '0')}.m4a`);

    await execPromise(ffmpeg, [
      '-i', filePath,
      '-ss', String(startTime),
      '-t', String(duration),
      '-vn',
      '-acodec', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '1',
      '-y',
      chunkPath,
    ]);

    if (!fsSync.existsSync(chunkPath)) {
      throw new Error(`Failed to create chunk ${i + 1}`);
    }

    chunks.push({
      id: `chunk_${i}`,
      index: i,
      filePath: chunkPath,
      startTime,
      endTime,
      duration,
      status: 'pending',
      retryCount: 0,
    });
  }

  return chunks;
}

// --- Phase 4: Transcript Merge ---

function mergeTranscripts(chunks: ChunkInfo[]): MergedTranscript {
  const allUtterances: MergedUtterance[] = [];
  let fullText = '';

  const completedChunks = chunks
    .filter((c) => c.status === 'done' && c.utterances)
    .sort((a, b) => a.index - b.index);

  for (const chunk of completedChunks) {
    const offsetMs = chunk.startTime * 1000;

    for (const u of chunk.utterances || []) {
      allUtterances.push({
        speaker: u.speaker || 'Speaker',
        text: u.text || '',
        startMs: (u.start || u.startMs || 0) + offsetMs,
        endMs: (u.end || u.endMs || 0) + offsetMs,
        confidence: u.confidence || 1,
        chunkIndex: chunk.index,
      });
    }

    if (chunk.utterances?.length) {
      fullText += chunk.utterances.map((u: any) => u.text).join(' ') + ' ';
    }
  }

  const speakers = new Set(allUtterances.map((u) => u.speaker));
  const totalDuration = completedChunks.length > 0
    ? completedChunks[completedChunks.length - 1].endTime
    : 0;

  return {
    fullText: fullText.trim(),
    utterances: allUtterances,
    totalDuration,
    speakerCount: speakers.size,
    chunkCount: completedChunks.length,
  };
}

// --- Phase 3 & 6: Processing Queue with Progress ---

function calculateProgress(state: PipelineState): number {
  if (state.status === 'analyzing') return 5;
  if (state.status === 'splitting') return 10;
  if (state.status === 'merging') return 95;
  if (state.status === 'done') return 100;

  const completed = state.chunks.filter((c) => c.status === 'done').length;
  const processing = state.chunks.filter((c) => c.status === 'processing' || c.status === 'uploading').length;
  // 10-90% range for chunk processing
  const chunkProgress = (completed + processing * 0.5) / state.totalChunks;
  return Math.round(10 + chunkProgress * 80);
}

function estimateRemainingTime(state: PipelineState): number {
  const completed = state.chunks.filter((c) => c.status === 'done').length;
  if (completed === 0) return -1;

  const elapsed = Date.now() - state.startedAt;
  const avgPerChunk = elapsed / completed;
  const remaining = state.totalChunks - completed;
  return Math.round(avgPerChunk * remaining / 1000); // seconds
}

// --- IPC Handlers ---

export function registerLongAudioHandlers(): void {
  // Analyze audio file
  ipcMain.handle('longaudio:analyze', async (_event, filePath: unknown) => {
    const v = validateSchema(filePathSchema, filePath);
    if (!v.ok) return { ok: false, error: v.error };
    try {
      const analysis = await analyzeAudio(v.data);
      return { ok: true, analysis };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  // Start pipeline
  ipcMain.handle('longaudio:start', async (_event, filePath: unknown, opts?: unknown) => {
    const v = validateSchema(filePathSchema, filePath);
    if (!v.ok) return { ok: false, error: v.error };
    const ov = validateSchema(longAudioStartOptsSchema, opts ?? undefined);
    if (!ov.ok) return { ok: false, error: ov.error };
    try {
      const analysis = await analyzeAudio(v.data);
      const durationHours = analysis.duration / 3600;
      const tier = getAudioTier(durationHours);

      // Block files exceeding 30 hours
      if (tier === 'blocked') {
        return { ok: false, error: `Audio duration (${durationHours.toFixed(1)}h) exceeds the maximum supported limit of ${MAX_SUPPORTED_HOURS} hours. Please split the file manually.` };
      }

      if (!analysis.requiresChunking) {
        return { ok: true, requiresChunking: false, analysis };
      }

      // Pre-flight: check disk space for enterprise mode
      if (tier === 'enterprise') {
        try {
          const tmpDir = os.tmpdir();
          const stats = fsSync.statfsSync ? fsSync.statfsSync(tmpDir) : null;
          if (stats) {
            const freeGB = (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);
            if (freeGB < MIN_DISK_SPACE_GB) {
              return { ok: false, error: `Insufficient disk space. Enterprise Long Audio Mode requires at least ${MIN_DISK_SPACE_GB}GB free. Available: ${freeGB.toFixed(1)}GB.` };
            }
          }
        } catch {
          // statfsSync may not be available on all platforms — proceed anyway
        }
      }

      const concurrency = getConcurrency(tier);
      const pipelineId = `pipeline_${Date.now()}`;
      const state: PipelineState = {
        id: pipelineId,
        sourceFile: v.data,
        fileName: path.basename(v.data),
        analysis,
        chunks: [],
        status: 'splitting',
        startedAt: Date.now(),
        progress: 10,
        currentChunk: 0,
        totalChunks: analysis.estimatedChunks || 1,
        concurrency: ov.data?.concurrency || concurrency,
      };

      await savePipelineState(state);

      // Split in background
      const chunks = await splitIntoChunks(v.data, analysis);
      state.chunks = chunks;
      state.totalChunks = chunks.length;
      state.status = 'processing';
      state.progress = 15;
      await savePipelineState(state);

      return { ok: true, requiresChunking: true, pipelineId, totalChunks: chunks.length, analysis };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  // Get pipeline status
  ipcMain.handle('longaudio:status', async (_event, pipelineId: unknown) => {
    const v = validateSchema(pipelineIdSchema, pipelineId);
    if (!v.ok) return { ok: false, error: v.error };
    const state = activePipelines.get(v.data) || await loadPipelineState(v.data);
    if (!state) return { ok: false, error: 'Pipeline not found.' };

    return {
      ok: true,
      status: state.status,
      progress: calculateProgress(state),
      currentChunk: state.chunks.filter((c) => c.status === 'done').length,
      totalChunks: state.totalChunks,
      estimatedRemaining: estimateRemainingTime(state),
      chunks: state.chunks.map((c) => ({ id: c.id, index: c.index, status: c.status, error: c.error })),
    };
  });

  // Mark chunk as completed (called by transcription handler)
  ipcMain.handle('longaudio:chunkDone', async (_event, pipelineId: unknown, chunkIndex: unknown, utterances: unknown) => {
    const pv = validateSchema(pipelineIdSchema, pipelineId);
    if (!pv.ok) return { ok: false, error: pv.error };
    const cv = validateSchema(chunkIndexSchema, chunkIndex);
    if (!cv.ok) return { ok: false, error: cv.error };
    const uv = validateSchema(chunkDoneUtterancesSchema, utterances);
    if (!uv.ok) return { ok: false, error: uv.error };

    const state = activePipelines.get(pv.data);
    if (!state) return { ok: false, error: 'Pipeline not found.' };

    const chunk = state.chunks[cv.data];
    if (!chunk) return { ok: false, error: 'Chunk not found.' };

    chunk.status = 'done';
    chunk.utterances = uv.data;
    state.progress = calculateProgress(state);
    savePipelineState(state);

    // Check if all done
    const allDone = state.chunks.every((c) => c.status === 'done');
    if (allDone) {
      state.status = 'merging';
      state.mergedTranscript = mergeTranscripts(state.chunks);
      try {
        const ffmpegPath = getFfmpegPath();
        // Annotate merged utterances with simple gender/age heuristic
        state.mergedTranscript = await annotateUtterancesWithGender(ffmpegPath, state.mergedTranscript, state.chunks);
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err);
        console.warn('[gender-detection] annotation failed', errMessage);
      }
      // Release chunk utterances to free memory — merged transcript holds the data now
      for (const c of state.chunks) {
        c.utterances = undefined;
      }
      state.status = 'done';
      state.completedAt = Date.now();
      state.progress = 100;
      await savePipelineState(state);
    }

    return { ok: true, allDone, progress: state.progress };
  });

  // Mark chunk as failed
  ipcMain.handle('longaudio:chunkFailed', async (_event, pipelineId: unknown, chunkIndex: unknown, error: unknown) => {
    const pv = validateSchema(pipelineIdSchema, pipelineId);
    if (!pv.ok) return { ok: false, error: pv.error };
    const cv = validateSchema(chunkIndexSchema, chunkIndex);
    if (!cv.ok) return { ok: false, error: cv.error };
    const ev = validateSchema(chunkFailedErrorSchema, error);
    if (!ev.ok) return { ok: false, error: ev.error };

    const state = activePipelines.get(pv.data);
    if (!state) return { ok: false, error: 'Pipeline not found.' };

    const chunk = state.chunks[cv.data];
    if (!chunk) return { ok: false, error: 'Chunk not found.' };

    chunk.retryCount++;
    if (chunk.retryCount < MAX_RETRIES) {
      chunk.status = 'retrying';
      chunk.error = ev.data;
    } else {
      chunk.status = 'failed';
      chunk.error = `Failed after ${MAX_RETRIES} attempts: ${ev.data}`;
    }
    savePipelineState(state);

    return { ok: true, canRetry: chunk.retryCount < MAX_RETRIES, retryCount: chunk.retryCount };
  });

  // Get next pending chunk for processing
  ipcMain.handle('longaudio:nextChunk', async (_event, pipelineId: unknown) => {
    const v = validateSchema(pipelineIdSchema, pipelineId);
    if (!v.ok) return { ok: false, error: v.error };
    const state = activePipelines.get(v.data);
    if (!state) return { ok: false, error: 'Pipeline not found.' };

    const pending = state.chunks.find((c) => c.status === 'pending' || c.status === 'retrying');
    if (!pending) return { ok: true, chunk: null, allProcessed: true };

    pending.status = 'uploading';
    savePipelineState(state);

    return {
      ok: true,
      chunk: {
        index: pending.index,
        filePath: pending.filePath,
        startTime: pending.startTime,
        duration: pending.duration,
      },
      allProcessed: false,
    };
  });

  // Get merged transcript
  ipcMain.handle('longaudio:getMerged', async (_event, pipelineId: unknown) => {
    const v = validateSchema(pipelineIdSchema, pipelineId);
    if (!v.ok) return { ok: false, error: v.error };
    const state = activePipelines.get(v.data) || await loadPipelineState(v.data);
    if (!state) return { ok: false, error: 'Pipeline not found.' };

    if (state.status !== 'done') {
      const partial = mergeTranscripts(state.chunks);
      return { ok: true, partial: true, transcript: partial };
    }

    return { ok: true, partial: false, transcript: state.mergedTranscript };
  });

  // Resume interrupted pipeline
  ipcMain.handle('longaudio:resume', async (_event, pipelineId: unknown) => {
    const v = validateSchema(pipelineIdSchema, pipelineId);
    if (!v.ok) return { ok: false, error: v.error };
    const state = await loadPipelineState(v.data);
    if (!state) return { ok: false, error: 'Pipeline not found.' };

    // Reset failed/retrying chunks to pending
    for (const chunk of state.chunks) {
      if (chunk.status === 'uploading' || chunk.status === 'processing') {
        chunk.status = 'pending';
      }
    }
    state.status = 'processing';
    activePipelines.set(state.id, state);
    await savePipelineState(state);

    const remaining = state.chunks.filter((c: any) => c.status === 'pending' || c.status === 'retrying').length;
    return { ok: true, pipelineId: state.id, remainingChunks: remaining, totalChunks: state.totalChunks };
  });

  // List recoverable pipelines
  ipcMain.handle('longaudio:listRecoverable', async () => {
    const pipelines = await listRecoverablePipelines();
    return {
      ok: true,
      pipelines: pipelines.map((p: any) => ({
        id: p.id,
        fileName: p.fileName,
        status: p.status,
        progress: calculateProgress(p),
        completedChunks: p.chunks.filter((c: any) => c.status === 'done').length,
        totalChunks: p.totalChunks,
        startedAt: p.startedAt,
      })),
    };
  });

  // Cleanup pipeline (delete temp files)
  ipcMain.handle('longaudio:cleanup', async (_event, pipelineId: unknown) => {
    const v = validateSchema(pipelineIdSchema, pipelineId);
    if (!v.ok) return { ok: false, error: v.error };
    try {
      await cleanupPipeline(v.data);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  // Cancel pipeline
  ipcMain.handle('longaudio:cancel', async (_event, pipelineId: unknown) => {
    const v = validateSchema(pipelineIdSchema, pipelineId);
    if (!v.ok) return { ok: false, error: v.error };
    const state = activePipelines.get(v.data);
    if (state) {
      state.status = 'failed';
      state.error = 'Cancelled by user.';
      await savePipelineState(state);
    }
    cleanupPipeline(v.data);
    return { ok: true };
  });
}
