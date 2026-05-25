/**
 * Folder Watcher Service
 *
 * Watches a configured folder for new audio files and emits events
 * when new files are detected. Uses Node.js fs.watch (no external deps).
 */

import { ipcMain, app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { writeLog } from './history';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.mp4', '.aac', '.flac', '.ogg', '.wma']);
const POLL_INTERVAL_MS = 5000; // Check every 5 seconds
const DEBOUNCE_MS = 2000; // Wait 2s after file appears (ensure write is complete)

interface WatcherState {
  active: boolean;
  folderPath: string | null;
  knownFiles: Set<string>;
  pollTimer: NodeJS.Timeout | null;
}

const state: WatcherState = {
  active: false,
  folderPath: null,
  knownFiles: new Set(),
  pollTimer: null,
};

function isAudioFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return AUDIO_EXTENSIONS.has(ext);
}

function scanFolder(folderPath: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);
      if (entry.isDirectory()) {
        // Recursive scan
        results.push(...scanFolder(fullPath));
      } else if (entry.isFile() && isAudioFile(entry.name)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Folder may have been deleted or permissions changed
  }
  return results;
}

function getFileStableSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return -1;
  }
}

async function checkForNewFiles(): Promise<void> {
  if (!state.active || !state.folderPath) return;

  const currentFiles = scanFolder(state.folderPath);
  const newFiles: string[] = [];

  for (const file of currentFiles) {
    if (!state.knownFiles.has(file)) {
      // Verify file is not still being written (size stable)
      const size1 = getFileStableSize(file);
      if (size1 <= 0) continue;

      // Wait briefly and check again
      await new Promise((r) => setTimeout(r, DEBOUNCE_MS));
      const size2 = getFileStableSize(file);

      if (size2 === size1 && size2 > 0) {
        // File is stable — it's a new complete file
        newFiles.push(file);
        state.knownFiles.add(file);
      }
      // If sizes differ, file is still being written — skip this cycle, catch next time
    }
  }

  // Remove files that no longer exist from known set
  for (const known of state.knownFiles) {
    if (!fs.existsSync(known)) {
      state.knownFiles.delete(known);
    }
  }

  // Notify renderer of new files
  if (newFiles.length > 0) {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      const fileMetas = newFiles.map((filePath) => {
        const stat = fs.statSync(filePath);
        const ext = path.extname(filePath).slice(1).toLowerCase();
        return {
          id: `watch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          fileName: path.basename(filePath),
          filePath,
          sizeBytes: stat.size,
          extension: ext,
        };
      });
      win.webContents.send('watcher:newFiles', fileMetas);
      await writeLog('INFO', `Folder watcher detected ${newFiles.length} new file(s)`, newFiles.map((f) => path.basename(f)).join(', '));
    }
  }
}

function startPolling(): void {
  if (state.pollTimer) return;
  state.pollTimer = setInterval(() => {
    checkForNewFiles().catch(() => {});
  }, POLL_INTERVAL_MS);
}

function stopPolling(): void {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

export function registerFolderWatcherHandlers(): void {
  ipcMain.handle('watcher:start', async (_event, folderPath: unknown): Promise<{ ok: boolean; error?: string; fileCount?: number }> => {
    if (typeof folderPath !== 'string' || !folderPath) {
      return { ok: false, error: 'Invalid folder path' };
    }
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      return { ok: false, error: 'Folder does not exist' };
    }

    // Initialize known files (don't trigger for existing files)
    const existingFiles = scanFolder(folderPath);
    state.knownFiles = new Set(existingFiles);
    state.folderPath = folderPath;
    state.active = true;

    startPolling();
    await writeLog('INFO', `Folder watcher started`, `path=${folderPath} existing=${existingFiles.length}`);

    return { ok: true, fileCount: existingFiles.length };
  });

  ipcMain.handle('watcher:stop', async (): Promise<{ ok: boolean }> => {
    state.active = false;
    state.folderPath = null;
    state.knownFiles.clear();
    stopPolling();
    await writeLog('INFO', 'Folder watcher stopped');
    return { ok: true };
  });

  ipcMain.handle('watcher:status', async (): Promise<{ active: boolean; folderPath: string | null; knownFileCount: number }> => {
    return {
      active: state.active,
      folderPath: state.folderPath,
      knownFileCount: state.knownFiles.size,
    };
  });
}
