import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Sparkles, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranscripts } from "../transcript-store";

interface Segment {
  id: number;
  speaker: string;
  initials: string;
  color: string;
  start: string;
  text: string;
  tags: string[];
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

const demoSegments: Segment[] = [];

export function TranscriptViewer() {
  const { getActive, getActiveSummary, transcripts, setActiveId } = useTranscripts();

  const active = getActive();
  const summary = getActiveSummary();

  const exportPdf = async () => {
    if (!active) {
      toast.error("No transcript to export");
      return;
    }
    if (!window.electronAPI?.pdf) {
      toast.error("PDF export not available in browser mode");
      return;
    }
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
    if (result.ok) {
      toast.success("PDF exported", { description: result.filePath });
    } else if (result.error !== 'Export cancelled.') {
      toast.error("PDF export failed", { description: result.error });
    }
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
          tags: [],
        };
      })
    : demoSegments;

  const title = active ? active.fileName : "No transcript available";
  const speakerCount = active
    ? new Set(active.utterances.map((u) => u.speaker)).size
    : 0;
  const description = active
    ? `${active.utterances.length} utterances · ${speakerCount} speakers · ${active.languageCode}`
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
          <Button variant="outline" size="sm"><Sparkles className="size-4 mr-1" />Summarize</Button>
          <Button size="sm" onClick={exportPdf} disabled={!active}>
            <Download className="size-4 mr-1" />Export PDF
          </Button>
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
                  {seg.tags.map((t) => (
                    <Badge key={t} variant="outline">{t}</Badge>
                  ))}
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
