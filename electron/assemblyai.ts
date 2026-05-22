import { ipcMain, net, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import https from 'https';

const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const PLACEHOLDER_KEYS = [
  'your_api_key', 'your_api_key_here', 'paste_key_here',
  'your-api-key', 'api_key', 'api-key', 'sk-xxx', 'xxx',
  'insert_key_here', 'replace_with_your_key',
];

function isPlaceholderKey(key: string): boolean {
  const lower = key.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return PLACEHOLDER_KEYS.some((p) => lower === p.replace(/[^a-z0-9_-]/g, ''));
}

async function getApiKey(): Promise<string | null> {
  let store: any = null;
  const { default: Store } = await import('electron-store');
  store = new Store({ name: 'recllm-settings', encryptionKey: 'recllm-local-encryption-key' });
  const keys = store.get('apiKeys') as Record<string, string> | undefined;
  const key = keys?.assemblyai?.trim() || null;
  if (key && isPlaceholderKey(key)) return null;
  return key;
}

async function getSpeechModels(): Promise<string[]> {
  let store: any = null;
  const { default: Store } = await import('electron-store');
  store = new Store({ name: 'recllm-settings', encryptionKey: 'recllm-local-encryption-key' });
  const models = store.get('models') as Record<string, string> | undefined;
  const model = models?.assemblyai || 'universal-3-pro+universal-2';
  // Map stored value to API array
  switch (model) {
    case 'universal-3-pro+universal-2':
      return ['universal-3-pro', 'universal-2'];
    case 'universal-2':
      return ['universal-2'];
    case 'universal-3-pro':
      return ['universal-3-pro', 'universal-2']; // always include fallback for language coverage
    default:
      return ['universal-3-pro', 'universal-2'];
  }
}

interface Utterance {
  speaker: string;
  startMs: number;
  endMs: number;
  text: string;
}

interface TranscribeResult {
  ok: boolean;
  error?: string;
  fullText?: string;
  languageCode?: string;
  utterances?: Utterance[];
}

function sendProgress(jobId: string, stage: string, detail?: string): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send('assemblyai:progress', { jobId, stage, detail });
  }
}

function uploadFileOnce(filePath: string, apiKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    console.log(`[assemblyai:upload] path exists: true, size: ${stat.size} bytes, ext: ${ext}`);

    const options: https.RequestOptions = {
      hostname: 'api.assemblyai.com',
      path: '/v2/upload',
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/octet-stream',
        'Content-Length': stat.size,
      },
    };

    const timer = setTimeout(() => {
      req.destroy(new Error('Upload timed out'));
    }, UPLOAD_TIMEOUT_MS);

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        clearTimeout(timer);
        console.log(`[assemblyai:upload] HTTP status: ${res.statusCode}`);
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(body) as { upload_url: string };
            resolve(data.upload_url);
          } catch (e) {
            reject(new Error('Failed to parse upload response'));
          }
        } else {
          reject(new Error(`Upload failed (${res.statusCode}): ${body.slice(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      clearTimeout(timer);
      req.destroy(err);
      reject(err);
    });
    stream.pipe(req);
  });
}

async function uploadFile(filePath: string, apiKey: string): Promise<string> {
  try {
    return await uploadFileOnce(filePath, apiKey);
  } catch (err: any) {
    // One retry on failure
    const msg = err.message || '';
    console.log(`[assemblyai:upload] first attempt failed: ${msg.slice(0, 100)}`);
    if (msg.includes('timed out') || msg.includes('Upload failed') || msg.includes('ECONNRESET')) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log(`[assemblyai:upload] retrying...`);
      return await uploadFileOnce(filePath, apiKey);
    }
    throw err;
  }
}

async function createTranscript(uploadUrl: string, apiKey: string): Promise<string> {
  const speechModels = await getSpeechModels();

  // Build payload, omit undefined values
  const payload: Record<string, unknown> = {
    audio_url: uploadUrl,
    speaker_labels: true,
    speech_models: speechModels,
  };

  console.log(`[assemblyai:createTranscript] uploadUrl exists: ${!!uploadUrl}, starts with https: ${uploadUrl?.startsWith('https')}`);
  console.log(`[assemblyai:createTranscript] speech_models: ${JSON.stringify(speechModels)}`);
  console.log(`[assemblyai:createTranscript] request body: ${JSON.stringify(payload)}`);

  if (!uploadUrl || !uploadUrl.startsWith('https')) {
    throw new Error(`Invalid upload URL: expected https URL, got ${uploadUrl ? uploadUrl.slice(0, 30) : 'empty'}`);
  }

  const response = await net.fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.status !== 200) {
    const errorText = await response.text();
    console.log(`[assemblyai:createTranscript] HTTP ${response.status}: ${errorText.slice(0, 300)}`);
    let errorMsg = `Transcript creation failed (${response.status})`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error) errorMsg = `AssemblyAI: ${errorJson.error}`;
    } catch { /* use default message */ }
    throw new Error(errorMsg);
  }

  const data = await response.json() as { id: string };
  console.log(`[assemblyai:createTranscript] transcript id: ${data.id}`);
  return data.id;
}

async function pollTranscript(transcriptId: string, apiKey: string, jobId: string): Promise<TranscribeResult> {
  const url = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;

  while (true) {
    const response = await net.fetch(url, {
      method: 'GET',
      headers: { 'Authorization': apiKey },
    });

    if (response.status !== 200) {
      return { ok: false, error: `Poll failed (${response.status})` };
    }

    const data = await response.json() as {
      status: string;
      text?: string;
      language_code?: string;
      utterances?: Array<{ speaker: string; start: number; end: number; text: string }>;
      error?: string;
    };

    if (data.status === 'completed') {
      const utterances: Utterance[] = (data.utterances || []).map((u) => ({
        speaker: u.speaker,
        startMs: u.start,
        endMs: u.end,
        text: u.text,
      }));

      return {
        ok: true,
        fullText: data.text || '',
        languageCode: data.language_code || 'unknown',
        utterances,
      };
    }

    if (data.status === 'error') {
      return { ok: false, error: data.error || 'Transcription failed.' };
    }

    sendProgress(jobId, 'transcribing', `Status: ${data.status}`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

export function registerAssemblyAIHandlers(): void {
  ipcMain.handle('assemblyai:validateKey', async (): Promise<{ ok: boolean; error?: string }> => {
    const apiKey = await getApiKey();
    if (!apiKey || apiKey.length < 10) {
      return { ok: false, error: 'Please paste your real AssemblyAI API key from the AssemblyAI dashboard.' };
    }

    console.log(`[assemblyai:validateKey] key length=${apiKey.length}, prefix=${apiKey.slice(0, 4)}...`);

    try {
      const response = await net.fetch('https://api.assemblyai.com/v2/transcript?limit=1', {
        method: 'GET',
        headers: { 'Authorization': apiKey },
      });

      if (response.status === 200) return { ok: true };
      if (response.status === 401) return { ok: false, error: 'Invalid API key. Check your key at assemblyai.com/app/account.' };
      return { ok: false, error: `Unexpected response (${response.status}).` };
    } catch (err: any) {
      return { ok: false, error: `Network error: ${err.message || 'Could not reach AssemblyAI.'}` };
    }
  });

  ipcMain.handle('assemblyai:transcribeFile', async (_event, filePath: string, jobId: string): Promise<TranscribeResult> => {
    const apiKey = await getApiKey();
    if (!apiKey || apiKey.length < 10) {
      return { ok: false, error: 'No API key saved.' };
    }

    if (!fs.existsSync(filePath)) {
      return { ok: false, error: 'File not found.' };
    }

    try {
      sendProgress(jobId, 'uploading');
      const uploadUrl = await uploadFile(filePath, apiKey);

      sendProgress(jobId, 'transcribing', 'Creating transcript...');
      const transcriptId = await createTranscript(uploadUrl, apiKey);

      const result = await pollTranscript(transcriptId, apiKey, jobId);
      sendProgress(jobId, result.ok ? 'done' : 'failed');
      return result;
    } catch (err: any) {
      sendProgress(jobId, 'failed');
      return { ok: false, error: err.message || 'Transcription failed.' };
    }
  });
}
