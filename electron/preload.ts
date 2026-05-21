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
  },
});
