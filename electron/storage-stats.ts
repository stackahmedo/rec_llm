import { ipcMain, app } from 'electron';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(app.getPath('userData'), 'recllm-data');
const TRANSCRIPTS_DIR = path.join(DATA_DIR, 'transcripts');
const SUMMARIES_DIR = path.join(DATA_DIR, 'summaries');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

function countFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

function fileSize(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function dirSize(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  try {
    return fs.readdirSync(dir).reduce((sum, f) => {
      const fp = path.join(dir, f);
      try { return sum + fs.statSync(fp).size; } catch { return sum; }
    }, 0);
  } catch {
    return 0;
  }
}

export function registerStorageStatsHandlers(): void {
  ipcMain.handle('storage:stats', async (): Promise<{
    historySize: number;
    transcriptCount: number;
    summaryCount: number;
    transcriptSize: number;
    summarySize: number;
    totalSize: number;
  }> => {
    const historySize = fileSize(HISTORY_FILE);
    const transcriptCount = countFiles(TRANSCRIPTS_DIR);
    const summaryCount = countFiles(SUMMARIES_DIR);
    const transcriptSize = dirSize(TRANSCRIPTS_DIR);
    const summarySize = dirSize(SUMMARIES_DIR);
    const totalSize = historySize + transcriptSize + summarySize;

    return { historySize, transcriptCount, summaryCount, transcriptSize, summarySize, totalSize };
  });
}
