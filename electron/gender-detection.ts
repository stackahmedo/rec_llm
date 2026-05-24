import { execFile } from 'child_process';

const execFileP = (file: string, args: string[], opts: { maxBuffer: number; encoding: 'buffer' }) =>
  new Promise<{ stdout: Buffer; stderr: Buffer }>((resolve, reject) => {
    execFile(file, args, opts, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout: stdout as Buffer, stderr: stderr as Buffer });
    });
  });

// Simple WAV parser for 16-bit PCM mono
function parseWav(buffer: Buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') throw new Error('Invalid WAV');
  const fmtOff = buffer.indexOf('fmt ');
  const dataOff = buffer.indexOf('data');
  const sampleRate = buffer.readUInt32LE(fmtOff + 12);
  const bitsPerSample = buffer.readUInt16LE(fmtOff + 22);
  const dataStart = dataOff + 8;
  const dataLen = buffer.readUInt32LE(dataOff + 4);
  const samples: number[] = [];
  if (bitsPerSample !== 16) throw new Error('Only 16-bit WAV supported');
  for (let i = dataStart; i < dataStart + dataLen; i += 2) {
    const s = buffer.readInt16LE(i);
    samples.push(s / 32768);
  }
  return { samples, sampleRate };
}

function detectPitchAutoCorr(samples: number[], sampleRate: number) {
  const MIN_FREQ = 60;
  const MAX_FREQ = 500;
  const minLag = Math.floor(sampleRate / MAX_FREQ);
  const maxLag = Math.floor(sampleRate / MIN_FREQ);
  let bestLag = -1;
  let bestCorr = -Infinity;
  const N = Math.min(samples.length, sampleRate * 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < N - lag; i++) {
      corr += samples[i] * samples[i + lag];
    }
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }
  if (bestLag <= 0) return null;
  return sampleRate / bestLag;
}

async function extractSegmentToWav(ffmpegPath: string, filePath: string, startSec: number, durationSec: number) {
  const args = [
    '-i', filePath,
    '-ss', String(startSec),
    '-t', String(Math.max(durationSec, 0.2)),
    '-ar', '16000',
    '-ac', '1',
    '-f', 'wav',
    'pipe:1',
  ];
  const { stdout } = await execFileP(ffmpegPath, args, { maxBuffer: 200 * 1024 * 1024, encoding: 'buffer' });
  return stdout;
}

export async function analyzeUtteranceSegment(ffmpegPath: string, filePath: string, startSec: number, durationSec: number) {
  try {
    const wav = await extractSegmentToWav(ffmpegPath, filePath, startSec, durationSec);
    const { samples, sampleRate } = parseWav(wav);
    if (samples.length < sampleRate * 0.05) return null;
    const pitch = detectPitchAutoCorr(samples, sampleRate);
    if (!pitch) return null;
    let gender: 'male' | 'female' | 'unknown' = 'unknown';
    if (pitch > 170) gender = 'female';
    else if (pitch > 90) gender = 'male';
    let ageRange: 'child' | 'young' | 'adult' | 'senior' | 'unknown' = 'unknown';
    if (pitch > 250) ageRange = 'child';
    else if (pitch > 180) ageRange = 'young';
    else if (pitch > 120) ageRange = 'adult';
    else ageRange = 'senior';
    return { pitchHz: Math.round(pitch), gender, ageRange };
  } catch (err) {
    return null;
  }
}

export async function annotateUtterancesWithGender(ffmpegPath: string, merged: any, chunks: any[]) {
  if (!merged || !merged.utterances) return merged;
  for (const u of merged.utterances) {
    try {
      const chunk = chunks[u.chunkIndex];
      if (!chunk || !chunk.filePath) { u.gender = 'unknown'; u.ageRange = 'unknown'; continue; }
      const relStart = Math.max(0, (u.startMs - (chunk.startTime * 1000)) / 1000);
      const duration = Math.max(0.2, (u.endMs - u.startMs) / 1000);
      const info = await analyzeUtteranceSegment(ffmpegPath, chunk.filePath, relStart, duration);
      if (info) {
        u.gender = info.gender;
        u.ageRange = info.ageRange;
        u.pitchHz = info.pitchHz;
      } else {
        u.gender = 'unknown';
        u.ageRange = 'unknown';
      }
    } catch {
      u.gender = 'unknown';
      u.ageRange = 'unknown';
    }
  }
  return merged;
}
