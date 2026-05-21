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
    generate: (transcript: string, language: 'en' | 'ja'): Promise<{
      ok: boolean;
      error?: string;
      summary?: string;
      pointNotes?: string[];
      actionItems?: string[];
      decisions?: string[];
      risks?: string[];
    }> => ipcRenderer.invoke('summarize:generate', { transcript, language }),
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
    }): Promise<{ ok: boolean; error?: string; filePath?: string }> =>
      ipcRenderer.invoke('pdf:exportReport', data),
  },
  history: {
    load: (): Promise<any[]> => ipcRenderer.invoke('history:load'),
    save: (job: any): Promise<boolean> => ipcRenderer.invoke('history:save', job),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('history:delete', id),
    clear: (): Promise<boolean> => ipcRenderer.invoke('history:clear'),
  },
});
