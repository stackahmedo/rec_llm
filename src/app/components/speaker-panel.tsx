import { useState, useMemo, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
  Users, Pencil, Check, X, Search, FileAudio, Clock, Mic2,
  BarChart3, MessageSquare, Activity,
} from "lucide-react";
import { useTranscripts } from "../transcript-store";

const speakerColors = [
  "bg-blue-500", "bg-rose-500", "bg-amber-500",
  "bg-emerald-500", "bg-violet-500", "bg-cyan-500",
  "bg-pink-500", "bg-orange-500",
];

function msToTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m ${s}s`;
}

interface SpeakerProfile {
  id: string;
  alias: string;
  recordings: { fileId: string; fileName: string; segments: number; durationMs: number; lastSeen: string }[];
  totalSegments: number;
  totalDurationMs: number;
  lastSeen: string;
}

// Load/save speaker aliases from localStorage
function loadAliases(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem("recllm-speaker-aliases") || "{}"); } catch { return {}; }
}
function saveAliases(aliases: Record<string, string>) {
  try { localStorage.setItem("recllm-speaker-aliases", JSON.stringify(aliases)); } catch {}
}

export function SpeakerPanel() {
  const { transcripts } = useTranscripts();
  const [aliases, setAliases] = useState<Record<string, string>>(loadAliases);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Persist aliases
  useEffect(() => { saveAliases(aliases); }, [aliases]);

  // Build speaker profiles from all transcripts
  const profiles = useMemo((): SpeakerProfile[] => {
    const map = new Map<string, SpeakerProfile>();

    transcripts.forEach((t) => {
      const speakerSegments = new Map<string, { count: number; durationMs: number }>();
      t.utterances.forEach((u) => {
        const existing = speakerSegments.get(u.speaker) || { count: 0, durationMs: 0 };
        existing.count++;
        existing.durationMs += (u.endMs - u.startMs);
        speakerSegments.set(u.speaker, existing);
      });

      speakerSegments.forEach((stats, speakerId) => {
        const existing = map.get(speakerId) || {
          id: speakerId,
          alias: aliases[speakerId] || "",
          recordings: [],
          totalSegments: 0,
          totalDurationMs: 0,
          lastSeen: t.completedAt,
        };
        existing.recordings.push({
          fileId: t.fileId,
          fileName: t.fileName,
          segments: stats.count,
          durationMs: stats.durationMs,
          lastSeen: t.completedAt,
        });
        existing.totalSegments += stats.count;
        existing.totalDurationMs += stats.durationMs;
        existing.alias = aliases[speakerId] || "";
        if (t.completedAt > existing.lastSeen) existing.lastSeen = t.completedAt;
        map.set(speakerId, existing);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalSegments - a.totalSegments);
  }, [transcripts, aliases]);

  const filtered = useMemo(() => {
    if (!search.trim()) return profiles;
    const q = search.toLowerCase();
    return profiles.filter((p) =>
      p.id.toLowerCase().includes(q) ||
      p.alias.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const selected = selectedId ? profiles.find((p) => p.id === selectedId) || null : null;

  const startEdit = (id: string) => {
    setEditing(id);
    setEditValue(aliases[id] || "");
  };

  const saveEdit = (id: string) => {
    const trimmed = editValue.trim();
    if (trimmed) {
      setAliases((prev) => ({ ...prev, [id]: trimmed }));
    } else {
      setAliases((prev) => { const next = { ...prev }; delete next[id]; return next; });
    }
    setEditing(null);
  };

  const getDisplayName = (p: SpeakerProfile) => p.alias || `Speaker ${p.id}`;

  // Get segments for selected speaker
  const selectedSegments = useMemo(() => {
    if (!selected) return [];
    return transcripts.flatMap((t) =>
      t.utterances
        .filter((u) => u.speaker === selected.id)
        .map((u) => ({ ...u, fileName: t.fileName, fileId: t.fileId }))
    ).slice(0, 100); // limit for performance
  }, [selected, transcripts]);

  // Empty state
  if (profiles.length === 0) {
    return (
      <div className="flex flex-col h-full -m-6 items-center justify-center text-muted-foreground">
        <Users className="size-8 opacity-30 mb-2" />
        <div className="text-sm">No speakers identified yet</div>
        <div className="text-[11px] mt-0.5">Speakers appear after transcription with diarization</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Toolbar */}
      <div className="h-9 border-b bg-muted/10 flex items-center px-3 gap-2 shrink-0">
        <Users className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium">Speaker Directory</span>
        <Badge variant="outline" className="h-4 text-[9px] px-1.5 font-mono">{profiles.length} speakers</Badge>
        <div className="flex-1" />
        <Badge variant="outline" className="h-4 text-[9px] px-1.5 font-mono">{transcripts.length} recordings</Badge>
      </div>

      {/* 3-panel workspace */}
      <div className="flex-1 min-h-0 flex">
        {/* Left: Speaker list */}
        <div className="w-52 xl:w-56 border-r shrink-0 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="size-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search speakers..."
                className="h-6 text-[10px] pl-6"
              />
            </div>
          </div>

          {/* Speaker list */}
          <div className="flex-1 overflow-auto">
            {filtered.map((p, i) => {
              const color = speakerColors[i % speakerColors.length];
              const isSelected = selectedId === p.id;
              return (
                <button
                  key={p.id}
                  className={`w-full text-left px-2.5 py-2 border-b transition-colors
                    ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/30 border-l-2 border-l-transparent"}`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`size-2.5 rounded-full ${color} shrink-0`} />
                    <span className="text-[11px] font-medium truncate flex-1">{getDisplayName(p)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 pl-4">
                    <span className="text-[9px] text-muted-foreground font-mono">{p.recordings.length} rec</span>
                    <span className="text-[9px] text-muted-foreground font-mono">{p.totalSegments} seg</span>
                    <span className="text-[9px] text-muted-foreground font-mono">{formatDuration(p.totalDurationMs)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Speaker profile + conversation */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Mic2 className="size-6 opacity-30 mb-2" />
              <div className="text-[11px]">Select a speaker to view profile</div>
            </div>
          ) : (
            <>
              {/* Profile header */}
              <div className="p-3 border-b bg-muted/10 shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`size-3 rounded-full ${speakerColors[profiles.indexOf(selected) % speakerColors.length]}`} />
                  {editing === selected.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder={`Speaker ${selected.id}`}
                        className="h-6 text-[11px] flex-1"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(selected.id); if (e.key === "Escape") setEditing(null); }}
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => saveEdit(selected.id)}>
                        <Check className="size-3" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditing(null)}>
                        <X className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium">{getDisplayName(selected)}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => startEdit(selected.id)}>
                        <Pencil className="size-2.5" />
                      </Button>
                    </>
                  )}
                  {selected.alias && (
                    <span className="text-[9px] text-muted-foreground font-mono ml-auto">ID: {selected.id}</span>
                  )}
                </div>
              </div>

              {/* Recordings */}
              <div className="p-2.5 border-b shrink-0">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Recordings ({selected.recordings.length})</div>
                <div className="space-y-1">
                  {selected.recordings.map((r) => (
                    <div key={r.fileId} className="flex items-center gap-2 text-[10px] py-0.5">
                      <FileAudio className="size-3 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{r.fileName}</span>
                      <span className="text-muted-foreground font-mono shrink-0">{r.segments} seg</span>
                      <span className="text-muted-foreground font-mono shrink-0">{formatDuration(r.durationMs)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conversation segments */}
              <div className="flex-1 overflow-auto">
                <div className="p-2 border-b bg-muted/5 sticky top-0">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
                    Conversation ({selectedSegments.length} segments)
                  </div>
                </div>
                <div className="divide-y">
                  {selectedSegments.map((seg, i) => (
                    <div key={i} className="flex gap-2 px-2.5 py-1 hover:bg-muted/20 text-[10px]">
                      <span className="text-muted-foreground font-mono shrink-0 w-14">{msToTimestamp(seg.startMs)}</span>
                      <span className="flex-1 leading-relaxed">{seg.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: Analytics */}
        <div className="w-56 xl:w-60 border-l shrink-0 overflow-auto bg-card">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-3 text-center">
              <BarChart3 className="size-5 opacity-30 mb-2" />
              <div className="text-[11px]">Speaker analytics</div>
              <div className="text-[10px] mt-0.5">Select a speaker to view stats</div>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="p-2.5 border-b">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Statistics</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
                  <div className="text-muted-foreground flex items-center gap-1"><MessageSquare className="size-2.5" />Segments</div>
                  <div className="font-mono">{selected.totalSegments}</div>
                  <div className="text-muted-foreground flex items-center gap-1"><Clock className="size-2.5" />Speaking time</div>
                  <div className="font-mono">{formatDuration(selected.totalDurationMs)}</div>
                  <div className="text-muted-foreground flex items-center gap-1"><FileAudio className="size-2.5" />Recordings</div>
                  <div className="font-mono">{selected.recordings.length}</div>
                  <div className="text-muted-foreground flex items-center gap-1"><Activity className="size-2.5" />Last seen</div>
                  <div className="font-mono">{selected.lastSeen.slice(0, 10)}</div>
                </div>
              </div>

              {/* Conversation ratio */}
              <div className="p-2.5 border-b">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Conversation Ratio</div>
                {selected.recordings.map((r) => {
                  const totalInFile = transcripts.find((t) => t.fileId === r.fileId)?.utterances.length || 1;
                  const ratio = Math.round((r.segments / totalInFile) * 100);
                  return (
                    <div key={r.fileId} className="mb-1.5">
                      <div className="flex items-center justify-between text-[9px] mb-0.5">
                        <span className="truncate">{r.fileName}</span>
                        <span className="font-mono shrink-0">{ratio}%</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full">
                        <div className="h-1 bg-primary/60 rounded-full" style={{ width: `${ratio}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Speaker memory */}
              <div className="p-2.5">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Speaker Memory</div>
                {selected.alias ? (
                  <div className="text-[10px] space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      <span>Identity saved</span>
                    </div>
                    <div className="text-muted-foreground">
                      Future recordings with similar patterns will suggest "{selected.alias}" as a match.
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground">
                    Rename this speaker to save their identity for cross-recording matching.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
