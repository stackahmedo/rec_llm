import { useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
  FileAudio, Clock, Download, FileText, ExternalLink, RotateCw,
  Mic2, Languages, HardDrive, Waves, Activity,
} from "lucide-react";
import { useUploadJobs, UploadJob, getStageLabel } from "../upload-job-store";
import { useTranscripts } from "../transcript-store";
import { toast } from "sonner";
import { addNotification } from "../notification-store";
import { notifyError } from "../notify";

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
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
  return <span className="font-mono">{m}:{s.toString().padStart(2, "0")}</span>;
}

interface ReportInspectorProps {
  selectedId: string | null;
}

export function ReportInspector({ selectedId }: ReportInspectorProps) {
  const { jobs, updateJob } = useUploadJobs();
  const { transcripts, summaries } = useTranscripts();

  const job = selectedId ? jobs.find((j) => j.id === selectedId) || null : null;
  const transcript = selectedId ? transcripts.find((t) => t.fileId === selectedId) || null : null;
  const summary = selectedId ? summaries.find((s) => s.fileId === selectedId) || null : null;

  const isActive = job && ["uploading", "transcribing", "analyzing", "summarizing", "saving"].includes(job.stage);
  const isDone = job?.stage === "done";
  const isFailed = job?.stage === "failed";

  const exportTxt = async () => {
    if (!transcript || !job) return;
    const lines = transcript.utterances.map((u) => {
      const ts = `${Math.floor(u.startMs / 60000)}:${Math.floor((u.startMs % 60000) / 1000).toString().padStart(2, "0")}`;
      return `[${ts}] ${u.speaker}: ${u.text}`;
    });
    const content = `# ${job.fileName}\n# Language: ${transcript.languageCode}\n\n${lines.join("\n")}`;
    const result = await window.electronAPI?.export?.saveTxt(job.fileName, content);
    if (result?.ok) {
      toast.success("TXT exported");
      addNotification("success", "TXT exported", `${job.fileName}`, "export");
    } else if (result?.error && result.error !== "Export cancelled.") {
      notifyError("Export failed", { category: "export", technicalDetail: result.error });
    }
  };

  if (!job) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
        <FileAudio className="size-6 opacity-30 mb-2" />
        <div className="text-[11px]">Select a file from the queue</div>
        <div className="text-[10px] mt-0.5">to view processing details</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="p-2.5 border-b bg-muted/10">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Report Inspector</div>
        <div className="text-[11px] font-medium truncate" title={job.fileName}>{job.fileName}</div>
        <div className="flex items-center gap-1.5 mt-1">
          <Badge variant="outline" className="h-4 text-[9px] px-1">{job.format}</Badge>
          <Badge variant="outline" className="h-4 text-[9px] px-1">{getStageLabel(job.stage)}</Badge>
        </div>
      </div>

      {/* File metadata */}
      <div className="p-2.5 border-b">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Metadata</div>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px]">
          <div className="text-muted-foreground">Original</div>
          <div className="truncate" title={job.fileName}>{job.fileName}</div>
          <div className="text-muted-foreground">Size</div>
          <div>{(job.sizeBytes / (1024 * 1024)).toFixed(1)} MB</div>
          {job.audioMeta?.duration && (
            <>
              <div className="text-muted-foreground">Duration</div>
              <div>{Math.floor(job.audioMeta.duration / 60)}m {Math.floor(job.audioMeta.duration % 60)}s</div>
            </>
          )}
          <div className="text-muted-foreground">Created</div>
          <div>{new Date(job.createdAt).toLocaleString()}</div>
        </div>
      </div>

      {/* Processing info */}
      {isActive && (
        <div className="p-2.5 border-b">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Processing</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
            <div className="text-muted-foreground">Elapsed</div>
            <div>{job.startedAt ? <ElapsedTime startMs={job.startedAt} /> : "—"}</div>
            <div className="text-muted-foreground">Step</div>
            <div>{getStageLabel(job.stage)}</div>
            <div className="text-muted-foreground">Progress</div>
            <div className="font-mono">{job.progress}%</div>
          </div>
        </div>
      )}

      {/* Metadata */}
      {job.audioMeta && (
        <div className="p-2.5 border-b">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Audio Metadata</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
            <div className="text-muted-foreground flex items-center gap-1"><Clock className="size-2.5" />Duration</div>
            <div className="font-mono">{formatDuration(job.audioMeta.duration)}</div>
            <div className="text-muted-foreground flex items-center gap-1"><Waves className="size-2.5" />Codec</div>
            <div className="font-mono uppercase">{job.audioMeta.codec}</div>
            <div className="text-muted-foreground flex items-center gap-1"><Activity className="size-2.5" />Bitrate</div>
            <div className="font-mono">{job.audioMeta.bitrate} kbps</div>
            <div className="text-muted-foreground flex items-center gap-1"><HardDrive className="size-2.5" />Size</div>
            <div className="font-mono">{formatBytes(job.sizeBytes)}</div>
          </div>
        </div>
      )}

      {/* Results */}
      {isDone && (
        <div className="p-2.5 border-b">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Results</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
            <div className="text-muted-foreground flex items-center gap-1"><Languages className="size-2.5" />Language</div>
            <div className="font-mono uppercase">{job.language || "—"}</div>
            <div className="text-muted-foreground flex items-center gap-1"><Mic2 className="size-2.5" />Speakers</div>
            <div className="font-mono">{job.speakers || "—"}</div>
            {transcript && (
              <>
                <div className="text-muted-foreground">Segments</div>
                <div className="font-mono">{transcript.utterances.length}</div>
              </>
            )}
            {job.completedAt && (
              <>
                <div className="text-muted-foreground">Completed</div>
                <div className="font-mono">{job.completedAt.slice(11, 19)}</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Summary preview */}
      {summary && (
        <div className="p-2.5 border-b">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Summary</div>
          <div className="text-[10px] leading-relaxed line-clamp-4">{summary.summary}</div>
          {summary.pointNotes.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {summary.pointNotes.slice(0, 3).map((n, i) => (
                <div key={i} className="text-[9px] text-muted-foreground">• {n}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {isFailed && job.error && (
        <div className="p-2.5 border-b">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Error</div>
          <div className="text-[10px] text-destructive">{job.error}</div>
        </div>
      )}

      {/* Actions */}
      <div className="p-2.5 space-y-1.5">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Actions</div>
        {isDone && (
          <>
            <Button variant="outline" size="sm" className="w-full h-7 text-[10px] justify-start gap-2" onClick={exportTxt}>
              <Download className="size-3" />Export TXT
            </Button>
            <Button variant="outline" size="sm" className="w-full h-7 text-[10px] justify-start gap-2" disabled>
              <FileText className="size-3" />Export PDF
            </Button>
            <Button variant="outline" size="sm" className="w-full h-7 text-[10px] justify-start gap-2" disabled>
              <ExternalLink className="size-3" />Open Document
            </Button>
          </>
        )}
        {isFailed && (
          <Button variant="outline" size="sm" className="w-full h-7 text-[10px] justify-start gap-2"
            onClick={() => updateJob(job.id, { stage: "queued", progress: 0, error: undefined })}>
            <RotateCw className="size-3" />Retry
          </Button>
        )}
        <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] justify-start gap-2 text-muted-foreground" disabled>
          <RotateCw className="size-3" />Reprocess
        </Button>
      </div>
    </div>
  );
}
