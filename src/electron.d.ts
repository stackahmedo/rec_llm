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
    config?: any;
  }) => Promise<{ ok: boolean; error?: string; filePath?: string }>;
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
  }) => Promise<{ ok: boolean; error?: string }>;
}

interface ElectronHistory {
  load: () => Promise<any[]>;
  loadTranscript: (id: string) => Promise<any | null>;
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

interface ElectronExport {
  saveTxt: (fileName: string, content: string) => Promise<{ ok: boolean; error?: string; filePath?: string }>;
  saveDocx: (fileName: string, data: any) => Promise<{ ok: boolean; error?: string; filePath?: string }>;
  selectFolder: () => Promise<{ ok: boolean; path?: string }>;
}

interface ElectronAudio {
  metadata: (filePath: string) => Promise<{
    ok: boolean;
    error?: string;
    metadata?: {
      duration: number;
      codec: string;
      bitrate: number;
      sampleRate: number;
      channels: number;
      sizeBytes: number;
      format: string;
    };
    recommendation?: {
      action: 'direct' | 'compress' | 'split';
      reason: string;
      metadata: any;
    };
  }>;
  compress: (filePath: string) => Promise<{ ok: boolean; error?: string; outputPath?: string; savedMB?: number }>;
  split: (filePath: string, chunkMinutes?: number) => Promise<{ ok: boolean; error?: string; chunks?: string[] }>;
  ffmpegCheck: () => Promise<{ ok: boolean; ffmpegPath?: string; ffprobePath?: string; error?: string }>;
}

interface ElectronDocument {
  save: (fileId: string, data: any) => Promise<boolean>;
  load: (fileId: string) => Promise<any | null>;
  exists: (fileId: string) => Promise<boolean>;
}

interface ElectronLongAudio {
  analyze: (filePath: string) => Promise<{ ok: boolean; error?: string; analysis?: any }>;
  start: (filePath: string, opts?: { concurrency?: number }) => Promise<{ ok: boolean; error?: string; requiresChunking?: boolean; pipelineId?: string; totalChunks?: number; analysis?: any }>;
  status: (pipelineId: string) => Promise<{ ok: boolean; error?: string; status?: string; progress?: number; currentChunk?: number; totalChunks?: number; estimatedRemaining?: number; chunks?: any[] }>;
  nextChunk: (pipelineId: string) => Promise<{ ok: boolean; error?: string; chunk?: any; allProcessed?: boolean }>;
  chunkDone: (pipelineId: string, chunkIndex: number, utterances: any[]) => Promise<{ ok: boolean; error?: string; allDone?: boolean; progress?: number }>;
  chunkFailed: (pipelineId: string, chunkIndex: number, error: string) => Promise<{ ok: boolean; error?: string; canRetry?: boolean; retryCount?: number }>;
  getMerged: (pipelineId: string) => Promise<{ ok: boolean; error?: string; partial?: boolean; transcript?: any }>;
  resume: (pipelineId: string) => Promise<{ ok: boolean; error?: string; pipelineId?: string; remainingChunks?: number; totalChunks?: number }>;
  listRecoverable: () => Promise<{ ok: boolean; pipelines?: any[] }>;
  cleanup: (pipelineId: string) => Promise<{ ok: boolean; error?: string }>;
  cancel: (pipelineId: string) => Promise<{ ok: boolean; error?: string }>;
  onProgress: (callback: (data: { pipelineId: string; progress: number; currentChunk: number; totalChunks: number; status: string }) => void) => void;
  offProgress: () => void;
}

interface ElectronAPI {
  platform: string;
  openAudioFiles: () => Promise<AudioFileMeta[]>;
  settings: ElectronSettings;
  assemblyai: ElectronAssemblyAI;
  summarize: ElectronSummarize;
  pdf: ElectronPdf;
  history: ElectronHistory;
  document: ElectronDocument;
  storage: ElectronStorage;
  export: ElectronExport;
  audio: ElectronAudio;
  longAudio: ElectronLongAudio;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
