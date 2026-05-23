import { useMemo } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { QueueCard } from "./queue-card";
import { useUploadJobs } from "../upload-job-store";
import { useTranscripts } from "../transcript-store";
import { useT } from "../i18n";
import { FileAudio, Inbox } from "lucide-react";

interface ProcessingQueueProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenReport: (id: string) => void;
}

export function ProcessingQueue({ selectedId, onSelect, onOpenReport }: ProcessingQueueProps) {
  const { jobs, updateJob, removeJob } = useUploadJobs();
  const { history } = useTranscripts();
  const { t } = useT();

  // Merge active jobs + completed history into unified sorted list
  const sortedJobs = useMemo(() => {
    const active = jobs.filter((j) => ["analyzing", "uploading", "transcribing", "summarizing", "saving"].includes(j.stage));
    const queued = jobs.filter((j) => j.stage === "queued" || j.stage === "paused");
    const done = jobs.filter((j) => j.stage === "done");
    const failed = jobs.filter((j) => j.stage === "failed");
    // Order: active first, then queued, then failed, then done
    return [...active, ...queued, ...failed, ...done];
  }, [jobs]);

  const handleRetry = (id: string) => {
    updateJob(id, { stage: "queued", progress: 0, error: undefined });
  };

  const handleRemove = (id: string) => {
    removeJob(id);
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
      <div className="h-7 flex items-center px-3 border-b bg-muted/10 shrink-0">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{t("queue.title")}</span>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono">{sortedJobs.length} {t("queue.files")}</span>
      </div>

      {/* Scrollable queue list */}
      <div className="flex-1 overflow-auto">
        <div className="divide-y-0">
          {sortedJobs.map((job) => (
            <div key={job.id} className="group">
              <QueueCard
                job={job}
                selected={selectedId === job.id}
                onSelect={onSelect}
                onRetry={handleRetry}
                onRemove={handleRemove}
                onOpenReport={onOpenReport}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
