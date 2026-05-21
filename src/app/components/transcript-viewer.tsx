import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Sparkles, Download, FileText, FileType } from "lucide-react";
import { toast } from "sonner";
import { useTranscripts } from "../transcript-store";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface Segment {
  id: number;
  speaker: string;
  initials: string;
  color: string;
  start: string;
  text: string;
}

const speakerColors = [
  "bg-blue-500", "bg-rose-500", "bg-amber-500", "bg-emerald-500",
  "bg-violet-500", "bg-cyan-500", "bg-pink-500", "bg-orange-500",
];

function msToTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptViewer() {
  const { getActive, getActiveSummary, transcripts, setActiveId } = useTranscripts();

  const active = getActive();
  const summary = getActiveSummary();

  const exportPdf = async () => {
    if (!active) { toast.error("No transcript to export"); return; }
    if (!window.electronAPI?.pdf) { toast.error("PDF export not available in browser mode"); return; }
    const result = await window.electronAPI.pdf.exportReport({
      fileName: active.fileName,
      processedAt: active.completedAt,
      languageCode: active.languageCode,
      summary: summary?.summary,
      pointNotes: summary?.pointNotes,
      actionItems: summary?.actionItems,
      decisions: summary?.decisions,
      risks: summary?.risks,
      utterances: active.utterances,
    });
    if (result.ok) toast.success("PDF exported", { description: result.filePath });
    else if (result.error !== 'Export cancelled.') toast.error("PDF export failed", { description: result.error });
  };

  const exportTxt = async () => {
    if (!active) { toast.error("No transcript to export"); return; }
    if (!window.electronAPI?.export) { toast.error("Export not available in browser mode"); return; }
    const lines = active.utterances.map((u) =>
      `[${msToTimestamp(u.startMs)}] ${u.speaker}: ${u.text}`
    );
    const content = `${active.fileName}\nLanguage: ${active.languageCode}\n\n${lines.join('\n')}`;
    const result = await window.electronAPI.export.saveTxt(active.fileName, content);
    if (result?.ok) toast.success("TXT exported", { description: result.filePath });
    else if (result && result.error !== 'Export cancelled.') toast.error("TXT export failed", { description: result?.error });
  };

  const exportDocx = async () => {
    if (!active) { toast.error("No transcript to export"); return; }
    if (!window.electronAPI?.export) { toast.error("Export not available in browser mode"); return; }
    const result = await window.electronAPI.export.saveDocx(active.fileName, {
      utterances: active.utterances,
      languageCode: active.languageCode,
      summary: summary?.summary,
      pointNotes: summary?.pointNotes,
    });
    if (result?.ok) toast.success("DOCX exported", { description: result.filePath });
    else if (result && result.error !== 'Export cancelled.') toast.error("DOCX export failed", { description: result?.error });
  };

  const segments: Segment[] = active
    ? active.utterances.map((u, i) => {
        const speakerIndex = parseInt(u.speaker.replace(/\D/g, '') || '0', 10) % speakerColors.length;
        const initials = u.speaker.slice(0, 2).toUpperCase();
        return {
          id: i + 1,
          speaker: u.speaker,
          initials,
          color: speakerColors[speakerIndex],
          start: msToTimestamp(u.startMs),
          text: u.text,
        };
      })
    : [];

  const title = active ? active.fileName : "No transcript available";
  const speakerCount = active
    ? new Set(active.utterances.map((u) => u.speaker)).size
    : 0;
  const description = active
    ? `${active.utterances.length} conversation segments · ${speakerCount} speakers · ${active.languageCode}`
    : "Transcribe an audio file to see results here.";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
          {transcripts.length > 1 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {transcripts.map((tr) => (
                <Badge
                  key={tr.fileId}
                  variant={tr.fileId === active?.fileId ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setActiveId(tr.fileId)}
                >
                  {tr.fileName}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={!active}>
                <Download className="size-4 mr-1" />Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportPdf}>
                <FileText className="size-4 mr-2" />PDF Report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportTxt}>
                <FileType className="size-4 mr-2" />Plain Text (.txt)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportDocx}>
                <FileText className="size-4 mr-2" />Document (.docx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {segments.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No transcript available yet. Transcribe an audio file to see results here.
          </div>
        ) : (
        <div className="space-y-4">
          {segments.map((seg) => (
            <div key={seg.id} className="flex gap-3 group">
              <Avatar className="size-9">
                <AvatarFallback className={`${seg.color} text-white`}>{seg.initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>{seg.speaker}</span>
                  <span className="text-muted-foreground tabular-nums">{seg.start}</span>
                </div>
                <p className="mt-1 leading-relaxed">{seg.text}</p>
              </div>
            </div>
          ))}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
