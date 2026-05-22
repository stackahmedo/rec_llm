import { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Pencil, Check, X, FileAudio, Upload, Mic2, Sparkles, FileText, Globe } from "lucide-react";
import { useTranscripts, Utterance } from "../transcript-store";
import { toast } from "sonner";

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

export function TranscriptEditor({ fileId }: TranscriptEditorProps) {
  const { transcripts, addTranscript } = useTranscripts();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editedIndices, setEditedIndices] = useState<Set<number>>(new Set());

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
    toast.success("Segment updated");

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

  // Empty state — no transcript selected
  if (!active) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6">
        <FileAudio className="size-10 opacity-20 mb-3" />
        <div className="text-sm font-medium mb-1">No transcript selected</div>
        <div className="text-[11px] text-center max-w-[240px] mb-4">
          Upload and process audio files to begin, or select a session from the list.
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

  // Empty utterances
  if (active.utterances.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6">
        <div className="text-sm">Transcript is empty</div>
        <div className="text-[11px] mt-1">This file produced no segments.</div>
      </div>
    );
  }

  // Timeline bar
  const lastEnd = Math.max(...active.utterances.map((u) => u.endMs));

  return (
    <div className="h-full flex flex-col">
      {/* Timeline placeholder */}
      <div className="h-6 border-b bg-muted/10 flex items-center px-3 gap-2 shrink-0">
        <span className="text-[9px] font-mono text-muted-foreground">00:00</span>
        <div className="flex-1 h-1 bg-muted rounded-full relative">
          <div className="absolute inset-y-0 left-0 bg-primary/40 rounded-full" style={{ width: "100%" }} />
        </div>
        <span className="text-[9px] font-mono text-muted-foreground">{msToTimestamp(lastEnd)}</span>
      </div>

      {/* Transcript content */}
      <div className="flex-1 overflow-auto">
        <div className="divide-y">
          {active.utterances.map((u, idx) => {
            const speakerIndex = parseInt(u.speaker.replace(/\D/g, '') || '0', 10) % speakerColors.length;
            const isEditing = editingIdx === idx;
            const wasEdited = editedIndices.has(idx);

            return (
              <div
                key={idx}
                className="flex gap-2 px-3 py-1.5 group hover:bg-muted/20 transition-colors"
              >
                {/* Speaker color dot + timestamp */}
                <div className="flex flex-col items-center gap-0.5 pt-0.5 shrink-0 w-14">
                  <span className={`size-2 rounded-full ${speakerColors[speakerIndex]}`} />
                  <span className="text-[9px] font-mono text-muted-foreground">{msToTimestamp(u.startMs)}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium">{u.speaker}</span>
                    {wasEdited && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">edited</Badge>}
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
                      className="text-[11px] leading-relaxed mt-0.5 cursor-pointer"
                      onClick={() => startEdit(idx, u.text)}
                      title="Click to edit"
                    >
                      {u.text}
                    </p>
                  )}
                </div>

                {/* Edit button */}
                {!isEditing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                    onClick={() => startEdit(idx, u.text)}
                  >
                    <Pencil className="size-2.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
