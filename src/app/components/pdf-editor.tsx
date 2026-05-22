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
  ZoomIn, ZoomOut, Maximize2, RefreshCw, Save, FileEdit, Sparkles,
  MousePointer2, Type, Image, MessageSquare, Highlighter, EyeOff, StickyNote,
  Eye, Pencil, Columns2, Keyboard,
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
  sectionOrder: string[];
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
  sectionOrder: ["summary", "keyPoints", "actionItems", "decisions", "risks", "transcript", "appendix"],
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
  const [editorMode, setEditorMode] = useState<"preview" | "edit" | "print">("preview");
  const [activeTool, setActiveTool] = useState<string>("select");
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
      <div className="border-b px-6 pt-2 flex items-center gap-3">
        <TabsList className="h-8">
          <TabsTrigger value="document" className="text-xs gap-1.5"><FileEdit className="size-3" />Document</TabsTrigger>
          <TabsTrigger value="export" className="text-xs gap-1.5"><Download className="size-3" />Export PDF</TabsTrigger>
        </TabsList>
        <div className="flex-1" />
        {/* Editor mode switcher */}
        <div className="flex items-center border rounded h-6 overflow-hidden">
          {([["preview", Eye, "Preview"], ["edit", Pencil, "Edit"], ["print", Printer, "Print"]] as const).map(([mode, Icon, label]) => (
            <button
              key={mode}
              className={`h-6 px-2 flex items-center gap-1 text-[9px] transition-colors ${editorMode === mode ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/40"}`}
              onClick={() => setEditorMode(mode)}
              title={`${label} mode`}
            >
              <Icon className="size-3" />{label}
            </button>
          ))}
        </div>
        {/* Keyboard shortcut hint */}
        <div className="text-[8px] text-muted-foreground font-mono hidden xl:block">⌘P print · ⌘E export · ⌘S save</div>
      </div>

      <TabsContent value="document" className="flex-1 overflow-auto p-6 mt-0">
        <DocumentEditor />
      </TabsContent>

      <TabsContent value="export" className="flex-1 min-h-0 mt-0">
    <TooltipProvider delayDuration={200}>
    <div className="flex flex-col h-full">
      {/* Main content */}
      <div className="flex-1 min-h-0 flex">
        {/* Left vertical editing toolbar */}
        <EditorToolbar activeTool={activeTool} setActiveTool={setActiveTool} editorMode={editorMode} />

        {/* Collapsible Left Sidebar */}
        <div className={`h-full border-r flex flex-col shrink-0 transition-all duration-200 ${sidebarCollapsed ? "w-10" : "w-44"}`}>
          {/* Collapse toggle */}
          <div className="p-1.5 border-b flex items-center justify-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
            </Button>
          </div>

          {/* Transcripts section */}
          {sidebarCollapsed ? (
            <div className="flex-1 flex flex-col items-center py-1.5 gap-0.5 overflow-hidden">
              {filtered.slice(0, 10).map((tr) => {
                const isSelected = tr.fileId === selectedId;
                return (
                  <Tooltip key={tr.fileId}>
                    <TooltipTrigger asChild>
                      <button
                        className={`size-7 rounded flex items-center justify-center transition-colors ${isSelected ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground"}`}
                        onClick={() => selectTranscript(tr.fileId)}
                      >
                        <FileAudio className="size-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      <div className="font-medium">{tr.fileName}</div>
                      <div className="text-muted-foreground">Speakers: {new Set(tr.utterances.map((u) => u.speaker)).size} · Segments: {tr.utterances.length}</div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ) : (
            <>
              <div className="p-2 border-b space-y-1.5">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Transcripts</div>
                <div className="relative">
                  <Search className="size-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-6 pl-7 text-[10px]"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-1.5 space-y-0.5">
                  {filtered.map((tr) => {
                    const isSelected = tr.fileId === selectedId;
                    const speakers = new Set(tr.utterances.map((u) => u.speaker)).size;
                    return (
                      <div
                        key={tr.fileId}
                        className={`px-2 py-1.5 rounded cursor-pointer text-[10px] transition-colors ${isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/50 border-l-2 border-l-transparent"}`}
                        onClick={() => selectTranscript(tr.fileId)}
                        onDoubleClick={() => { selectTranscript(tr.fileId); setShowModal(true); }}
                      >
                        <div className="font-medium truncate">{tr.fileName}</div>
                        <div className="text-muted-foreground mt-0.5 flex gap-2">
                          <span>{speakers} spk</span>
                          <span>{tr.utterances.length} seg</span>
                          <span className="uppercase">{tr.languageCode}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              {/* Template selector — compact dropdown */}
              <div className="p-2 border-t">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Template</div>
                <Select value={settings.template} onValueChange={(v) => applyTemplate(v)}>
                  <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allTemplates.map((tmpl) => (
                      <SelectItem key={tmpl.id} value={tmpl.id} className="text-[10px]">{tmpl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        {/* Main area: Preview + Settings */}
        <div className="flex-1 min-w-0">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Center: PDF Preview — dominant canvas */}
            <ResizablePanel defaultSize={72} minSize={55}>
              <div className="h-full flex flex-col bg-neutral-100 dark:bg-neutral-900/50">
                <div className="h-7 px-2 border-b bg-muted/30 flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium flex-1">Preview</span>
                  {previewLoading && <Badge variant="outline" className="text-[9px] h-4 gap-0.5"><RefreshCw className="size-2.5 animate-spin" />Updating</Badge>}
                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => setZoom((z) => Math.max(50, z - 10))} title="Zoom out">
                    <ZoomOut className="size-3" />
                  </Button>
                  <span className="text-[9px] font-mono w-7 text-center">{zoom}%</span>
                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => setZoom((z) => Math.min(200, z + 10))} title="Zoom in">
                    <ZoomIn className="size-3" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => setZoom(100)} title="Fit width">
                    <Maximize2 className="size-3" />
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-6 flex justify-center min-h-full">
                  {!active ? (
                    <div className="flex flex-col items-center justify-center text-muted-foreground py-16 max-w-[280px] text-center">
                      <FileText className="size-8 opacity-20 mb-3" />
                      <div className="text-[11px] font-medium mb-1">No document selected</div>
                      <div className="text-[10px] mb-3">Select a transcript from the sidebar to generate a PDF report.</div>
                      <div className="text-[9px] space-y-0.5 text-left w-full">
                        <div className="text-muted-foreground/70">Report types:</div>
                        <div>• Business Report</div>
                        <div>• Meeting Minutes</div>
                        <div>• Legal Transcript</div>
                        <div>• Speaker Timeline</div>
                      </div>
                      <div className="text-[9px] mt-3 space-y-0.5 text-left w-full">
                        <div className="text-muted-foreground/70">Shortcuts:</div>
                        <div>• Double-click transcript → fullscreen</div>
                        <div>• Click header/text → edit inline</div>
                      </div>
                    </div>
                  ) : previewLoading ? (
                    <div className="w-full max-w-[700px] space-y-4 p-8 bg-white dark:bg-white rounded shadow-lg">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ) : (
                    <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}>
                      <div className="shadow-xl rounded-sm">
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
                    </div>
                  )}
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right: Inspector — compact */}
            <ResizablePanel defaultSize={28} minSize={20} maxSize={38}>
              <div className="h-full border-l flex flex-col">
                <div className="h-7 px-2.5 border-b flex items-center shrink-0">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Inspector</span>
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

      {/* Bottom status bar */}
      <div className="h-7 border-t bg-muted/20 flex items-center px-3 gap-3 text-[9px] text-muted-foreground font-mono shrink-0">
        {active ? (
          <>
            <span>{active.utterances.length} segments</span>
            <span className="text-border">│</span>
            <span>{new Set(active.utterances.map((u) => u.speaker)).size} speakers</span>
            <span className="text-border">│</span>
            <span>{active.languageCode.toUpperCase()}</span>
            <span className="text-border">│</span>
            <span>{settings.template}</span>
            <span className="text-border">│</span>
            <span>{settings.pageSize} {settings.orientation}</span>
          </>
        ) : (
          <span>No document</span>
        )}
        <div className="flex-1" />
        <span>Zoom: {zoom}%</span>
        <span className="text-border">│</span>
        <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1.5" onClick={() => setShowSaveTemplate(true)}>
          <Save className="size-2.5 mr-0.5" />Template
        </Button>
        <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5" disabled={!active || printing} onClick={printPdf}>
          {printing ? <Loader2 className="size-2.5 mr-0.5 animate-spin" /> : <Printer className="size-2.5 mr-0.5" />}
          Print
        </Button>
        <Button size="sm" className="h-5 text-[9px] px-1.5" disabled={!active || exporting} onClick={exportPdf}>
          {exporting ? <Loader2 className="size-2.5 mr-0.5 animate-spin" /> : <Download className="size-2.5 mr-0.5" />}
          Export
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

      {/* No summary warning */}
      {!summary && settings.sections.summary && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700 mb-3">
          <AlertTriangle className="size-3 shrink-0" />
          Generate AI analysis first for a richer report.
        </div>
      )}

      {/* Sections rendered in configured order */}
      {settings.sectionOrder.map((sectionKey) => {
        if (!settings.sections[sectionKey as keyof typeof settings.sections]) return null;
        switch (sectionKey) {
          case "summary":
            if (!summary?.summary) return null;
            return (
              <div key={sectionKey} className="mb-4">
                <div className="text-xs font-semibold text-blue-600 border-b border-gray-200 pb-1 mb-2">Executive Summary</div>
                <div className="text-[10px] leading-relaxed">{summary.summary}</div>
              </div>
            );
          case "keyPoints":
            if (!summary?.pointNotes?.length) return null;
            return (
              <div key={sectionKey} className="mb-4">
                <div className="text-xs font-semibold text-blue-600 border-b border-gray-200 pb-1 mb-2">Discussion Topics</div>
                <ol className="text-[10px] pl-4 space-y-1 list-decimal">
                  {summary.pointNotes.map((n: string, i: number) => (
                    <li key={i} className="leading-relaxed">{n}</li>
                  ))}
                </ol>
              </div>
            );
          case "actionItems":
            if (!summary?.actionItems?.length) return null;
            return (
              <div key={sectionKey} className="mb-4">
                <div className="text-xs font-semibold text-blue-600 border-b border-gray-200 pb-1 mb-2">Action Items</div>
                <ul className="text-[10px] pl-4 space-y-1">
                  {summary.actionItems.map((a: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="size-3 border border-gray-300 rounded-sm shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          case "decisions":
            if (!summary?.decisions?.length) return null;
            return (
              <div key={sectionKey} className="mb-4">
                <div className="text-xs font-semibold text-blue-600 border-b border-gray-200 pb-1 mb-2">Decisions</div>
                <ul className="text-[10px] pl-4 space-y-1 list-disc">
                  {summary.decisions.map((d: string, i: number) => (
                    <li key={i} className="leading-relaxed">{d}</li>
                  ))}
                </ul>
              </div>
            );
          case "risks":
            if (!summary?.risks?.length) return null;
            return (
              <div key={sectionKey} className="mb-4">
                <div className="text-xs font-semibold text-blue-600 border-b border-gray-200 pb-1 mb-2">Risks & Concerns</div>
                <ul className="text-[10px] pl-4 space-y-1 list-disc">
                  {summary.risks.map((r: string, i: number) => (
                    <li key={i} className="leading-relaxed">{r}</li>
                  ))}
                </ul>
              </div>
            );
          case "transcript":
            return (
              <div key={sectionKey} className="mb-3">
                <div className="text-xs font-semibold text-blue-600 border-b border-gray-200 pb-1 mb-1">
                  Transcript <span className="font-normal text-gray-400">({transcript.utterances.length} segments)</span>
                </div>
                <div className="space-y-0.5">
                  {transcript.utterances.map((u: any, i: number) => {
                    const displayText = draft.editedUtterances[i] || u.text;
                    const displaySpeaker = draft.speakerNames[u.speaker] || u.speaker;
                    const showPageBreak = i > 0 && i % 40 === 0;
                    return (
                      <div key={i}>
                        {showPageBreak && (
                          <div className="border-t border-dashed border-gray-300 my-1.5 relative">
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white px-2 text-[8px] text-gray-300">page break</span>
                          </div>
                        )}
                        <div className="text-[9px] flex gap-2 group leading-tight">
                          <span className="font-mono text-gray-400 shrink-0 w-12">{msToTs(u.startMs)}</span>
                          <span className="font-medium shrink-0 w-16" style={{ color: settings.showSpeakerColors ? speakerColorMap.get(u.speaker) : undefined }}>{displaySpeaker}</span>
                          {editingIdx === i ? (
                            <input
                              className="flex-1 border-b border-blue-300 outline-none bg-blue-50/50 text-[9px]"
                              defaultValue={displayText}
                              autoFocus
                              onBlur={(e) => { onEditUtterance(i, e.target.value); setEditingIdx(null); }}
                              onKeyDown={(e) => { if (e.key === "Enter") { onEditUtterance(i, (e.target as HTMLInputElement).value); setEditingIdx(null); } }}
                            />
                          ) : (
                            <span className="flex-1 cursor-text hover:bg-blue-50/50 rounded px-0.5 -mx-0.5" onClick={() => setEditingIdx(i)} title="Click to edit">{displayText}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          case "appendix":
            return null; // Appendix placeholder
          default:
            return null;
        }
      })}

      {/* Speaker Legend */}
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

      {/* Transcript */}
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  const isOpen = (key: string) => !collapsed[key];

  const reportPresets = [
    { id: "business", label: "Business Meeting" },
    { id: "legal", label: "Legal Transcript" },
    { id: "interview", label: "Interview" },
    { id: "podcast", label: "Podcast Summary" },
    { id: "medical", label: "Medical Notes" },
  ];

  const applyPreset = (id: string) => {
    switch (id) {
      case "business":
        onUpdateSections({ summary: true, keyPoints: true, actionItems: true, decisions: true, risks: true, transcript: true, appendix: false });
        break;
      case "legal":
        onUpdateSections({ summary: false, keyPoints: false, actionItems: false, decisions: false, risks: false, transcript: true, appendix: true });
        break;
      case "interview":
        onUpdateSections({ summary: true, keyPoints: true, actionItems: false, decisions: false, risks: false, transcript: true, appendix: false });
        break;
      case "podcast":
        onUpdateSections({ summary: true, keyPoints: true, actionItems: false, decisions: false, risks: false, transcript: false, appendix: false });
        break;
      case "medical":
        onUpdateSections({ summary: true, keyPoints: true, actionItems: true, decisions: true, risks: true, transcript: true, appendix: true });
        break;
    }
  };

  return (
    <div className="text-[10px]">
      {/* Document Outline */}
      <InspectorGroup title="Document Outline" open={isOpen("outline")} onToggle={() => toggle("outline")}>
        <div className="space-y-0.5 text-[9px]">
          {headerConfig.enabled && <div className="flex items-center gap-1.5 py-0.5 text-muted-foreground"><span className="size-1 rounded-full bg-blue-500" />Header</div>}
          {settings.sections.summary && <div className="flex items-center gap-1.5 py-0.5"><span className="size-1 rounded-full bg-emerald-500" />Executive Summary</div>}
          {settings.sections.keyPoints && <div className="flex items-center gap-1.5 py-0.5"><span className="size-1 rounded-full bg-violet-500" />Discussion Topics</div>}
          {settings.sections.actionItems && <div className="flex items-center gap-1.5 py-0.5"><span className="size-1 rounded-full bg-amber-500" />Action Items</div>}
          {settings.sections.decisions && <div className="flex items-center gap-1.5 py-0.5"><span className="size-1 rounded-full bg-cyan-500" />Decisions</div>}
          {settings.sections.risks && <div className="flex items-center gap-1.5 py-0.5"><span className="size-1 rounded-full bg-red-500" />Risks & Concerns</div>}
          {settings.sections.transcript && <div className="flex items-center gap-1.5 py-0.5"><span className="size-1 rounded-full bg-slate-500" />Transcript</div>}
          {settings.sections.appendix && <div className="flex items-center gap-1.5 py-0.5 text-muted-foreground"><span className="size-1 rounded-full bg-slate-400" />Appendix</div>}
          {footerConfig.enabled && <div className="flex items-center gap-1.5 py-0.5 text-muted-foreground"><span className="size-1 rounded-full bg-slate-400" />Footer</div>}
        </div>
      </InspectorGroup>

      {/* Report Preset */}
      <InspectorGroup title="Report Preset" open={isOpen("preset")} onToggle={() => toggle("preset")}>
        <div className="grid grid-cols-2 gap-1">
          {reportPresets.map((p) => (
            <button
              key={p.id}
              className="h-5 rounded border text-[9px] hover:bg-primary/5 hover:border-primary/30 transition-colors truncate px-1.5"
              onClick={() => applyPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </InspectorGroup>

      {/* Section Composer — reorderable */}
      <InspectorGroup title="Sections" open={isOpen("sections")} onToggle={() => toggle("sections")}>
        {!hasSummary && (
          <div className="flex items-center gap-1 p-1 bg-amber-500/10 border border-amber-500/20 rounded text-amber-600 text-[9px] mb-1">
            <AlertTriangle className="size-2.5" />
            <span>No summary generated</span>
          </div>
        )}
        <SectionComposer settings={settings} onUpdate={onUpdate} onUpdateSections={onUpdateSections} />
      </InspectorGroup>

      {/* AI Actions */}
      <InspectorGroup title="AI Actions" open={isOpen("ai")} onToggle={() => toggle("ai")}>
        <div className="space-y-1">
          <button className="w-full h-5 rounded border text-[9px] flex items-center justify-center gap-1 hover:bg-primary/5 hover:border-primary/30 transition-colors" disabled={hasSummary}>
            <Sparkles className="size-2.5" />Generate Summary
          </button>
          <button className="w-full h-5 rounded border text-[9px] flex items-center justify-center gap-1 hover:bg-primary/5 hover:border-primary/30 transition-colors" disabled>
            <CheckCircle2 className="size-2.5" />Extract Tasks
          </button>
          <button className="w-full h-5 rounded border text-[9px] flex items-center justify-center gap-1 hover:bg-primary/5 hover:border-primary/30 transition-colors" disabled>
            <FileText className="size-2.5" />Create Minutes
          </button>
          <button className="w-full h-5 rounded border text-[9px] flex items-center justify-center gap-1 hover:bg-primary/5 hover:border-primary/30 transition-colors" disabled>
            <Search className="size-2.5" />Redact Sensitive
          </button>
        </div>
      </InspectorGroup>

      {/* Layout */}
      <InspectorGroup title="Layout" open={isOpen("layout")} onToggle={() => toggle("layout")}>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          <InspectorField label="Size">
            <Select value={settings.pageSize} onValueChange={(v) => onUpdate({ pageSize: v as "A4" | "Letter" })}>
              <SelectTrigger className="h-5 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="Letter">Letter</SelectItem>
              </SelectContent>
            </Select>
          </InspectorField>
          <InspectorField label="Orientation">
            <Select value={settings.orientation} onValueChange={(v) => onUpdate({ orientation: v as "portrait" | "landscape" })}>
              <SelectTrigger className="h-5 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait</SelectItem>
                <SelectItem value="landscape">Landscape</SelectItem>
              </SelectContent>
            </Select>
          </InspectorField>
          <InspectorField label="Columns">
            <div className="flex gap-0.5">
              {[1, 2].map((n) => (
                <button key={n} className={`flex-1 h-5 rounded text-[9px] border transition-colors ${settings.columns === n ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted/50"}`}
                  onClick={() => onUpdate({ columns: n as 1 | 2 })}>{n}</button>
              ))}
            </div>
          </InspectorField>
        </div>
      </InspectorGroup>

      {/* Typography */}
      <InspectorGroup title="Typography" open={isOpen("typo")} onToggle={() => toggle("typo")}>
        <InspectorField label="Font Size">
          <div className="flex gap-0.5">
            {(["small", "medium", "large"] as const).map((s) => (
              <button key={s} className={`flex-1 h-5 rounded text-[9px] border capitalize transition-colors ${settings.fontSize === s ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted/50"}`}
                onClick={() => onUpdate({ fontSize: s })}>{s.slice(0, 3)}</button>
            ))}
          </div>
        </InspectorField>
        <InspectorCheck label="Speaker colors" checked={settings.showSpeakerColors} onChange={(v) => onUpdate({ showSpeakerColors: v })} />
      </InspectorGroup>

      {/* Branding */}
      <InspectorGroup title="Branding" open={isOpen("branding")} onToggle={() => toggle("branding")}>
        <div className="space-y-0.5">
          <InspectorCheck label="Show header" checked={headerConfig.enabled} onChange={(v) => onHeaderChange({ enabled: v })} />
          {headerConfig.enabled && (
            <div className="pl-3 space-y-0.5 border-l border-muted ml-1">
              <InspectorCheck label="File name" checked={headerConfig.showFileName} onChange={(v) => onHeaderChange({ showFileName: v })} />
              <InspectorCheck label="Date" checked={headerConfig.showDate} onChange={(v) => onHeaderChange({ showDate: v })} />
              <InspectorCheck label="Time" checked={headerConfig.showTime} onChange={(v) => onHeaderChange({ showTime: v })} />
              <InspectorCheck label="Logo" checked={headerConfig.showLogo} onChange={(v) => onHeaderChange({ showLogo: v })} />
            </div>
          )}
          <InspectorCheck label="Show footer" checked={footerConfig.enabled} onChange={(v) => onFooterChange({ enabled: v })} />
          {footerConfig.enabled && (
            <div className="pl-3 space-y-0.5 border-l border-muted ml-1">
              <InspectorCheck label="Page numbers" checked={footerConfig.showPageNumbers} onChange={(v) => onFooterChange({ showPageNumbers: v })} />
              <InspectorCheck label="Confidential" checked={footerConfig.showConfidential} onChange={(v) => onFooterChange({ showConfidential: v })} />
              <InspectorCheck label="Generated by" checked={footerConfig.showGeneratedBy} onChange={(v) => onFooterChange({ showGeneratedBy: v })} />
            </div>
          )}
        </div>
      </InspectorGroup>

      {/* Speakers */}
      <InspectorGroup title="Speakers" open={isOpen("speakers")} onToggle={() => toggle("speakers")}>
        <SpeakerEditor profiles={speakerProfiles} onChange={onSpeakerProfilesChange} />
      </InspectorGroup>
    </div>
  );
}

// --- Inspector primitives ---

function InspectorGroup({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b">
      <button
        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">{title}</span>
        <span className="text-[9px] text-muted-foreground">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="px-2.5 pb-2 space-y-1.5">{children}</div>}
    </div>
  );
}

function InspectorField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] text-muted-foreground mb-0.5">{label}</div>
      {children}
    </div>
  );
}

function InspectorCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-muted/20 rounded px-1 -mx-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3 rounded border-muted-foreground/40 accent-primary"
      />
      <span className="text-[10px]">{label}</span>
    </label>
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

// --- Section Composer with reordering ---
const sectionLabels: Record<string, string> = {
  summary: "Executive Summary",
  keyPoints: "Discussion Topics",
  actionItems: "Action Items",
  decisions: "Decisions",
  risks: "Risks & Concerns",
  transcript: "Transcript",
  appendix: "Appendix",
};

function SectionComposer({ settings, onUpdate, onUpdateSections }: {
  settings: PdfSettings;
  onUpdate: (patch: Partial<PdfSettings>) => void;
  onUpdateSections: (patch: Partial<PdfSettings["sections"]>) => void;
}) {
  const order = settings.sectionOrder;

  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    const next = [...order];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onUpdate({ sectionOrder: next });
  };

  const moveDown = (idx: number) => {
    if (idx >= order.length - 1) return;
    const next = [...order];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onUpdate({ sectionOrder: next });
  };

  return (
    <div className="space-y-0.5">
      {order.map((key, idx) => {
        const checked = settings.sections[key as keyof typeof settings.sections];
        const label = sectionLabels[key] || key;
        return (
          <div key={key} className="flex items-center gap-1 py-0.5 group hover:bg-muted/20 rounded px-1 -mx-1">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onUpdateSections({ [key]: e.target.checked })}
              className="size-3 rounded border-muted-foreground/40 accent-primary shrink-0"
            />
            <span className="text-[10px] flex-1">{label}</span>
            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="size-4 flex items-center justify-center text-muted-foreground hover:text-foreground rounded"
                onClick={() => moveUp(idx)}
                disabled={idx === 0}
                title="Move up"
              >
                <span className="text-[8px]">▲</span>
              </button>
              <button
                className="size-4 flex items-center justify-center text-muted-foreground hover:text-foreground rounded"
                onClick={() => moveDown(idx)}
                disabled={idx === order.length - 1}
                title="Move down"
              >
                <span className="text-[8px]">▼</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Editor Toolbar (vertical, left side) ---
const editorTools = [
  { id: "select", icon: MousePointer2, label: "Select", shortcut: "V" },
  { id: "text", icon: Type, label: "Text", shortcut: "T" },
  { id: "image", icon: Image, label: "Image", shortcut: "I" },
  { id: "annotate", icon: StickyNote, label: "Annotate", shortcut: "A" },
  { id: "highlight", icon: Highlighter, label: "Highlight", shortcut: "H" },
  { id: "redact", icon: EyeOff, label: "Redact", shortcut: "R" },
  { id: "comment", icon: MessageSquare, label: "Comment", shortcut: "C" },
];

function EditorToolbar({ activeTool, setActiveTool, editorMode }: {
  activeTool: string;
  setActiveTool: (tool: string) => void;
  editorMode: string;
}) {
  const isEditMode = editorMode === "edit";

  return (
    <div className="w-8 border-r bg-muted/10 flex flex-col items-center py-1.5 gap-0.5 shrink-0">
      {editorTools.map((tool) => {
        const Icon = tool.icon;
        const active = activeTool === tool.id;
        const disabled = !isEditMode && tool.id !== "select";
        return (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <button
                className={`size-6 rounded flex items-center justify-center transition-colors
                  ${active ? "bg-primary/20 text-primary" : disabled ? "text-muted-foreground/40 cursor-not-allowed" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                onClick={() => !disabled && setActiveTool(tool.id)}
                disabled={disabled}
              >
                <Icon className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-[10px]">
              <span>{tool.label}</span>
              <span className="ml-1.5 text-muted-foreground font-mono">{tool.shortcut}</span>
              {disabled && <span className="ml-1 text-muted-foreground">(Edit mode)</span>}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
