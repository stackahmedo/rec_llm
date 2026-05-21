import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";

export interface Utterance {
  speaker: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface SummaryResult {
  fileId: string;
  language: 'en' | 'ja';
  summary: string;
  pointNotes: string[];
  actionItems: string[];
  decisions: string[];
  risks: string[];
  generatedAt: string;
}

export interface TranscriptResult {
  fileId: string;
  fileName: string;
  fullText: string;
  languageCode: string;
  utterances: Utterance[];
  completedAt: string;
}

export interface HistoryJob {
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

interface TranscriptStore {
  transcripts: TranscriptResult[];
  summaries: SummaryResult[];
  history: HistoryJob[];
  activeId: string | null;
  addTranscript: (result: TranscriptResult) => void;
  addSummary: (result: SummaryResult) => void;
  addHistoryJob: (job: HistoryJob) => void;
  setActiveId: (id: string | null) => void;
  getActive: () => TranscriptResult | null;
  getActiveSummary: () => SummaryResult | null;
  loadHistory: () => Promise<void>;
}

const Ctx = createContext<TranscriptStore>({
  transcripts: [],
  summaries: [],
  history: [],
  activeId: null,
  addTranscript: () => {},
  addSummary: () => {},
  addHistoryJob: () => {},
  setActiveId: () => {},
  getActive: () => null,
  getActiveSummary: () => null,
  loadHistory: async () => {},
});

export function TranscriptProvider({ children }: { children: ReactNode }) {
  const [transcripts, setTranscripts] = useState<TranscriptResult[]>([]);
  const [summaries, setSummaries] = useState<SummaryResult[]>([]);
  const [history, setHistory] = useState<HistoryJob[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const api = window.electronAPI?.history;
    if (!api) return;
    const jobs = await api.load();
    const historyJobs: HistoryJob[] = [];
    const loadedTranscripts: TranscriptResult[] = [];
    const loadedSummaries: SummaryResult[] = [];

    for (const job of jobs) {
      historyJobs.push({
        id: job.id,
        fileName: job.fileName,
        filePath: job.filePath,
        sizeBytes: job.sizeBytes,
        status: job.status,
        languageCode: job.languageCode,
        speakerCount: job.speakerCount,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        pdfPath: job.pdfPath,
      });
      if (job.transcript) {
        loadedTranscripts.push({
          fileId: job.id,
          fileName: job.fileName,
          fullText: job.transcript.fullText,
          languageCode: job.languageCode,
          utterances: job.transcript.utterances,
          completedAt: job.completedAt,
        });
      }
      if (job.summary) {
        loadedSummaries.push({
          fileId: job.id,
          language: job.summary.language as 'en' | 'ja',
          summary: job.summary.summary,
          pointNotes: job.summary.pointNotes,
          actionItems: job.summary.actionItems,
          decisions: job.summary.decisions,
          risks: job.summary.risks,
          generatedAt: job.summary.generatedAt,
        });
      }
    }

    setHistory(historyJobs);
    setTranscripts(loadedTranscripts);
    setSummaries(loadedSummaries);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const addTranscript = useCallback((result: TranscriptResult) => {
    setTranscripts((prev) => {
      const existing = prev.findIndex((t) => t.fileId === result.fileId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = result;
        return updated;
      }
      return [...prev, result];
    });
    setActiveId(result.fileId);
  }, []);

  const addSummary = useCallback((result: SummaryResult) => {
    setSummaries((prev) => {
      const existing = prev.findIndex((s) => s.fileId === result.fileId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = result;
        return updated;
      }
      return [...prev, result];
    });
  }, []);

  const addHistoryJob = useCallback((job: HistoryJob) => {
    setHistory((prev) => {
      const existing = prev.findIndex((h) => h.id === job.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = job;
        return updated;
      }
      return [job, ...prev];
    });
  }, []);

  const getActive = useCallback(() => {
    if (!activeId) return null;
    return transcripts.find((t) => t.fileId === activeId) || null;
  }, [activeId, transcripts]);

  const getActiveSummary = useCallback(() => {
    if (!activeId) return null;
    return summaries.find((s) => s.fileId === activeId) || null;
  }, [activeId, summaries]);

  return (
    <Ctx.Provider value={{ transcripts, summaries, history, activeId, addTranscript, addSummary, addHistoryJob, setActiveId, getActive, getActiveSummary, loadHistory }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTranscripts = () => useContext(Ctx);
