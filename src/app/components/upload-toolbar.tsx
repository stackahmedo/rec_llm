import { useCallback, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { UploadCloud, Plus, FolderOpen, Layers, Play, Pause, RotateCw, Trash2 } from "lucide-react";
import { useUploadJobs, UploadJob, JobStage } from "../upload-job-store";
import { useT } from "../i18n";
import { toast } from "sonner";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function UploadToolbar() {
  const { jobs, addJobs, clearDone, startAll, pauseAll, retryFailed } = useUploadJobs();
  const { t } = useT();
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const stats = {
    total: jobs.length,
    active: jobs.filter((j) => ["uploading", "transcribing", "analyzing", "summarizing", "saving", "chunking"].includes(j.stage)).length,
    queued: jobs.filter((j) => j.stage === "queued").length,
    paused: jobs.filter((j) => j.stage === "paused").length,
    done: jobs.filter((j) => j.stage === "done").length,
    failed: jobs.filter((j) => j.stage === "failed").length,
  };

  const addFilesToQueue = (incoming: UploadJob[]) => {
    if (incoming.length === 0) return;
    addJobs(incoming);
    toast.success(`${incoming.length} ${t("upload.addedFiles")}`, { duration: 2000 });
  };

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const incoming: UploadJob[] = Array.from(list)
      .filter((file) => {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        return ["mp3", "wav", "m4a", "mp4", "aac", "flac", "ogg"].includes(ext);
      })
      .map((file, i) => ({
        id: `u${Date.now()}-${i}`,
        fileName: file.name,
        sizeBytes: file.size,
        format: (file.name.split(".").pop() || "AUD").toUpperCase(),
        speakers: 0,
        language: "auto",
        stage: "queued" as JobStage,
        progress: 0,
        createdAt: Date.now(),
      }));
    addFilesToQueue(incoming);
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
      stage: "queued" as JobStage,
      progress: 0,
      createdAt: Date.now(),
      filePath: meta.filePath,
    }));
    addFilesToQueue(incoming);
  };

  const openFolderPicker = async () => {
    if (!window.electronAPI?.openAudioFolder) {
      toast.error(t("notify.notAvailable"));
      return;
    }
    const results = await window.electronAPI.openAudioFolder();
    if (results.length === 0) return;
    const incoming: UploadJob[] = results.map((meta) => ({
      id: meta.id,
      fileName: meta.fileName,
      sizeBytes: meta.sizeBytes,
      format: meta.extension.toUpperCase(),
      speakers: 0,
      language: "auto",
      stage: "queued" as JobStage,
      progress: 0,
      createdAt: Date.now(),
      filePath: meta.filePath,
    }));
    addFilesToQueue(incoming);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  return (
    <div
      className={`h-10 border-b flex items-center gap-1.5 px-3 shrink-0 transition-colors ${drag ? "bg-primary/10 border-primary" : "bg-muted/20"}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
    >
      {/* Add files */}
      <Button type="button" size="sm" variant="default" className="h-7 text-xs gap-1.5" onClick={openNativePicker}>
        <Plus className="size-3" />{t("upload.select")}
      </Button>
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={openFolderPicker}>
        <FolderOpen className="size-3" />{t("upload.selectFolder")}
      </Button>

      <div className="text-[10px] text-muted-foreground flex-1">
        {drag ? t("upload.release") : ""}
      </div>

      {/* Batch actions */}
      {stats.paused > 0 && (
        <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={startAll}>
          <Play className="size-2.5" />{t("upload.startAll")}
        </Button>
      )}
      {stats.queued > 0 && (
        <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={pauseAll}>
          <Pause className="size-2.5" />{t("upload.pauseAll")}
        </Button>
      )}
      {stats.failed > 0 && (
        <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2 text-red-600" onClick={retryFailed}>
          <RotateCw className="size-2.5" />{t("upload.retryFailed")}
        </Button>
      )}
      {stats.done > 0 && (
        <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={clearDone}>
          <Trash2 className="size-2.5" />{t("upload.clearDone")}
        </Button>
      )}

      {/* Stats */}
      <div className="flex items-center gap-1.5 ml-1">
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
  );
}
