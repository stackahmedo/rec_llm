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
