import { useState, useMemo } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { FileAudio, Search, Clock, Mic2, Languages, CheckCircle2, Sparkles, AlertCircle } from "lucide-react";
import { useTranscripts, TranscriptResult, HistoryJob } from "../transcript-store";

type SessionStatus = "ready" | "summarized" | "exported" | "failed";

function getStatus(fileId: string, hasSummary: boolean, historyStatus?: string): SessionStatus {
  if (historyStatus === 'failed') return "failed";
  if (hasSummary) return "summarized";
  return "ready";
}

const statusConfig: Record<SessionStatus, { label: string; labelJa: string; color: string }> = {
  ready: { label: "Ready", labelJa: "準備完了", color: "text-emerald-600 border-emerald-300" },
  summarized: { label: "Summarized", labelJa: "要約済み", color: "text-blue-600 border-blue-300" },
  exported: { label: "Exported", labelJa: "出力済み", color: "text-purple-600 border-purple-300" },
  failed: { label: "Failed", labelJa: "失敗", color: "text-red-600 border-red-300" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return "今日";
  if (diff < 172800000) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface SessionListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SessionList({ selectedId, onSelect }: SessionListProps) {
  const { transcripts, summaries, history } = useTranscripts();
  const [search, setSearch] = useState("");

  // Use history as the authoritative session list — it always has ALL sessions
  const sessions = useMemo(() => {
    // Merge: history is the source of truth for the list; transcripts may have extra in-memory-only entries
    const historyIds = new Set(history.map((h) => h.id));
    const fromHistory = history.map((h) => ({
      fileId: h.id,
      fileName: h.displayName || h.generatedFileName || h.fileName,
      originalFileName: h.originalFileName || h.fileName,
      languageCode: h.languageCode,
      speakerCount: h.speakerCount,
      completedAt: h.completedAt,
      status: h.status,
    }));
    // Include any in-memory transcripts not yet in history (just processed, not yet persisted)
    const fromTranscripts = transcripts
      .filter((t) => !historyIds.has(t.fileId))
      .map((t) => ({
        fileId: t.fileId,
        fileName: t.fileName,
        originalFileName: t.fileName,
        languageCode: t.languageCode,
        speakerCount: new Set(t.utterances.map((u) => u.speaker)).size,
        completedAt: t.completedAt,
        status: 'done' as const,
      }));
    return [...fromTranscripts, ...fromHistory];
  }, [history, transcripts]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((s) =>
      s.fileName.toLowerCase().includes(q) ||
      s.originalFileName.toLowerCase().includes(q)
    );
  }, [sessions, search]);

  if (sessions.length === 0) {
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
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium px-1">Sessions ({sessions.length})</div>
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
        {filtered.map((session) => {
          const hasSummary = summaries.some((s) => s.fileId === session.fileId);
          const status = getStatus(session.fileId, hasSummary, session.status);
          const cfg = statusConfig[status];
          const selected = selectedId === session.fileId;

          return (
            <button
              key={session.fileId}
              className={`w-full text-left px-2.5 py-2 border-b transition-colors
                ${selected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/30 border-l-2 border-l-transparent"}`}
              onClick={() => onSelect(session.fileId)}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <FileAudio className="size-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-medium truncate flex-1">{session.fileName}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 pl-[18px]">
                <Badge variant="outline" className={`h-3.5 text-[8px] px-1 ${cfg.color}`}>{cfg.labelJa}</Badge>
                <span className="text-[9px] text-muted-foreground font-mono uppercase">{session.languageCode}</span>
                <span className="text-[9px] text-muted-foreground font-mono">{session.speakerCount} spk</span>
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5 pl-[18px]">
                {formatDate(session.completedAt)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
