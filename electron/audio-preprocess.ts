import { ipcMain, app } from 'electron';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { filePathSchema, chunkMinutesSchema, validateSchema } from './shared/schemas';

// Resolve bundled FFmpeg/FFprobe paths
// In dev: node_modules paths. In packaged: app.asar.unpacked or extraResources.
function getFfmpegPath(): string {
  const devPath = path.join(__dirname, '../node_modules/ffmpeg-static/ffmpeg');
  const unpackedPath = path.join(process.resourcesPath || '', 'ffmpeg');
  const unpackedPathExe = path.join(process.resourcesPath || '', 'ffmpeg.exe');

  if (fs.existsSync(devPath)) return devPath;
  if (fs.existsSync(unpackedPath)) return unpackedPath;
  if (fs.existsSync(unpackedPathExe)) return unpackedPathExe;

  // Fallback: try require resolution
  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath && fs.existsSync(staticPath)) return staticPath;
  } catch {}

  throw new Error('Bundled FFmpeg runtime missing. Please reinstall RecLLM.');
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

  // Fallback: try require resolution
  try {
    const staticPath = require('ffprobe-static').path;
    if (staticPath && fs.existsSync(staticPath)) return staticPath;
  } catch {}

  throw new Error('Bundled FFprobe runtime missing. Please reinstall RecLLM.');
}

export interface AudioMetadata {
  duration: number; // seconds
  codec: string;
  bitrate: number; // kbps
  sampleRate: number;
  channels: number;
  sizeBytes: number;
  format: string;
  recordingDate?: string; // ISO date string extracted from file metadata/filename
}

export interface PreprocessResult {
  action: 'direct' | 'compress' | 'split';
  reason: string;
  metadata: AudioMetadata;
}

function execPromise(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout || stderr);
    });
  });
}

/**
 * Detect recording date from multiple sources:
 * 1. Filename patterns (YYYYMMDD, YYYY-MM-DD, DD_MM_YYYY, etc.)
 * 2. File system creation/modification date
 * 3. Audio metadata tags (ID3, RIFF INFO)
 */
function detectRecordingDate(filePath: string, ffprobeOutput?: any): string | undefined {
  const fileName = path.basename(filePath);

  // Pattern 1: YYYYMMDD (e.g., 20240315_meeting.mp3)
  const p1 = fileName.match(/(?:^|[_\-\s])(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:[_\-\s.]|$)/);
  if (p1) {
    const d = new Date(`${p1[1]}-${p1[2]}-${p1[3]}`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  // Pattern 2: YYYY-MM-DD or YYYY_MM_DD
  const p2 = fileName.match(/(\d{4})[-_](0[1-9]|1[0-2])[-_](0[1-9]|[12]\d|3[01])/);
  if (p2) {
    const d = new Date(`${p2[1]}-${p2[2]}-${p2[3]}`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  // Pattern 3: DD-MM-YYYY or DD_MM_YYYY
  const p3 = fileName.match(/(0[1-9]|[12]\d|3[01])[-_](0[1-9]|1[0-2])[-_](\d{4})/);
  if (p3) {
    const d = new Date(`${p3[3]}-${p3[2]}-${p3[1]}`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  // Pattern 4: Check ffprobe metadata tags (creation_time, date)
  if (ffprobeOutput?.format?.tags) {
    const tags = ffprobeOutput.format.tags;
    const dateTag = tags.creation_time || tags.date || tags.ICRD || tags.IDIT;
    if (dateTag) {
      const d = new Date(dateTag);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
  }

  // Pattern 5: File system birthtime (creation date)
  try {
    const stat = fs.statSync(filePath);
    const birthtime = stat.birthtime;
    if (birthtime && birthtime.getFullYear() > 1980) {
      return birthtime.toISOString().split('T')[0];
    }
  } catch {}

  return undefined;
}

async function getAudioMetadata(filePath: string): Promise<AudioMetadata> {
  const ffprobe = getFfprobePath();
  const args = [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ];

  const output = await execPromise(ffprobe, args);
  const data = JSON.parse(output);

  const audioStream = data.streams?.find((s: any) => s.codec_type === 'audio') || {};
  const format = data.format || {};

  const sizeBytes = fs.statSync(filePath).size;

  return {
    duration: parseFloat(format.duration || audioStream.duration || '0'),
    codec: audioStream.codec_name || 'unknown',
    bitrate: Math.round((parseInt(format.bit_rate || '0', 10)) / 1000),
    sampleRate: parseInt(audioStream.sample_rate || '0', 10),
    channels: audioStream.channels || 0,
    sizeBytes,
    format: format.format_name || path.extname(filePath).slice(1),
    recordingDate: detectRecordingDate(filePath, data),
  };
}

function shouldPreprocessAudio(filePath: string, metadata: AudioMetadata): PreprocessResult {
  const ext = path.extname(filePath).toLowerCase();
  const sizeMB = metadata.sizeBytes / (1024 * 1024);
  const durationHours = metadata.duration / 3600;

  // WAV files: always recommend compression
  if (ext === '.wav' || metadata.codec === 'pcm_s16le' || metadata.codec === 'pcm_s24le') {
    return {
      action: 'compress',
      reason: `WAV file (${sizeMB.toFixed(0)} MB). Compressing to M4A will reduce upload size significantly.`,
      metadata,
    };
  }

  // Very large files (> 2 GB): recommend compression
  if (sizeMB > 2048) {
    return {
      action: 'compress',
      reason: `File is ${sizeMB.toFixed(0)} MB. Compressing to reduce upload time.`,
      metadata,
    };
  }

  // Very long audio (> 2 hours): recommend splitting via long-audio pipeline
  if (durationHours > 2) {
    return {
      action: 'split',
      reason: `Audio is ${durationHours.toFixed(1)} hours. Long Audio Mode will be used automatically (30–45 min chunks).`,
      metadata,
    };
  }

  // Normal MP3/M4A under safe size: direct upload
  return {
    action: 'direct',
    reason: 'Ready for upload.',
    metadata,
  };
}

async function compressToM4A(filePath: string): Promise<string> {
  const ffmpeg = getFfmpegPath();
  const outputPath = filePath.replace(/\.[^.]+$/, '_compressed.m4a');

  const args = [
    '-i', filePath,
    '-vn',
    '-acodec', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '1', // mono for speech
    '-y',
    outputPath,
  ];

  await execPromise(ffmpeg, args);

  if (!fs.existsSync(outputPath)) {
    throw new Error('Compression failed: output file not created.');
  }

  return outputPath;
}

/**
 * Apply noise reduction using FFmpeg's afftdn filter.
 * Reduces background noise while preserving speech clarity.
 * Output: mono 16kHz WAV (optimal for STT).
 */
async function denoiseAudio(filePath: string): Promise<string> {
  const ffmpeg = getFfmpegPath();
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const outputPath = path.join(os.tmpdir(), `${baseName}_denoised_${Date.now()}.wav`);

  const args = [
    '-i', filePath,
    '-af', 'afftdn=nf=-25:tn=1,highpass=f=80,lowpass=f=8000',
    '-ar', '16000',
    '-ac', '1',
    '-y',
    outputPath,
  ];

  await execPromise(ffmpeg, args);

  if (!fs.existsSync(outputPath)) {
    throw new Error('Noise reduction failed: output file not created.');
  }

  return outputPath;
}

async function splitAudio(filePath: string, chunkMinutes: number = 60): Promise<string[]> {
  const ffmpeg = getFfmpegPath();
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const outputDir = path.join(os.tmpdir(), `recllm-chunks-${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPattern = path.join(outputDir, `${baseName}_chunk_%03d${ext}`);

  const args = [
    '-i', filePath,
    '-f', 'segment',
    '-segment_time', String(chunkMinutes * 60),
    '-c', 'copy',
    '-reset_timestamps', '1',
    '-y',
    outputPattern,
  ];

  await execPromise(ffmpeg, args);

  const chunks = fs.readdirSync(outputDir)
    .filter((f) => f.startsWith(baseName))
    .sort()
    .map((f) => path.join(outputDir, f));

  if (chunks.length === 0) {
    throw new Error('Splitting failed: no chunks created.');
  }

  return chunks;
}

export function registerAudioPreprocessHandlers(): void {
  ipcMain.handle('audio:metadata', async (_event, filePath: unknown): Promise<{
    ok: boolean;
    error?: string;
    metadata?: AudioMetadata;
    recommendation?: PreprocessResult;
  }> => {
    const v = validateSchema(filePathSchema, filePath);
    if (!v.ok) return { ok: false, error: v.error };
    try {
      const metadata = await getAudioMetadata(v.data);
      const recommendation = shouldPreprocessAudio(v.data, metadata);
      return { ok: true, metadata, recommendation };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to analyze audio.' };
    }
  });

  ipcMain.handle('audio:compress', async (_event, filePath: unknown): Promise<{
    ok: boolean;
    error?: string;
    outputPath?: string;
    savedMB?: number;
  }> => {
    const v = validateSchema(filePathSchema, filePath);
    if (!v.ok) return { ok: false, error: v.error };
    try {
      const originalSize = fs.statSync(v.data).size;
      const outputPath = await compressToM4A(v.data);
      const newSize = fs.statSync(outputPath).size;
      const savedMB = (originalSize - newSize) / (1024 * 1024);
      return { ok: true, outputPath, savedMB: Math.round(savedMB * 10) / 10 };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Compression failed.' };
    }
  });

  ipcMain.handle('audio:split', async (_event, filePath: unknown, chunkMinutes?: unknown): Promise<{
    ok: boolean;
    error?: string;
    chunks?: string[];
  }> => {
    const v = validateSchema(filePathSchema, filePath);
    if (!v.ok) return { ok: false, error: v.error };
    const cv = validateSchema(chunkMinutesSchema, chunkMinutes ?? undefined);
    if (!cv.ok) return { ok: false, error: cv.error };
    try {
      const chunks = await splitAudio(v.data, cv.data || 60);
      return { ok: true, chunks };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Splitting failed.' };
    }
  });

  ipcMain.handle('audio:denoise', async (_event, filePath: unknown): Promise<{
    ok: boolean;
    error?: string;
    outputPath?: string;
  }> => {
    const v = validateSchema(filePathSchema, filePath);
    if (!v.ok) return { ok: false, error: v.error };
    try {
      const outputPath = await denoiseAudio(v.data);
      return { ok: true, outputPath };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Noise reduction failed.' };
    }
  });

  ipcMain.handle('audio:ffmpegCheck', async (): Promise<{ ok: boolean; ffmpegPath?: string; ffprobePath?: string; error?: string }> => {
    try {
      const ffmpegPath = getFfmpegPath();
      const ffprobePath = getFfprobePath();
      return { ok: true, ffmpegPath, ffprobePath };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });
}
