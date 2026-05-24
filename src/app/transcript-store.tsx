import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from "react";

export interface Utterance {
  speaker: string;
  startMs: number;
  endMs: number;
  text: string;
  gender?: string;
  ageRange?: string;
  pitchHz?: number;
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

/**
 * Push a fileId to loadedIdsRef, deduplicating and enforcing max size.
 * Protected IDs (activeId, the new fileId) are never evicted from the ref.
 */
function pushLoadedId(ref: React.MutableRefObject<string[]>, fileId: string, protectedIds: (string | null)[]): void {
  // Deduplicate — don't push if already present
  if (ref.current.includes(fileId)) return;
  // Enforce cap: remove oldest non-protected entry if at limit
  while (ref.current.length >= MAX_CACHED_TRANSCRIPTS) {
    const evictIdx = ref.current.findIndex((id) => !protectedIds.includes(id) && id !== fileId);
    if (evictIdx === -1) break; // all protected, can't evict
    ref.current.splice(evictIdx, 1);
  }
  ref.current.push(fileId);
}

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
    // Already loaded? Use ref to avoid stale closure on transcripts array
    if (loadedIdsRef.current.includes(fileId)) return;

    const api = window.electronAPI?.history;
    if (!api?.loadTranscript) return;

    // If history hasn't loaded yet, trigger it and wait
    if (history.length === 0) {
      await loadHistory();
    }

    setIsLoadingTranscript(true);
    try {
      const data = await api.loadTranscript(fileId);
      if (!data) return;

      const historyItem = history.find((h) => h.id === fileId);
      if (!historyItem) return;

      if (data.transcript) {
        const transcript = data.transcript;
        setTranscripts((prev) => {
          // Evict oldest if at capacity — never evict the active or requested transcript
          let updated = [...prev];
          if (updated.length >= MAX_CACHED_TRANSCRIPTS) {
            const oldestId = loadedIdsRef.current.find((id) => id !== fileId && id !== activeId);
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
            fullText: transcript.fullText,
            languageCode: historyItem.languageCode,
            utterances: transcript.utterances,
            completedAt: historyItem.completedAt,
          };

          if (existingIdx >= 0) {
            updated[existingIdx] = newTranscript;
          } else {
            updated.push(newTranscript);
            pushLoadedId(loadedIdsRef, fileId, [activeId]);
          }
          return updated;
        });
      }

      if (data.summary) {
        const summary = data.summary;
        setSummaries((prev) => {
          const existingIdx = prev.findIndex((s) => s.fileId === fileId);
          const newSummary: SummaryResult = {
            fileId,
            language: summary.language as 'en' | 'ja',
            summary: summary.summary,
            pointNotes: summary.pointNotes,
            actionItems: summary.actionItems,
            decisions: summary.decisions,
            risks: summary.risks,
            generatedAt: summary.generatedAt,
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
  }, [history, activeId, loadHistory]);

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

      // Evict oldest if at capacity, but never evict the active transcript
      let updated = [...prev];
      if (updated.length >= MAX_CACHED_TRANSCRIPTS) {
        const oldestId = loadedIdsRef.current.find((id) => id !== result.fileId && id !== activeId);
        if (oldestId) {
          updated = updated.filter((t) => t.fileId !== oldestId);
          loadedIdsRef.current = loadedIdsRef.current.filter((id) => id !== oldestId);
        }
      }

      // Track in loaded order (deduplicated, capped)
      pushLoadedId(loadedIdsRef, result.fileId, [activeId]);
      return [...updated, result];
    });
    setActiveId(result.fileId);
  }, [activeId]);

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
