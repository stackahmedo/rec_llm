import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from "react";

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
  loadTranscriptData: (fileId: string) => Promise<void>;
  isLoadingTranscript: boolean;
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
  loadTranscriptData: async () => {},
  isLoadingTranscript: false,
});

// Maximum number of transcripts to keep in memory at once
const MAX_CACHED_TRANSCRIPTS = 3;

export function TranscriptProvider({ children }: { children: ReactNode }) {
  const [transcripts, setTranscripts] = useState<TranscriptResult[]>([]);
  const [summaries, setSummaries] = useState<SummaryResult[]>([]);
  const [history, setHistory] = useState<HistoryJob[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const loadedIdsRef = useRef<string[]>([]); // Track load order for eviction

  const loadHistory = useCallback(async () => {
    const api = window.electronAPI?.history;
    if (!api) return;
    const jobs = await api.load();
    const historyJobs: HistoryJob[] = [];

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
    }

    setHistory(historyJobs);
    // Don't load transcripts/summaries — they'll be loaded on-demand
  }, []);

  // Load transcript data on-demand for a specific file
  const loadTranscriptData = useCallback(async (fileId: string) => {
    // Already loaded?
    const existing = transcripts.find((t) => t.fileId === fileId);
    if (existing) return;

    const api = window.electronAPI?.history;
    if (!api?.loadTranscript) return;

    setIsLoadingTranscript(true);
    try {
      const data = await api.loadTranscript(fileId);
      if (!data) return;

      const historyItem = history.find((h) => h.id === fileId);
      if (!historyItem) return;

      if (data.transcript) {
        setTranscripts((prev) => {
          // Evict oldest if at capacity
          let updated = [...prev];
          if (updated.length >= MAX_CACHED_TRANSCRIPTS) {
            // Remove the oldest loaded transcript (not the one we're adding)
            const oldestId = loadedIdsRef.current.find((id) => id !== fileId);
            if (oldestId) {
              updated = updated.filter((t) => t.fileId !== oldestId);
              loadedIdsRef.current = loadedIdsRef.current.filter((id) => id !== oldestId);
            }
          }

          // Add new transcript
          const existingIdx = updated.findIndex((t) => t.fileId === fileId);
          const newTranscript: TranscriptResult = {
            fileId,
            fileName: historyItem.fileName,
            fullText: data.transcript.fullText,
            languageCode: historyItem.languageCode,
            utterances: data.transcript.utterances,
            completedAt: historyItem.completedAt,
          };

          if (existingIdx >= 0) {
            updated[existingIdx] = newTranscript;
          } else {
            updated.push(newTranscript);
            loadedIdsRef.current.push(fileId);
          }
          return updated;
        });
      }

      if (data.summary) {
        setSummaries((prev) => {
          const existingIdx = prev.findIndex((s) => s.fileId === fileId);
          const newSummary: SummaryResult = {
            fileId,
            language: data.summary.language as 'en' | 'ja',
            summary: data.summary.summary,
            pointNotes: data.summary.pointNotes,
            actionItems: data.summary.actionItems,
            decisions: data.summary.decisions,
            risks: data.summary.risks,
            generatedAt: data.summary.generatedAt,
          };
          if (existingIdx >= 0) {
            const updated = [...prev];
            updated[existingIdx] = newSummary;
            return updated;
          }
          return [...prev, newSummary];
        });
      }
    } finally {
      setIsLoadingTranscript(false);
    }
  }, [transcripts, history]);

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
      // Track in loaded order
      loadedIdsRef.current.push(result.fileId);
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
    <Ctx.Provider value={{ transcripts, summaries, history, activeId, addTranscript, addSummary, addHistoryJob, setActiveId, getActive, getActiveSummary, loadHistory, loadTranscriptData, isLoadingTranscript }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTranscripts = () => useContext(Ctx);
