import { contextBridge, ipcRenderer } from 'electron';

export interface AudioFileMeta {
  id: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  extension: string;
  status: 'queued';
  createdAt: string;
}

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  openAudioFiles: (): Promise<AudioFileMeta[]> =>
    ipcRenderer.invoke('dialog:openAudioFiles'),
  settings: {
    get: (key: string): Promise<unknown> =>
      ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown): Promise<boolean> =>
      ipcRenderer.invoke('settings:set', key, value),
    delete: (key: string): Promise<boolean> =>
      ipcRenderer.invoke('settings:delete', key),
  },
  assemblyai: {
    validateKey: (): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('assemblyai:validateKey'),
    transcribeFile: (filePath: string, jobId: string): Promise<{
      ok: boolean;
      error?: string;
      fullText?: string;
      languageCode?: string;
      utterances?: Array<{ speaker: string; startMs: number; endMs: number; text: string }>;
    }> => ipcRenderer.invoke('assemblyai:transcribeFile', filePath, jobId),
    onProgress: (callback: (data: { jobId: string; stage: string; detail?: string }) => void) => {
      ipcRenderer.on('assemblyai:progress', (_event, data) => callback(data));
    },
    offProgress: () => {
      ipcRenderer.removeAllListeners('assemblyai:progress');
    },
  },
  summarize: {
    generate: (transcript: string, language: 'en' | 'ja', utterances?: Array<{ speaker: string; startMs: number; text: string }>): Promise<{
      ok: boolean;
      error?: string;
      summary?: string;
      pointNotes?: string[];
      actionItems?: string[];
      decisions?: string[];
      risks?: string[];
    }> => ipcRenderer.invoke('summarize:generate', { transcript, language, utterances }),
  },
  pdf: {
    exportReport: (data: {
      fileName: string;
      processedAt: string;
      languageCode: string;
      summary?: string;
      pointNotes?: string[];
      actionItems?: string[];
      decisions?: string[];
      risks?: string[];
      utterances?: Array<{ speaker: string; startMs: number; endMs: number; text: string }>;
      config?: any;
    }): Promise<{ ok: boolean; error?: string; filePath?: string }> =>
      ipcRenderer.invoke('pdf:exportReport', data),
    print: (data: {
      fileName: string;
      processedAt: string;
      languageCode: string;
      summary?: string;
      pointNotes?: string[];
      actionItems?: string[];
      decisions?: string[];
      risks?: string[];
      utterances?: Array<{ speaker: string; startMs: number; endMs: number; text: string }>;
      config?: any;
    }): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('pdf:print', data),
  },
  history: {
    load: (): Promise<any[]> => ipcRenderer.invoke('history:load'),
    save: (job: any): Promise<boolean> => ipcRenderer.invoke('history:save', job),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('history:delete', id),
    clear: (): Promise<boolean> => ipcRenderer.invoke('history:clear'),
  },
  document: {
    save: (fileId: string, data: any): Promise<boolean> => ipcRenderer.invoke('document:save', fileId, data),
    load: (fileId: string): Promise<any | null> => ipcRenderer.invoke('document:load', fileId),
    exists: (fileId: string): Promise<boolean> => ipcRenderer.invoke('document:exists', fileId),
  },
  storage: {
    stats: (): Promise<{
      historySize: number;
      transcriptCount: number;
      summaryCount: number;
      transcriptSize: number;
      summarySize: number;
      totalSize: number;
    }> => ipcRenderer.invoke('storage:stats'),
  },
  export: {
    saveTxt: (fileName: string, content: string): Promise<{ ok: boolean; error?: string; filePath?: string }> =>
      ipcRenderer.invoke('export:saveTxt', fileName, content),
    saveDocx: (fileName: string, data: any): Promise<{ ok: boolean; error?: string; filePath?: string }> =>
      ipcRenderer.invoke('export:saveDocx', fileName, data),
  },
  audio: {
    metadata: (filePath: string): Promise<{ ok: boolean; error?: string; metadata?: any; recommendation?: any }> =>
      ipcRenderer.invoke('audio:metadata', filePath),
    compress: (filePath: string): Promise<{ ok: boolean; error?: string; outputPath?: string; savedMB?: number }> =>
      ipcRenderer.invoke('audio:compress', filePath),
    split: (filePath: string, chunkMinutes?: number): Promise<{ ok: boolean; error?: string; chunks?: string[] }> =>
      ipcRenderer.invoke('audio:split', filePath, chunkMinutes),
    ffmpegCheck: (): Promise<{ ok: boolean; ffmpegPath?: string; ffprobePath?: string; error?: string }> =>
      ipcRenderer.invoke('audio:ffmpegCheck'),
  },
  longAudio: {
    analyze: (filePath: string): Promise<{ ok: boolean; error?: string; analysis?: any }> =>
      ipcRenderer.invoke('longaudio:analyze', filePath),
    start: (filePath: string, opts?: { concurrency?: number }): Promise<{ ok: boolean; error?: string; requiresChunking?: boolean; pipelineId?: string; totalChunks?: number; analysis?: any }> =>
      ipcRenderer.invoke('longaudio:start', filePath, opts),
    status: (pipelineId: string): Promise<{ ok: boolean; error?: string; status?: string; progress?: number; currentChunk?: number; totalChunks?: number; estimatedRemaining?: number; chunks?: any[] }> =>
      ipcRenderer.invoke('longaudio:status', pipelineId),
    nextChunk: (pipelineId: string): Promise<{ ok: boolean; error?: string; chunk?: any; allProcessed?: boolean }> =>
      ipcRenderer.invoke('longaudio:nextChunk', pipelineId),
    chunkDone: (pipelineId: string, chunkIndex: number, utterances: any[]): Promise<{ ok: boolean; error?: string; allDone?: boolean; progress?: number }> =>
      ipcRenderer.invoke('longaudio:chunkDone', pipelineId, chunkIndex, utterances),
    chunkFailed: (pipelineId: string, chunkIndex: number, error: string): Promise<{ ok: boolean; error?: string; canRetry?: boolean; retryCount?: number }> =>
      ipcRenderer.invoke('longaudio:chunkFailed', pipelineId, chunkIndex, error),
    getMerged: (pipelineId: string): Promise<{ ok: boolean; error?: string; partial?: boolean; transcript?: any }> =>
      ipcRenderer.invoke('longaudio:getMerged', pipelineId),
    resume: (pipelineId: string): Promise<{ ok: boolean; error?: string; pipelineId?: string; remainingChunks?: number; totalChunks?: number }> =>
      ipcRenderer.invoke('longaudio:resume', pipelineId),
    listRecoverable: (): Promise<{ ok: boolean; pipelines?: any[] }> =>
      ipcRenderer.invoke('longaudio:listRecoverable'),
    cleanup: (pipelineId: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('longaudio:cleanup', pipelineId),
    cancel: (pipelineId: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('longaudio:cancel', pipelineId),
    onProgress: (callback: (data: { pipelineId: string; progress: number; currentChunk: number; totalChunks: number; status: string }) => void) => {
      ipcRenderer.on('longaudio:progress', (_event, data) => callback(data));
    },
    offProgress: () => {
      ipcRenderer.removeAllListeners('longaudio:progress');
    },
  },
});
