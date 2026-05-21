import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "./ui/dropdown-menu";
import { toast } from "sonner";
import {
  UploadCloud, FileAudio, CheckCircle2, AlertCircle, Pause, Play,
  X, RotateCw, MoreHorizontal, Trash2, HardDrive, ScanText, Clock,
} from "lucide-react";
import { useT } from "../i18n";
import { useTranscripts } from "../transcript-store";

type Stage = "queued" | "uploading" | "transcribing" | "done" | "failed" | "paused";

interface FileItem {
  id: string;
  name: string;
  sizeBytes: number;
  format: string;
  speakers: number;
  language: string;
  stage: Stage;
  startedAt: number;
  processingStartedAt?: number;
  error?: string;
  filePath?: string;
}

interface StageStyle {
  key: string;
  icon: any;
  color: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  bar: string;
  card: string;
  iconBg: string;
  progress: string;
  badge: string;
  dot: string;
}

const stageMeta: Record<Stage, StageStyle> = {
  queued: {
    key: "stage.queued", icon: FileAudio, color: "text-slate-600", variant: "outline",
    bar: "bg-slate-400", card: "border-slate-200 bg-slate-50/40 dark:bg-slate-950/20",
    iconBg: "bg-slate-100 dark:bg-slate-900/40", progress: "[&>div]:bg-slate-500",
    badge: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/40 dark:text-slate-200",
    dot: "bg-slate-400",
  },
  uploading: {
    key: "stage.uploading", icon: UploadCloud, color: "text-blue-600", variant: "secondary",
    bar: "bg-blue-500", card: "border-blue-300/60 bg-blue-50/60 dark:bg-blue-950/20",
    iconBg: "bg-blue-100 dark:bg-blue-900/40", progress: "[&>div]:bg-blue-500",
    badge: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200",
    dot: "bg-blue-500",
  },
  transcribing: {
    key: "stage.transcribing", icon: ScanText, color: "text-indigo-600", variant: "secondary",
    bar: "bg-indigo-500", card: "border-indigo-300/60 bg-indigo-50/60 dark:bg-indigo-950/20",
    iconBg: "bg-indigo-100 dark:bg-indigo-900/40", progress: "[&>div]:bg-indigo-500",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-200",
    dot: "bg-indigo-500",
  },
  done: {
    key: "stage.done", icon: CheckCircle2, color: "text-emerald-600", variant: "default",
    bar: "bg-emerald-500", card: "border-emerald-300/60 bg-emerald-50/60 dark:bg-emerald-950/20",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/40", progress: "[&>div]:bg-emerald-500",
    badge: "bg-emerald-600 text-white border-transparent",
    dot: "bg-emerald-500",
  },
  failed: {
    key: "stage.failed", icon: AlertCircle, color: "text-red-600", variant: "destructive",
    bar: "bg-red-500", card: "border-red-300/60 bg-red-50/60 dark:bg-red-950/20",
    iconBg: "bg-red-100 dark:bg-red-900/40", progress: "[&>div]:bg-red-500",
    badge: "bg-red-600 text-white border-transparent",
    dot: "bg-red-500",
  },
  paused: {
    key: "stage.paused", icon: Pause, color: "text-yellow-600", variant: "outline",
    bar: "bg-yellow-500", card: "border-yellow-300/60 bg-yellow-50/60 dark:bg-yellow-950/20",
    iconBg: "bg-yellow-100 dark:bg-yellow-900/40", progress: "[&>div]:bg-yellow-500",
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

export function UploadPanel() {
  const { t } = useT();
  const { addTranscript, addHistoryJob } = useTranscripts();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const incoming: FileItem[] = Array.from(list).map((file, i) => ({
      id: `u${Date.now()}-${i}`,
      name: file.name,
      sizeBytes: file.size,
      format: (file.name.split(".").pop() || "AUD").toUpperCase(),
      speakers: 0, language: "auto",
      stage: "queued" as Stage, startedAt: Date.now(),
    }));
    setFiles((prev) => [...incoming, ...prev]);
    toast.success(`${incoming.length} file${incoming.length > 1 ? "s" : ""} queued`, {
      description: `${formatBytes(incoming.reduce((s, f) => s + f.sizeBytes, 0))} total`,
    });
  };

  const openNativePicker = async () => {
    if (!window.electronAPI?.openAudioFiles) {
      inputRef.current?.click();
      return;
    }
    const results = await window.electronAPI.openAudioFiles();
    if (results.length === 0) return;
    const incoming: FileItem[] = results.map((meta) => ({
      id: meta.id,
      name: meta.fileName,
      sizeBytes: meta.sizeBytes,
      format: meta.extension.toUpperCase(),
      speakers: 0, language: "auto",
      stage: "queued" as Stage, startedAt: Date.now(),
      filePath: meta.filePath,
    }));
    setFiles((prev) => [...incoming, ...prev]);
    toast.success(`${incoming.length} file${incoming.length > 1 ? "s" : ""} queued`, {
      description: `${formatBytes(incoming.reduce((s, f) => s + f.sizeBytes, 0))} total`,
    });
  };

  const pauseResume = (id: string) => {
    setFiles((p) => p.map((f) => f.id === id ? { ...f, stage: f.stage === "paused" ? "queued" : "paused" } : f));
  };
  const retry = (id: string) => {
    setFiles((p) => p.map((f) => f.id === id ? { ...f, stage: "queued", stageProgress: 0, uploadedBytes: 0, error: undefined } : f));
  };
  const remove = (id: string) => setFiles((p) => p.filter((f) => f.id !== id));
  const clearDone = () => setFiles((p) => p.filter((f) => f.stage !== "done"));

  // Sequential queue processor
  const processingRef = useRef(false);

  const processNext = useCallback(async () => {
    if (processingRef.current) return;
    if (!window.electronAPI?.assemblyai) return;

    const queue = files.filter((f) => f.stage === "queued" && f.filePath);
    if (queue.length === 0) return;

    const file = queue[0];
    processingRef.current = true;

    setFiles((p) => p.map((f) => f.id === file.id ? { ...f, stage: "uploading", processingStartedAt: Date.now() } : f));

    const result = await window.electronAPI.assemblyai.transcribeFile(file.filePath!, file.id);
    const now = new Date().toISOString();

    if (result.ok) {
      const speakerCount = result.utterances?.length
        ? new Set(result.utterances.map((u) => u.speaker)).size
        : 0;
      const languageCode = result.languageCode || 'unknown';

      setFiles((p) => p.map((f) => f.id === file.id ? {
        ...f,
        stage: "done",
        speakers: speakerCount,
        language: languageCode,
      } : f));
      addTranscript({
        fileId: file.id,
        fileName: file.name,
        fullText: result.fullText || '',
        languageCode,
        utterances: result.utterances || [],
        completedAt: now,
      });
      const historyJob = {
        id: file.id,
        fileName: file.name,
        filePath: file.filePath!,
        sizeBytes: file.sizeBytes,
        status: 'done' as const,
        languageCode,
        speakerCount,
        createdAt: new Date(file.startedAt).toISOString(),
        completedAt: now,
        transcript: {
          fullText: result.fullText || '',
          utterances: result.utterances || [],
        },
      };
      addHistoryJob(historyJob);
      window.electronAPI?.history?.save(historyJob);
      toast.success(`Transcription complete: ${file.name}`, {
        description: `${result.utterances?.length || 0} utterances · ${languageCode}`,
      });
    } else {
      setFiles((p) => p.map((f) => f.id === file.id ? {
        ...f,
        stage: "failed",
        error: result.error,
      } : f));
      toast.error(`Transcription failed: ${file.name}`, { description: result.error });
    }

    processingRef.current = false;
  }, [files, addTranscript, addHistoryJob]);

  // Auto-advance queue when files change
  useEffect(() => {
    if (processingRef.current) return;
    const hasQueued = files.some((f) => f.stage === "queued" && f.filePath);
    if (hasQueued) {
      processNext();
    }
  }, [files, processNext]);

  // Listen for progress updates from main process
  useEffect(() => {
    const api = window.electronAPI?.assemblyai;
    if (!api) return;
    api.onProgress((data) => {
      const stageMap: Record<string, Stage> = {
        uploading: "uploading",
        transcribing: "transcribing",
        done: "done",
        failed: "failed",
      };
      const mapped = stageMap[data.stage];
      if (mapped) {
        setFiles((p) => p.map((f) => f.id === data.jobId ? { ...f, stage: mapped } : f));
      }
    });
    return () => { api.offProgress(); };
  }, []);

  const totals = useMemo(() => {
    return {
      count: files.length,
      active: files.filter((f) => f.stage === "uploading" || f.stage === "transcribing").length,
      totalBytes: files.reduce((s, f) => s + f.sizeBytes, 0),
      done: files.filter((f) => f.stage === "done").length,
    };
  }, [files]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>{t("upload.title")}</CardTitle>
            <CardDescription>{t("upload.desc")}</CardDescription>
          </div>
          {files.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1"><HardDrive className="size-3" />{formatBytes(totals.totalBytes)}</Badge>
              <Badge variant="outline" className="gap-1">{totals.done}/{totals.count} done</Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => openNativePicker()}
          className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer
            ${drag ? "border-primary bg-primary/10" : "bg-muted/30 hover:bg-muted/50"}`}
        >
          <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
            <UploadCloud className="size-6" />
          </div>
          <div>{drag ? t("upload.release") : t("upload.drag")}</div>
          <div className="text-muted-foreground mt-1">{t("upload.formats")}</div>
          <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
            <Button type="button" onClick={() => openNativePicker()}>
              <UploadCloud className="size-4 mr-1" /> {t("upload.select")}
            </Button>
            <Button type="button" variant="outline" onClick={() => toast.message("Folder picker not available in preview")}>
              {t("upload.selectFolder")}
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

        {files.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground">{t("upload.queue")} ({files.length})</div>
            <Button variant="ghost" size="sm" onClick={clearDone} disabled={totals.done === 0}>
              <Trash2 className="size-4 mr-1" /> {t("upload.clearDone")}
            </Button>
          </div>
        )}

        {files.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No files selected. Use the area above to pick audio files.
          </div>
        ) : (
        <div className="space-y-3">
          {files.map((f) => {
            const meta = stageMeta[f.stage];
            const Icon = meta.icon;
            const spinning = f.stage === "uploading" || f.stage === "transcribing";

            return (
              <div key={f.id} className={`relative border rounded-lg p-3 space-y-3 overflow-hidden transition-colors ${meta.card}`}>
                <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${meta.bar}`} />
                <div className="flex items-start gap-3 pl-2">
                  <div className={`size-9 rounded-md flex items-center justify-center shrink-0 ${meta.iconBg} ${meta.color}`}>
                    <Icon className={`size-4 ${spinning ? "animate-pulse" : ""}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate">{f.name}</span>
                      <Badge variant="outline" className="shrink-0">{f.format}</Badge>
                      {f.language !== "auto" && <Badge variant="outline" className="shrink-0">{f.language}</Badge>}
                    </div>
                    <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="inline-flex items-center gap-1"><HardDrive className="size-3" />{formatBytes(f.sizeBytes)}</span>
                      {f.speakers > 0 && <span>{f.speakers} speakers</span>}
                      {spinning && f.processingStartedAt && <ElapsedTime startMs={f.processingStartedAt} />}
                    </div>
                  </div>
                  <Badge variant="outline" className={`shrink-0 gap-1.5 ${meta.badge}`}>
                    <span className={`size-1.5 rounded-full ${meta.dot} ${spinning ? "animate-pulse" : ""}`} />
                    {t(meta.key)}
                  </Badge>
                  <div className="flex items-center gap-1 shrink-0">
                    {f.stage === "failed" ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => retry(f.id)} title={t("upload.retry")}>
                        <RotateCw className="size-4" />
                      </Button>
                    ) : f.stage !== "done" && f.stage !== "uploading" && f.stage !== "transcribing" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => pauseResume(f.id)} title={f.stage === "paused" ? t("upload.resume") : t("upload.pause")}>
                        {f.stage === "paused" ? <Play className="size-4" /> : <Pause className="size-4" />}
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="size-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{f.name}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {f.filePath && f.stage === "failed" && (
                          <DropdownMenuItem onClick={() => retry(f.id)}>
                            <RotateCw className="size-4 mr-2" />Retry transcription
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => retry(f.id)}><RotateCw className="size-4 mr-2" />{t("upload.restart")}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => remove(f.id)}>
                          <X className="size-4 mr-2" />{t("upload.remove")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {f.stage === "failed" && f.error && (
                  <div className="text-destructive flex items-start gap-1.5">
                    <AlertCircle className="size-4 mt-0.5 shrink-0" />{f.error}
                  </div>
                )}

                {spinning && f.sizeBytes > 50 * 1024 * 1024 && (
                  <div className="text-muted-foreground text-xs pl-2">
                    Long audio may take several minutes depending on file size. Do not close the app.
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
