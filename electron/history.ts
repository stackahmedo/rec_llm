import { ipcMain, app } from 'electron';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(app.getPath('userData'), 'recllm-data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

interface HistoryJob {
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
  transcript?: {
    fullText: string;
    utterances: Array<{ speaker: string; startMs: number; endMs: number; text: string }>;
  };
  summary?: {
    language: string;
    summary: string;
    pointNotes: string[];
    actionItems: string[];
    decisions: string[];
    risks: string[];
    generatedAt: string;
  };
}

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readHistory(): HistoryJob[] {
  ensureDir();
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(raw) as HistoryJob[];
  } catch {
    return [];
  }
}

function writeHistory(jobs: HistoryJob[]): void {
  ensureDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(jobs, null, 2), 'utf-8');
}

export function registerHistoryHandlers(): void {
  ipcMain.handle('history:load', async (): Promise<HistoryJob[]> => {
    return readHistory();
  });

  ipcMain.handle('history:save', async (_event, job: HistoryJob): Promise<boolean> => {
    const jobs = readHistory();
    const idx = jobs.findIndex((j) => j.id === job.id);
    if (idx >= 0) {
      jobs[idx] = job;
    } else {
      jobs.unshift(job);
    }
    writeHistory(jobs);
    return true;
  });

  ipcMain.handle('history:delete', async (_event, id: string): Promise<boolean> => {
    const jobs = readHistory();
    const filtered = jobs.filter((j) => j.id !== id);
    writeHistory(filtered);
    return true;
  });

  ipcMain.handle('history:clear', async (): Promise<boolean> => {
    writeHistory([]);
    return true;
  });
}
