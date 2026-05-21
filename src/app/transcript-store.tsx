import { createContext, useContext, useState, ReactNode, useCallback } from "react";

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

interface TranscriptStore {
  transcripts: TranscriptResult[];
  summaries: SummaryResult[];
  activeId: string | null;
  addTranscript: (result: TranscriptResult) => void;
  addSummary: (result: SummaryResult) => void;
  setActiveId: (id: string | null) => void;
  getActive: () => TranscriptResult | null;
  getActiveSummary: () => SummaryResult | null;
}

const Ctx = createContext<TranscriptStore>({
  transcripts: [],
  summaries: [],
  activeId: null,
  addTranscript: () => {},
  addSummary: () => {},
  setActiveId: () => {},
  getActive: () => null,
  getActiveSummary: () => null,
});

export function TranscriptProvider({ children }: { children: ReactNode }) {
  const [transcripts, setTranscripts] = useState<TranscriptResult[]>([]);
  const [summaries, setSummaries] = useState<SummaryResult[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

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

  const getActive = useCallback(() => {
    if (!activeId) return null;
    return transcripts.find((t) => t.fileId === activeId) || null;
  }, [activeId, transcripts]);

  const getActiveSummary = useCallback(() => {
    if (!activeId) return null;
    return summaries.find((s) => s.fileId === activeId) || null;
  }, [activeId, summaries]);

  return (
    <Ctx.Provider value={{ transcripts, summaries, activeId, addTranscript, addSummary, setActiveId, getActive, getActiveSummary }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTranscripts = () => useContext(Ctx);
