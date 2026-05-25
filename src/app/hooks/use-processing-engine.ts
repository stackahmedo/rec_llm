// Processing engine hook — extracted from upload-panel.tsx
// Runs the sequential queue processor independent of UI components
// Supports both direct transcription and long-audio chunked pipeline

import { useCallback, useEffect, useRef } from "react";
import { useUploadJobs, UploadJob, JobStage, getStageProgress } from "../upload-job-store";
import { useTranscripts } from "../transcript-store";
import { notifySessionStarted, notifySessionCompleted, notifySessionFailed } from "../notification-store";
import { toast } from "sonner";

export function useProcessingEngine() {
  const { jobs, updateJob } = useUploadJobs();
  const { addTranscript, addHistoryJob } = useTranscripts();
  const processingRef = useRef(false);

  // --- Long-audio chunk processing loop ---
  const processLongAudio = useCallback(async (file: UploadJob, pipelineId: string, totalChunks: number) => {
    const api = window.electronAPI;
    if (!api?.longAudio || !api?.assemblyai) return;

    updateJob(file.id, {
      stage: "transcribing",
      progress: 15,
      isLongAudio: true,
      pipelineId,
      totalChunks,
      completedChunks: 0,
      currentChunkLabel: `Chunk 1/${totalChunks}`,
    });

    let completedCount = 0;

    // Process chunks sequentially
    while (true) {
      const nextResult = await api.longAudio.nextChunk(pipelineId);
      if (!nextResult.ok || !nextResult.chunk) {
        if (nextResult.allProcessed) break;
        break; // Error
      }

      const chunk = nextResult.chunk;
      updateJob(file.id, {
        currentChunkLabel: `Chunk ${chunk.index + 1}/${totalChunks}`,
        progress: Math.round(15 + (completedCount / totalChunks) * 70),
      });

      // Transcribe this chunk via AssemblyAI
      const transcribeResult = await api.assemblyai.transcribeFile(chunk.filePath, `${file.id}_chunk_${chunk.index}`);

      if (transcribeResult.ok && transcribeResult.utterances) {
        await api.longAudio.chunkDone(pipelineId, chunk.index, transcribeResult.utterances);
        completedCount++;
        updateJob(file.id, {
          completedChunks: completedCount,
          progress: Math.round(15 + (completedCount / totalChunks) * 70),
        });
      } else {
        const chunkError = transcribeResult.error || "Chunk transcription failed";
        const failResult = await api.longAudio.chunkFailed(pipelineId, chunk.index, chunkError);
        if (failResult.ok && failResult.canRetry) {
          // Will be retried on next loop iteration
          continue;
        }
        // Chunk permanently failed — continue with remaining chunks
        completedCount++;
      }
    }

    // Merge results
    updateJob(file.id, { stage: "saving", progress: 90, currentChunkLabel: "Merging..." });
    const mergedResult = await api.longAudio.getMerged(pipelineId);

    if (mergedResult.ok && mergedResult.transcript) {
      const transcript = mergedResult.transcript;
      const now = new Date().toISOString();
      const speakerCount = transcript.speakerCount || 0;

      addTranscript({
        fileId: file.id,
        fileName: file.fileName,
        fullText: transcript.fullText || '',
        languageCode: 'auto',
        utterances: transcript.utterances?.map((u: any) => ({
          speaker: u.speaker,
          startMs: u.startMs,
          endMs: u.endMs,
          text: u.text,
        })) || [],
        completedAt: now,
      });

      const historyJob = {
        id: file.id,
        fileName: file.fileName,
        filePath: file.filePath!,
        sizeBytes: file.sizeBytes,
        status: 'done' as const,
        languageCode: 'auto',
        speakerCount,
        createdAt: new Date(file.createdAt).toISOString(),
        completedAt: now,
        transcript: {
          fullText: transcript.fullText || '',
          utterances: transcript.utterances || [],
        },
      };
      addHistoryJob(historyJob);
      let saveOk = await window.electronAPI?.history?.save(historyJob);
      if (!saveOk) {
        // One automatic retry after short delay
        await new Promise((r) => setTimeout(r, 1000));
        saveOk = await window.electronAPI?.history?.save(historyJob);
        if (!saveOk) {
          toast.error("Warning: transcript may not be saved to disk. It will persist in memory until app closes.", { duration: 8000 });
        }
      }

      updateJob(file.id, {
        stage: "done",
        progress: 100,
        speakers: speakerCount,
        language: "auto",
        completedAt: now,
        resultFileId: file.id,
        currentChunkLabel: undefined,
      });

      toast.success(`Done: ${file.fileName}`, {
        description: `${totalChunks} chunks merged · ${transcript.utterances?.length || 0} segments`,
      });
      notifySessionCompleted(file.fileName);

      // Cleanup temp chunks
      await api.longAudio.cleanup(pipelineId);
    } else {
      updateJob(file.id, { stage: "failed", progress: 0, error: "Failed to merge transcript chunks" });
      toast.error(`Failed: ${file.fileName}`, { description: "Merge failed" });
      notifySessionFailed(file.fileName, "Merge failed");
    }
  }, [addTranscript, addHistoryJob, updateJob]);

  // --- Main processing loop ---
  const processNext = useCallback(async () => {
    if (processingRef.current) return;
    if (!window.electronAPI?.assemblyai) return;

    const queue = jobs.filter((f) => f.stage === "queued" && f.filePath);
    if (queue.length === 0) return;

    const file = queue[0];
    processingRef.current = true;

    try {
      // Step 1: Analyze audio metadata
      let uploadPath = file.filePath!;
      if (window.electronAPI?.audio) {
        updateJob(file.id, { stage: "analyzing", progress: 5 });
        const metaResult = await window.electronAPI.audio.metadata(file.filePath!);
        if (metaResult.ok && metaResult.metadata && metaResult.recommendation) {
          updateJob(file.id, { audioMeta: metaResult.metadata, recommendation: metaResult.recommendation, progress: 8 });

          // Check if long-audio pipeline is needed
          if (metaResult.recommendation.action === 'split' && window.electronAPI.longAudio) {
            updateJob(file.id, { stage: "chunking", progress: 10 });
            toast.info("Long audio detected", { description: metaResult.recommendation.reason });

            const startResult = await window.electronAPI.longAudio.start(file.filePath!);
            if (startResult.ok && startResult.requiresChunking && startResult.pipelineId) {
              await processLongAudio(file, startResult.pipelineId, startResult.totalChunks || 1);
              return;
            }
            // If chunking not needed after all, fall through to direct
          }

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

      // Step 2: Upload and transcribe (direct mode)
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
        let saveOk = await window.electronAPI?.history?.save(historyJob);
        if (!saveOk) {
          // One automatic retry after short delay
          await new Promise((r) => setTimeout(r, 1000));
          saveOk = await window.electronAPI?.history?.save(historyJob);
          if (!saveOk) {
            toast.error("Warning: transcript may not be saved to disk. It will persist in memory until app closes.", { duration: 8000 });
          }
        }

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

        // Auto-summarize in background (non-blocking)
        if (window.electronAPI?.summarize && result.fullText && result.fullText.length > 50) {
          const summaryLang: 'en' | 'ja' = 'ja'; // Default Japanese output
          window.electronAPI.summarize.generate(result.fullText, summaryLang, result.utterances).then((sumResult) => {
            if (sumResult.ok && sumResult.summary) {
              // Save summary to history
              window.electronAPI?.history?.save({
                id: file.id,
                fileName: file.fileName,
                filePath: file.filePath!,
                sizeBytes: file.sizeBytes,
                status: 'done',
                languageCode,
                speakerCount,
                createdAt: new Date(file.createdAt).toISOString(),
                completedAt: now,
                summary: {
                  language: summaryLang,
                  summary: sumResult.summary,
                  pointNotes: sumResult.pointNotes || [],
                  actionItems: sumResult.actionItems || [],
                  decisions: sumResult.decisions || [],
                  risks: sumResult.risks || [],
                  generatedAt: new Date().toISOString(),
                },
              });
            }
          }).catch(() => {
            // Summary failure is non-critical — don't block the queue
          });
        }
      } else {
        const errorMsg = result.error || "Unknown error";
        const isApiKeyError = errorMsg.startsWith("API_KEY_MISSING:") || errorMsg.startsWith("API_KEY_INVALID:");
        const displayError = isApiKeyError
          ? errorMsg.split(": ").slice(1).join(": ")
          : errorMsg;

        if (isApiKeyError) {
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
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Unexpected processing error";
      updateJob(file.id, { stage: "failed", progress: 0, error: errorMsg });
      toast.error(`Failed: ${file.fileName}`, { description: errorMsg });
      notifySessionFailed(file.fileName, errorMsg);
    } finally {
      processingRef.current = false;
    }
  }, [jobs, addTranscript, addHistoryJob, updateJob, processLongAudio]);

  // --- Crash recovery: reset orphaned in-progress jobs on mount ---
  const recoveryDoneRef = useRef(false);
  useEffect(() => {
    if (recoveryDoneRef.current) return;
    recoveryDoneRef.current = true;

    // Reset any jobs stuck in active states (from a previous crash)
    const activeStages: JobStage[] = ["analyzing", "chunking", "uploading", "transcribing", "summarizing", "saving"];
    const orphaned = jobs.filter((j) => activeStages.includes(j.stage));
    for (const job of orphaned) {
      updateJob(job.id, { stage: "queued", progress: 0, currentChunkLabel: undefined });
    }
    if (orphaned.length > 0) {
      toast.info(`Recovered ${orphaned.length} interrupted job${orphaned.length > 1 ? 's' : ''}`, {
        description: "Requeued for processing",
        duration: 4000,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
