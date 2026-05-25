import { contextBridge, ipcRenderer } from 'electron';
import type {
  HistoryJobPayload,
  TranscriptPayload,
  SummaryPayload,
  ExportDocxPayload,
  AudioMetadata,
  AudioRecommendation,
  AudioAnalysis,
  ChunkStatus,
  ChunkDetail,
  MergedTranscript,
  RecoverablePipeline,
  PdfExportData,
  DocumentData,
} from './shared/types';

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
  openAudioFolder: (): Promise<AudioFileMeta[]> =>
    ipcRenderer.invoke('dialog:openAudioFolder'),
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
    generate: (transcript: string, language: 'en' | 'ja', utterances?: Array<{ speaker: string; startMs: number; text: string }>): Promise<{
      ok: boolean;
      error?: string;
      summary?: string;
      pointNotes?: string[];
      actionItems?: string[];
      decisions?: string[];
      risks?: string[];
    }> => ipcRenderer.invoke('summarize:generate', { transcript, language, utterances }),
    suggestSpeakers: (utterances: Array<{ speaker: string; startMs: number; text: string }>): Promise<{
      ok: boolean;
      error?: string;
      suggestions?: Array<{ speakerLabel: string; suggestedName: string; confidence: number; reason: string; evidenceTimestamp?: string }>;
    }> => ipcRenderer.invoke('summarize:suggestSpeakers', { utterances }),
    chat: (question: string, transcriptContext: string, history?: Array<{ role: string; text: string }>): Promise<{
      ok: boolean;
      error?: string;
      reply?: string;
    }> => ipcRenderer.invoke('summarize:chat', { question, transcriptContext, history }),
  },
  pdf: {
    exportReport: (data: PdfExportData): Promise<{ ok: boolean; error?: string; filePath?: string }> =>
      ipcRenderer.invoke('pdf:exportReport', data),
    print: (data: PdfExportData): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('pdf:print', data),
    previewHtml: (data: PdfExportData): Promise<{ ok: boolean; error?: string; html?: string }> =>
      ipcRenderer.invoke('pdf:previewHtml', data),
  },
  history: {
    load: (): Promise<HistoryJobPayload[]> => ipcRenderer.invoke('history:load'),
    loadTranscript: (id: string): Promise<{ transcript?: TranscriptPayload; summary?: SummaryPayload } | null> => ipcRenderer.invoke('history:loadTranscript', id),
    save: (job: HistoryJobPayload): Promise<boolean> => ipcRenderer.invoke('history:save', job),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('history:delete', id),
    clear: (): Promise<boolean> => ipcRenderer.invoke('history:clear'),
  },
  document: {
    save: (fileId: string, data: DocumentData): Promise<boolean> => ipcRenderer.invoke('document:save', fileId, data),
    load: (fileId: string): Promise<DocumentData | null> => ipcRenderer.invoke('document:load', fileId),
    exists: (fileId: string): Promise<boolean> => ipcRenderer.invoke('document:exists', fileId),
  },
  storage: {
    stats: (): Promise<{
      historySize: number;
      transcriptCount: number;
      summaryCount: number;
      transcriptSize: number;
      summarySize: number;
      totalSize: number;
    }> => ipcRenderer.invoke('storage:stats'),
  },
  export: {
    saveTxt: (fileName: string, content: string): Promise<{ ok: boolean; error?: string; filePath?: string }> =>
      ipcRenderer.invoke('export:saveTxt', fileName, content),
    saveDocx: (fileName: string, data: ExportDocxPayload): Promise<{ ok: boolean; error?: string; filePath?: string }> =>
      ipcRenderer.invoke('export:saveDocx', fileName, data),
    selectFolder: (): Promise<{ ok: boolean; path?: string }> =>
      ipcRenderer.invoke('export:selectFolder'),
  },
  audio: {
    metadata: (filePath: string): Promise<{ ok: boolean; error?: string; metadata?: AudioMetadata; recommendation?: AudioRecommendation }> =>
      ipcRenderer.invoke('audio:metadata', filePath),
    compress: (filePath: string): Promise<{ ok: boolean; error?: string; outputPath?: string; savedMB?: number }> =>
      ipcRenderer.invoke('audio:compress', filePath),
    denoise: (filePath: string): Promise<{ ok: boolean; error?: string; outputPath?: string }> =>
      ipcRenderer.invoke('audio:denoise', filePath),
    split: (filePath: string, chunkMinutes?: number): Promise<{ ok: boolean; error?: string; chunks?: string[] }> =>
      ipcRenderer.invoke('audio:split', filePath, chunkMinutes),
    ffmpegCheck: (): Promise<{ ok: boolean; ffmpegPath?: string; ffprobePath?: string; error?: string }> =>
      ipcRenderer.invoke('audio:ffmpegCheck'),
  },
  longAudio: {
    analyze: (filePath: string): Promise<{ ok: boolean; error?: string; analysis?: AudioAnalysis }> =>
      ipcRenderer.invoke('longaudio:analyze', filePath),
    start: (filePath: string, opts?: { concurrency?: number }): Promise<{ ok: boolean; error?: string; requiresChunking?: boolean; pipelineId?: string; totalChunks?: number; analysis?: AudioAnalysis }> =>
      ipcRenderer.invoke('longaudio:start', filePath, opts),
    status: (pipelineId: string): Promise<{ ok: boolean; error?: string; status?: string; progress?: number; currentChunk?: number; totalChunks?: number; estimatedRemaining?: number; chunks?: ChunkStatus[] }> =>
      ipcRenderer.invoke('longaudio:status', pipelineId),
    nextChunk: (pipelineId: string): Promise<{ ok: boolean; error?: string; chunk?: ChunkDetail | null; allProcessed?: boolean }> =>
      ipcRenderer.invoke('longaudio:nextChunk', pipelineId),
    chunkDone: (pipelineId: string, chunkIndex: number, utterances: Array<{ speaker?: string; text?: string; start?: number; end?: number; startMs?: number; endMs?: number; confidence?: number }>): Promise<{ ok: boolean; error?: string; allDone?: boolean; progress?: number }> =>
      ipcRenderer.invoke('longaudio:chunkDone', pipelineId, chunkIndex, utterances),
    chunkFailed: (pipelineId: string, chunkIndex: number, error: string): Promise<{ ok: boolean; error?: string; canRetry?: boolean; retryCount?: number }> =>
      ipcRenderer.invoke('longaudio:chunkFailed', pipelineId, chunkIndex, error),
    getMerged: (pipelineId: string): Promise<{ ok: boolean; error?: string; partial?: boolean; transcript?: MergedTranscript }> =>
      ipcRenderer.invoke('longaudio:getMerged', pipelineId),
    resume: (pipelineId: string): Promise<{ ok: boolean; error?: string; pipelineId?: string; remainingChunks?: number; totalChunks?: number }> =>
      ipcRenderer.invoke('longaudio:resume', pipelineId),
    listRecoverable: (): Promise<{ ok: boolean; pipelines?: RecoverablePipeline[] }> =>
      ipcRenderer.invoke('longaudio:listRecoverable'),
    cleanup: (pipelineId: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('longaudio:cleanup', pipelineId),
    cancel: (pipelineId: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('longaudio:cancel', pipelineId),
    onProgress: (callback: (data: { pipelineId: string; progress: number; currentChunk: number; totalChunks: number; status: string }) => void) => {
      ipcRenderer.on('longaudio:progress', (_event, data) => callback(data));
    },
    offProgress: () => {
      ipcRenderer.removeAllListeners('longaudio:progress');
    },
  },
});
