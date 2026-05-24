import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron';
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
import { migrateFromElectronStore } from './credential-store';

// Global error handlers — prevent silent crashes, log safely (no secrets/file contents)
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(error.stack);
  }
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error('[WARN] Unhandled promise rejection:', msg);
  if (process.env.NODE_ENV !== 'production' && reason instanceof Error) {
    console.error(reason.stack);
  }
});

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
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Block new window creation — redirect to external browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Prevent navigation away from the app
  win.webContents.on('will-navigate', (event, url) => {
    const appOrigins = ['http://localhost:5173', `file://${path.join(__dirname, '../dist')}`];
    const isAppUrl = appOrigins.some((origin) => url.startsWith(origin)) || url.startsWith('file://');
    if (!isAppUrl) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Set Content-Security-Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev
      ? [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "connect-src 'self' ws://localhost:* http://localhost:*",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'none'",
        ].join('; ')
      : [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "connect-src 'self' https://api.assemblyai.com https://generativelanguage.googleapis.com https://api.openai.com",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'none'",
          "frame-ancestors 'none'",
        ].join('; ');

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

app.whenReady().then(async () => {
  await migrateFromElectronStore();
  createWindow();
});

// --- Safe shutdown and crash diagnostics ---

app.on('before-quit', () => {
  console.log('[recllm] App shutting down gracefully.');
});

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

process.on('unhandledRejection', (reason) => {
  console.error('[recllm] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[recllm] Uncaught exception:', error.message);
  // Do not call process.exit — let Electron handle cleanup
});
