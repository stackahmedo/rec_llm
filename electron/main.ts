import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { registerSettingsHandlers } from './settings';
import { registerAssemblyAIHandlers } from './assemblyai';
import { registerSummarizeHandlers } from './summarize';
import { registerPdfHandlers } from './pdf-export';
import { registerHistoryHandlers } from './history';
import { registerStorageStatsHandlers } from './storage-stats';
import { registerExportHandlers } from './export';
import { registerAudioPreprocessHandlers } from './audio-preprocess';
import { registerLongAudioHandlers } from './long-audio-pipeline';

const isDev = !app.isPackaged && !fs.existsSync(path.join(__dirname, '../dist/index.html'));

registerSettingsHandlers();
registerAssemblyAIHandlers();
registerSummarizeHandlers();
registerPdfHandlers();
registerHistoryHandlers();
registerStorageStatsHandlers();
registerExportHandlers();
registerAudioPreprocessHandlers();
registerLongAudioHandlers();

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'mp4', 'aac', 'flac'];

interface AudioFileMeta {
  id: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  extension: string;
  status: 'queued';
  createdAt: string;
}

ipcMain.handle('dialog:openAudioFiles', async (): Promise<AudioFileMeta[]> => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return [];

  const result = await dialog.showOpenDialog(win, {
    title: 'Select Audio Files',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Audio Files', extensions: AUDIO_EXTENSIONS },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) return [];

  const files: AudioFileMeta[] = result.filePaths
    .filter((fp) => {
      const ext = path.extname(fp).slice(1).toLowerCase();
      return AUDIO_EXTENSIONS.includes(ext);
    })
    .map((fp, i) => {
      const stat = fs.statSync(fp);
      return {
        id: `native-${Date.now()}-${i}`,
        fileName: path.basename(fp),
        filePath: fp,
        sizeBytes: stat.size,
        extension: path.extname(fp).slice(1).toLowerCase(),
        status: 'queued' as const,
        createdAt: new Date().toISOString(),
      };
    });

  return files;
});

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Block new window creation — redirect to external browser
  win.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Set Content-Security-Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev
      ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:* http://localhost:*; img-src 'self' data: blob:; font-src 'self' data:;"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.assemblyai.com https://generativelanguage.googleapis.com https://api.openai.com; img-src 'self' data: blob:; font-src 'self' data:;";

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
