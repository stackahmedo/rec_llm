interface AudioFileMeta {
  id: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  extension: string;
  status: 'queued';
  createdAt: string;
}

interface ElectronSettings {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<boolean>;
  delete: (key: string) => Promise<boolean>;
}

interface ElectronAPI {
  platform: string;
  openAudioFiles: () => Promise<AudioFileMeta[]>;
  settings: ElectronSettings;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
