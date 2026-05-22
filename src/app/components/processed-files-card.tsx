import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { FileText, Download, FileAudio, ExternalLink, Clock } from "lucide-react";
import { useTranscripts } from "../transcript-store";
import { toast } from "sonner";
import { addNotification } from "../notification-store";

interface ProcessedFilesCardProps {
  onOpenDocument?: (fileId: string) => void;
  onOpenPdf?: (fileId: string) => void;
}

export function ProcessedFilesCard({ onOpenDocument, onOpenPdf }: ProcessedFilesCardProps) {
  const { history, transcripts } = useTranscripts();

  const recentDone = history
    .filter((h) => h.status === "done")
    .slice(0, 20);

  const exportTxt = async (job: typeof recentDone[0]) => {
    const tr = transcripts.find((t) => t.fileId === job.id);
    if (!tr) { toast.error("Transcript not found"); return; }
    const lines = tr.utterances.map((u) => {
      const ts = msToTs(u.startMs);
      return `[${ts}] ${u.speaker}: ${u.text}`;
    });
    const content = `# ${job.fileName}\n# Language: ${job.languageCode} | Date: ${job.completedAt}\n\n${lines.join("\n")}`;
    const result = await window.electronAPI?.export?.saveTxt(job.fileName, content);
    if (result?.ok) {
      toast.success("TXT exported");
      addNotification("success", "TXT exported", `${job.fileName} saved`, "export");
    } else if (result?.error && result.error !== "Export cancelled.") {
      toast.error("Export failed", { description: result.error });
    }
  };

  if (recentDone.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileAudio className="size-4" />Processed Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground text-sm py-6">
            No processed files yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileAudio className="size-4" />Processed Files
          <Badge variant="outline" className="text-[9px] h-4 ml-1">{recentDone.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-hidden">
        <ScrollArea className="max-h-[240px]">
          <div className="space-y-1">
            {recentDone.map((job) => (
              <div key={job.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 group text-xs min-w-0 overflow-hidden">
                <FileAudio className="size-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="truncate font-medium" title={job.fileName}>{job.fileName}</div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5 shrink-0"><Clock className="size-2.5" />{job.completedAt?.slice(0, 10)}</span>
                    <span className="shrink-0">{job.languageCode.toUpperCase()}</span>
                    {job.speakerCount > 0 && <span className="shrink-0">{job.speakerCount} spk</span>}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Open document"
                    onClick={() => onOpenDocument?.(job.id)}
                  >
                    <ExternalLink className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Export TXT"
                    onClick={() => exportTxt(job)}
                  >
                    <Download className="size-3" />
                  </Button>
                  {onOpenPdf && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title="Open PDF"
                      onClick={() => onOpenPdf(job.id)}
                    >
                      <FileText className="size-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function msToTs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
