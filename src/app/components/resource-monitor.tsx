import { useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import { Wifi, HardDrive, Cpu, Database } from "lucide-react";

interface ResourceMonitorProps {
  queueStats: { queued: number; processing: number; done: number; failed: number };
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

export function ResourceMonitor({ queueStats }: ResourceMonitorProps) {
  const [apiStatus, setApiStatus] = useState<boolean>(false);
  const [ffmpegOk, setFfmpegOk] = useState<boolean | null>(null);
  const [storageSize, setStorageSize] = useState<number>(0);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    // Check API key
    api.settings.get('apiKeys').then((keys: any) => {
      setApiStatus((keys?.assemblyai?.length || 0) >= 20);
    });

    // Check FFmpeg
    api.audio?.ffmpegCheck().then((r) => setFfmpegOk(r.ok));

    // Storage
    api.storage?.stats().then((s) => setStorageSize(s.totalSize));
  }, [queueStats.done]);

  return (
    <div className="h-8 border-t bg-muted/30 flex items-center px-3 gap-4 text-xs text-muted-foreground shrink-0">
      {/* Queue */}
      <div className="flex items-center gap-1.5">
        <Cpu className="size-3" />
        <span className="font-mono">
          {queueStats.queued}Q · {queueStats.processing}P · {queueStats.done}D
          {queueStats.failed > 0 && <span className="text-red-500"> · {queueStats.failed}F</span>}
        </span>
      </div>

      <div className="w-px h-4 bg-border" />

      {/* API */}
      <div className="flex items-center gap-1.5">
        <Wifi className="size-3" />
        <span className={`size-1.5 rounded-full ${apiStatus ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <span>AssemblyAI</span>
      </div>

      <div className="w-px h-4 bg-border" />

      {/* FFmpeg */}
      <div className="flex items-center gap-1.5">
        <HardDrive className="size-3" />
        <span className={`size-1.5 rounded-full ${ffmpegOk === null ? 'bg-gray-400' : ffmpegOk ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <span>FFmpeg</span>
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Storage */}
      <div className="flex items-center gap-1.5">
        <Database className="size-3" />
        <span className="font-mono">{formatBytes(storageSize)}</span>
      </div>

      <div className="flex-1" />

      {/* Mode */}
      <Badge variant="outline" className="h-5 text-xs font-normal">Cloud API</Badge>
    </div>
  );
}
