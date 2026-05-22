// Global upload job store — persists across navigation
// Solves the vanishing-file bug where queue disappears on screen change

import { createContext, useContext, useState, ReactNode, useCallback, useRef, useEffect } from "react";

export type JobStage = "queued" | "analyzing" | "uploading" | "transcribing" | "summarizing" | "saving" | "done" | "failed" | "paused";

export interface UploadJob {
  id: string;
  fileName: string;
  filePath?: string;
  sizeBytes: number;
  format: string;
  stage: JobStage;
  progress: number; // 0-100
  speakers: number;
  language: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: string;
  audioMeta?: { duration: number; codec: string; bitrate: number; sampleRate: number; channels: number };
  recommendation?: { action: string; reason: string };
  compressedPath?: string;
  resultFileId?: string;
}

export interface UploadPreset {
  transcriptLanguage: string; // "auto" | "ja" | "en" | "bn"
  summaryLanguage: string; // "ja" | "en"
  outputType: "transcript" | "transcript+summary" | "transcript+summary+pdf";
  speakerDetection: boolean;
  expectedSpeakers: number;
  autoSaveTxt: boolean;
}

const defaultPreset: UploadPreset = {
  transcriptLanguage: "auto",
  summaryLanguage: "en",
  outputType: "transcript+summary",
  speakerDetection: true,
  expectedSpeakers: 0,
  autoSaveTxt: true,
};

// Progress percentages per stage
export function getStageProgress(stage: JobStage): number {
  switch (stage) {
    case "queued": return 0;
    case "analyzing": return 10;
    case "uploading": return 20;
    case "transcribing": return 50;
    case "summarizing": return 80;
    case "saving": return 95;
    case "done": return 100;
    case "failed": return 0;
    case "paused": return 0;
    default: return 0;
  }
}

export function getStageLabel(stage: JobStage): string {
  switch (stage) {
    case "queued": return "Waiting";
    case "analyzing": return "Analyzing";
    case "uploading": return "Uploading";
    case "transcribing": return "Transcribing";
    case "summarizing": return "Summarizing";
    case "saving": return "Saving";
    case "done": return "Completed";
    case "failed": return "Failed";
    case "paused": return "Paused";
    default: return "Unknown";
  }
}

interface UploadJobStore {
  jobs: UploadJob[];
  preset: UploadPreset;
  addJobs: (jobs: UploadJob[]) => void;
  updateJob: (id: string, patch: Partial<UploadJob>) => void;
  removeJob: (id: string) => void;
  clearDone: () => void;
  setPreset: (patch: Partial<UploadPreset>) => void;
  getActiveJobs: () => UploadJob[];
  getQueuedJobs: () => UploadJob[];
}

const Ctx = createContext<UploadJobStore>({
  jobs: [],
  preset: defaultPreset,
  addJobs: () => {},
  updateJob: () => {},
  removeJob: () => {},
  clearDone: () => {},
  setPreset: () => {},
  getActiveJobs: () => [],
  getQueuedJobs: () => [],
});

export function useUploadJobs() {
  return useContext(Ctx);
}

export function UploadJobProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [preset, setPresetState] = useState<UploadPreset>(() => {
    try {
      const saved = localStorage.getItem("recllm-upload-preset");
      return saved ? { ...defaultPreset, ...JSON.parse(saved) } : defaultPreset;
    } catch { return defaultPreset; }
  });

  const addJobs = useCallback((newJobs: UploadJob[]) => {
    setJobs((prev) => [...newJobs, ...prev]);
  }, []);

  const updateJob = useCallback((id: string, patch: Partial<UploadJob>) => {
    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, ...patch } : j));
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const clearDone = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.stage !== "done"));
  }, []);

  const setPreset = useCallback((patch: Partial<UploadPreset>) => {
    setPresetState((prev) => {
      const updated = { ...prev, ...patch };
      try { localStorage.setItem("recllm-upload-preset", JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const getActiveJobs = useCallback(() => {
    return jobs.filter((j) => j.stage !== "done" && j.stage !== "failed" && j.stage !== "paused");
  }, [jobs]);

  const getQueuedJobs = useCallback(() => {
    return jobs.filter((j) => j.stage === "queued" && j.filePath);
  }, [jobs]);

  return (
    <Ctx.Provider value={{ jobs, preset, addJobs, updateJob, removeJob, clearDone, setPreset, getActiveJobs, getQueuedJobs }}>
      {children}
    </Ctx.Provider>
  );
}
