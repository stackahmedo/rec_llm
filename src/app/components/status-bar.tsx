import { useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import { Wifi, HardDrive, Cpu, Activity, Layers } from "lucide-react";
import { useUploadJobs } from "../upload-job-store";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function StatusBar() {
  const { jobs } = useUploadJobs();
  const [apiStatus, setApiStatus] = useState<boolean>(false);
  const [ffmpegOk, setFfmpegOk] = useState<boolean | null>(null);
  const [storageSize, setStorageSize] = useState<number>(0);
  const [model, setModel] = useState<string>("—");

  const activeJobs = jobs.filter((j) => ["uploading", "transcribing", "analyzing", "summarizing", "saving"].includes(j.stage));
  const currentFile = activeJobs[0];
  const queuedCount = jobs.filter((j) => j.stage === "queued").length;

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.settings?.get('apiKeys').then((keys: any) => {
      setApiStatus((keys?.assemblyai?.length || 0) >= 20);
    });
    api.settings?.get('models').then((models: any) => {
      const m = models?.assemblyai || "universal-3-pro+universal-2";
      setModel(m === "universal-3-pro+universal-2" ? "U3-Pro" : "U2");
    });
    api.audio?.ffmpegCheck().then((r) => setFfmpegOk(r.ok));
    api.storage?.stats().then((s) => setStorageSize(s.totalSize));
  }, [jobs.length]);

  return (
    <div className="h-7 border-t bg-muted/20 flex items-center px-3 gap-3 text-[10px] text-muted-foreground shrink-0 font-mono">
      {/* API status */}
      <div className="flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${apiStatus ? "bg-emerald-500" : "bg-red-500"}`} />
        <span>AssemblyAI</span>
      </div>

      <span className="text-border">│</span>

      {/* FFmpeg */}
      <div className="flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${ffmpegOk ? "bg-emerald-500" : ffmpegOk === null ? "bg-yellow-500" : "bg-red-500"}`} />
        <span>FFmpeg</span>
      </div>

      <span className="text-border">│</span>

      {/* Model */}
      <div className="flex items-center gap-1">
        <Activity className="size-2.5" />
        <span>{model}</span>
      </div>

      <span className="text-border">│</span>

      {/* Storage */}
      <div className="flex items-center gap-1">
        <HardDrive className="size-2.5" />
        <span>{formatBytes(storageSize)}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Processing state */}
      {currentFile ? (
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="truncate max-w-[200px]">{currentFile.fileName}</span>
          <span className="text-muted-foreground/60">·</span>
          <span>{currentFile.progress}%</span>
          {queuedCount > 0 && <span className="text-muted-foreground/60">+{queuedCount} queued</span>}
        </div>
      ) : (
        <span>Idle</span>
      )}
    </div>
  );
}
