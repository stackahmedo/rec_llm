import { ipcMain, net, BrowserWindow } from 'electron';
import fs from 'fs';
import { Readable } from 'stream';

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

async function uploadFileOnce(filePath: string, apiKey: string): Promise<string> {
  const stat = fs.statSync(filePath);
  const nodeStream = fs.createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const response = await net.fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(stat.size),
      },
      body: webStream,
      signal: controller.signal as AbortSignal,
      duplex: 'half',
    } as any);

    if (response.status !== 200) {
      throw new Error(`Upload failed (${response.status})`);
    }

    const data = await response.json() as { upload_url: string };
    return data.upload_url;
  } finally {
    clearTimeout(timeout);
    nodeStream.destroy();
  }
}

async function uploadFile(filePath: string, apiKey: string): Promise<string> {
  try {
    return await uploadFileOnce(filePath, apiKey);
  } catch (err: any) {
    // One retry on failure
    const msg = err.message || '';
    if (msg.includes('aborted') || msg.includes('Upload failed')) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return await uploadFileOnce(filePath, apiKey);
    }
    throw err;
  }
}

async function createTranscript(uploadUrl: string, apiKey: string): Promise<string> {
  const response = await net.fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: uploadUrl,
      speaker_labels: true,
    }),
  });

  if (response.status !== 200) {
    throw new Error(`Transcript creation failed (${response.status})`);
  }

  const data = await response.json() as { id: string };
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
