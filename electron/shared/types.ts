export interface IpcSuccess<T = unknown> {
  ok: true;
  data: T;
}

export interface IpcError {
  ok: false;
  error: string;
  code?: string;
}

export type IpcResult<T = unknown> = IpcSuccess<T> | IpcError;

export function ipcOk<T>(data: T): IpcSuccess<T> {
  return { ok: true, data };
}

export function ipcErr(error: string, code?: string): IpcError {
  return { ok: false, error, code };
}

export interface HistoryMetaPayload {
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

export interface TranscriptPayload {
  fullText: string;
  utterances: Array<{ speaker: string; startMs: number; endMs: number; text: string }>;
}

export interface SummaryPayload {
  language: string;
  summary: string;
  pointNotes: string[];
  actionItems: string[];
  decisions: string[];
  risks: string[];
  generatedAt: string;
}

export interface HistoryJobPayload extends HistoryMetaPayload {
  transcript?: TranscriptPayload;
  summary?: SummaryPayload;
}

export interface SummarizeRequestPayload {
  transcript: string;
  utterances?: Array<{ speaker: string; startMs: number; text: string }>;
  language: 'en' | 'ja';
}

export interface ExportDocxPayload {
  utterances: Array<{ speaker: string; startMs: number; text: string }>;
  languageCode: string;
  summary?: string;
  pointNotes?: string[];
}

// --- Audio types ---

export interface AudioMetadata {
  duration: number;
  codec: string;
  bitrate: number;
  sampleRate: number;
  channels: number;
  sizeBytes: number;
  format: string;
}

export interface AudioRecommendation {
  action: 'direct' | 'compress' | 'split';
  reason: string;
  metadata: AudioMetadata;
}

// --- Long-audio types ---

export interface AudioAnalysis {
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

export interface ChunkStatus {
  id: string;
  index: number;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'failed' | 'retrying';
  error?: string;
}

export interface ChunkDetail {
  index: number;
  filePath: string;
  startTime: number;
  duration: number;
}

export interface MergedTranscript {
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

export interface RecoverablePipeline {
  id: string;
  fileName: string;
  status: string;
  progress: number;
  completedChunks: number;
  totalChunks: number;
  startedAt: number;
}

// --- PDF config types ---

export interface PdfHeaderConfig {
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

export interface PdfFooterConfig {
  enabled: boolean;
  mode: 'auto' | 'custom';
  text: string;
  showPageNumbers: boolean;
  showConfidential: boolean;
  showGeneratedBy: boolean;
  alignment: 'left' | 'center' | 'right';
}

export interface PdfSpeakerConfig {
  id: string;
  displayName: string;
  color: string;
  enabled: boolean;
}

export interface PdfExportConfig {
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

export interface PdfExportData {
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

// --- Document types ---

export interface DocumentData {
  [key: string]: unknown;
}

// --- Settings store shape ---

export interface AppSettings {
  models?: Record<string, string>;
  preferences?: Record<string, unknown>;
  exportFolder?: string;
  openaiProvider?: { providerType?: string; baseUrl?: string };
}
