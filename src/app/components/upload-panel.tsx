import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "./ui/dropdown-menu";
import { toast } from "sonner";
import {
  UploadCloud, FileAudio, CheckCircle2, Loader2, AlertCircle, Pause, Play,
  X, RotateCw, MoreHorizontal, Trash2, Eye, Gauge, Clock, HardDrive,
  Waves, Mic2, Sparkles, ScanText, Languages,
} from "lucide-react";
import { useT } from "../i18n";
import { useTranscripts } from "../transcript-store";

type Stage = "queued" | "uploading" | "preprocess" | "diarizing" | "transcribing" | "classifying" | "summarizing" | "done" | "failed" | "paused";

interface FileItem {
  id: string;
  name: string;
  sizeBytes: number;
  durationSec: number;
  format: string;
  sampleRate: number;
  channels: number;
  bitrate: number;
  speakers: number;
  language: string;
  uploadedBytes: number;
  speedBps: number;
  stage: Stage;
  stageProgress: number;
  startedAt: number;
  error?: string;
  filePath?: string;
}

const stageOrder: Stage[] = ["uploading", "preprocess", "diarizing", "transcribing", "classifying", "summarizing", "done"];

interface StageStyle {
  key: string;
  icon: any;
  color: string;        // icon color
  variant: "default" | "secondary" | "outline" | "destructive";
  bar: string;          // left accent bar bg
  card: string;         // row tint
  iconBg: string;       // icon container bg
  progress: string;     // progress bar fill
  badge: string;        // badge override classes
  dot: string;          // pulsing status dot
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
  preprocess: {
    key: "stage.preprocess", icon: Waves, color: "text-cyan-600", variant: "secondary",
    bar: "bg-cyan-500", card: "border-cyan-300/60 bg-cyan-50/60 dark:bg-cyan-950/20",
    iconBg: "bg-cyan-100 dark:bg-cyan-900/40", progress: "[&>div]:bg-cyan-500",
    badge: "bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-200",
    dot: "bg-cyan-500",
  },
  diarizing: {
    key: "stage.diarizing", icon: Mic2, color: "text-violet-600", variant: "secondary",
    bar: "bg-violet-500", card: "border-violet-300/60 bg-violet-50/60 dark:bg-violet-950/20",
    iconBg: "bg-violet-100 dark:bg-violet-900/40", progress: "[&>div]:bg-violet-500",
    badge: "bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/40 dark:text-violet-200",
    dot: "bg-violet-500",
  },
  transcribing: {
    key: "stage.transcribing", icon: ScanText, color: "text-indigo-600", variant: "secondary",
    bar: "bg-indigo-500", card: "border-indigo-300/60 bg-indigo-50/60 dark:bg-indigo-950/20",
    iconBg: "bg-indigo-100 dark:bg-indigo-900/40", progress: "[&>div]:bg-indigo-500",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-200",
    dot: "bg-indigo-500",
  },
  classifying: {
    key: "stage.classifying", icon: Languages, color: "text-amber-600", variant: "secondary",
    bar: "bg-amber-500", card: "border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20",
    iconBg: "bg-amber-100 dark:bg-amber-900/40", progress: "[&>div]:bg-amber-500",
    badge: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  summarizing: {
    key: "stage.summarizing", icon: Sparkles, color: "text-fuchsia-600", variant: "secondary",
    bar: "bg-fuchsia-500", card: "border-fuchsia-300/60 bg-fuchsia-50/60 dark:bg-fuchsia-950/20",
    iconBg: "bg-fuchsia-100 dark:bg-fuchsia-900/40", progress: "[&>div]:bg-fuchsia-500",
    badge: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
    dot: "bg-fuchsia-500",
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
function formatDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, "0")}s`;
  return `${sec}s`;
}
function formatEta(sec: number) {
  if (!isFinite(sec) || sec <= 0) return "—";
  if (sec < 60) return `${Math.ceil(sec)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

const seedFiles: FileItem[] = [
  {
    id: "f1", name: "field_session_2026-05-19.wav", sizeBytes: 1.4 * 1024 ** 3, durationSec: 23 * 3600 + 41 * 60,
    format: "WAV", sampleRate: 48000, channels: 2, bitrate: 1536, speakers: 4, language: "Quechua",
    uploadedBytes: 1.4 * 1024 ** 3, speedBps: 0, stage: "done", stageProgress: 100, startedAt: Date.now() - 86400_000,
  },
  {
    id: "f2", name: "interview_block_A.mp3", sizeBytes: 812 * 1024 ** 2, durationSec: 14 * 3600 + 2 * 60,
    format: "MP3", sampleRate: 44100, channels: 2, bitrate: 192, speakers: 3, language: "Spanish",
    uploadedBytes: 812 * 1024 ** 2, speedBps: 9.2 * 1024 ** 2, stage: "transcribing", stageProgress: 68, startedAt: Date.now() - 1800_000,
  },
  {
    id: "f3", name: "village_meeting_north.wav", sizeBytes: 2.1 * 1024 ** 3, durationSec: 21 * 3600 + 18 * 60,
    format: "WAV", sampleRate: 48000, channels: 1, bitrate: 768, speakers: 7, language: "Quechua",
    uploadedBytes: 2.1 * 1024 ** 3, speedBps: 7.4 * 1024 ** 2, stage: "diarizing", stageProgress: 24, startedAt: Date.now() - 3600_000,
  },
  {
    id: "f4", name: "morning_round.m4a", sizeBytes: 640 * 1024 ** 2, durationSec: 9 * 3600 + 50 * 60,
    format: "M4A", sampleRate: 48000, channels: 2, bitrate: 256, speakers: 2, language: "Spanish",
    uploadedBytes: 220 * 1024 ** 2, speedBps: 8.1 * 1024 ** 2, stage: "uploading", stageProgress: 34, startedAt: Date.now() - 60_000,
  },
];

export function UploadPanel() {
  const { t } = useT();
  const { addTranscript } = useTranscripts();
  const [files, setFiles] = useState<FileItem[]>(seedFiles);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Simulate progress
  useEffect(() => {
    const t = setInterval(() => {
      setFiles((prev) => prev.map((f) => {
        if (f.stage === "done" || f.stage === "failed" || f.stage === "paused" || f.stage === "queued") return f;
        if (f.stage === "uploading") {
          const delta = (f.speedBps || 8 * 1024 ** 2) * 0.5;
          const uploaded = Math.min(f.sizeBytes, f.uploadedBytes + delta);
          const pct = (uploaded / f.sizeBytes) * 100;
          if (uploaded >= f.sizeBytes) {
            return { ...f, uploadedBytes: uploaded, stage: "preprocess", stageProgress: 0 };
          }
          return { ...f, uploadedBytes: uploaded, stageProgress: pct, speedBps: 7 * 1024 ** 2 + Math.random() * 4 * 1024 ** 2 };
        }
        const next = Math.min(100, f.stageProgress + 1.5 + Math.random() * 2);
        if (next >= 100) {
          const idx = stageOrder.indexOf(f.stage);
          const upcoming = stageOrder[idx + 1] || "done";
          return { ...f, stage: upcoming, stageProgress: upcoming === "done" ? 100 : 0 };
        }
        return { ...f, stageProgress: next };
      }));
    }, 500);
    return () => clearInterval(t);
  }, []);

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
      durationSec: Math.round(file.size / (192 * 1024 / 8)), // rough estimate
      format: (file.name.split(".").pop() || "AUD").toUpperCase(),
      sampleRate: 48000, channels: 2, bitrate: 192,
      speakers: 0, language: "auto",
      uploadedBytes: 0, speedBps: 8 * 1024 ** 2,
      stage: "uploading", stageProgress: 0, startedAt: Date.now(),
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
      durationSec: Math.round(meta.sizeBytes / (192 * 1024 / 8)),
      format: meta.extension.toUpperCase(),
      sampleRate: 48000, channels: 2, bitrate: 192,
      speakers: 0, language: "auto",
      uploadedBytes: 0, speedBps: 0,
      stage: "queued", stageProgress: 0, startedAt: Date.now(),
      filePath: meta.filePath,
    }));
    setFiles((prev) => [...incoming, ...prev]);
    toast.success(`${incoming.length} file${incoming.length > 1 ? "s" : ""} queued`, {
      description: `${formatBytes(incoming.reduce((s, f) => s + f.sizeBytes, 0))} total`,
    });
  };

  const pauseResume = (id: string) => {
    setFiles((p) => p.map((f) => f.id === id ? { ...f, stage: f.stage === "paused" ? "uploading" : "paused" } : f));
  };
  const retry = (id: string) => {
    setFiles((p) => p.map((f) => f.id === id ? { ...f, stage: "uploading", stageProgress: 0, uploadedBytes: 0, error: undefined } : f));
  };
  const remove = (id: string) => setFiles((p) => p.filter((f) => f.id !== id));
  const clearDone = () => setFiles((p) => p.filter((f) => f.stage !== "done"));

  const transcribeFile = async (id: string) => {
    const file = files.find((f) => f.id === id);
    if (!file?.filePath || !window.electronAPI?.assemblyai) return;

    setFiles((p) => p.map((f) => f.id === id ? { ...f, stage: "uploading", stageProgress: 0 } : f));

    const result = await window.electronAPI.assemblyai.transcribeFile(file.filePath, id);

    if (result.ok) {
      setFiles((p) => p.map((f) => f.id === id ? {
        ...f,
        stage: "done",
        stageProgress: 100,
        speakers: result.utterances?.length
          ? new Set(result.utterances.map((u) => u.speaker)).size
          : 0,
        language: result.languageCode || "auto",
      } : f));
      addTranscript({
        fileId: id,
        fileName: file.name,
        fullText: result.fullText || '',
        languageCode: result.languageCode || 'unknown',
        utterances: result.utterances || [],
        completedAt: new Date().toISOString(),
      });
      toast.success(`Transcription complete: ${file.name}`, {
        description: `${result.utterances?.length || 0} utterances · ${result.languageCode}`,
      });
    } else {
      setFiles((p) => p.map((f) => f.id === id ? {
        ...f,
        stage: "failed",
        stageProgress: 0,
        error: result.error,
      } : f));
      toast.error(`Transcription failed: ${file.name}`, { description: result.error });
    }
  };

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
    const active = files.filter((f) => f.stage !== "done" && f.stage !== "failed");
    return {
      count: files.length,
      active: active.length,
      totalBytes: files.reduce((s, f) => s + f.sizeBytes, 0),
      totalDuration: files.reduce((s, f) => s + f.durationSec, 0),
      throughput: active.reduce((s, f) => s + (f.stage === "uploading" ? f.speedBps : 0), 0),
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
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1"><Gauge className="size-3" />{formatBytes(totals.throughput)}/s</Badge>
            <Badge variant="outline" className="gap-1"><Clock className="size-3" />{formatDuration(totals.totalDuration)}</Badge>
            <Badge variant="outline" className="gap-1"><HardDrive className="size-3" />{formatBytes(totals.totalBytes)}</Badge>
          </div>
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
            <Button onClick={() => openNativePicker()}>
              <UploadCloud className="size-4 mr-1" /> {t("upload.select")}
            </Button>
            <Button variant="outline" onClick={() => toast.message("Folder picker not available in preview")}>
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

        {/* Summary bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { k: t("upload.files"),      v: `${totals.done} / ${totals.count}` },
            { k: t("upload.active"),     v: totals.active },
            { k: t("upload.totalSize"),  v: formatBytes(totals.totalBytes) },
            { k: t("upload.totalAudio"), v: formatDuration(totals.totalDuration) },
          ].map((s) => (
            <div key={s.k} className="border rounded-md px-3 py-2">
              <div className="text-muted-foreground">{s.k}</div>
              <div className="tabular-nums">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-muted-foreground">{t("upload.queue")} ({files.length})</div>
          <Button variant="ghost" size="sm" onClick={clearDone} disabled={totals.done === 0}>
            <Trash2 className="size-4 mr-1" /> {t("upload.clearDone")}
          </Button>
        </div>

        <div className="space-y-3">
          {files.map((f) => {
            const meta = stageMeta[f.stage];
            const Icon = meta.icon;
            const stageIdx = stageOrder.indexOf(f.stage);
            const overall =
              f.stage === "done" ? 100 :
              f.stage === "failed" ? 0 :
              stageIdx >= 0 ? ((stageIdx + f.stageProgress / 100) / stageOrder.length) * 100 : 0;
            const remaining = f.sizeBytes - f.uploadedBytes;
            const eta = f.stage === "uploading" && f.speedBps > 0 ? remaining / f.speedBps : NaN;
            const spinning = ["uploading", "preprocess", "diarizing", "transcribing", "classifying", "summarizing"].includes(f.stage);

            return (
              <div key={f.id} className={`relative border rounded-lg p-3 space-y-3 overflow-hidden transition-colors ${meta.card}`}>
                <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${meta.bar}`} />
                <div className="flex items-start gap-3 pl-2">
                  <div className={`size-9 rounded-md flex items-center justify-center shrink-0 ${meta.iconBg} ${meta.color}`}>
                    <Icon className={`size-4 ${spinning && f.stage !== "uploading" ? "animate-pulse" : ""}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate">{f.name}</span>
                      <Badge variant="outline" className="shrink-0">{f.format}</Badge>
                      {f.language !== "auto" && <Badge variant="outline" className="shrink-0">{f.language}</Badge>}
                    </div>
                    <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="inline-flex items-center gap-1"><HardDrive className="size-3" />{formatBytes(f.sizeBytes)}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="size-3" />{formatDuration(f.durationSec)}</span>
                      <span>{(f.sampleRate / 1000).toFixed(1)} kHz</span>
                      <span>{f.channels === 1 ? "Mono" : "Stereo"}</span>
                      <span>{f.bitrate} kbps</span>
                      {f.speakers > 0 && <span>{f.speakers} speakers</span>}
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
                    ) : f.stage !== "done" && (
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
                        {f.filePath && f.stage === "queued" && (
                          <DropdownMenuItem onClick={() => transcribeFile(f.id)}>
                            <ScanText className="size-4 mr-2" />Transcribe
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem><Eye className="size-4 mr-2" />{t("upload.viewDetails")}</DropdownMenuItem>
                        <DropdownMenuItem><RotateCw className="size-4 mr-2" />{t("upload.restart")}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => remove(f.id)}>
                          <X className="size-4 mr-2" />{t("upload.remove")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Upload progress */}
                {f.stage === "uploading" && (
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground tabular-nums">
                      <span>{formatBytes(f.uploadedBytes)} / {formatBytes(f.sizeBytes)}</span>
                      <span>{formatBytes(f.speedBps)}/s · {t("upload.eta")} {formatEta(eta)}</span>
                    </div>
                    <Progress value={f.stageProgress} className={`mt-1.5 ${meta.progress}`} />
                  </div>
                )}

                {/* Stage progress (post-upload) */}
                {f.stage !== "uploading" && f.stage !== "done" && f.stage !== "queued" && f.stage !== "failed" && f.stage !== "paused" && (
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{t(meta.key)} · {t("upload.stage")} {stageIdx + 1} {t("upload.of")} {stageOrder.length - 1}</span>
                      <span className="tabular-nums">{Math.round(f.stageProgress)}%</span>
                    </div>
                    <Progress value={f.stageProgress} className={`mt-1.5 ${meta.progress}`} />
                  </div>
                )}

                {/* Pipeline stepper */}
                {f.stage !== "queued" && f.stage !== "failed" && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between gap-1 overflow-x-auto">
                      {stageOrder.slice(0, -1).map((s, i) => {
                        const m = stageMeta[s];
                        const SIcon = m.icon;
                        const done = stageIdx > i || f.stage === "done";
                        const active = stageIdx === i;
                        return (
                          <div key={s} className="flex-1 min-w-0 flex flex-col items-center text-center">
                            <div className={`size-6 rounded-full flex items-center justify-center mb-1
                              ${done ? "bg-emerald-600 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                              {done ? <CheckCircle2 className="size-3.5" /> : <SIcon className="size-3" />}
                            </div>
                            <div className={`truncate w-full ${active ? "" : "text-muted-foreground"}`}>{t(m.key)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Overall mini-bar */}
                {f.stage !== "queued" && (
                  <div className="flex items-center gap-2">
                    <Progress value={overall} className={`h-1.5 flex-1 ${meta.progress}`} />
                    <span className="text-muted-foreground tabular-nums shrink-0">{Math.round(overall)}%</span>
                  </div>
                )}

                {f.stage === "failed" && f.error && (
                  <div className="text-destructive flex items-start gap-1.5">
                    <AlertCircle className="size-4 mt-0.5 shrink-0" />{f.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
