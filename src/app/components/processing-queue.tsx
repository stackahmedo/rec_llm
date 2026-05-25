import { useState, useMemo, useRef, useCallback, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Checkbox } from "./ui/checkbox";
import { RotateCw, X, FileAudio, Inbox, Trash2 } from "lucide-react";
import { useUploadJobs, UploadJob, JobStage, getStageLabel } from "../upload-job-store";
import { useTranscripts } from "../transcript-store";
import { useT } from "../i18n";

const stageColors: Record<JobStage, string> = {
  queued: "text-slate-600 border-slate-300",
  analyzing: "text-purple-600 border-purple-300",
  chunking: "text-violet-600 border-violet-300",
  uploading: "text-blue-600 border-blue-300",
  transcribing: "text-indigo-600 border-indigo-300",
  summarizing: "text-orange-600 border-orange-300",
  saving: "text-teal-600 border-teal-300",
  done: "text-emerald-600 border-emerald-300",
  failed: "text-red-600 border-red-300",
  paused: "text-yellow-600 border-yellow-300",
};

function formatBytes(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

interface QueueRowProps {
  job: UploadJob;
  selected: boolean;
  checked: boolean;
  onSelect: (id: string) => void;
  onCheck: (id: string, checked: boolean) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

const QueueRow = memo(function QueueRow({ job, selected, checked, onSelect, onCheck, onRetry, onRemove }: QueueRowProps) {
  const isActive = ["analyzing", "uploading", "transcribing", "summarizing", "saving", "chunking"].includes(job.stage);
  const showProgress = isActive || job.stage === "queued";

  return (
    <div
      className={`flex items-center gap-2 px-3 h-9 border-b cursor-pointer transition-colors group
        ${selected ? "bg-primary/5" : "hover:bg-muted/30"}`}
      onClick={() => onSelect(job.id)}
    >
      {/* Checkbox */}
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheck(job.id, !!v)}
        onClick={(e) => e.stopPropagation()}
        className="size-3.5"
      />

      {/* Icon */}
      <FileAudio className="size-3 text-muted-foreground shrink-0" />

      {/* Filename */}
      <span className="text-[11px] font-medium truncate flex-1 min-w-0">{job.fileName}</span>

      {/* Size */}
      <span className="text-[9px] text-muted-foreground font-mono shrink-0 w-12 text-right">{formatBytes(job.sizeBytes)}</span>

      {/* Long audio chunk label */}
      {job.currentChunkLabel && (
        <span className="text-[8px] text-muted-foreground font-mono shrink-0">{job.currentChunkLabel}</span>
      )}

      {/* Status badge */}
      <Badge variant="outline" className={`h-4 text-[8px] px-1.5 shrink-0 ${stageColors[job.stage]}`}>
        {getStageLabel(job.stage)}
      </Badge>

      {/* Progress */}
      <div className="w-16 shrink-0">
        {showProgress ? (
          <Progress value={job.progress} className="h-1.5 [&>div]:bg-primary" />
        ) : job.stage === "done" ? (
          <span className="text-[9px] text-emerald-600 font-mono">100%</span>
        ) : null}
      </div>

      {/* Actions (visible on hover) */}
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {job.stage === "failed" && (
          <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onRetry(job.id); }}>
            <RotateCw className="size-2.5" />
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-red-600" onClick={(e) => { e.stopPropagation(); onRemove(job.id); }}>
          <X className="size-2.5" />
        </Button>
      </div>
    </div>
  );
});

interface ProcessingQueueProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenReport: (id: string) => void;
}

export function ProcessingQueue({ selectedId, onSelect, onOpenReport }: ProcessingQueueProps) {
  const { jobs, updateJob, removeJob, removeSelected } = useUploadJobs();
  const { t } = useT();
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sort: active first, then queued, then failed, then done
  const sortedJobs = useMemo(() => {
    const active = jobs.filter((j) => ["analyzing", "uploading", "transcribing", "summarizing", "saving", "chunking"].includes(j.stage));
    const queued = jobs.filter((j) => j.stage === "queued" || j.stage === "paused");
    const failed = jobs.filter((j) => j.stage === "failed");
    const done = jobs.filter((j) => j.stage === "done");
    return [...active, ...queued, ...failed, ...done];
  }, [jobs]);

  const virtualizer = useVirtualizer({
    count: sortedJobs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  const handleRetry = (id: string) => {
    updateJob(id, { stage: "queued", progress: 0, error: undefined });
  };

  const handleRemove = (id: string) => {
    removeJob(id);
    setCheckedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleCheck = useCallback((id: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const toggleAll = () => {
    if (checkedIds.size === sortedJobs.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(sortedJobs.map((j) => j.id)));
    }
  };

  const handleRemoveSelected = () => {
    removeSelected(Array.from(checkedIds));
    setCheckedIds(new Set());
  };

  if (sortedJobs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
        <Inbox className="size-8 opacity-30" />
        <div className="text-xs">{t("queue.noFiles")}</div>
        <div className="text-[10px]">{t("queue.noFilesDesc")}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Queue header */}
      <div className="h-7 flex items-center px-3 border-b bg-muted/10 shrink-0 gap-2">
        <Checkbox
          checked={checkedIds.size === sortedJobs.length && sortedJobs.length > 0}
          onCheckedChange={toggleAll}
          className="size-3"
        />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{t("queue.title")}</span>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono">{sortedJobs.length} {t("queue.files")}</span>
        {checkedIds.size > 0 && (
          <Button type="button" size="sm" variant="ghost" className="h-5 text-[9px] gap-1 px-1.5 text-red-600" onClick={handleRemoveSelected}>
            <Trash2 className="size-2.5" />{t("upload.removeSelected")} ({checkedIds.size})
          </Button>
        )}
      </div>

      {/* Virtualized scrollable queue */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const job = sortedJobs[virtualRow.index];
            return (
              <div
                key={job.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <QueueRow
                  job={job}
                  selected={selectedId === job.id}
                  checked={checkedIds.has(job.id)}
                  onSelect={onSelect}
                  onCheck={handleCheck}
                  onRetry={handleRetry}
                  onRemove={handleRemove}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
