import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import {
  Save, FileText, Download, CheckCircle2, AlertCircle, Loader2,
  Clock, User, Plus, X,
} from "lucide-react";
import { useTranscripts, TranscriptResult, SummaryResult } from "../transcript-store";
import { DocumentData, loadDocument, saveDocument, createEmptyDocument } from "../document-store";
import { notifyFileError, addNotification } from "../notification-store";
import { logIoError } from "../crash-log-store";
import { toast } from "sonner";

type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "failed";

export function DocumentEditor() {
  const { transcripts, summaries, activeId, setActiveId } = useTranscripts();
  const [selectedId, setSelectedId] = useState<string | null>(activeId);
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = transcripts.find((t) => t.fileId === selectedId) || null;
  const summary = summaries.find((s) => s.fileId === selectedId) || null;

  // Load document on selection change
  useEffect(() => {
    if (!selectedId) { setDoc(null); return; }
    setLoading(true);
    loadDocument(selectedId).then((existing) => {
      if (existing) {
        setDoc(existing);
      } else {
        // Initialize from transcript + summary
        const tr = transcripts.find((t) => t.fileId === selectedId);
        const sm = summaries.find((s) => s.fileId === selectedId);
        const newDoc = createEmptyDocument(selectedId);
        if (tr) newDoc.title = tr.fileName.replace(/\.[^.]+$/, "");
        if (sm) {
          newDoc.summary = sm.summary;
          newDoc.pointNotes = [...sm.pointNotes];
          newDoc.actionItems = [...sm.actionItems];
          newDoc.decisions = [...sm.decisions];
          newDoc.risks = [...sm.risks];
        }
        setDoc(newDoc);
      }
      setSaveStatus("idle");
      setLoading(false);
    }).catch((err) => {
      logIoError(`Failed to load document: ${err?.message || err}`, "document-editor");
      setLoading(false);
    });
  }, [selectedId, transcripts, summaries]);

  // Auto-save with debounce
  const triggerAutoSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus("unsaved");
    debounceRef.current = setTimeout(() => {
      doSave();
    }, 2000);
  }, []);

  const doSave = async () => {
    if (!doc) return;
    setSaveStatus("saving");
    try {
      const ok = await saveDocument(doc);
      if (ok) {
        setSaveStatus("saved");
      } else {
        setSaveStatus("failed");
        notifyFileError("Document save", "Write failed");
      }
    } catch (err: unknown) {
      setSaveStatus("failed");
      const msg = err instanceof Error ? err.message : "Unknown error";
      logIoError(`Document save failed: ${msg}`, "document-editor");
      notifyFileError("Document save", msg);
    }
  };

  const updateDoc = (patch: Partial<DocumentData>) => {
    setDoc((prev) => prev ? { ...prev, ...patch } : prev);
    triggerAutoSave();
  };

  const updateUtterance = (index: number, text: string) => {
    setDoc((prev) => {
      if (!prev) return prev;
      return { ...prev, editedUtterances: { ...prev.editedUtterances, [index]: text } };
    });
    triggerAutoSave();
  };

  const updateSpeakerName = (original: string, display: string) => {
    setDoc((prev) => {
      if (!prev) return prev;
      return { ...prev, speakerNames: { ...prev.speakerNames, [original]: display } };
    });
    triggerAutoSave();
  };

  const updateListItem = (field: "pointNotes" | "actionItems" | "decisions" | "risks", index: number, value: string) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const arr = [...prev[field]];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
    triggerAutoSave();
  };

  const addListItem = (field: "pointNotes" | "actionItems" | "decisions" | "risks") => {
    setDoc((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: [...prev[field], ""] };
    });
    triggerAutoSave();
  };

  const removeListItem = (field: "pointNotes" | "actionItems" | "decisions" | "risks", index: number) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const arr = prev[field].filter((_, i) => i !== index);
      return { ...prev, [field]: arr };
    });
    triggerAutoSave();
  };

  // Export TXT with edits applied
  const exportTxt = async () => {
    if (!active || !doc) return;
    const lines: string[] = [];
    lines.push(`# ${doc.title || active.fileName}`);
    lines.push(`# Language: ${active.languageCode} | Date: ${active.completedAt?.slice(0, 10) || ""}`);
    lines.push("");
    if (doc.summary) { lines.push("## Summary"); lines.push(doc.summary); lines.push(""); }
    if (doc.pointNotes.length > 0) {
      lines.push("## Key Points");
      doc.pointNotes.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
      lines.push("");
    }
    if (doc.actionItems.length > 0) {
      lines.push("## Action Items");
      doc.actionItems.forEach((n) => lines.push(`- ${n}`));
      lines.push("");
    }
    lines.push("## Transcript");
    active.utterances.forEach((u, i) => {
      const text = doc.editedUtterances[i] || u.text;
      const speaker = doc.speakerNames[u.speaker] || u.speaker;
      const ts = msToTs(u.startMs);
      lines.push(`[${ts}] ${speaker}: ${text}`);
    });

    const content = lines.join("\n");
    const result = await window.electronAPI?.export?.saveTxt(active.fileName, content);
    if (result?.ok) {
      toast.success("TXT exported");
      addNotification("success", "TXT exported", `${active.fileName} saved`, "export");
    } else if (result?.error && result.error !== "Export cancelled.") {
      toast.error("Export failed", { description: result.error });
    }
  };

  // Virtual scroll for transcript
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rowHeight = 36;
    const start = Math.floor(el.scrollTop / rowHeight);
    const visible = Math.ceil(el.clientHeight / rowHeight);
    setVisibleRange({ start: Math.max(0, start - 5), end: start + visible + 10 });
  };

  const utterances = active?.utterances || [];
  const totalHeight = utterances.length * 36;

  if (!selectedId || transcripts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <FileText className="size-8 opacity-30 mb-2" />
        <span className="text-sm">No transcript selected.</span>
        <span className="text-xs mt-1">Transcribe an audio file first, then edit here.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* File selector */}
        <select
          className="h-8 text-xs border rounded px-2 bg-background"
          value={selectedId || ""}
          onChange={(e) => { setSelectedId(e.target.value); setActiveId(e.target.value); }}
        >
          {transcripts.map((t) => (
            <option key={t.fileId} value={t.fileId}>{t.fileName}</option>
          ))}
        </select>

        <div className="flex-1" />

        {/* Save status */}
        <SaveStatusBadge status={saveStatus} />

        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={doSave} disabled={saveStatus === "saving"}>
          <Save className="size-3 mr-1" />Save
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={exportTxt}>
          <Download className="size-3 mr-1" />Export TXT
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : doc ? (
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-[10px] uppercase text-muted-foreground font-medium">Title</label>
            <Input
              value={doc.title}
              onChange={(e) => updateDoc({ title: e.target.value })}
              placeholder="Document title"
              className="h-8 text-sm"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="text-[10px] uppercase text-muted-foreground font-medium">Summary</label>
            <Textarea
              value={doc.summary}
              onChange={(e) => updateDoc({ summary: e.target.value })}
              placeholder="AI-generated or manual summary..."
              className="text-sm min-h-[60px] resize-y"
            />
          </div>

          {/* Key Points */}
          <EditableList
            label="Key Points"
            items={doc.pointNotes}
            field="pointNotes"
            onUpdate={updateListItem}
            onAdd={addListItem}
            onRemove={removeListItem}
          />

          {/* Action Items */}
          <EditableList
            label="Action Items"
            items={doc.actionItems}
            field="actionItems"
            onUpdate={updateListItem}
            onAdd={addListItem}
            onRemove={removeListItem}
          />

          {/* Transcript */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-[10px] uppercase text-muted-foreground font-medium">Transcript</label>
              <Badge variant="outline" className="text-[9px] h-4">{utterances.length} segments</Badge>
            </div>
            <div
              ref={scrollRef}
              className="border rounded max-h-[400px] overflow-auto"
              onScroll={handleScroll}
            >
              <div style={{ height: totalHeight, position: "relative" }}>
                {utterances.slice(visibleRange.start, visibleRange.end).map((u, idx) => {
                  const realIdx = visibleRange.start + idx;
                  const editedText = doc.editedUtterances[realIdx];
                  const displaySpeaker = doc.speakerNames[u.speaker] || u.speaker;
                  return (
                    <div
                      key={realIdx}
                      className="flex items-start gap-2 px-2 text-xs border-b"
                      style={{ position: "absolute", top: realIdx * 36, height: 36, left: 0, right: 0 }}
                    >
                      <span className="font-mono text-muted-foreground shrink-0 w-14 leading-[36px]">
                        {msToTs(u.startMs)}
                      </span>
                      <input
                        className="shrink-0 w-20 bg-transparent border-r px-1 leading-[36px] text-xs font-medium focus:outline-none focus:bg-muted/30"
                        value={displaySpeaker}
                        onChange={(e) => updateSpeakerName(u.speaker, e.target.value)}
                        title="Edit speaker name"
                      />
                      <input
                        className="flex-1 bg-transparent leading-[36px] text-xs focus:outline-none focus:bg-muted/30 px-1"
                        value={editedText !== undefined ? editedText : u.text}
                        onChange={(e) => updateUtterance(realIdx, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  switch (status) {
    case "unsaved":
      return <Badge variant="outline" className="text-[9px] h-5 text-amber-600"><AlertCircle className="size-3 mr-0.5" />Unsaved</Badge>;
    case "saving":
      return <Badge variant="outline" className="text-[9px] h-5 text-blue-600"><Loader2 className="size-3 mr-0.5 animate-spin" />Saving</Badge>;
    case "saved":
      return <Badge variant="outline" className="text-[9px] h-5 text-emerald-600"><CheckCircle2 className="size-3 mr-0.5" />Saved</Badge>;
    case "failed":
      return <Badge variant="outline" className="text-[9px] h-5 text-red-600"><AlertCircle className="size-3 mr-0.5" />Failed</Badge>;
    default:
      return null;
  }
}

function EditableList({ label, items, field, onUpdate, onAdd, onRemove }: {
  label: string;
  items: string[];
  field: "pointNotes" | "actionItems" | "decisions" | "risks";
  onUpdate: (field: "pointNotes" | "actionItems" | "decisions" | "risks", index: number, value: string) => void;
  onAdd: (field: "pointNotes" | "actionItems" | "decisions" | "risks") => void;
  onRemove: (field: "pointNotes" | "actionItems" | "decisions" | "risks", index: number) => void;
}) {
  if (items.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase text-muted-foreground font-medium">{label}</label>
          <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => onAdd(field)}>
            <Plus className="size-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-[10px] uppercase text-muted-foreground font-medium">{label}</label>
        <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => onAdd(field)}>
          <Plus className="size-3" />
        </Button>
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground w-4 shrink-0">{i + 1}.</span>
            <Input
              value={item}
              onChange={(e) => onUpdate(field, i, e.target.value)}
              className="h-7 text-xs flex-1"
            />
            <Button type="button" variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => onRemove(field, i)}>
              <X className="size-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function msToTs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
