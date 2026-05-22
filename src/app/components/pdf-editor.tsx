import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { Separator } from "./ui/separator";
import { toast } from "sonner";
import {
  Download, Printer, FileText, Search, CheckCircle2, AlertTriangle,
  Loader2, Palette,
} from "lucide-react";
import { useTranscripts } from "../transcript-store";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./ui/resizable";

// --- Types ---
interface PdfSettings {
  template: string;
  fontSize: "small" | "medium" | "large";
  pageSize: "A4" | "Letter";
  orientation: "portrait" | "landscape";
  columns: 1 | 2;
  showHeader: boolean;
  headerText: string;
  showFooter: boolean;
  showPageNumbers: boolean;
  showDateTime: boolean;
  showLogo: boolean;
  showSpeakerColors: boolean;
  sections: {
    summary: boolean;
    keyPoints: boolean;
    actionItems: boolean;
    decisions: boolean;
    risks: boolean;
    transcript: boolean;
    appendix: boolean;
  };
}

const defaultSettings: PdfSettings = {
  template: "business",
  fontSize: "medium",
  pageSize: "A4",
  orientation: "portrait",
  columns: 1,
  showHeader: true,
  headerText: "RecLLM — Transcript Report",
  showFooter: true,
  showPageNumbers: true,
  showDateTime: true,
  showLogo: true,
  showSpeakerColors: true,
  sections: {
    summary: true,
    keyPoints: true,
    actionItems: true,
    decisions: true,
    risks: true,
    transcript: true,
    appendix: true,
  },
};

const templates = [
  { id: "business", label: "Business Report", desc: "Professional corporate style" },
  { id: "meeting", label: "Meeting Minutes", desc: "Action-focused layout" },
  { id: "legal", label: "Legal / Official", desc: "Formal document style" },
  { id: "simple", label: "Simple Transcript", desc: "Clean text-only output" },
  { id: "timeline", label: "Speaker Timeline", desc: "Time-based speaker view" },
  { id: "japanese", label: "Japanese Enterprise", desc: "日本語ビジネス形式" },
];

const speakerColors = [
  "#2563eb", "#dc2626", "#d97706", "#059669",
  "#7c3aed", "#0891b2", "#be185d", "#ea580c",
];

// --- Main Component ---
export function PdfEditor() {
  const { transcripts, getActiveSummary, setActiveId } = useTranscripts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<PdfSettings>(defaultSettings);
  const [searchQuery, setSearchQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);

  const active = transcripts.find((t) => t.fileId === selectedId) || null;
  const summary = selectedId ? getActiveSummary() : null;

  // Filter transcripts
  const filtered = useMemo(() => {
    if (!searchQuery) return transcripts;
    const q = searchQuery.toLowerCase();
    return transcripts.filter((t) =>
      t.fileName.toLowerCase().includes(q) ||
      t.languageCode.toLowerCase().includes(q)
    );
  }, [transcripts, searchQuery]);

  // Speaker color map
  const speakerColorMap = useMemo(() => {
    if (!active) return new Map<string, string>();
    const speakers = Array.from(new Set(active.utterances.map((u) => u.speaker)));
    const map = new Map<string, string>();
    speakers.forEach((s, i) => map.set(s, speakerColors[i % speakerColors.length]));
    return map;
  }, [active]);

  const selectTranscript = (id: string) => {
    setSelectedId(id);
    setActiveId(id);
  };

  const updateSettings = (patch: Partial<PdfSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const updateSections = (patch: Partial<PdfSettings["sections"]>) => {
    setSettings((prev) => ({ ...prev, sections: { ...prev.sections, ...patch } }));
  };

  const exportPdf = async () => {
    if (!active) { toast.error("No transcript selected"); return; }
    if (!window.electronAPI?.pdf) { toast.error("PDF export not available in browser mode"); return; }
    setExporting(true);
    const result = await window.electronAPI.pdf.exportReport({
      fileName: active.fileName,
      processedAt: active.completedAt || new Date().toISOString(),
      languageCode: active.languageCode,
      summary: settings.sections.summary ? summary?.summary : undefined,
      pointNotes: settings.sections.keyPoints ? summary?.pointNotes : undefined,
      actionItems: settings.sections.actionItems ? summary?.actionItems : undefined,
      decisions: settings.sections.decisions ? summary?.decisions : undefined,
      risks: settings.sections.risks ? summary?.risks : undefined,
      utterances: settings.sections.transcript ? active.utterances : undefined,
    });
    setExporting(false);
    if (result.ok) toast.success("PDF exported", { description: result.filePath });
    else if (result.error !== "Export cancelled.") toast.error("Export failed", { description: result.error });
  };

  const printPdf = async () => {
    if (!active) { toast.error("No transcript selected"); return; }
    if (!window.electronAPI?.pdf) { toast.error("Print not available in browser mode"); return; }
    setPrinting(true);
    toast.info("Generating PDF for print...");
    // Use export then open — or direct print
    const result = await window.electronAPI.pdf.exportReport({
      fileName: active.fileName,
      processedAt: active.completedAt || new Date().toISOString(),
      languageCode: active.languageCode,
      summary: settings.sections.summary ? summary?.summary : undefined,
      pointNotes: settings.sections.keyPoints ? summary?.pointNotes : undefined,
      actionItems: settings.sections.actionItems ? summary?.actionItems : undefined,
      decisions: settings.sections.decisions ? summary?.decisions : undefined,
      risks: settings.sections.risks ? summary?.risks : undefined,
      utterances: settings.sections.transcript ? active.utterances : undefined,
    });
    setPrinting(false);
    if (result.ok) {
      toast.success("PDF ready for print", { description: "Opening system print dialog..." });
    } else if (result.error !== "Export cancelled.") {
      toast.error("Print failed", { description: result.error });
    }
  };

  // --- Empty state ---
  if (transcripts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center text-muted-foreground">
            <FileText className="size-12 mx-auto mb-3 opacity-40" />
            <div className="text-lg font-medium">No transcripts available</div>
            <div className="mt-1">Transcribe an audio file first, then return here to build a PDF report.</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Main content */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left: Transcript selector + Template */}
          <ResizablePanel defaultSize={22} minSize={18} maxSize={30}>
            <div className="h-full border-r flex flex-col">
              <div className="p-3 border-b space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Transcripts</div>
                <div className="relative">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-7 pl-8 text-xs"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {filtered.map((tr) => {
                    const hasSummary = transcripts.some(() => false); // simplified
                    const isSelected = tr.fileId === selectedId;
                    const speakers = new Set(tr.utterances.map((u) => u.speaker)).size;
                    return (
                      <div
                        key={tr.fileId}
                        className={`p-2 rounded cursor-pointer text-xs transition-colors ${isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"}`}
                        onClick={() => selectTranscript(tr.fileId)}
                      >
                        <div className="font-medium truncate">{tr.fileName}</div>
                        <div className="text-muted-foreground mt-0.5 flex gap-2">
                          <span>{tr.languageCode}</span>
                          <span>{speakers}sp</span>
                          <span>{tr.utterances.length}seg</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              {/* Template selector */}
              <div className="p-3 border-t space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Template</div>
                <div className="space-y-1">
                  {templates.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className={`p-2 rounded cursor-pointer text-xs transition-colors ${settings.template === tmpl.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"}`}
                      onClick={() => updateSettings({ template: tmpl.id })}
                    >
                      <div className="font-medium">{tmpl.label}</div>
                      <div className="text-muted-foreground">{tmpl.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Center: PDF Preview */}
          <ResizablePanel defaultSize={50} minSize={35}>
            <div className="h-full flex flex-col bg-muted/20">
              <div className="p-3 border-b text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Preview
              </div>
              <ScrollArea className="flex-1 p-4">
                {!active ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Select a transcript to preview
                  </div>
                ) : (
                  <PdfPreview
                    transcript={active}
                    summary={summary}
                    settings={settings}
                    speakerColorMap={speakerColorMap}
                  />
                )}
              </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Settings */}
          <ResizablePanel defaultSize={28} minSize={20} maxSize={35}>
            <div className="h-full border-l flex flex-col">
              <div className="p-3 border-b text-xs text-muted-foreground uppercase tracking-wider font-medium">
                PDF Settings
              </div>
              <ScrollArea className="flex-1">
                <PdfSettingsPanel
                  settings={settings}
                  onUpdate={updateSettings}
                  onUpdateSections={updateSections}
                  speakerColorMap={speakerColorMap}
                  hasSummary={!!summary}
                />
              </ScrollArea>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Bottom action bar */}
      <div className="h-12 border-t bg-card flex items-center px-4 gap-3 shrink-0">
        <div className="flex-1 text-xs text-muted-foreground">
          {active ? `${active.fileName} · ${active.utterances.length} segments` : "No transcript selected"}
        </div>
        <Button size="sm" variant="outline" disabled={!active || printing} onClick={printPdf}>
          {printing ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Printer className="size-4 mr-1" />}
          Print PDF
        </Button>
        <Button size="sm" disabled={!active || exporting} onClick={exportPdf}>
          {exporting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Download className="size-4 mr-1" />}
          Export PDF
        </Button>
      </div>
    </div>
  );
}

// --- PDF Preview Component ---
function PdfPreview({ transcript, summary, settings, speakerColorMap }: {
  transcript: any;
  summary: any;
  settings: PdfSettings;
  speakerColorMap: Map<string, string>;
}) {
  const fontSizeClass = settings.fontSize === "small" ? "text-[9px]" : settings.fontSize === "large" ? "text-[13px]" : "text-[11px]";

  return (
    <div className={`bg-white text-black rounded shadow-lg mx-auto max-w-[700px] ${fontSizeClass}`}
      style={{ aspectRatio: settings.orientation === "portrait" ? "210/297" : "297/210", padding: "32px" }}
    >
      {/* Header */}
      {settings.showHeader && (
        <div className="border-b-2 border-blue-600 pb-2 mb-4">
          <div className="text-lg font-bold text-blue-600">{settings.headerText}</div>
          <div className="text-xs text-gray-500">{transcript.fileName}</div>
        </div>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-3 gap-2 mb-4 p-2 bg-gray-50 rounded border text-[9px]">
        <div><span className="text-gray-500 uppercase">Language</span><br />{transcript.languageCode}</div>
        <div><span className="text-gray-500 uppercase">Speakers</span><br />{new Set(transcript.utterances.map((u: any) => u.speaker)).size}</div>
        <div><span className="text-gray-500 uppercase">Segments</span><br />{transcript.utterances.length}</div>
      </div>

      {/* No summary warning */}
      {!summary && settings.sections.summary && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700 mb-3">
          <AlertTriangle className="size-3 shrink-0" />
          Generate AI analysis first for a richer report.
        </div>
      )}

      {/* Summary */}
      {settings.sections.summary && summary?.summary && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-blue-600 border-b border-gray-200 pb-1 mb-1">Summary</div>
          <div className="text-[10px] leading-relaxed line-clamp-4">{summary.summary}</div>
        </div>
      )}

      {/* Key Points */}
      {settings.sections.keyPoints && summary?.pointNotes?.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-blue-600 border-b border-gray-200 pb-1 mb-1">Key Points</div>
          <ol className="text-[10px] pl-4 space-y-0.5">
            {summary.pointNotes.slice(0, 5).map((n: string, i: number) => (
              <li key={i}>{n}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Speaker Color Legend */}
      {settings.showSpeakerColors && speakerColorMap.size > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-blue-600 border-b border-gray-200 pb-1 mb-1">Speakers</div>
          <div className="flex flex-wrap gap-2">
            {Array.from(speakerColorMap.entries()).map(([speaker, color]) => (
              <div key={speaker} className="flex items-center gap-1 text-[9px]">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span>{speaker}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transcript preview */}
      {settings.sections.transcript && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-blue-600 border-b border-gray-200 pb-1 mb-1">Transcript</div>
          <div className="space-y-1 max-h-[200px] overflow-hidden">
            {transcript.utterances.slice(0, 8).map((u: any, i: number) => (
              <div key={i} className="text-[9px] flex gap-2">
                <span className="font-mono text-gray-400 shrink-0 w-12">
                  {msToTs(u.startMs)}
                </span>
                <span
                  className="font-medium shrink-0 w-16"
                  style={{ color: settings.showSpeakerColors ? speakerColorMap.get(u.speaker) : undefined }}
                >
                  {u.speaker}
                </span>
                <span className="truncate">{u.text}</span>
              </div>
            ))}
            {transcript.utterances.length > 8 && (
              <div className="text-[9px] text-gray-400 italic">... {transcript.utterances.length - 8} more segments</div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      {settings.showFooter && (
        <div className="mt-auto pt-3 border-t border-gray-200 text-[8px] text-gray-400 text-center">
          Generated by RecLLM · {settings.showDateTime ? new Date().toISOString().slice(0, 10) : ""}
          {settings.showPageNumbers && " · Page 1"}
        </div>
      )}
    </div>
  );
}

function msToTs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// --- Settings Panel ---
function PdfSettingsPanel({ settings, onUpdate, onUpdateSections, speakerColorMap, hasSummary }: {
  settings: PdfSettings;
  onUpdate: (patch: Partial<PdfSettings>) => void;
  onUpdateSections: (patch: Partial<PdfSettings["sections"]>) => void;
  speakerColorMap: Map<string, string>;
  hasSummary: boolean;
}) {
  return (
    <div className="p-3 space-y-4 text-xs">
      {/* Page */}
      <div className="space-y-2">
        <div className="font-medium text-muted-foreground uppercase tracking-wider">Page</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-muted-foreground">Size</label>
            <Select value={settings.pageSize} onValueChange={(v) => onUpdate({ pageSize: v as any })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="Letter">Letter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-muted-foreground">Orientation</label>
            <Select value={settings.orientation} onValueChange={(v) => onUpdate({ orientation: v as any })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait</SelectItem>
                <SelectItem value="landscape">Landscape</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-muted-foreground">Font Size</label>
            <Select value={settings.fontSize} onValueChange={(v) => onUpdate({ fontSize: v as any })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-muted-foreground">Columns</label>
            <Select value={String(settings.columns)} onValueChange={(v) => onUpdate({ columns: Number(v) as 1 | 2 })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Column</SelectItem>
                <SelectItem value="2">2 Columns</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Header/Footer */}
      <div className="space-y-2">
        <div className="font-medium text-muted-foreground uppercase tracking-wider">Header & Footer</div>
        <SettingRow label="Header" checked={settings.showHeader} onChange={(v) => onUpdate({ showHeader: v })} />
        {settings.showHeader && (
          <Input
            value={settings.headerText}
            onChange={(e) => onUpdate({ headerText: e.target.value })}
            className="h-7 text-xs"
            placeholder="Header text"
          />
        )}
        <SettingRow label="Footer" checked={settings.showFooter} onChange={(v) => onUpdate({ showFooter: v })} />
        <SettingRow label="Page numbers" checked={settings.showPageNumbers} onChange={(v) => onUpdate({ showPageNumbers: v })} />
        <SettingRow label="Date/time" checked={settings.showDateTime} onChange={(v) => onUpdate({ showDateTime: v })} />
        <SettingRow label="Logo" checked={settings.showLogo} onChange={(v) => onUpdate({ showLogo: v })} />
      </div>

      <Separator />

      {/* Sections */}
      <div className="space-y-2">
        <div className="font-medium text-muted-foreground uppercase tracking-wider">Sections</div>
        {!hasSummary && (
          <div className="flex items-center gap-1.5 p-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-600">
            <AlertTriangle className="size-3" />
            <span>No AI summary. Generate one for full report.</span>
          </div>
        )}
        <SettingRow label="Summary" checked={settings.sections.summary} onChange={(v) => onUpdateSections({ summary: v })} />
        <SettingRow label="Key Points" checked={settings.sections.keyPoints} onChange={(v) => onUpdateSections({ keyPoints: v })} />
        <SettingRow label="Action Items" checked={settings.sections.actionItems} onChange={(v) => onUpdateSections({ actionItems: v })} />
        <SettingRow label="Decisions" checked={settings.sections.decisions} onChange={(v) => onUpdateSections({ decisions: v })} />
        <SettingRow label="Risks" checked={settings.sections.risks} onChange={(v) => onUpdateSections({ risks: v })} />
        <SettingRow label="Transcript" checked={settings.sections.transcript} onChange={(v) => onUpdateSections({ transcript: v })} />
        <SettingRow label="Full Appendix" checked={settings.sections.appendix} onChange={(v) => onUpdateSections({ appendix: v })} />
      </div>

      <Separator />

      {/* Speaker Colors */}
      <div className="space-y-2">
        <div className="font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Palette className="size-3" /> Speaker Colors
        </div>
        <SettingRow label="Enable colors" checked={settings.showSpeakerColors} onChange={(v) => onUpdate({ showSpeakerColors: v })} />
        {settings.showSpeakerColors && speakerColorMap.size > 0 && (
          <div className="space-y-1 pl-1">
            {Array.from(speakerColorMap.entries()).map(([speaker, color]) => (
              <div key={speaker} className="flex items-center gap-2">
                <span className="size-3 rounded-full border" style={{ backgroundColor: color }} />
                <span>{speaker}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} className="scale-75" />
    </div>
  );
}
