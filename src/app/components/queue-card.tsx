import { memo } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { RotateCw, X, FileAudio, ExternalLink } from "lucide-react";
import { UploadJob, JobStage, getStageLabel } from "../upload-job-store";

const stageColors: Record<JobStage, { bar: string; badge: string; progress: string }> = {
  queued:       { bar: "bg-slate-400",   badge: "text-slate-600 border-slate-300",   progress: "[&>div]:bg-slate-400" },
  analyzing:    { bar: "bg-purple-500",  badge: "text-purple-600 border-purple-300", progress: "[&>div]:bg-purple-500" },
  chunking:     { bar: "bg-violet-500",  badge: "text-violet-600 border-violet-300", progress: "[&>div]:bg-violet-500" },
  uploading:    { bar: "bg-blue-500",    badge: "text-blue-600 border-blue-300",     progress: "[&>div]:bg-blue-500" },
  transcribing: { bar: "bg-indigo-500",  badge: "text-indigo-600 border-indigo-300", progress: "[&>div]:bg-indigo-500" },
  summarizing:  { bar: "bg-orange-500",  badge: "text-orange-600 border-orange-300", progress: "[&>div]:bg-orange-500" },
  saving:       { bar: "bg-teal-500",    badge: "text-teal-600 border-teal-300",     progress: "[&>div]:bg-teal-500" },
  done:         { bar: "bg-emerald-500", badge: "text-emerald-600 border-emerald-300", progress: "[&>div]:bg-emerald-500" },
  failed:       { bar: "bg-red-500",     badge: "text-red-600 border-red-300",       progress: "[&>div]:bg-red-500" },
  paused:       { bar: "bg-yellow-500",  badge: "text-yellow-600 border-yellow-300", progress: "[&>div]:bg-yellow-500" },
};

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}m`;
  return `${m}m`;
}

function formatBytes(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

interface QueueCardProps {
  job: UploadJob;
  selected: boolean;
  onSelect: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onOpenReport: (id: string) => void;
}

export const QueueCard = memo(function QueueCard({ job, selected, onSelect, onRetry, onRemove, onOpenReport }: QueueCardProps) {
  const colors = stageColors[job.stage];
  const isActive = ["uploading", "transcribing", "analyzing", "summarizing", "saving"].includes(job.stage);
  const isDone = job.stage === "done";
  const isFailed = job.stage === "failed";

  return (
    <div
      className={`relative flex flex-col gap-1 px-2.5 py-1.5 border-b cursor-pointer transition-colors
        hover:bg-muted/40
        ${selected ? "bg-primary/5 border-l-2 border-l-primary" : "border-l-[3px]"}
        ${!selected ? `border-l-transparent` : ""}
      `}
      style={!selected ? { borderLeftColor: `var(--queue-bar)` } : undefined}
      onClick={() => onSelect(job.id)}
      onDoubleClick={() => isDone && onOpenReport(job.id)}
      title={job.fileName}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect(job.id); }}
    >
      {/* Left color indicator via CSS variable */}
      <style>{`.queue-card-${job.id} { --queue-bar: ${getComputedBarColor(job.stage)}; }`}</style>

      {/* Row 1: filename + chips + actions */}
      <div className="flex items-center gap-1.5 min-w-0">
        <FileAudio className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-medium truncate flex-1 min-w-0">{job.fileName}</span>

        {/* Metadata chips */}
        {job.language && job.language !== "auto" && (
          <Badge variant="outline" className="h-4 text-[9px] px-1 shrink-0 font-mono uppercase">{job.language}</Badge>
        )}
        {job.speakers > 0 && (
          <Badge variant="outline" className="h-4 text-[9px] px-1 shrink-0 font-mono">{job.speakers} spk</Badge>
        )}
        {job.audioMeta && (
          <Badge variant="outline" className="h-4 text-[9px] px-1 shrink-0 font-mono">{formatDuration(job.audioMeta.duration)}</Badge>
        )}
        {!job.audioMeta && (
          <Badge variant="outline" className="h-4 text-[9px] px-1 shrink-0 font-mono">{formatBytes(job.sizeBytes)}</Badge>
        )}

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {isFailed && (
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onRetry(job.id); }} title="Retry">
              <RotateCw className="size-3" />
            </Button>
          )}
          {isDone && (
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onOpenReport(job.id); }} title="Open report">
              <ExternalLink className="size-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onRemove(job.id); }} title="Remove">
            <X className="size-2.5" />
          </Button>
        </div>
      </div>

      {/* Row 2: progress + status */}
      <div className="flex items-center gap-2 pl-5">
        {isActive && (
          <>
            <Progress value={job.progress} className={`h-1 flex-1 ${colors.progress}`} />
            <span className="text-[9px] font-mono text-muted-foreground w-7 text-right">{job.progress}%</span>
          </>
        )}
        {isDone && <Progress value={100} className="h-1 flex-1 [&>div]:bg-emerald-500" />}

        <Badge variant="outline" className={`h-4 text-[9px] px-1.5 shrink-0 ${colors.badge}`}>
          {isActive && <span className="size-1.5 rounded-full bg-current animate-pulse mr-1" />}
          {getStageLabel(job.stage)}
        </Badge>
      </div>

      {/* Error message */}
      {isFailed && job.error && (
        <div className="text-[9px] text-destructive pl-5 truncate">{job.error}</div>
      )}
    </div>
  );
});

function getComputedBarColor(stage: JobStage): string {
  const map: Record<JobStage, string> = {
    queued: "#94a3b8",
    analyzing: "#a855f7",
    chunking: "#8b5cf6",
    uploading: "#3b82f6",
    transcribing: "#6366f1",
    summarizing: "#f97316",
    saving: "#14b8a6",
    done: "#10b981",
    failed: "#ef4444",
    paused: "#eab308",
  };
  return map[stage];
}
