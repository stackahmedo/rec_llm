import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "./ui/dropdown-menu";
import { toast } from "sonner";
import { notifySessionStarted, notifySessionCompleted, notifySessionFailed } from "../notification-store";
import {
  UploadCloud, FileAudio, CheckCircle2, AlertCircle, Pause, Play,
  X, RotateCw, MoreHorizontal, Trash2, HardDrive, ScanText, Clock,
} from "lucide-react";
import { useT } from "../i18n";
import { useTranscripts } from "../transcript-store";
import { useUploadJobs, UploadJob, JobStage, getStageProgress, getStageLabel } from "../upload-job-store";
import { UploadConfirmDialog } from "./upload-confirm-dialog";

const stageMeta: Record<JobStage, { icon: any; color: string; bar: string; card: string; iconBg: string; badge: string; dot: string }> = {
  queued: {
    icon: FileAudio, color: "text-slate-600",
    bar: "bg-slate-400", card: "border-slate-200 bg-slate-50/40 dark:bg-slate-950/20",
    iconBg: "bg-slate-100 dark:bg-slate-900/40",
    badge: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/40 dark:text-slate-200",
    dot: "bg-slate-400",
  },
  analyzing: {
    icon: ScanText, color: "text-purple-600",
    bar: "bg-purple-500", card: "border-purple-300/60 bg-purple-50/60 dark:bg-purple-950/20",
    iconBg: "bg-purple-100 dark:bg-purple-900/40",
    badge: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/40 dark:text-purple-200",
    dot: "bg-purple-500",
  },
  uploading: {
    icon: UploadCloud, color: "text-blue-600",
    bar: "bg-blue-500", card: "border-blue-300/60 bg-blue-50/60 dark:bg-blue-950/20",
    iconBg: "bg-blue-100 dark:bg-blue-900/40",
    badge: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200",
    dot: "bg-blue-500",
  },
  transcribing: {
    icon: ScanText, color: "text-indigo-600",
    bar: "bg-indigo-500", card: "border-indigo-300/60 bg-indigo-50/60 dark:bg-indigo-950/20",
    iconBg: "bg-indigo-100 dark:bg-indigo-900/40",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-200",
    dot: "bg-indigo-500",
  },
  summarizing: {
    icon: ScanText, color: "text-violet-600",
    bar: "bg-violet-500", card: "border-violet-300/60 bg-violet-50/60 dark:bg-violet-950/20",
    iconBg: "bg-violet-100 dark:bg-violet-900/40",
    badge: "bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/40 dark:text-violet-200",
    dot: "bg-violet-500",
  },
  saving: {
    icon: HardDrive, color: "text-teal-600",
    bar: "bg-teal-500", card: "border-teal-300/60 bg-teal-50/60 dark:bg-teal-950/20",
    iconBg: "bg-teal-100 dark:bg-teal-900/40",
    badge: "bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900/40 dark:text-teal-200",
    dot: "bg-teal-500",
  },
  done: {
    icon: CheckCircle2, color: "text-emerald-600",
    bar: "bg-emerald-500", card: "border-emerald-300/60 bg-emerald-50/60 dark:bg-emerald-950/20",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
    badge: "bg-emerald-600 text-white border-transparent",
    dot: "bg-emerald-500",
  },
  failed: {
    icon: AlertCircle, color: "text-red-600",
    bar: "bg-red-500", card: "border-red-300/60 bg-red-50/60 dark:bg-red-950/20",
    iconBg: "bg-red-100 dark:bg-red-900/40",
    badge: "bg-red-600 text-white border-transparent",
    dot: "bg-red-500",
  },
  paused: {
    icon: Pause, color: "text-yellow-600",
    bar: "bg-yellow-500", card: "border-yellow-300/60 bg-yellow-50/60 dark:bg-yellow-950/20",
    iconBg: "bg-yellow-100 dark:bg-yellow-900/40",
    badge: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-200",
    dot: "bg-yellow-500",
  },
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h${m}m`;
  if (m > 0) return `${m}m${s}s`;
  return `${s}s`;
}

function ElapsedTime({ startMs }: { startMs: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const sec = Math.floor((now - startMs) / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="size-3" />{m}:{s.toString().padStart(2, "0")}</span>;
}

export function UploadPanel({ onFileSelect, selectedFileId }: {
  onFileSelect?: (id: string) => void;
  selectedFileId?: string | null;
} = {}) {
  const { t } = useT();
  const { addTranscript, addHistoryJob } = useTranscripts();
  const { jobs, addJobs, updateJob, removeJob, clearDone } = useUploadJobs();
  const [drag, setDrag] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<UploadJob[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    setDrag(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const incoming: UploadJob[] = Array.from(list).map((file, i) => ({
      id: `u${Date.now()}-${i}`,
      fileName: file.name,
      sizeBytes: file.size,
      format: (file.name.split(".").pop() || "AUD").toUpperCase(),
      speakers: 0,
      language: "auto",
      stage: "paused" as JobStage, // paused until confirmed
      progress: 0,
      createdAt: Date.now(),
    }));
    setPendingFiles(incoming);
    setConfirmOpen(true);
  };

  const openNativePicker = async () => {
    if (!window.electronAPI?.openAudioFiles) {
      inputRef.current?.click();
      return;
    }
    const results = await window.electronAPI.openAudioFiles();
    if (results.length === 0) return;
    const incoming: UploadJob[] = results.map((meta) => ({
      id: meta.id,
      fileName: meta.fileName,
      sizeBytes: meta.sizeBytes,
      format: meta.extension.toUpperCase(),
      speakers: 0,
      language: "auto",
      stage: "paused" as JobStage, // paused until confirmed
      progress: 0,
      createdAt: Date.now(),
      filePath: meta.filePath,
    }));
    setPendingFiles(incoming);
    setConfirmOpen(true);
  };

  const handleConfirmStart = (fileIds: string[]) => {
    // Move confirmed files to queued state and add to global store
    const confirmed = pendingFiles
      .filter((f) => fileIds.includes(f.id))
      .map((f) => ({ ...f, stage: "queued" as JobStage }));
    addJobs(confirmed);
    toast.success(`${confirmed.length} file${confirmed.length > 1 ? "s" : ""} queued`, {
      description: `${formatBytes(confirmed.reduce((s, f) => s + f.sizeBytes, 0))} total`,
    });
    confirmed.forEach((f) => notifySessionStarted(f.fileName));
    setPendingFiles([]);
  };

  const handleRemovePending = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const pauseResume = (id: string) => {
    const job = jobs.find((j) => j.id === id);
    if (job) updateJob(id, { stage: job.stage === "paused" ? "queued" : "paused", progress: 0 });
  };
  const retry = (id: string) => {
    updateJob(id, { stage: "queued", progress: 0, error: undefined });
  };

  // Sequential queue processor
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
            toast.success("Compressed", { description: `Saved ${compressResult.savedMB} MB` });
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
      toast.success(`Transcription complete: ${file.fileName}`, {
        description: `${result.utterances?.length || 0} conversation segments · ${languageCode}`,
      });
      notifySessionCompleted(file.fileName);
    } else {
      updateJob(file.id, { stage: "failed", progress: 0, error: result.error });
      toast.error(`Transcription failed: ${file.fileName}`, { description: result.error });
      notifySessionFailed(file.fileName, result.error);
    }

    processingRef.current = false;
  }, [jobs, addTranscript, addHistoryJob, updateJob]);

  // Auto-advance queue when jobs change
  useEffect(() => {
    if (processingRef.current) return;
    const hasQueued = jobs.some((f) => f.stage === "queued" && f.filePath);
    if (hasQueued) {
      processNext();
    }
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

  const totals = useMemo(() => ({
    count: jobs.length,
    active: jobs.filter((f) => ["uploading", "transcribing", "analyzing", "summarizing", "saving"].includes(f.stage)).length,
    totalBytes: jobs.reduce((s, f) => s + f.sizeBytes, 0),
    done: jobs.filter((f) => f.stage === "done").length,
  }), [jobs]);

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>{t("upload.title")}</CardTitle>
            <CardDescription>{t("upload.desc")}</CardDescription>
          </div>
          {jobs.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1"><HardDrive className="size-3" />{formatBytes(totals.totalBytes)}</Badge>
              <Badge variant="outline" className="gap-1">{totals.done}/{totals.count} done</Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDrag(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDrag(false); }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(e); }}
          onClick={(e) => { e.preventDefault(); openNativePicker(); }}
          className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer
            ${drag ? "border-primary bg-primary/10" : "bg-muted/30 hover:bg-muted/50"}`}
        >
          <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <UploadCloud className="size-5" />
          </div>
          <div className="text-sm">{drag ? t("upload.release") : t("upload.drag")}</div>
          <div className="text-muted-foreground text-xs mt-1">{t("upload.formats")}</div>
          <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
            <Button type="button" size="sm" onClick={() => openNativePicker()}>
              <UploadCloud className="size-3.5 mr-1" /> {t("upload.select")}
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {jobs.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-sm">{t("upload.queue")} ({jobs.length})</div>
            <Button variant="ghost" size="sm" onClick={clearDone} disabled={totals.done === 0}>
              <Trash2 className="size-3.5 mr-1" /> {t("upload.clearDone")}
            </Button>
          </div>
        )}

        {jobs.length === 0 ? (
          <div className="text-center text-muted-foreground py-6 text-sm">
            No files selected. Use the area above to pick audio files.
          </div>
        ) : (
        <div className="space-y-2">
          {jobs.map((f) => {
            const meta = stageMeta[f.stage];
            const Icon = meta.icon;
            const spinning = ["uploading", "transcribing", "analyzing", "summarizing", "saving"].includes(f.stage);

            return (
              <div
                key={f.id}
                className={`relative border rounded-lg p-3 space-y-2 overflow-hidden transition-colors cursor-pointer ${meta.card} ${selectedFileId === f.id ? 'ring-1 ring-primary' : ''}`}
                onClick={() => onFileSelect?.(f.id)}
              >
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${meta.bar}`} />
                <div className="flex items-start gap-3 pl-2">
                  <div className={`size-8 rounded-md flex items-center justify-center shrink-0 ${meta.iconBg} ${meta.color}`}>
                    <Icon className={`size-4 ${spinning ? "animate-pulse" : ""}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm truncate">{f.fileName}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px] h-4">{f.format}</Badge>
                    </div>
                    <div className="text-muted-foreground text-xs mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="inline-flex items-center gap-1"><HardDrive className="size-3" />{formatBytes(f.sizeBytes)}</span>
                      {f.audioMeta && <span className="font-mono">{formatDuration(f.audioMeta.duration)}</span>}
                      {f.speakers > 0 && <span>{f.speakers} speakers</span>}
                      {spinning && f.startedAt && <ElapsedTime startMs={f.startedAt} />}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className={`gap-1 text-[10px] h-5 ${meta.badge}`}>
                      <span className={`size-1.5 rounded-full ${meta.dot} ${spinning ? "animate-pulse" : ""}`} />
                      {getStageLabel(f.stage)}
                    </Badge>
                    {f.stage === "failed" && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); retry(f.id); }} title="Retry">
                        <RotateCw className="size-3.5" />
                      </Button>
                    )}
                    {f.stage !== "done" && !spinning && f.stage !== "failed" && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); pauseResume(f.id); }}>
                        {f.stage === "paused" ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); removeJob(f.id); }}>
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Progress bar */}
                {f.stage !== "done" && f.stage !== "failed" && f.stage !== "paused" && f.stage !== "queued" && (
                  <div className="pl-2 pr-1">
                    <div className="flex items-center gap-2">
                      <Progress value={f.progress} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground w-8 text-right">{f.progress}%</span>
                    </div>
                  </div>
                )}

                {f.stage === "done" && (
                  <div className="pl-2">
                    <Progress value={100} className="h-1 [&>div]:bg-emerald-500" />
                  </div>
                )}

                {f.stage === "failed" && f.error && (
                  <div className="text-destructive flex items-start gap-1.5 text-xs pl-2">
                    <AlertCircle className="size-3 mt-0.5 shrink-0" />{f.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </CardContent>
    </Card>

    {/* Upload confirmation popup */}
    <UploadConfirmDialog
      open={confirmOpen}
      onOpenChange={(v) => { if (!v) setPendingFiles([]); setConfirmOpen(v); }}
      files={pendingFiles}
      onConfirm={handleConfirmStart}
      onRemoveFile={handleRemovePending}
    />
    </>
  );
}
