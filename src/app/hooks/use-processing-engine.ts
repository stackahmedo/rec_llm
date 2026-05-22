// Processing engine hook — extracted from upload-panel.tsx
// Runs the sequential queue processor independent of UI components

import { useCallback, useEffect, useRef } from "react";
import { useUploadJobs, UploadJob, JobStage, getStageProgress } from "../upload-job-store";
import { useTranscripts } from "../transcript-store";
import { notifySessionStarted, notifySessionCompleted, notifySessionFailed } from "../notification-store";
import { toast } from "sonner";

export function useProcessingEngine() {
  const { jobs, updateJob } = useUploadJobs();
  const { addTranscript, addHistoryJob } = useTranscripts();
  const processingRef = useRef(false);

  const processNext = useCallback(async () => {
    if (processingRef.current) return;
    if (!window.electronAPI?.assemblyai) return;

    const queue = jobs.filter((f) => f.stage === "queued" && f.filePath);
    if (queue.length === 0) return;

    const file = queue[0];
    processingRef.current = true;

    // Step 1: Analyze audio metadata
    let uploadPath = file.filePath!;
    if (window.electronAPI?.audio) {
      updateJob(file.id, { stage: "analyzing", progress: 10 });
      const metaResult = await window.electronAPI.audio.metadata(file.filePath!);
      if (metaResult.ok && metaResult.metadata && metaResult.recommendation) {
        updateJob(file.id, { audioMeta: metaResult.metadata, recommendation: metaResult.recommendation, progress: 15 });

        if (metaResult.recommendation.action === 'compress') {
          toast.info("Compressing audio", { description: metaResult.recommendation.reason });
          const compressResult = await window.electronAPI.audio.compress(file.filePath!);
          if (compressResult.ok && compressResult.outputPath) {
            uploadPath = compressResult.outputPath;
            updateJob(file.id, { compressedPath: compressResult.outputPath, progress: 20 });
          }
        }
      }
    }

    // Step 2: Upload and transcribe
    updateJob(file.id, { stage: "uploading", progress: 25, startedAt: Date.now() });

    const result = await window.electronAPI.assemblyai.transcribeFile(uploadPath, file.id);
    const now = new Date().toISOString();

    if (result.ok) {
      // Step 3: Save
      updateJob(file.id, { stage: "saving", progress: 90 });

      const speakerCount = result.utterances?.length
        ? new Set(result.utterances.map((u) => u.speaker)).size
        : 0;
      const languageCode = result.languageCode || 'unknown';

      addTranscript({
        fileId: file.id,
        fileName: file.fileName,
        fullText: result.fullText || '',
        languageCode,
        utterances: result.utterances || [],
        completedAt: now,
      });
      const historyJob = {
        id: file.id,
        fileName: file.fileName,
        filePath: file.filePath!,
        sizeBytes: file.sizeBytes,
        status: 'done' as const,
        languageCode,
        speakerCount,
        createdAt: new Date(file.createdAt).toISOString(),
        completedAt: now,
        transcript: {
          fullText: result.fullText || '',
          utterances: result.utterances || [],
        },
      };
      addHistoryJob(historyJob);
      window.electronAPI?.history?.save(historyJob);

      updateJob(file.id, {
        stage: "done",
        progress: 100,
        speakers: speakerCount,
        language: languageCode,
        completedAt: now,
        resultFileId: file.id,
      });
      toast.success(`Done: ${file.fileName}`, {
        description: `${result.utterances?.length || 0} segments · ${languageCode}`,
      });
      notifySessionCompleted(file.fileName);
    } else {
      const errorMsg = result.error || "Unknown error";
      const isApiKeyError = errorMsg.startsWith("API_KEY_MISSING:") || errorMsg.startsWith("API_KEY_INVALID:");
      const displayError = isApiKeyError
        ? errorMsg.split(": ").slice(1).join(": ")
        : errorMsg;

      if (isApiKeyError) {
        // Don't mark as permanently failed — mark as paused so user can retry after fixing key
        updateJob(file.id, { stage: "paused", progress: 0, error: displayError });
        toast.error("API Key Error", {
          description: "AssemblyAI API key is invalid or missing. Please update your key in Settings.",
          duration: 8000,
        });
      } else {
        updateJob(file.id, { stage: "failed", progress: 0, error: displayError });
        toast.error(`Failed: ${file.fileName}`, { description: displayError });
        notifySessionFailed(file.fileName, displayError);
      }
    }

    processingRef.current = false;
  }, [jobs, addTranscript, addHistoryJob, updateJob]);

  // Auto-advance queue
  useEffect(() => {
    if (processingRef.current) return;
    const hasQueued = jobs.some((f) => f.stage === "queued" && f.filePath);
    if (hasQueued) processNext();
  }, [jobs, processNext]);

  // Listen for progress updates from main process
  useEffect(() => {
    const api = window.electronAPI?.assemblyai;
    if (!api) return;
    api.onProgress((data) => {
      const stageMap: Record<string, JobStage> = {
        uploading: "uploading",
        transcribing: "transcribing",
        done: "done",
        failed: "failed",
      };
      const mapped = stageMap[data.stage];
      if (mapped) {
        updateJob(data.jobId, { stage: mapped, progress: getStageProgress(mapped) });
      }
    });
    return () => { api.offProgress(); };
  }, [updateJob]);

  return { isProcessing: processingRef.current };
}
