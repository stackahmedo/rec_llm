import { createContext, useContext, useState, ReactNode, useCallback } from "react";

export interface Utterance {
  speaker: string;
  startMs: number;
  endMs: number;
  text: string;
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
  activeId: string | null;
  addTranscript: (result: TranscriptResult) => void;
  setActiveId: (id: string | null) => void;
  getActive: () => TranscriptResult | null;
}

const Ctx = createContext<TranscriptStore>({
  transcripts: [],
  activeId: null,
  addTranscript: () => {},
  setActiveId: () => {},
  getActive: () => null,
});

export function TranscriptProvider({ children }: { children: ReactNode }) {
  const [transcripts, setTranscripts] = useState<TranscriptResult[]>([]);
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

  const getActive = useCallback(() => {
    if (!activeId) return null;
    return transcripts.find((t) => t.fileId === activeId) || null;
  }, [activeId, transcripts]);

  return (
    <Ctx.Provider value={{ transcripts, activeId, addTranscript, setActiveId, getActive }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTranscripts = () => useContext(Ctx);
