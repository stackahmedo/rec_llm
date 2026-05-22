import { useState, useMemo } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { FileAudio, Search, Clock, Mic2, Languages, CheckCircle2, Sparkles, AlertCircle } from "lucide-react";
import { useTranscripts, TranscriptResult } from "../transcript-store";

type SessionStatus = "ready" | "summarized" | "exported" | "failed";

function getStatus(fileId: string, hasSummary: boolean): SessionStatus {
  if (hasSummary) return "summarized";
  return "ready";
}

const statusConfig: Record<SessionStatus, { label: string; color: string }> = {
  ready: { label: "Ready", color: "text-emerald-600 border-emerald-300" },
  summarized: { label: "Summarized", color: "text-blue-600 border-blue-300" },
  exported: { label: "Exported", color: "text-purple-600 border-purple-300" },
  failed: { label: "Failed", color: "text-red-600 border-red-300" },
};

function formatDuration(utterances: { startMs: number; endMs: number }[]): string {
  if (utterances.length === 0) return "—";
  const lastEnd = Math.max(...utterances.map((u) => u.endMs));
  const totalSec = Math.floor(lastEnd / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return "Today";
  if (diff < 172800000) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface SessionListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SessionList({ selectedId, onSelect }: SessionListProps) {
  const { transcripts, summaries } = useTranscripts();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return transcripts;
    const q = search.toLowerCase();
    return transcripts.filter((t) => t.fileName.toLowerCase().includes(q));
  }, [transcripts, search]);

  if (transcripts.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-2 border-b">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium px-1">Sessions</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-3 text-center">
          <FileAudio className="size-6 opacity-30 mb-2" />
          <div className="text-[11px]">No transcripts yet</div>
          <div className="text-[10px] mt-0.5">Process audio files to see sessions here</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-2 border-b space-y-1.5">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium px-1">Sessions ({transcripts.length})</div>
        <div className="relative">
          <Search className="size-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-6 text-[10px] pl-6"
          />
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-auto">
        {filtered.map((tr) => {
          const hasSummary = summaries.some((s) => s.fileId === tr.fileId);
          const status = getStatus(tr.fileId, hasSummary);
          const cfg = statusConfig[status];
          const speakerCount = new Set(tr.utterances.map((u) => u.speaker)).size;
          const selected = selectedId === tr.fileId;

          return (
            <button
              key={tr.fileId}
              className={`w-full text-left px-2.5 py-2 border-b transition-colors
                ${selected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/30 border-l-2 border-l-transparent"}`}
              onClick={() => onSelect(tr.fileId)}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <FileAudio className="size-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-medium truncate flex-1">{tr.fileName}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 pl-[18px]">
                <Badge variant="outline" className={`h-3.5 text-[8px] px-1 ${cfg.color}`}>{cfg.label}</Badge>
                <span className="text-[9px] text-muted-foreground font-mono uppercase">{tr.languageCode}</span>
                <span className="text-[9px] text-muted-foreground font-mono">{speakerCount} spk</span>
                <span className="text-[9px] text-muted-foreground font-mono">{formatDuration(tr.utterances)}</span>
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5 pl-[18px]">
                {formatDate(tr.completedAt)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
