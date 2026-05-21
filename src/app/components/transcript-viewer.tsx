import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Download, FileText, FileType, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranscripts } from "../transcript-store";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "./ui/dropdown-menu";

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
  const { getActive, getActiveSummary, transcripts, setActiveId, addTranscript } = useTranscripts();
  const [collapsed, setCollapsed] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editedIndices, setEditedIndices] = useState<Set<number>>(new Set());

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
    toast.success("Segment updated", { description: "Saved to local history." });

    // Persist to history
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

  const cancelEdit = () => {
    setEditingIdx(null);
  };

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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <CardTitle>{title}</CardTitle>
            {editedIndices.size > 0 && (
              <Badge variant="secondary" className="text-xs">Edited</Badge>
            )}
          </div>
          <CardDescription>{description}</CardDescription>
          {transcripts.length > 1 && !collapsed && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {transcripts.map((tr) => (
                <Badge
                  key={tr.fileId}
                  variant={tr.fileId === active?.fileId ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => { setActiveId(tr.fileId); setEditedIndices(new Set()); }}
                >
                  {tr.fileName}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </Button>
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

      {!collapsed && (
        <CardContent className="space-y-5">
          {!active || active.utterances.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No transcript available yet. Transcribe an audio file to see results here.
            </div>
          ) : (
          <div className="space-y-3">
            {active.utterances.map((u, idx) => {
              const speakerIndex = parseInt(u.speaker.replace(/\D/g, '') || '0', 10) % speakerColors.length;
              const initials = u.speaker.slice(0, 2).toUpperCase();
              const isEditing = editingIdx === idx;
              const wasEdited = editedIndices.has(idx);

              return (
                <div key={idx} className="flex gap-3 group rounded-lg p-2 hover:bg-muted/40 transition-colors">
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className={`${speakerColors[speakerIndex]} text-white`}>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{u.speaker}</span>
                      <span className="text-muted-foreground tabular-nums text-xs">{msToTimestamp(u.startMs)}</span>
                      {wasEdited && <Badge variant="secondary" className="text-xs h-5">edited</Badge>}
                    </div>
                    {isEditing ? (
                      <div className="mt-1 space-y-2">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="min-h-[60px] text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={saveEdit}>
                            <Check className="size-3 mr-1" />Save
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                            <X className="size-3 mr-1" />Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p
                        className="mt-1 leading-relaxed text-sm cursor-pointer"
                        onClick={() => startEdit(idx, u.text)}
                        title="Click to edit"
                      >
                        {u.text}
                      </p>
                    )}
                  </div>
                  {!isEditing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => startEdit(idx, u.text)}
                    >
                      <Pencil className="size-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
