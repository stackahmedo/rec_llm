// Processing engine hook — extracted from upload-panel.tsx
// Runs the sequential queue processor independent of UI components
// Supports both direct transcription and long-audio chunked pipeline

import { useCallback, useEffect, useRef } from "react";
import { useUploadJobs, UploadJob, JobStage, getStageProgress } from "../upload-job-store";
import { useTranscripts } from "../transcript-store";
import { notifySessionStarted, notifySessionCompleted, notifySessionFailed } from "../notification-store";
import { toast } from "sonner";

export function useProcessingEngine() {
  const { jobs, updateJob, addJobs } = useUploadJobs();
  const { addTranscript, addHistoryJob } = useTranscripts();
  const processingRef = useRef(false);

  // --- Long-audio chunk processing loop (supports parallel workers) ---
  const processLongAudio = useCallback(async (file: UploadJob, pipelineId: string, totalChunks: number) => {
    const api = window.electronAPI;
    if (!api?.longAudio || !api?.assemblyai) return;

    // Get concurrency from pipeline status
    const statusResult = await api.longAudio.status(pipelineId);
    const concurrency = Math.min(Math.max(statusResult?.concurrency || 1, 1), 5);

    updateJob(file.id, {
      stage: "transcribing",
      progress: 15,
      isLongAudio: true,
      pipelineId,
      totalChunks,
      completedChunks: 0,
      currentChunkLabel: `Chunk 0/${totalChunks} (×${concurrency})`,
    });

    let completedCount = 0;
    let activeWorkers = 0;
    const RATE_LIMIT_DELAY_MS = 1500; // Delay between starting new uploads to avoid rate limits

    // Worker function: fetch next chunk, transcribe, report result
    const processOneChunk = async (): Promise<boolean> => {
      const nextResult = await api.longAudio.nextChunk(pipelineId);
      if (!nextResult.ok || !nextResult.chunk) {
        return false; // No more chunks to process
      }

      const chunk = nextResult.chunk;
      activeWorkers++;

      try {
        const transcribeResult = await api.assemblyai.transcribeFile(chunk.filePath, `${file.id}_chunk_${chunk.index}`);

        if (transcribeResult.ok && transcribeResult.utterances) {
          const doneResult = await api.longAudio.chunkDone(pipelineId, chunk.index, transcribeResult.utterances);
          completedCount++;
          updateJob(file.id, {
            completedChunks: completedCount,
            currentChunkLabel: `Chunk ${completedCount}/${totalChunks} (×${concurrency})`,
            progress: Math.round(15 + (completedCount / totalChunks) * 70),
          });
          // Check if pipeline is fully done
          if (doneResult?.allDone) return false;
        } else {
          const chunkError = transcribeResult.error || "Chunk transcription failed";
          const failResult = await api.longAudio.chunkFailed(pipelineId, chunk.index, chunkError);
          if (!failResult?.canRetry) {
            // Permanently failed — count it and move on
            completedCount++;
            updateJob(file.id, {
              completedChunks: completedCount,
              progress: Math.round(15 + (completedCount / totalChunks) * 70),
            });
          }
          // If canRetry, the chunk goes back to pending and will be picked up again
        }
      } finally {
        activeWorkers--;
      }

      return true; // More chunks may be available
    };

    // Parallel processing loop
    if (concurrency <= 1) {
      // Sequential mode (enterprise / safe default)
      while (true) {
        const hasMore = await processOneChunk();
        if (!hasMore) break;
      }
    } else {
      // Parallel mode: maintain N concurrent workers
      let keepGoing = true;
      while (keepGoing) {
        // Fill up to concurrency limit
        const promises: Promise<boolean>[] = [];
        while (promises.length < concurrency && activeWorkers + promises.length < concurrency) {
          promises.push(processOneChunk());
          // Stagger starts to avoid rate-limit bursts
          if (promises.length < concurrency) {
            await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
          }
        }

        if (promises.length === 0) break;

        // Wait for all current batch to complete
        const results = await Promise.all(promises);
        keepGoing = results.some((r) => r === true);
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

          // Step 1.5: Noise reduction (if enabled in settings)
          const prefs = await window.electronAPI.settings?.get('preferences') as Record<string, unknown> | null;
          if (prefs?.noiseReduction && window.electronAPI.audio.denoise) {
            updateJob(file.id, { stage: "analyzing", progress: 9, currentChunkLabel: "Noise reduction..." });
            const denoiseResult = await window.electronAPI.audio.denoise(file.filePath!);
            if (denoiseResult.ok && denoiseResult.outputPath) {
              uploadPath = denoiseResult.outputPath;
              updateJob(file.id, { progress: 12 });
            }
            // If denoise fails, fall through with original file (non-blocking)
          }

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

        // Enrich utterances with speaking speed
        const enrichedUtterances = (result.utterances || []).map((u) => {
          const durationSec = (u.endMs - u.startMs) / 1000;
          const wordCount = u.text.trim().split(/\s+/).length;
          const wpm = durationSec > 0 ? Math.round(wordCount / (durationSec / 60)) : 0;
          let speedLabel: string = 'normal';
          if (wpm > 0 && wpm < 120) speedLabel = 'slow';
          else if (wpm >= 160) speedLabel = 'fast';
          return { ...u, wordCount, wpm, speedLabel };
        });

        addTranscript({
          fileId: file.id,
          fileName: file.fileName,
          fullText: result.fullText || '',
          languageCode,
          utterances: enrichedUtterances,
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

  // --- Folder watcher: listen for new files and auto-queue ---
  useEffect(() => {
    const api = window.electronAPI as any;
    if (!api?.watcher?.onNewFiles) return;

    const cleanup = api.watcher.onNewFiles((files: Array<{ id: string; fileName: string; filePath: string; sizeBytes: number; extension: string }>) => {
      if (!files || files.length === 0) return;

      // Prevent duplicates: check against existing jobs by filePath
      const existingPaths = new Set(jobs.map((j) => j.filePath).filter(Boolean));
      const newFiles = files.filter((f) => !existingPaths.has(f.filePath));

      if (newFiles.length === 0) return;

      const newJobs: UploadJob[] = newFiles.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        filePath: f.filePath,
        sizeBytes: f.sizeBytes,
        format: f.extension,
        stage: "queued" as JobStage,
        progress: 0,
        speakers: 0,
        language: "auto",
        createdAt: Date.now(),
      }));

      addJobs(newJobs);
      toast.info(`Folder watcher: ${newFiles.length} new file${newFiles.length > 1 ? 's' : ''} queued`, {
        description: newFiles.map((f) => f.fileName).slice(0, 3).join(', ') + (newFiles.length > 3 ? '...' : ''),
        duration: 5000,
      });
    });

    return cleanup;
  }, [jobs, addJobs]);

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
