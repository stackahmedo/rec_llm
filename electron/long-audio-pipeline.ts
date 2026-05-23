/**
 * Enterprise Long-Audio Processing Pipeline
 *
 * Handles audio files up to 20+ hours via automatic chunked transcription.
 * Splits, processes, merges, and recovers gracefully.
 */

import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

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

const CHUNK_DURATION_MINUTES = 45;       // Target chunk size
const MIN_CHUNK_MINUTES = 30;
const MAX_CHUNK_MINUTES = 90;
const LONG_AUDIO_THRESHOLD_HOURS = 2;    // Activate long-audio mode at 2 hours
const LONG_AUDIO_THRESHOLD_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_CONCURRENT_CHUNKS = 2;
const MAX_RETRIES = 3;
const SILENCE_DETECT_THRESHOLD = '-30dB';
const SILENCE_MIN_DURATION = '0.5';

// --- State Management ---

const activePipelines = new Map<string, PipelineState>();
const RECOVERY_DIR = path.join(os.tmpdir(), 'recllm-pipeline-recovery');

function ensureRecoveryDir() {
  if (!fs.existsSync(RECOVERY_DIR)) {
    fs.mkdirSync(RECOVERY_DIR, { recursive: true });
  }
}

function savePipelineState(state: PipelineState) {
  ensureRecoveryDir();
  const statePath = path.join(RECOVERY_DIR, `${state.id}.json`);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  activePipelines.set(state.id, state);
}

function loadPipelineState(pipelineId: string): PipelineState | null {
  const statePath = path.join(RECOVERY_DIR, `${pipelineId}.json`);
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  } catch { return null; }
}

function listRecoverablePipelines(): PipelineState[] {
  ensureRecoveryDir();
  const files = fs.readdirSync(RECOVERY_DIR).filter((f) => f.endsWith('.json'));
  const states: PipelineState[] = [];
  for (const file of files) {
    try {
      const state = JSON.parse(fs.readFileSync(path.join(RECOVERY_DIR, file), 'utf-8'));
      if (state.status !== 'done' && state.status !== 'failed') {
        states.push(state);
      }
    } catch {}
  }
  return states;
}

function cleanupPipeline(pipelineId: string) {
  const state = activePipelines.get(pipelineId);
  if (state) {
    // Delete temporary chunk files
    for (const chunk of state.chunks) {
      if (chunk.filePath && fs.existsSync(chunk.filePath)) {
        try { fs.unlinkSync(chunk.filePath); } catch {}
      }
    }
    // Delete chunk directory
    const chunkDir = path.dirname(state.chunks[0]?.filePath || '');
    if (chunkDir && chunkDir.includes('recllm-chunks') && fs.existsSync(chunkDir)) {
      try { fs.rmSync(chunkDir, { recursive: true }); } catch {}
    }
  }
  // Remove recovery file
  const statePath = path.join(RECOVERY_DIR, `${pipelineId}.json`);
  if (fs.existsSync(statePath)) {
    try { fs.unlinkSync(statePath); } catch {}
  }
  activePipelines.delete(pipelineId);
}

// --- FFmpeg Helpers ---

function getFfmpegPath(): string {
  const devPath = path.join(__dirname, '../node_modules/ffmpeg-static/ffmpeg');
  const unpackedPath = path.join(process.resourcesPath || '', 'ffmpeg');
  const unpackedPathExe = path.join(process.resourcesPath || '', 'ffmpeg.exe');
  if (fs.existsSync(devPath)) return devPath;
  if (fs.existsSync(unpackedPath)) return unpackedPath;
  if (fs.existsSync(unpackedPathExe)) return unpackedPathExe;
  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath && fs.existsSync(staticPath)) return staticPath;
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
  if (fs.existsSync(devPath)) return devPath;
  if (fs.existsSync(devPathAlt)) return devPathAlt;
  if (fs.existsSync(unpackedPath)) return unpackedPath;
  if (fs.existsSync(unpackedPathExe)) return unpackedPathExe;
  try {
    const staticPath = require('ffprobe-static').path;
    if (staticPath && fs.existsSync(staticPath)) return staticPath;
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
  const sizeBytes = fs.statSync(filePath).size;
  const duration = parseFloat(format.duration || audioStream.duration || '0');
  const durationHours = duration / 3600;

  const requiresChunking = durationHours > LONG_AUDIO_THRESHOLD_HOURS || sizeBytes > LONG_AUDIO_THRESHOLD_BYTES;
  const estimatedChunks = requiresChunking ? Math.ceil(duration / (CHUNK_DURATION_MINUTES * 60)) : 1;

  let reason: string | undefined;
  if (durationHours > LONG_AUDIO_THRESHOLD_HOURS) {
    reason = `Audio is ${durationHours.toFixed(1)} hours. Chunked processing activated (${estimatedChunks} chunks).`;
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
  fs.mkdirSync(outputDir, { recursive: true });

  const chunkDurationSec = CHUNK_DURATION_MINUTES * 60;
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

    if (!fs.existsSync(chunkPath)) {
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
  ipcMain.handle('longaudio:analyze', async (_event, filePath: string) => {
    try {
      const analysis = await analyzeAudio(filePath);
      return { ok: true, analysis };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  // Start pipeline
  ipcMain.handle('longaudio:start', async (_event, filePath: string, opts?: { concurrency?: number }) => {
    try {
      const analysis = await analyzeAudio(filePath);

      if (!analysis.requiresChunking) {
        return { ok: true, requiresChunking: false, analysis };
      }

      const pipelineId = `pipeline_${Date.now()}`;
      const state: PipelineState = {
        id: pipelineId,
        sourceFile: filePath,
        fileName: path.basename(filePath),
        analysis,
        chunks: [],
        status: 'splitting',
        startedAt: Date.now(),
        progress: 10,
        currentChunk: 0,
        totalChunks: analysis.estimatedChunks || 1,
        concurrency: opts?.concurrency || MAX_CONCURRENT_CHUNKS,
      };

      savePipelineState(state);

      // Split in background
      const chunks = await splitIntoChunks(filePath, analysis);
      state.chunks = chunks;
      state.totalChunks = chunks.length;
      state.status = 'processing';
      state.progress = 15;
      savePipelineState(state);

      return { ok: true, requiresChunking: true, pipelineId, totalChunks: chunks.length, analysis };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  // Get pipeline status
  ipcMain.handle('longaudio:status', async (_event, pipelineId: string) => {
    const state = activePipelines.get(pipelineId) || loadPipelineState(pipelineId);
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
  ipcMain.handle('longaudio:chunkDone', async (_event, pipelineId: string, chunkIndex: number, utterances: any[]) => {
    const state = activePipelines.get(pipelineId);
    if (!state) return { ok: false, error: 'Pipeline not found.' };

    const chunk = state.chunks[chunkIndex];
    if (!chunk) return { ok: false, error: 'Chunk not found.' };

    chunk.status = 'done';
    chunk.utterances = utterances;
    state.progress = calculateProgress(state);
    savePipelineState(state);

    // Check if all done
    const allDone = state.chunks.every((c) => c.status === 'done');
    if (allDone) {
      state.status = 'merging';
      state.mergedTranscript = mergeTranscripts(state.chunks);
      state.status = 'done';
      state.completedAt = Date.now();
      state.progress = 100;
      savePipelineState(state);
    }

    return { ok: true, allDone, progress: state.progress };
  });

  // Mark chunk as failed
  ipcMain.handle('longaudio:chunkFailed', async (_event, pipelineId: string, chunkIndex: number, error: string) => {
    const state = activePipelines.get(pipelineId);
    if (!state) return { ok: false, error: 'Pipeline not found.' };

    const chunk = state.chunks[chunkIndex];
    if (!chunk) return { ok: false, error: 'Chunk not found.' };

    chunk.retryCount++;
    if (chunk.retryCount < MAX_RETRIES) {
      chunk.status = 'retrying';
      chunk.error = error;
    } else {
      chunk.status = 'failed';
      chunk.error = `Failed after ${MAX_RETRIES} attempts: ${error}`;
      // Don't fail entire pipeline — allow partial results
    }
    savePipelineState(state);

    return { ok: true, canRetry: chunk.retryCount < MAX_RETRIES, retryCount: chunk.retryCount };
  });

  // Get next pending chunk for processing
  ipcMain.handle('longaudio:nextChunk', async (_event, pipelineId: string) => {
    const state = activePipelines.get(pipelineId);
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
  ipcMain.handle('longaudio:getMerged', async (_event, pipelineId: string) => {
    const state = activePipelines.get(pipelineId) || loadPipelineState(pipelineId);
    if (!state) return { ok: false, error: 'Pipeline not found.' };

    if (state.status !== 'done') {
      // Partial merge of completed chunks
      const partial = mergeTranscripts(state.chunks);
      return { ok: true, partial: true, transcript: partial };
    }

    return { ok: true, partial: false, transcript: state.mergedTranscript };
  });

  // Resume interrupted pipeline
  ipcMain.handle('longaudio:resume', async (_event, pipelineId: string) => {
    const state = loadPipelineState(pipelineId);
    if (!state) return { ok: false, error: 'Pipeline not found.' };

    // Reset failed/retrying chunks to pending
    for (const chunk of state.chunks) {
      if (chunk.status === 'uploading' || chunk.status === 'processing') {
        chunk.status = 'pending'; // Was interrupted
      }
    }
    state.status = 'processing';
    activePipelines.set(state.id, state);
    savePipelineState(state);

    const remaining = state.chunks.filter((c) => c.status === 'pending' || c.status === 'retrying').length;
    return { ok: true, pipelineId: state.id, remainingChunks: remaining, totalChunks: state.totalChunks };
  });

  // List recoverable pipelines
  ipcMain.handle('longaudio:listRecoverable', async () => {
    const pipelines = listRecoverablePipelines();
    return {
      ok: true,
      pipelines: pipelines.map((p) => ({
        id: p.id,
        fileName: p.fileName,
        status: p.status,
        progress: calculateProgress(p),
        completedChunks: p.chunks.filter((c) => c.status === 'done').length,
        totalChunks: p.totalChunks,
        startedAt: p.startedAt,
      })),
    };
  });

  // Cleanup pipeline (delete temp files)
  ipcMain.handle('longaudio:cleanup', async (_event, pipelineId: string) => {
    try {
      cleanupPipeline(pipelineId);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  // Cancel pipeline
  ipcMain.handle('longaudio:cancel', async (_event, pipelineId: string) => {
    const state = activePipelines.get(pipelineId);
    if (state) {
      state.status = 'failed';
      state.error = 'Cancelled by user.';
      savePipelineState(state);
    }
    cleanupPipeline(pipelineId);
    return { ok: true };
  });
}
