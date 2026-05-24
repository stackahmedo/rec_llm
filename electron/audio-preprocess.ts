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
      reason: `Audio is ${durationHours.toFixed(1)} hours. Consider splitting into chunks for reliable processing.`,
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
