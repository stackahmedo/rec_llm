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
  suggestSpeakers: (utterances: Array<{ speaker: string; startMs: number; text: string }>) => Promise<{
    ok: boolean;
    error?: string;
    suggestions?: Array<{ speakerLabel: string; suggestedName: string; confidence: number; reason: string; evidenceTimestamp?: string }>;
  }>;
  chat: (question: string, transcriptContext: string, history?: Array<{ role: string; text: string }>) => Promise<{
    ok: boolean;
    error?: string;
    reply?: string;
  }>;
}

interface PdfHeaderConfig {
  enabled: boolean;
  mode: 'auto' | 'custom';
  title: string;
  subtitle: string;
  showFileName: boolean;
  showDate: boolean;
  showTime: boolean;
  showLogo: boolean;
  companyName: string;
  alignment: 'left' | 'center' | 'right';
}

interface PdfFooterConfig {
  enabled: boolean;
  mode: 'auto' | 'custom';
  text: string;
  showPageNumbers: boolean;
  showConfidential: boolean;
  showGeneratedBy: boolean;
  alignment: 'left' | 'center' | 'right';
}

interface PdfSpeakerConfig {
  id: string;
  displayName: string;
  color: string;
  enabled: boolean;
}

interface PdfExportConfig {
  pageSize: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  margin: 'small' | 'medium' | 'large';
  fontSize: 'small' | 'medium' | 'large';
  columns: 1 | 2;
  header: PdfHeaderConfig;
  footer: PdfFooterConfig;
  speakerColorsEnabled: boolean;
  speakers: PdfSpeakerConfig[];
  timeFormat: 'start' | 'start-end' | 'hidden';
  sections: {
    summary: boolean;
    keyPoints: boolean;
    actionItems: boolean;
    decisions: boolean;
    risks: boolean;
    transcript: boolean;
    appendix: boolean;
  };
}

interface PdfExportData {
  fileName: string;
  processedAt: string;
  languageCode: string;
  summary?: string;
  pointNotes?: string[];
  actionItems?: string[];
  decisions?: string[];
  risks?: string[];
  utterances?: Array<{ speaker: string; startMs: number; endMs: number; text: string }>;
  config?: PdfExportConfig;
}

interface ElectronPdf {
  exportReport: (data: PdfExportData) => Promise<{ ok: boolean; error?: string; filePath?: string }>;
  print: (data: PdfExportData) => Promise<{ ok: boolean; error?: string }>;
  previewHtml: (data: PdfExportData) => Promise<{ ok: boolean; error?: string; html?: string }>;
}

interface HistoryMetaPayload {
  id: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  status: 'done' | 'failed';
  languageCode: string;
  speakerCount: number;
  createdAt: string;
  completedAt: string;
  pdfPath?: string;
}

interface TranscriptPayload {
  fullText: string;
  utterances: Array<{ speaker: string; startMs: number; endMs: number; text: string }>;
}

interface SummaryPayload {
  language: string;
  summary: string;
  pointNotes: string[];
  actionItems: string[];
  decisions: string[];
  risks: string[];
  generatedAt: string;
}

interface HistoryJobPayload extends HistoryMetaPayload {
  transcript?: TranscriptPayload;
  summary?: SummaryPayload;
}

interface ElectronHistory {
  load: () => Promise<HistoryJobPayload[]>;
  loadTranscript: (id: string) => Promise<{ transcript?: TranscriptPayload; summary?: SummaryPayload } | null>;
  save: (job: HistoryJobPayload) => Promise<boolean>;
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

interface ExportDocxPayload {
  utterances: Array<{ speaker: string; startMs: number; text: string }>;
  languageCode: string;
  summary?: string;
  pointNotes?: string[];
}

interface ElectronExport {
  saveTxt: (fileName: string, content: string) => Promise<{ ok: boolean; error?: string; filePath?: string }>;
  saveDocx: (fileName: string, data: ExportDocxPayload) => Promise<{ ok: boolean; error?: string; filePath?: string }>;
  selectFolder: () => Promise<{ ok: boolean; path?: string }>;
}

interface AudioMetadataInfo {
  duration: number;
  codec: string;
  bitrate: number;
  sampleRate: number;
  channels: number;
  sizeBytes: number;
  format: string;
}

interface AudioRecommendation {
  action: 'direct' | 'compress' | 'split';
  reason: string;
  metadata: AudioMetadataInfo;
}

interface ElectronAudio {
  metadata: (filePath: string) => Promise<{
    ok: boolean;
    error?: string;
    metadata?: AudioMetadataInfo;
    recommendation?: AudioRecommendation;
  }>;
  compress: (filePath: string) => Promise<{ ok: boolean; error?: string; outputPath?: string; savedMB?: number }>;
  split: (filePath: string, chunkMinutes?: number) => Promise<{ ok: boolean; error?: string; chunks?: string[] }>;
  ffmpegCheck: () => Promise<{ ok: boolean; ffmpegPath?: string; ffprobePath?: string; error?: string }>;
}

interface DocumentData {
  [key: string]: unknown;
}

interface ElectronDocument {
  save: (fileId: string, data: DocumentData) => Promise<boolean>;
  load: (fileId: string) => Promise<DocumentData | null>;
  exists: (fileId: string) => Promise<boolean>;
}

interface AudioAnalysis {
  duration: number;
  sizeBytes: number;
  bitrate: number;
  sampleRate: number;
  channels: number;
  codec: string;
  format: string;
  requiresChunking: boolean;
  reason?: string;
  estimatedChunks?: number;
}

interface ChunkStatus {
  id: string;
  index: number;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'failed' | 'retrying';
  error?: string;
}

interface ChunkDetail {
  index: number;
  filePath: string;
  startTime: number;
  duration: number;
}

interface MergedTranscript {
  fullText: string;
  utterances: Array<{
    speaker: string;
    text: string;
    startMs: number;
    endMs: number;
    confidence: number;
    chunkIndex: number;
  }>;
  totalDuration: number;
  speakerCount: number;
  chunkCount: number;
}

interface RecoverablePipeline {
  id: string;
  fileName: string;
  status: string;
  progress: number;
  completedChunks: number;
  totalChunks: number;
  startedAt: number;
}

interface ElectronLongAudio {
  analyze: (filePath: string) => Promise<{ ok: boolean; error?: string; analysis?: AudioAnalysis }>;
  start: (filePath: string, opts?: { concurrency?: number }) => Promise<{ ok: boolean; error?: string; requiresChunking?: boolean; pipelineId?: string; totalChunks?: number; analysis?: AudioAnalysis }>;
  status: (pipelineId: string) => Promise<{ ok: boolean; error?: string; status?: string; progress?: number; currentChunk?: number; totalChunks?: number; estimatedRemaining?: number; chunks?: ChunkStatus[] }>;
  nextChunk: (pipelineId: string) => Promise<{ ok: boolean; error?: string; chunk?: ChunkDetail | null; allProcessed?: boolean }>;
  chunkDone: (pipelineId: string, chunkIndex: number, utterances: Array<{ speaker?: string; text?: string; start?: number; end?: number; startMs?: number; endMs?: number; confidence?: number }>) => Promise<{ ok: boolean; error?: string; allDone?: boolean; progress?: number }>;
  chunkFailed: (pipelineId: string, chunkIndex: number, error: string) => Promise<{ ok: boolean; error?: string; canRetry?: boolean; retryCount?: number }>;
  getMerged: (pipelineId: string) => Promise<{ ok: boolean; error?: string; partial?: boolean; transcript?: MergedTranscript }>;
  resume: (pipelineId: string) => Promise<{ ok: boolean; error?: string; pipelineId?: string; remainingChunks?: number; totalChunks?: number }>;
  listRecoverable: () => Promise<{ ok: boolean; pipelines?: RecoverablePipeline[] }>;
  cleanup: (pipelineId: string) => Promise<{ ok: boolean; error?: string }>;
  cancel: (pipelineId: string) => Promise<{ ok: boolean; error?: string }>;
  onProgress: (callback: (data: { pipelineId: string; progress: number; currentChunk: number; totalChunks: number; status: string }) => void) => void;
  offProgress: () => void;
}

interface ElectronAPI {
  platform: string;
  openAudioFiles: () => Promise<AudioFileMeta[]>;
  openAudioFolder: () => Promise<AudioFileMeta[]>;
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
