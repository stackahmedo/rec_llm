import { useCallback, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { UploadCloud, Plus, Layers } from "lucide-react";
import { useUploadJobs, UploadJob, JobStage } from "../upload-job-store";
import { UploadConfirmDialog } from "./upload-confirm-dialog";
import { useT } from "../i18n";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function UploadToolbar() {
  const { jobs, addJobs } = useUploadJobs();
  const [drag, setDrag] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<UploadJob[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const stats = {
    total: jobs.length,
    active: jobs.filter((j) => ["uploading", "transcribing", "analyzing", "summarizing", "saving"].includes(j.stage)).length,
    queued: jobs.filter((j) => j.stage === "queued").length,
    done: jobs.filter((j) => j.stage === "done").length,
    failed: jobs.filter((j) => j.stage === "failed").length,
  };

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const incoming: UploadJob[] = Array.from(list).map((file, i) => ({
      id: `u${Date.now()}-${i}`,
      fileName: file.name,
      sizeBytes: file.size,
      format: (file.name.split(".").pop() || "AUD").toUpperCase(),
      speakers: 0,
      language: "auto",
      stage: "paused" as JobStage,
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
      stage: "paused" as JobStage,
      progress: 0,
      createdAt: Date.now(),
      filePath: meta.filePath,
    }));
    setPendingFiles(incoming);
    setConfirmOpen(true);
  };

  const handleConfirmStart = (fileIds: string[]) => {
    const confirmed = pendingFiles
      .filter((f) => fileIds.includes(f.id))
      .map((f) => ({ ...f, stage: "queued" as JobStage }));
    addJobs(confirmed);
    setPendingFiles([]);
  };

  const handleRemovePending = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  return (
    <>
    <div
      className={`h-10 border-b flex items-center gap-2 px-3 shrink-0 transition-colors ${drag ? "bg-primary/10 border-primary" : "bg-muted/20"}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
    >
      <Button type="button" size="sm" variant="default" className="h-7 text-xs gap-1.5" onClick={openNativePicker}>
        <Plus className="size-3" />Add Files
      </Button>

      <div className="text-[10px] text-muted-foreground flex-1">
        {drag ? "Drop files to add..." : "or drag audio files here"}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-1.5">
        {stats.total > 0 && (
          <>
            <Badge variant="outline" className="h-5 text-[10px] gap-1 font-mono">
              <Layers className="size-2.5" />{stats.total}
            </Badge>
            {stats.active > 0 && (
              <Badge className="h-5 text-[10px] bg-blue-600 gap-1 font-mono">
                {stats.active} active
              </Badge>
            )}
            {stats.done > 0 && (
              <Badge variant="outline" className="h-5 text-[10px] text-emerald-600 border-emerald-300 gap-1 font-mono">
                {stats.done} done
              </Badge>
            )}
            {stats.failed > 0 && (
              <Badge variant="destructive" className="h-5 text-[10px] gap-1 font-mono">
                {stats.failed} failed
              </Badge>
            )}
          </>
        )}
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
