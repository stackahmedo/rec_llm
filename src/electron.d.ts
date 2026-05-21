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
  generate: (transcript: string, language: 'en' | 'ja', utterances?: Array<{ speaker: string; startMs: number; text: string }>) => Promise<{
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

interface ElectronHistory {
  load: () => Promise<any[]>;
  save: (job: any) => Promise<boolean>;
  delete: (id: string) => Promise<boolean>;
  clear: () => Promise<boolean>;
}

interface ElectronStorage {
  stats: () => Promise<{
    historySize: number;
    transcriptCount: number;
    summaryCount: number;
    transcriptSize: number;
    summarySize: number;
    totalSize: number;
  }>;
}

interface ElectronAPI {
  platform: string;
  openAudioFiles: () => Promise<AudioFileMeta[]>;
  settings: ElectronSettings;
  assemblyai: ElectronAssemblyAI;
  summarize: ElectronSummarize;
  pdf: ElectronPdf;
  history: ElectronHistory;
  storage: ElectronStorage;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
