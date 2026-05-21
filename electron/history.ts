import { ipcMain, app } from 'electron';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(app.getPath('userData'), 'recllm-data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const TRANSCRIPTS_DIR = path.join(DATA_DIR, 'transcripts');
const SUMMARIES_DIR = path.join(DATA_DIR, 'summaries');

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
  utterances: Array<{ speaker: string; startMs: number; endMs: number; text: string }>;
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

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readHistoryMeta(): HistoryMeta[] {
  ensureDir(DATA_DIR);
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(raw) as HistoryMeta[];
  } catch {
    return [];
  }
}

function writeHistoryMeta(jobs: HistoryMeta[]): void {
  ensureDir(DATA_DIR);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(jobs, null, 2), 'utf-8');
}

function transcriptPath(id: string): string {
  return path.join(TRANSCRIPTS_DIR, `${id}.json`);
}

function summaryPath(id: string): string {
  return path.join(SUMMARIES_DIR, `${id}.json`);
}

function readTranscript(id: string): TranscriptData | undefined {
  const p = transcriptPath(id);
  if (!fs.existsSync(p)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as TranscriptData;
  } catch {
    return undefined;
  }
}

function readSummary(id: string): SummaryData | undefined {
  const p = summaryPath(id);
  if (!fs.existsSync(p)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as SummaryData;
  } catch {
    return undefined;
  }
}

function writeTranscript(id: string, data: TranscriptData): void {
  ensureDir(TRANSCRIPTS_DIR);
  fs.writeFileSync(transcriptPath(id), JSON.stringify(data), 'utf-8');
}

function writeSummary(id: string, data: SummaryData): void {
  ensureDir(SUMMARIES_DIR);
  fs.writeFileSync(summaryPath(id), JSON.stringify(data), 'utf-8');
}

export function registerHistoryHandlers(): void {
  ipcMain.handle('history:load', async (): Promise<HistoryJob[]> => {
    const metas = readHistoryMeta();
    return metas.map((meta) => ({
      ...meta,
      transcript: readTranscript(meta.id),
      summary: readSummary(meta.id),
    }));
  });

  ipcMain.handle('history:save', async (_event, job: HistoryJob): Promise<boolean> => {
    const metas = readHistoryMeta();
    const { transcript, summary, ...meta } = job;

    const idx = metas.findIndex((j) => j.id === meta.id);
    if (idx >= 0) {
      metas[idx] = meta;
    } else {
      metas.unshift(meta);
    }
    writeHistoryMeta(metas);

    if (transcript) {
      writeTranscript(meta.id, transcript);
    }
    if (summary) {
      writeSummary(meta.id, summary);
    }

    return true;
  });

  ipcMain.handle('history:delete', async (_event, id: string): Promise<boolean> => {
    const metas = readHistoryMeta();
    const filtered = metas.filter((j) => j.id !== id);
    writeHistoryMeta(filtered);

    // Clean up per-job files
    const tp = transcriptPath(id);
    const sp = summaryPath(id);
    if (fs.existsSync(tp)) fs.unlinkSync(tp);
    if (fs.existsSync(sp)) fs.unlinkSync(sp);

    return true;
  });

  ipcMain.handle('history:clear', async (): Promise<boolean> => {
    writeHistoryMeta([]);
    // Clean up all transcript/summary files
    if (fs.existsSync(TRANSCRIPTS_DIR)) {
      for (const f of fs.readdirSync(TRANSCRIPTS_DIR)) {
        fs.unlinkSync(path.join(TRANSCRIPTS_DIR, f));
      }
    }
    if (fs.existsSync(SUMMARIES_DIR)) {
      for (const f of fs.readdirSync(SUMMARIES_DIR)) {
        fs.unlinkSync(path.join(SUMMARIES_DIR, f));
      }
    }
    return true;
  });
}
