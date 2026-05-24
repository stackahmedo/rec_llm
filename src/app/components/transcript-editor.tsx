import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Pencil, Check, X, FileAudio, Upload, Mic2, Sparkles, FileText, Globe, Copy, Highlighter, MessageSquare, ChevronDown, ChevronRight } from "lucide-react";
import { useTranscripts, Utterance } from "../transcript-store";
import { useT } from "../i18n";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { loadSpeakerProfiles, saveSpeakerProfiles, getDisplayName, generateProfiles } from "../pdf-speaker-store";

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

interface TranscriptEditorProps {
  fileId: string | null;
}

// Virtualized window size
const RENDER_BATCH = 100;

export function TranscriptEditor({ fileId }: TranscriptEditorProps) {
  const { transcripts, addTranscript } = useTranscripts();
  const { t } = useT();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editedIndices, setEditedIndices] = useState<Set<number>>(new Set());
  const [collapsedSpeakers, setCollapsedSpeakers] = useState<Set<string>>(new Set());
  const [speakerProfiles, setSpeakerProfiles] = useState<any[]>([]);
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [editingSpeakerName, setEditingSpeakerName] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const active = fileId ? transcripts.find((t) => t.fileId === fileId) || null : null;

  const startEdit = (idx: number, text: string) => {
    setEditingIdx(idx);
    setEditText(text);
  };

  const saveEdit = () => {
    if (editingIdx === null || !active) return;
    const updated = { ...active, utterances: [...active.utterances] };
    updated.utterances[editingIdx] = { ...updated.utterances[editingIdx], text: editText };
    addTranscript(updated);
    setEditedIndices((prev) => new Set(prev).add(editingIdx));
    setEditingIdx(null);
    toast.success(t("transcript.segmentUpdated"));

    const api = window.electronAPI?.history;
    if (api) {
      api.save({
        id: active.fileId,
        fileName: active.fileName,
        filePath: '',
        sizeBytes: 0,
        status: 'done',
        languageCode: active.languageCode,
        speakerCount: new Set(updated.utterances.map((u) => u.speaker)).size,
        createdAt: active.completedAt,
        completedAt: active.completedAt,
        transcript: { fullText: updated.utterances.map((u) => u.text).join(' '), utterances: updated.utterances },
      });
    }
  };

  const cancelEdit = () => setEditingIdx(null);

  const copySegment = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("common.copied"));
  }, []);

  const toggleSpeakerCollapse = (speaker: string) => {
    setCollapsedSpeakers((prev) => {
      const next = new Set(prev);
      if (next.has(speaker)) next.delete(speaker);
      else next.add(speaker);
      return next;
    });
  };

  // Speaker groups for minimap
  const speakerGroups = useMemo(() => {
    if (!active) return [];
    const groups: { speaker: string; startIdx: number; endIdx: number; startMs: number }[] = [];
    let current: typeof groups[0] | null = null;
    active.utterances.forEach((u, i) => {
      if (!current || current.speaker !== u.speaker) {
        if (current) groups.push(current);
        current = { speaker: u.speaker, startIdx: i, endIdx: i, startMs: u.startMs };
      } else {
        current.endIdx = i;
      }
    });
    if (current) groups.push(current);
    return groups;
  }, [active]);

  const speakerMetadata = useMemo(() => {
    const map: Record<string, { gender?: string; ageRange?: string }> = {};
    if (!active) return map;
    for (const u of active.utterances) {
      if (!map[u.speaker]) {
        if (u.gender || u.ageRange) {
          map[u.speaker] = { gender: u.gender, ageRange: u.ageRange };
        }
      }
    }
    return map;
  }, [active]);

  useEffect(() => {
    if (!active) {
      setSpeakerProfiles([]);
      return;
    }
    const loaded = loadSpeakerProfiles(active.fileId);
    if (loaded && loaded.length) {
      setSpeakerProfiles(loaded);
      return;
    }
    const speakers = Array.from(new Set(active.utterances.map((u) => u.speaker)));
    setSpeakerProfiles(generateProfiles(speakers));
  }, [active]);

  const getDisplaySpeaker = (id: string) => {
    if (speakerProfiles && speakerProfiles.length) return getDisplayName(speakerProfiles, id);
    return id;
  };

  const persistSpeakerProfiles = (profiles: any[]) => {
    if (!active) return;
    saveSpeakerProfiles(active.fileId, profiles);
  };

  const startSpeakerRename = (speakerId: string) => {
    setEditingSpeaker(speakerId);
    setEditingSpeakerName(getDisplaySpeaker(speakerId));
  };

  const saveSpeakerRename = () => {
    if (!editingSpeaker || !active) return;
    const next = speakerProfiles.map((p) => p.id === editingSpeaker ? { ...p, displayName: editingSpeakerName } : p);
    setSpeakerProfiles(next);
    persistSpeakerProfiles(next);
    setEditingSpeaker(null);
    toast.success("Speaker name updated");
  };

  const cancelSpeakerRename = () => {
    setEditingSpeaker(null);
    setEditingSpeakerName("");
  };

  const formatAgeRange = (ageRange: string) => {
    switch (ageRange) {
      case 'child': return 'Child';
      case 'young': return 'Younger';
      case 'adult': return 'Adult';
      case 'senior': return 'Older';
      default: return ageRange;
    }
  };

  const lastEnd = active ? active.utterances.reduce((max, u) => u.endMs > max ? u.endMs : max, 0) : 0;

  // TanStack Virtual for true virtualized rendering
  const virtualizer = useVirtualizer({
    count: active ? active.utterances.length : 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 44, // estimated row height
    overscan: 20,
  });

  if (!active) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6">
        <FileAudio className="size-10 opacity-20 mb-3" />
        <div className="text-sm font-medium mb-1">{t("transcript.noSelected")}</div>
        <div className="text-[11px] text-center max-w-[240px] mb-4">
          {t("transcript.noSelectedDesc")}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
          <div className="flex items-center gap-1.5"><Upload className="size-3" />MP3, WAV, FLAC, M4A</div>
          <div className="flex items-center gap-1.5"><Mic2 className="size-3" />Speaker diarization</div>
          <div className="flex items-center gap-1.5"><Sparkles className="size-3" />AI summary</div>
          <div className="flex items-center gap-1.5"><Globe className="size-3" />Translation</div>
          <div className="flex items-center gap-1.5"><FileText className="size-3" />PDF export</div>
          <div className="flex items-center gap-1.5"><Mic2 className="size-3" />99 languages</div>
        </div>
      </div>
    );
  }

  if (active.utterances.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6">
        <div className="text-sm">{t("transcript.empty")}</div>
        <div className="text-[11px] mt-1">{t("transcript.emptyDesc")}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Timeline bar with minimap */}
      <div className="h-6 border-b bg-muted/10 flex items-center px-3 gap-2 shrink-0">
        <span className="text-[9px] font-mono text-muted-foreground">00:00</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full relative overflow-hidden">
          {/* Speaker color minimap */}
          {speakerGroups.map((g, i) => {
            const speakerIndex = parseInt(g.speaker.replace(/\D/g, '') || '0', 10) % speakerColors.length;
            const left = (active.utterances[g.startIdx].startMs / lastEnd) * 100;
            const width = ((active.utterances[g.endIdx].endMs - active.utterances[g.startIdx].startMs) / lastEnd) * 100;
            return (
              <div
                key={i}
                className={`absolute inset-y-0 ${speakerColors[speakerIndex]} opacity-60`}
                style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
              />
            );
          })}
        </div>
        <span className="text-[9px] font-mono text-muted-foreground">{msToTimestamp(lastEnd)}</span>
        <Badge variant="outline" className="h-4 text-[7px] px-1 font-mono">{active.utterances.length} seg</Badge>
      </div>

      {/* Virtualized transcript content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const idx = virtualRow.index;
            const u = active.utterances[idx];
            const speakerIndex = parseInt(u.speaker.replace(/\D/g, '') || '0', 10) % speakerColors.length;
            const isEditing = editingIdx === idx;
            const wasEdited = editedIndices.has(idx);
            const isSpeakerCollapsed = collapsedSpeakers.has(u.speaker);

            // Skip collapsed speaker segments (show only first)
            if (isSpeakerCollapsed && idx > 0 && active.utterances[idx - 1]?.speaker === u.speaker) {
              return (
                <div key={virtualRow.key} data-index={idx} ref={virtualizer.measureElement}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }}>
                </div>
              );
            }

            return (
              <div
                key={virtualRow.key}
                data-index={idx}
                ref={virtualizer.measureElement}
                className="flex gap-2 px-3 py-1 group hover:bg-muted/20 transition-colors border-b"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }}
                id={`seg-${idx}`}
              >
                {/* Timestamp — clickable */}
                <div className="flex flex-col items-center gap-0.5 pt-0.5 shrink-0 w-14">
                  <button
                    className="flex items-center gap-0.5"
                    onClick={() => toggleSpeakerCollapse(u.speaker)}
                    title={isSpeakerCollapsed ? "Expand speaker" : "Collapse speaker"}
                  >
                    <span className={`size-2 rounded-full ${speakerColors[speakerIndex]}`} />
                    {isSpeakerCollapsed ? <ChevronRight className="size-2 text-muted-foreground" /> : <ChevronDown className="size-2 text-muted-foreground" />}
                  </button>
                  <button
                    className="text-[8px] font-mono text-muted-foreground hover:text-primary hover:underline transition-colors"
                    onClick={() => virtualizer.scrollToIndex(idx, { align: "center" })}
                    title="Click to jump"
                  >
                    {msToTimestamp(u.startMs)}
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {editingSpeaker === u.speaker ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingSpeakerName}
                          onChange={(e) => setEditingSpeakerName(e.target.value)}
                          className="h-6 text-[10px] w-28"
                          autoFocus
                        />
                        <Button type="button" size="icon" className="h-6 w-6" onClick={saveSpeakerRename}>
                          <Check className="size-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={cancelSpeakerRename}>
                          <X className="size-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="text-[10px] font-medium hover:text-primary transition-colors"
                        onClick={() => startSpeakerRename(u.speaker)}
                      >
                        {getDisplaySpeaker(u.speaker)}
                      </button>
                    )}
                    {speakerMetadata[u.speaker]?.gender && (
                      <Badge variant="outline" className="text-[7px] h-3 px-0.5 capitalize">
                        {speakerMetadata[u.speaker]!.gender}
                      </Badge>
                    )}
                    {speakerMetadata[u.speaker]?.ageRange && (
                      <Badge variant="outline" className="text-[7px] h-3 px-0.5">{formatAgeRange(speakerMetadata[u.speaker]!.ageRange!)}</Badge>
                    )}
                    {wasEdited && <Badge variant="secondary" className="text-[7px] h-3 px-0.5">edited</Badge>}
                    <span className="text-[7px] text-muted-foreground font-mono">{Math.round((u.endMs - u.startMs) / 1000)}s</span>
                  </div>
                  {isEditing ? (
                    <div className="mt-1 space-y-1">
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="min-h-[48px] text-[11px]"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <Button type="button" size="sm" className="h-5 text-[9px] px-2" onClick={saveEdit}>
                          <Check className="size-2.5 mr-0.5" />Save
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="h-5 text-[9px] px-2" onClick={cancelEdit}>
                          <X className="size-2.5 mr-0.5" />Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p
                      className="text-[10px] leading-relaxed mt-0.5 cursor-text"
                      onDoubleClick={() => startEdit(idx, u.text)}
                    >
                      {u.text}
                    </p>
                  )}
                </div>

                {/* Hover quick actions */}
                {!isEditing && (
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
                    <Tooltip><TooltipTrigger asChild>
                      <button className="size-5 rounded hover:bg-muted flex items-center justify-center" onClick={() => copySegment(u.text)}>
                        <Copy className="size-2.5 text-muted-foreground" />
                      </button>
                    </TooltipTrigger><TooltipContent className="text-[9px]">Copy</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <button className="size-5 rounded hover:bg-muted flex items-center justify-center" onClick={() => startEdit(idx, u.text)}>
                        <Pencil className="size-2.5 text-muted-foreground" />
                      </button>
                    </TooltipTrigger><TooltipContent className="text-[9px]">Edit</TooltipContent></Tooltip>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
