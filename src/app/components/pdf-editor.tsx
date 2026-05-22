import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { Separator } from "./ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { toast } from "sonner";
import {
  Download, Printer, FileText, Search, CheckCircle2, AlertTriangle,
  Loader2, Palette, PanelLeftClose, PanelLeftOpen, FileAudio, LayoutTemplate,
  ZoomIn, ZoomOut, Maximize2, RefreshCw, Save, FileEdit,
} from "lucide-react";
import { useTranscripts } from "../transcript-store";
import { usePdfDraft } from "../pdf-draft-store";
import { notifyPdfExported, notifyPdfFailed } from "../notification-store";
import { SpeakerProfile, generateProfiles, loadSpeakerProfiles, saveSpeakerProfiles, getColor, getDisplayName } from "../pdf-speaker-store";
import { PdfTemplateConfig, HeaderConfig, FooterConfig, builtInTemplates, getAllTemplates, loadCustomTemplates, saveCustomTemplates } from "../pdf-template-store";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./ui/resizable";
import { SpeakerEditor } from "./pdf-speaker-editor";
import { HeaderFooterEditor } from "./pdf-header-footer-editor";
import { SaveTemplateDialog } from "./pdf-save-template-dialog";
import { DocumentEditor } from "./document-editor";
import { loadDocument } from "../document-store";

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

// --- Main Component ---
export function PdfEditor() {
  const { transcripts, getActiveSummary, setActiveId } = useTranscripts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<PdfSettings>(defaultSettings);
  const [searchQuery, setSearchQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("recllm-pdf-sidebar") === "collapsed"; } catch { return false; }
  });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [showModal, setShowModal] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = transcripts.find((t) => t.fileId === selectedId) || null;
  const summary = selectedId ? getActiveSummary() : null;
  const { draft, updateDraft, resetDraft, setSpeakerName, setUtteranceText } = usePdfDraft(selectedId, settings.headerText);
  const [speakerProfiles, setSpeakerProfiles] = useState<SpeakerProfile[]>([]);
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>({
    enabled: true, mode: "auto", title: "RecLLM — Transcript Report", subtitle: "",
    showFileName: true, showDate: true, showTime: false, showLogo: true, companyName: "", alignment: "left",
  });
  const [footerConfig, setFooterConfig] = useState<FooterConfig>({
    enabled: true, mode: "auto", text: "", showPageNumbers: true, showConfidential: false, showGeneratedBy: true, alignment: "center",
  });
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [allTemplates, setAllTemplates] = useState<PdfTemplateConfig[]>(getAllTemplates);

  useEffect(() => {
    try { localStorage.setItem("recllm-pdf-sidebar", sidebarCollapsed ? "collapsed" : "expanded"); } catch {}
  }, [sidebarCollapsed]);

  // Debounced preview refresh
  const triggerPreviewRefresh = useCallback(() => {
    setPreviewLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewKey((k) => k + 1);
      setPreviewLoading(false);
    }, 350);
  }, []);

  // Trigger refresh when settings change
  useEffect(() => { triggerPreviewRefresh(); }, [settings, triggerPreviewRefresh]);

  // Filter transcripts
  const filtered = useMemo(() => {
    if (!searchQuery) return transcripts;
    const q = searchQuery.toLowerCase();
    return transcripts.filter((t) =>
      t.fileName.toLowerCase().includes(q) ||
      t.languageCode.toLowerCase().includes(q)
    );
  }, [transcripts, searchQuery]);

  // Speaker color map derived from profiles
  const speakerColorMap = useMemo(() => {
    const map = new Map<string, string>();
    speakerProfiles.forEach((p) => {
      if (p.enabled) map.set(p.id, p.color);
    });
    return map;
  }, [speakerProfiles]);

  const selectTranscript = (id: string) => {
    setSelectedId(id);
    setActiveId(id);
    resetDraft(id);
    // Load or generate speaker profiles
    const tr = transcripts.find((t) => t.fileId === id);
    if (tr) {
      const saved = loadSpeakerProfiles(id);
      if (saved) {
        setSpeakerProfiles(saved);
      } else {
        const speakers = Array.from(new Set(tr.utterances.map((u) => u.speaker)));
        setSpeakerProfiles(generateProfiles(speakers));
      }
    }
  };

  // Save speaker profiles when they change
  const handleSpeakerProfilesChange = (profiles: SpeakerProfile[]) => {
    setSpeakerProfiles(profiles);
    if (selectedId) saveSpeakerProfiles(selectedId, profiles);
    triggerPreviewRefresh();
  };

  const handleHeaderChange = (patch: Partial<HeaderConfig>) => {
    setHeaderConfig((prev) => ({ ...prev, ...patch }));
    triggerPreviewRefresh();
  };

  const handleFooterChange = (patch: Partial<FooterConfig>) => {
    setFooterConfig((prev) => ({ ...prev, ...patch }));
    triggerPreviewRefresh();
  };

  // Apply template
  const applyTemplate = (templateId: string) => {
    const tmpl = allTemplates.find((t) => t.id === templateId);
    if (!tmpl) return;
    updateSettings({ template: templateId });
    setHeaderConfig(tmpl.settings.header);
    setFooterConfig(tmpl.settings.footer);
    updateSettings({
      fontSize: tmpl.settings.fontSize,
      pageSize: tmpl.settings.pageSize,
      orientation: tmpl.settings.orientation,
      columns: tmpl.settings.columns,
      showSpeakerColors: tmpl.settings.speakerColorsEnabled,
    });
    updateSections(tmpl.settings.sections);
  };

  const updateSettings = (patch: Partial<PdfSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const updateSections = (patch: Partial<PdfSettings["sections"]>) => {
    setSettings((prev) => ({ ...prev, sections: { ...prev.sections, ...patch } }));
  };

  const buildExportData = () => {
    if (!active) return null;

    // Apply document edits (speaker names + edited utterances) to export data
    const utterances = settings.sections.transcript ? active.utterances.map((u, i) => ({
      ...u,
      speaker: draft.speakerNames[u.speaker] || u.speaker,
      text: draft.editedUtterances[i] || u.text,
    })) : undefined;

    return {
      fileName: active.fileName,
      processedAt: active.completedAt || new Date().toISOString(),
      languageCode: active.languageCode,
      summary: settings.sections.summary ? summary?.summary : undefined,
      pointNotes: settings.sections.keyPoints ? summary?.pointNotes : undefined,
      actionItems: settings.sections.actionItems ? summary?.actionItems : undefined,
      decisions: settings.sections.decisions ? summary?.decisions : undefined,
      risks: settings.sections.risks ? summary?.risks : undefined,
      utterances,
      config: {
        pageSize: settings.pageSize,
        orientation: settings.orientation,
        margin: "medium",
        fontSize: settings.fontSize,
        columns: settings.columns,
        header: headerConfig,
        footer: footerConfig,
        speakerColorsEnabled: settings.showSpeakerColors,
        speakers: speakerProfiles.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          color: p.color,
          enabled: p.enabled,
        })),
        timeFormat: "start" as const,
        sections: settings.sections,
      },
    };
  };

  const exportPdf = async () => {
    if (!active) { toast.error("No transcript selected"); return; }
    if (!window.electronAPI?.pdf) { toast.error("PDF export not available in browser mode"); return; }
    setExporting(true);
    const data = buildExportData()!;
    const result = await window.electronAPI.pdf.exportReport(data);
    setExporting(false);
    if (result.ok) { toast.success("PDF exported", { description: result.filePath }); notifyPdfExported(active.fileName, result.filePath); }
    else if (result.error !== "Export cancelled.") { toast.error("Export failed", { description: result.error }); notifyPdfFailed(active.fileName, result.error); }
  };

  const printPdf = async () => {
    if (!active) { toast.error("No transcript selected"); return; }
    if (!window.electronAPI?.pdf) { toast.error("Print not available in browser mode"); return; }
    setPrinting(true);
    toast.info("Generating PDF for print...");
    const data = buildExportData()!;
    const result = await window.electronAPI.pdf.print(data);
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
    <Tabs defaultValue="document" className="h-full flex flex-col -m-6">
      <div className="border-b px-6 pt-2">
        <TabsList className="h-8">
          <TabsTrigger value="document" className="text-xs gap-1.5"><FileEdit className="size-3" />Document</TabsTrigger>
          <TabsTrigger value="export" className="text-xs gap-1.5"><Download className="size-3" />Export PDF</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="document" className="flex-1 overflow-auto p-6 mt-0">
        <DocumentEditor />
      </TabsContent>

      <TabsContent value="export" className="flex-1 min-h-0 mt-0">
    <TooltipProvider delayDuration={200}>
    <div className="flex flex-col h-full">
      {/* Main content */}
      <div className="flex-1 min-h-0 flex">
        {/* Collapsible Left Sidebar */}
        <div className={`h-full border-r flex flex-col shrink-0 transition-all duration-200 ${sidebarCollapsed ? "w-12" : "w-56"}`}>
          {/* Collapse toggle */}
          <div className="p-2 border-b flex items-center justify-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </Button>
          </div>

          {/* Transcripts section */}
          {sidebarCollapsed ? (
            <div className="flex-1 flex flex-col items-center py-2 gap-1 overflow-hidden">
              {filtered.slice(0, 10).map((tr) => {
                const isSelected = tr.fileId === selectedId;
                return (
                  <Tooltip key={tr.fileId}>
                    <TooltipTrigger asChild>
                      <button
                        className={`size-8 rounded flex items-center justify-center transition-colors ${isSelected ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground"}`}
                        onClick={() => selectTranscript(tr.fileId)}
                      >
                        <FileAudio className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      <div className="font-medium">{tr.fileName}</div>
                      <div className="text-muted-foreground">Speakers: {new Set(tr.utterances.map((u) => u.speaker)).size} · Segments: {tr.utterances.length}</div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              <Separator className="my-1 w-6" />
              {templates.map((tmpl) => {
                const isActive = settings.template === tmpl.id;
                return (
                  <Tooltip key={tmpl.id}>
                    <TooltipTrigger asChild>
                      <button
                        className={`size-8 rounded flex items-center justify-center transition-colors ${isActive ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground"}`}
                        onClick={() => updateSettings({ template: tmpl.id })}
                      >
                        <LayoutTemplate className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      <div className="font-medium">{tmpl.label}</div>
                      <div className="text-muted-foreground">{tmpl.desc}</div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ) : (
            <>
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
                    const isSelected = tr.fileId === selectedId;
                    const speakers = new Set(tr.utterances.map((u) => u.speaker)).size;
                    const durationMs = tr.utterances.length > 0 ? tr.utterances[tr.utterances.length - 1].endMs : 0;
                    const durationStr = formatMsDuration(durationMs);
                    return (
                      <div
                        key={tr.fileId}
                        className={`p-2.5 rounded cursor-pointer text-xs transition-colors ${isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"}`}
                        onClick={() => selectTranscript(tr.fileId)}
                        onDoubleClick={() => { selectTranscript(tr.fileId); setShowModal(true); }}
                      >
                        <div className="font-medium truncate">{tr.fileName}</div>
                        <div className="text-muted-foreground mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                          <span>Speakers: {speakers}</span>
                          <span>Segments: {tr.utterances.length}</span>
                          <span>Duration: {durationStr}</span>
                          <span>{tr.languageCode.toUpperCase()}</span>
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
            </>
          )}
        </div>

        {/* Main area: Preview + Settings */}
        <div className="flex-1 min-w-0">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Center: PDF Preview */}
            <ResizablePanel defaultSize={60} minSize={40}>
              <div className="h-full flex flex-col bg-muted/20">
                <div className="p-2 border-b flex items-center gap-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex-1">Preview</span>
                  {previewLoading && <Badge variant="outline" className="text-[10px] h-5 gap-1"><RefreshCw className="size-3 animate-spin" />Updating</Badge>}
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom((z) => Math.max(50, z - 10))} title="Zoom out">
                    <ZoomOut className="size-3.5" />
                  </Button>
                  <span className="text-xs font-mono w-8 text-center">{zoom}%</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom((z) => Math.min(200, z + 10))} title="Zoom in">
                    <ZoomIn className="size-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowModal(true)} title="Fullscreen preview" disabled={!active}>
                    <Maximize2 className="size-3.5" />
                  </Button>
                </div>
                <ScrollArea className="flex-1 p-4">
                  {!active ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm gap-2">
                      <FileText className="size-8 opacity-40" />
                      <span>Select a transcript to preview</span>
                      <span className="text-xs">Double-click a transcript card for fullscreen</span>
                    </div>
                  ) : previewLoading ? (
                    <div className="mx-auto max-w-[700px] space-y-4 p-8">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ) : (
                    <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}>
                      <PdfPreview
                        key={previewKey}
                        transcript={active}
                        summary={summary}
                        settings={settings}
                        speakerColorMap={speakerColorMap}
                        draft={draft}
                        onEditHeader={(text) => updateDraft({ headerText: text })}
                        onEditUtterance={setUtteranceText}
                      />
                    </div>
                  )}
                </ScrollArea>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right: Settings */}
            <ResizablePanel defaultSize={40} minSize={25} maxSize={50}>
              <div className="h-full border-l flex flex-col">
                <div className="p-3 border-b text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  PDF Settings
                </div>
                <ScrollArea className="flex-1">
                  <PdfSettingsPanel
                    settings={settings}
                    onUpdate={updateSettings}
                    onUpdateSections={updateSections}
                    speakerProfiles={speakerProfiles}
                    onSpeakerProfilesChange={handleSpeakerProfilesChange}
                    headerConfig={headerConfig}
                    footerConfig={footerConfig}
                    onHeaderChange={handleHeaderChange}
                    onFooterChange={handleFooterChange}
                    hasSummary={!!summary}
                  />
                </ScrollArea>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="h-12 border-t bg-card flex items-center px-4 gap-3 shrink-0">
        <div className="flex-1 text-xs text-muted-foreground">
          {active ? `${active.fileName} · ${active.utterances.length} segments` : "No transcript selected"}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowSaveTemplate(true)}>
          <Save className="size-4 mr-1" /> Save Template
        </Button>
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

    {/* Fullscreen Preview Modal */}
    <Dialog open={showModal} onOpenChange={setShowModal}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <span>PDF Preview</span>
            {active && <Badge variant="outline" className="text-xs">{active.fileName}</Badge>}
            <div className="flex-1" />
            <Button size="sm" variant="outline" disabled={!active || printing} onClick={printPdf}>
              <Printer className="size-4 mr-1" /> Print
            </Button>
            <Button size="sm" disabled={!active || exporting} onClick={exportPdf}>
              <Download className="size-4 mr-1" /> Export
            </Button>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 p-6">
          {active && (
            <PdfPreview
              transcript={active}
              summary={summary}
              settings={settings}
              speakerColorMap={speakerColorMap}
              draft={draft}
              onEditHeader={(text) => updateDraft({ headerText: text })}
              onEditUtterance={setUtteranceText}
            />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>

    {/* Save Template Dialog */}
    <SaveTemplateDialog
      open={showSaveTemplate}
      onOpenChange={setShowSaveTemplate}
      currentSettings={{
        fontSize: settings.fontSize,
        pageSize: settings.pageSize,
        orientation: settings.orientation,
        columns: settings.columns,
        margin: "medium",
        header: headerConfig,
        footer: footerConfig,
        sections: settings.sections,
        speakerColorsEnabled: settings.showSpeakerColors,
      }}
      onSaved={() => { setAllTemplates(getAllTemplates()); toast.success("Template saved"); }}
    />
    </TooltipProvider>
      </TabsContent>
    </Tabs>
  );
}

// --- PDF Preview Component ---
function PdfPreview({ transcript, summary, settings, speakerColorMap, draft, onEditHeader, onEditUtterance }: {
  transcript: any;
  summary: any;
  settings: PdfSettings;
  speakerColorMap: Map<string, string>;
  draft: any;
  onEditHeader: (text: string) => void;
  onEditUtterance: (index: number, text: string) => void;
}) {
  const fontSizeClass = settings.fontSize === "small" ? "text-[9px]" : settings.fontSize === "large" ? "text-[13px]" : "text-[11px]";
  const [editingHeader, setEditingHeader] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const headerText = draft.headerText || settings.headerText;

  return (
    <div className={`bg-white text-black rounded shadow-lg mx-auto max-w-[700px] ${fontSizeClass}`}
      style={{ padding: "32px", minHeight: settings.orientation === "portrait" ? "900px" : "600px" }}
    >
      {/* Header */}
      {settings.showHeader && (
        <div className="border-b-2 border-blue-600 pb-2 mb-4">
          {editingHeader ? (
            <input
              className="text-lg font-bold text-blue-600 w-full border-b border-blue-300 outline-none bg-blue-50/50 px-1"
              defaultValue={headerText}
              autoFocus
              onBlur={(e) => { onEditHeader(e.target.value); setEditingHeader(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { onEditHeader((e.target as HTMLInputElement).value); setEditingHeader(false); } }}
            />
          ) : (
            <div
              className="text-lg font-bold text-blue-600 cursor-text hover:bg-blue-50/50 rounded px-1 -mx-1"
              onClick={() => setEditingHeader(true)}
              title="Click to edit header"
            >
              {headerText}
            </div>
          )}
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
          <div className="text-xs font-semibold text-blue-600 border-b border-gray-200 pb-1 mb-1">
            Transcript <span className="font-normal text-gray-400">({transcript.utterances.length} segments)</span>
          </div>
          <div className="space-y-0.5">
            {transcript.utterances.map((u: any, i: number) => {
              const displayText = draft.editedUtterances[i] || u.text;
              const displaySpeaker = draft.speakerNames[u.speaker] || u.speaker;
              // Visual page break indicator every 40 rows
              const showPageBreak = i > 0 && i % 40 === 0;
              return (
                <div key={i}>
                  {showPageBreak && (
                    <div className="border-t border-dashed border-gray-300 my-1.5 relative">
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white px-2 text-[8px] text-gray-300">page break</span>
                    </div>
                  )}
                  <div className="text-[9px] flex gap-2 group leading-tight">
                    <span className="font-mono text-gray-400 shrink-0 w-12">
                      {msToTs(u.startMs)}
                    </span>
                    <span
                      className="font-medium shrink-0 w-16"
                      style={{ color: settings.showSpeakerColors ? speakerColorMap.get(u.speaker) : undefined }}
                    >
                      {displaySpeaker}
                    </span>
                    {editingIdx === i ? (
                      <input
                        className="flex-1 border-b border-blue-300 outline-none bg-blue-50/50 text-[9px]"
                        defaultValue={displayText}
                        autoFocus
                        onBlur={(e) => { onEditUtterance(i, e.target.value); setEditingIdx(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { onEditUtterance(i, (e.target as HTMLInputElement).value); setEditingIdx(null); } }}
                      />
                    ) : (
                      <span
                        className="flex-1 cursor-text hover:bg-blue-50/50 rounded px-0.5 -mx-0.5"
                        onClick={() => setEditingIdx(i)}
                        title="Click to edit"
                      >
                        {displayText}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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

function formatMsDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// --- Settings Panel ---
function PdfSettingsPanel({ settings, onUpdate, onUpdateSections, speakerProfiles, onSpeakerProfilesChange, headerConfig, footerConfig, onHeaderChange, onFooterChange, hasSummary }: {
  settings: PdfSettings;
  onUpdate: (patch: Partial<PdfSettings>) => void;
  onUpdateSections: (patch: Partial<PdfSettings["sections"]>) => void;
  speakerProfiles: SpeakerProfile[];
  onSpeakerProfilesChange: (profiles: SpeakerProfile[]) => void;
  headerConfig: HeaderConfig;
  footerConfig: FooterConfig;
  onHeaderChange: (patch: Partial<HeaderConfig>) => void;
  onFooterChange: (patch: Partial<FooterConfig>) => void;
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
            <Select value={settings.pageSize} onValueChange={(v) => onUpdate({ pageSize: v as "A4" | "Letter" })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="Letter">Letter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-muted-foreground">Orientation</label>
            <Select value={settings.orientation} onValueChange={(v) => onUpdate({ orientation: v as "portrait" | "landscape" })}>
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
            <Select value={settings.fontSize} onValueChange={(v) => onUpdate({ fontSize: v as "small" | "medium" | "large" })}>
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
      <HeaderFooterEditor
        header={headerConfig}
        footer={footerConfig}
        onHeaderChange={onHeaderChange}
        onFooterChange={onFooterChange}
      />

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

      {/* Speaker Editor */}
      <SpeakerEditor profiles={speakerProfiles} onChange={onSpeakerProfilesChange} />
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
