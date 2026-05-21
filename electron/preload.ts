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
});
