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

interface ElectronAssemblyAI {
  validateKey: () => Promise<{ ok: boolean; error?: string }>;
  transcribeFile: (filePath: string, jobId: string) => Promise<{
    ok: boolean;
    error?: string;
    fullText?: string;
    languageCode?: string;
    utterances?: Array<{ speaker: string; startMs: number; endMs: number; text: string }>;
  }>;
  onProgress: (callback: (data: { jobId: string; stage: string; detail?: string }) => void) => void;
  offProgress: () => void;
}

interface ElectronSummarize {
  generate: (transcript: string, language: 'en' | 'ja') => Promise<{
    ok: boolean;
    error?: string;
    summary?: string;
    pointNotes?: string[];
    actionItems?: string[];
    decisions?: string[];
    risks?: string[];
  }>;
}

interface ElectronPdf {
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
  }) => Promise<{ ok: boolean; error?: string; filePath?: string }>;
}

interface ElectronAPI {
  platform: string;
  openAudioFiles: () => Promise<AudioFileMeta[]>;
  settings: ElectronSettings;
  assemblyai: ElectronAssemblyAI;
  summarize: ElectronSummarize;
  pdf: ElectronPdf;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
