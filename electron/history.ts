import { ipcMain, app } from 'electron';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { historyJobSchema, idSchema, documentIdSchema, validateSchema } from './shared/schemas';

const DATA_DIR = path.join(app.getPath('userData'), 'recllm-data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const TRANSCRIPTS_DIR = path.join(DATA_DIR, 'transcripts');
const SUMMARIES_DIR = path.join(DATA_DIR, 'summaries');
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents');

// Sanitize IDs to prevent path traversal — allow only alphanumeric, dash, underscore, dot
function sanitizeId(id: string): string {
  const sanitized = id.replace(/[^a-zA-Z0-9_\-\.]/g, '');
  if (!sanitized || sanitized.startsWith('.')) {
    throw new Error(`Invalid ID: "${id}"`);
  }
  return sanitized;
}

interface HistoryMeta {
  id: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  status: 'done' | 'failed';
  languageCode: string;
  speakerCount: number;
  createdAt: string;
  completedAt: string;
  pdfPath?: string;
}

interface TranscriptData {
  fullText: string;
  utterances: Array<{ speaker: string; startMs: number; endMs: number; text: string; gender?: string; ageRange?: string; pitchHz?: number }>;
}

interface SummaryData {
  language: string;
  summary: string;
  pointNotes: string[];
  actionItems: string[];
  decisions: string[];
  risks: string[];
  generatedAt: string;
}

interface HistoryJob extends HistoryMeta {
  transcript?: TranscriptData;
  summary?: SummaryData;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readHistoryMeta(): Promise<HistoryMeta[]> {
  await ensureDir(DATA_DIR);
  try {
    const raw = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(raw) as HistoryMeta[];
  } catch {
    return [];
  }
}

async function writeHistoryMeta(jobs: HistoryMeta[]): Promise<void> {
  await ensureDir(DATA_DIR);
  await fs.writeFile(HISTORY_FILE, JSON.stringify(jobs, null, 2), 'utf-8');
}

function transcriptPath(id: string): string {
  const safeId = sanitizeId(id);
  return path.join(TRANSCRIPTS_DIR, `${safeId}.json`);
}

function summaryPath(id: string): string {
  const safeId = sanitizeId(id);
  return path.join(SUMMARIES_DIR, `${safeId}.json`);
}

async function readTranscript(id: string): Promise<TranscriptData | undefined> {
  const p = transcriptPath(id);
  try {
    const raw = await fs.readFile(p, 'utf-8');
    return JSON.parse(raw) as TranscriptData;
  } catch {
    return undefined;
  }
}

async function readSummary(id: string): Promise<SummaryData | undefined> {
  const p = summaryPath(id);
  try {
    const raw = await fs.readFile(p, 'utf-8');
    return JSON.parse(raw) as SummaryData;
  } catch {
    return undefined;
  }
}

async function writeTranscript(id: string, data: TranscriptData): Promise<void> {
  await ensureDir(TRANSCRIPTS_DIR);
  await fs.writeFile(transcriptPath(id), JSON.stringify(data), 'utf-8');
  await writeTranscriptTxt(id, data);
}

async function writeTranscriptTxt(id: string, data: TranscriptData): Promise<void> {
  await ensureDir(TRANSCRIPTS_DIR);
  const safeId = sanitizeId(id);
  const txtPath = path.join(TRANSCRIPTS_DIR, `${safeId}.txt`);
  const lines = data.utterances.map((u) => {
    const ts = msToTimestamp(u.startMs);
    return `[${ts}] ${u.speaker}: ${u.text}`;
  });
  await fs.writeFile(txtPath, lines.join('\n'), 'utf-8');
}

function msToTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

async function writeSummary(id: string, data: SummaryData): Promise<void> {
  await ensureDir(SUMMARIES_DIR);
  await fs.writeFile(summaryPath(id), JSON.stringify(data), 'utf-8');
}

export function registerHistoryHandlers(): void {
  ipcMain.handle('history:load', async (): Promise<HistoryJob[]> => {
    const metas = await readHistoryMeta();
    return metas.map((meta) => ({ ...meta }));
  });

  ipcMain.handle('history:loadTranscript', async (_event, id: unknown): Promise<{ transcript?: TranscriptData; summary?: SummaryData } | null> => {
    const v = validateSchema(idSchema, id);
    if (!v.ok) return null;
    try {
      const safeId = sanitizeId(v.data);
      const transcript = await readTranscript(safeId);
      const summary = await readSummary(safeId);
      if (!transcript && !summary) return null;
      return { transcript, summary };
    } catch {
      return null;
    }
  });

  ipcMain.handle('history:save', async (_event, job: unknown): Promise<boolean> => {
    const v = validateSchema(historyJobSchema, job);
    if (!v.ok) return false;
    try {
      const safeId = sanitizeId(v.data.id);
      const metas = await readHistoryMeta();
      const { transcript, summary, ...meta } = v.data;
      meta.id = safeId;

      const idx = metas.findIndex((j) => j.id === safeId);
      if (idx >= 0) {
        metas[idx] = meta;
      } else {
        metas.unshift(meta);
      }
      await writeHistoryMeta(metas);

      if (transcript) {
        await writeTranscript(safeId, transcript);
      }
      if (summary) {
        await writeSummary(safeId, summary);
      }

      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('history:delete', async (_event, id: unknown): Promise<boolean> => {
    const v = validateSchema(idSchema, id);
    if (!v.ok) return false;
    try {
      const safeId = sanitizeId(v.data);
      const metas = await readHistoryMeta();
      const filtered = metas.filter((j) => j.id !== safeId);
      await writeHistoryMeta(filtered);

      const tp = transcriptPath(safeId);
      const sp = summaryPath(safeId);
      await fs.unlink(tp).catch(() => {});
      await fs.unlink(sp).catch(() => {});

      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('history:clear', async (): Promise<boolean> => {
    await writeHistoryMeta([]);
    try {
      const transcriptFiles = await fs.readdir(TRANSCRIPTS_DIR);
      for (const f of transcriptFiles) {
        await fs.unlink(path.join(TRANSCRIPTS_DIR, f));
      }
    } catch {}
    try {
      const summaryFiles = await fs.readdir(SUMMARIES_DIR);
      for (const f of summaryFiles) {
        await fs.unlink(path.join(SUMMARIES_DIR, f));
      }
    } catch {}
    return true;
  });

  // --- Document edit persistence ---
  ipcMain.handle('document:save', async (_event, fileId: unknown, data: unknown): Promise<boolean> => {
    const v = validateSchema(documentIdSchema, fileId);
    if (!v.ok) return false;
    try {
      const safeId = sanitizeId(v.data);
      await ensureDir(DOCUMENTS_DIR);
      const docPath = path.join(DOCUMENTS_DIR, `${safeId}.json`);
      await fs.writeFile(docPath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('document:load', async (_event, fileId: unknown): Promise<unknown | null> => {
    const v = validateSchema(documentIdSchema, fileId);
    if (!v.ok) return null;
    try {
      const safeId = sanitizeId(v.data);
      const docPath = path.join(DOCUMENTS_DIR, `${safeId}.json`);
      const raw = await fs.readFile(docPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  ipcMain.handle('document:exists', async (_event, fileId: unknown): Promise<boolean> => {
    const v = validateSchema(documentIdSchema, fileId);
    if (!v.ok) return false;
    try {
      const safeId = sanitizeId(v.data);
      const docPath = path.join(DOCUMENTS_DIR, `${safeId}.json`);
      await fs.access(docPath);
      return true;
    } catch {
      return false;
    }
  });
}
