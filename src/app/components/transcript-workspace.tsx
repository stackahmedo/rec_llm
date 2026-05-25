import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import {
  Download, Sparkles, RefreshCw, Copy,
  FileText, Globe, Loader2, Mic2, BarChart3,
  Languages, MessageSquare, CheckCircle2, Send,
  ChevronDown, ChevronRight, ListFilter, Wand2,
  Clock, TrendingUp, Users, AlertTriangle, Hash,
  Search, ArrowUp,
} from "lucide-react";
import { SessionList } from "./session-list";
import { TranscriptEditor } from "./transcript-editor";
import { useTranscripts } from "../transcript-store";
import { useT } from "../i18n";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { toast } from "sonner";
import { notifySummaryGenerated, notifySummaryFailed } from "../notification-store";
import { notifyProviderError } from "../notify";

type AITab = "summary" | "keypoints" | "actions" | "translation" | "chat";

const aiTabs: { id: AITab; labelKey: string; icon: any }[] = [
  { id: "summary", labelKey: "ai.summary", icon: FileText },
  { id: "keypoints", labelKey: "ai.keyPoints", icon: BarChart3 },
  { id: "actions", labelKey: "ai.actions", icon: CheckCircle2 },
  { id: "translation", labelKey: "ai.translation", icon: Globe },
  { id: "chat", labelKey: "ai.chat", icon: MessageSquare },
];

type TranscriptFilter = "all" | "questions" | "decisions" | "tasks" | "risks" | "speaker";

// Slash commands
const slashCommands = [
  { cmd: "/summary", desc: "Generate executive summary" },
  { cmd: "/translate", desc: "Translate transcript" },
  { cmd: "/tasks", desc: "Extract action items" },
  { cmd: "/minutes", desc: "Create meeting minutes" },
  { cmd: "/risks", desc: "Identify risks and issues" },
  { cmd: "/decisions", desc: "Extract decisions made" },
  { cmd: "/sentiment", desc: "Analyze sentiment" },
  { cmd: "/topics", desc: "Extract discussion topics" },
];

export function TranscriptWorkspace() {
  const { transcripts, summaries, addSummary, activeId, setActiveId, loadTranscriptData, isLoadingTranscript, history } = useTranscripts();
  const { t } = useT();
  const selectedId = activeId;
  const [activeTab, setActiveTab] = useState<AITab>("summary");
  const [generating, setGenerating] = useState(false);
  const [summaryLang, setSummaryLang] = useState<"en" | "ja">("ja");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; text: string; timestamp?: number }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [filter, setFilter] = useState<TranscriptFilter>("all");
  const [aiCommand, setAiCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSelect = (id: string) => {
    setActiveId(id);
    // Lazy-load transcript data on demand
    loadTranscriptData(id);
  };

  // On mount, reload transcript data if activeId is set but not loaded
  useEffect(() => {
    if (activeId) {
      loadTranscriptData(activeId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const active = selectedId ? transcripts.find((t) => t.fileId === selectedId) || null : null;
  const summary = selectedId ? summaries.find((s) => s.fileId === selectedId) || null : null;
  const activeHistory = selectedId ? history.find((h) => h.id === selectedId) || null : null;
  const exportName = activeHistory?.generatedFileName?.replace(/\.[^.]+$/, '') || active?.fileName?.replace(/\.[^.]+$/, '') || 'transcript';
  const speakerCount = active ? new Set(active.utterances.map((u) => u.speaker)).size : 0;
  const lastEnd = active ? active.utterances.reduce((max, u) => u.endMs > max ? u.endMs : max, 0) : 0;
  const speakers = useMemo(() => active ? [...new Set(active.utterances.map((u) => u.speaker))] : [], [active]);

  // Time since last generation
  const timeSinceGenerated = useMemo(() => {
    if (!summary?.generatedAt) return null;
    const diff = Date.now() - new Date(summary.generatedAt).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  }, [summary]);

  const generate = useCallback(async () => {
    if (!active) return;
    if (!window.electronAPI?.summarize) { toast.error(t("notify.notAvailable")); return; }
    setGenerating(true);
    const utterances = active.utterances.map((u) => ({ speaker: u.speaker, startMs: u.startMs, text: u.text }));
    const result = await window.electronAPI.summarize.generate(active.fullText, summaryLang, utterances);
    setGenerating(false);

    if (result.ok) {
      const summaryData = {
        fileId: active.fileId, language: summaryLang,
        summary: result.summary || '', pointNotes: result.pointNotes || [],
        actionItems: result.actionItems || [], decisions: result.decisions || [],
        risks: result.risks || [], generatedAt: new Date().toISOString(),
      };
      addSummary(summaryData);
      toast.success(t("notify.summaryGenerated"));
      notifySummaryGenerated(active.fileName);
    } else {
      notifyProviderError(result.error || "Unknown error", "AI Summary");
      notifySummaryFailed(active.fileName, result.error);
    }
  }, [active, summaryLang, addSummary]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("common.copied"));
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: "user", text: msg, timestamp: Date.now() }]);
    // Simulate streaming AI response
    setTimeout(() => {
      setChatMessages((prev) => [...prev, { role: "ai", text: "I'll analyze the transcript for you. This feature connects to your configured AI provider for context-aware responses about this transcript.", timestamp: Date.now() }]);
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 500);
    setChatInput("");
  };

  const handleAiCommand = () => {
    if (!aiCommand.trim()) return;
    const cmd = aiCommand.trim();
    // Add to history
    setCommandHistory((prev) => [cmd, ...prev.slice(0, 19)]);
    setHistoryIdx(-1);

    // Handle slash commands
    if (cmd.startsWith("/")) {
      const slashCmd = slashCommands.find((s) => cmd.startsWith(s.cmd));
      if (slashCmd) {
        toast.info(`Running: ${slashCmd.desc}`, { description: t("common.processing") });
        if (cmd === "/summary" || cmd === "/tasks" || cmd === "/risks" || cmd === "/decisions") {
          generate();
        }
      } else {
        toast.error(`Unknown command: ${cmd.split(" ")[0]}`);
      }
    } else {
      toast.info(`AI: "${cmd}"`, { description: "Processing..." });
    }
    setAiCommand("");
    setShowSlashMenu(false);
  };

  const handleCommandKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiCommand(); }
    if (e.key === "ArrowUp" && !aiCommand && commandHistory.length > 0) {
      const idx = Math.min(historyIdx + 1, commandHistory.length - 1);
      setHistoryIdx(idx);
      setAiCommand(commandHistory[idx]);
    }
    if (e.key === "ArrowDown" && historyIdx >= 0) {
      const idx = historyIdx - 1;
      setHistoryIdx(idx);
      setAiCommand(idx >= 0 ? commandHistory[idx] : "");
    }
    // Show slash menu
    if (aiCommand === "" && e.key === "/") setShowSlashMenu(true);
    if (e.key === "Escape") setShowSlashMenu(false);
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex flex-col h-full -m-6">
      {/* Compact toolbar */}
      <div className="h-8 border-b bg-background flex items-center px-2 gap-1.5 shrink-0">
        <span className="text-[10px] font-medium">{t("transcript.title")}</span>
        {active && (
          <>
            <Badge variant="outline" className="h-4 text-[8px] px-1 font-mono">{active.utterances.length} seg</Badge>
            <Badge variant="outline" className="h-4 text-[8px] px-1 font-mono">{speakerCount} spk</Badge>
            <Badge variant="outline" className="h-4 text-[8px] px-1 font-mono">{active.languageCode.toUpperCase()}</Badge>
            <Badge variant="outline" className="h-4 text-[8px] px-1 font-mono">{Math.floor(lastEnd / 60000)}m</Badge>
          </>
        )}
        <div className="flex-1" />
        {/* Transcript search */}
        <div className="relative">
          <Search className="size-2.5 absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={transcriptSearch} onChange={(e) => setTranscriptSearch(e.target.value)} placeholder={t("common.search") + "..."} className="h-5 text-[9px] pl-6 w-28" />
        </div>
        {/* Speaker filter */}
        {speakers.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={speakerFilter ? "secondary" : "ghost"} size="sm" className="h-5 text-[9px] gap-0.5 px-1.5">
                <Users className="size-2.5" />{speakerFilter || t("filter.speaker")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-[10px]" onClick={() => setSpeakerFilter(null)}>All Speakers</DropdownMenuItem>
              {speakers.map((s) => (
                <DropdownMenuItem key={s} className="text-[10px]" onClick={() => setSpeakerFilter(s)}>{s}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {/* Filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={filter !== "all" ? "secondary" : "ghost"} size="sm" className="h-5 text-[9px] gap-0.5 px-1.5">
              <ListFilter className="size-2.5" />{filter !== "all" ? filter : t("common.filter")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(["all", "questions", "decisions", "tasks", "risks"] as const).map((f) => (
              <DropdownMenuItem key={f} className="text-[10px] capitalize" onClick={() => setFilter(f)}>{f}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-5 text-[9px] gap-0.5 px-1.5" disabled={!active}>
              <Download className="size-2.5" />{t("common.export")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-[10px]" onClick={() => {
              if (!active || !window.electronAPI?.pdf) return;
              window.electronAPI.pdf.exportReport({ fileName: exportName, processedAt: active.completedAt, languageCode: active.languageCode, utterances: active.utterances, summary: summary?.summary, pointNotes: summary?.pointNotes, actionItems: summary?.actionItems, decisions: summary?.decisions, risks: summary?.risks }).then((r) => { if (r.ok) toast.success(t("export.pdfExported")); });
            }}>{t("export.pdf")}</DropdownMenuItem>
            <DropdownMenuItem className="text-[10px]" onClick={() => {
              if (!active || !window.electronAPI?.export) return;
              const isJa = active.languageCode?.startsWith("ja");
              const header = isJa ? "時間 | 話者 | 文字起こし" : "Time | Speaker | Transcript";
              const lines = [header, ...active.utterances.map((u) => {
                const totalSec = Math.floor(u.startMs / 1000);
                const h = Math.floor(totalSec / 3600).toString().padStart(2, "0");
                const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, "0");
                const s = (totalSec % 60).toString().padStart(2, "0");
                const ts = `${h}:${m}:${s}`;
                return `${ts} | ${u.speaker} | ${u.text}`;
              })];
              window.electronAPI.export.saveTxt(exportName, lines.join("\n")).then((r) => { if (r?.ok) toast.success(t("export.txtExported")); });
            }}>{t("export.txt")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 3-panel workspace */}
      <div className="flex-1 min-h-0 flex">
        {/* Left: Session list */}
        <div className="w-48 border-r shrink-0 overflow-hidden bg-card">
          <SessionList selectedId={selectedId} onSelect={handleSelect} />
        </div>

        {/* Center: Transcript editor */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {selectedId && !active && isLoadingTranscript ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6">
              <Loader2 className="size-5 animate-spin opacity-40 mb-2" />
              <div className="text-[11px]">{t("transcript.loading")}</div>
            </div>
          ) : (
            <TranscriptEditor fileId={selectedId} />
          )}
        </div>

        {/* Right: AI Workspace Panel */}
        <div className="w-72 xl:w-80 border-l shrink-0 flex flex-col min-h-0 bg-card">
          {/* Tab bar */}
          <div className="h-7 border-b flex items-center px-1 gap-0.5 shrink-0 overflow-x-auto">
            {aiTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger asChild>
                    <button
                      className={`h-5 px-1.5 rounded text-[8px] flex items-center gap-0.5 transition-colors shrink-0 ${isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/40"}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <Icon className="size-2.5" />{t(tab.labelKey)}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[9px]">{t(tab.labelKey)}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Tab content — independently scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded">
            {/* Summary Tab */}
            {activeTab === "summary" && (
              <div className="p-2 space-y-2">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium flex-1">{t("ai.executiveSummary")}</span>
                  {timeSinceGenerated && <span className="text-[7px] text-muted-foreground">{timeSinceGenerated}</span>}
                  <Tooltip><TooltipTrigger asChild>
                    <button className="size-4 rounded hover:bg-muted flex items-center justify-center" onClick={generate} disabled={generating}>
                      {generating ? <Loader2 className="size-2.5 animate-spin" /> : <RefreshCw className="size-2.5 text-muted-foreground" />}
                    </button>
                  </TooltipTrigger><TooltipContent className="text-[9px]">{t("common.regenerate")}</TooltipContent></Tooltip>
                  {summary && <Tooltip><TooltipTrigger asChild>
                    <button className="size-4 rounded hover:bg-muted flex items-center justify-center" onClick={() => copyToClipboard(summary.summary)}>
                      <Copy className="size-2.5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger><TooltipContent className="text-[9px]">{t("common.copy")}</TooltipContent></Tooltip>}
                </div>
                {summary ? (
                  <p className="text-[10px] leading-relaxed">{summary.summary}</p>
                ) : (
                  <div className="text-center py-4">
                    <Sparkles className="size-4 mx-auto opacity-20 mb-1" />
                    <div className="text-[9px] text-muted-foreground mb-2">{t("ai.noSummary")}</div>
                    <Button size="sm" className="h-5 text-[9px] gap-1" onClick={generate} disabled={generating}>
                      {generating ? <Loader2 className="size-2.5 animate-spin" /> : <Sparkles className="size-2.5" />}
                      {t("ai.generateSummary")}
                    </Button>
                  </div>
                )}
                {summary?.decisions && summary.decisions.length > 0 && (
                  <AIBlock title={t("ai.decisions")} items={summary.decisions} icon="⚖️" onCopy={() => copyToClipboard(summary.decisions.join("\n"))} onRegenerate={generate} />
                )}
                {summary?.risks && summary.risks.length > 0 && (
                  <AIBlock title={t("ai.risks")} items={summary.risks} icon="⚠️" onCopy={() => copyToClipboard(summary.risks.join("\n"))} onRegenerate={generate} />
                )}
                {/* Analysis Modules */}
                <Separator />
                <AnalysisModulesPanel onGenerate={generate} generating={generating} />
              </div>
            )}

            {/* Key Points Tab */}
            {activeTab === "keypoints" && (
              <div className="p-2 space-y-2">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium flex-1">{t("ai.keyPoints")}</span>
                  <button className="size-4 rounded hover:bg-muted flex items-center justify-center" onClick={generate} disabled={generating}>
                    {generating ? <Loader2 className="size-2.5 animate-spin" /> : <RefreshCw className="size-2.5 text-muted-foreground" />}
                  </button>
                  {summary?.pointNotes && <button className="size-4 rounded hover:bg-muted flex items-center justify-center" onClick={() => copyToClipboard(summary.pointNotes.join("\n"))}>
                    <Copy className="size-2.5 text-muted-foreground" />
                  </button>}
                </div>
                {summary?.pointNotes && summary.pointNotes.length > 0 ? (
                  <div className="space-y-1">
                    {summary.pointNotes.map((point, i) => (
                      <div key={i} className="text-[10px] pl-2 border-l-2 border-violet-400/50 py-0.5 leading-relaxed hover:bg-muted/20 rounded-r px-1">{point}</div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <BarChart3 className="size-4 mx-auto opacity-20 mb-1" />
                    <div className="text-[9px] text-muted-foreground mb-2">{t("ai.generateKeyPoints")}</div>
                    <Button size="sm" className="h-5 text-[9px] gap-1" onClick={generate} disabled={generating}>
                      <Sparkles className="size-2.5" />{t("common.generate")}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Actions Tab */}
            {activeTab === "actions" && (
              <div className="p-2 space-y-2">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium flex-1">{t("ai.actionItems")}</span>
                  <button className="size-4 rounded hover:bg-muted flex items-center justify-center" onClick={generate} disabled={generating}>
                    {generating ? <Loader2 className="size-2.5 animate-spin" /> : <RefreshCw className="size-2.5 text-muted-foreground" />}
                  </button>
                  {summary?.actionItems && <button className="size-4 rounded hover:bg-muted flex items-center justify-center" onClick={() => copyToClipboard(summary.actionItems.join("\n"))}>
                    <Copy className="size-2.5 text-muted-foreground" />
                  </button>}
                </div>
                {summary?.actionItems && summary.actionItems.length > 0 ? (
                  <div className="space-y-0.5">
                    {summary.actionItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[10px] py-0.5 hover:bg-muted/20 rounded px-1">
                        <CheckCircle2 className="size-3 text-amber-500 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <CheckCircle2 className="size-4 mx-auto opacity-20 mb-1" />
                    <div className="text-[9px] text-muted-foreground mb-2">{t("ai.generateActions")}</div>
                    <Button size="sm" className="h-5 text-[9px] gap-1" onClick={generate} disabled={generating}>
                      <Sparkles className="size-2.5" />{t("common.generate")}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Translation Tab */}
            {activeTab === "translation" && (
              <div className="p-2 space-y-2">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium flex-1">{t("ai.translation")}</span>
                </div>
                <div className="grid grid-cols-3 gap-0.5">
                  {[{ code: "en", label: "English" }, { code: "ja", label: "日本語" }, { code: "zh", label: "中文" }, { code: "ko", label: "한국어" }, { code: "es", label: "Español" }, { code: "fr", label: "Français" }].map((lang) => (
                    <button key={lang.code} className={`h-5 rounded border text-[8px] transition-colors ${summaryLang === lang.code ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted/40"}`} onClick={() => setSummaryLang(lang.code as any)}>
                      {lang.label}
                    </button>
                  ))}
                </div>
                <Separator />
                <div className="space-y-1">
                  <button className="w-full h-6 rounded border text-[9px] flex items-center justify-center gap-1 hover:bg-primary/5 hover:border-primary/30 transition-colors">
                    <Globe className="size-2.5" />{t("translation.full")}
                  </button>
                  <button className="w-full h-6 rounded border text-[9px] flex items-center justify-center gap-1 hover:bg-primary/5 hover:border-primary/30 transition-colors">
                    <Languages className="size-2.5" />{t("translation.bilingual")}
                  </button>
                  <button className="w-full h-6 rounded border text-[9px] flex items-center justify-center gap-1 hover:bg-primary/5 hover:border-primary/30 transition-colors">
                    <Mic2 className="size-2.5" />{t("translation.bySpeaker")}
                  </button>
                </div>
                <div className="text-[8px] text-muted-foreground">{t("translation.preserves")}</div>
              </div>
            )}

            {/* AI Chat Tab */}
            {activeTab === "chat" && (
              <div className="flex flex-col h-full">
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-6">
                      <MessageSquare className="size-4 mx-auto opacity-20 mb-1" />
                      <div className="text-[9px] text-muted-foreground">{t("ai.chatEmpty")}</div>
                      <div className="text-[8px] text-muted-foreground mt-1 space-y-0.5">
                        <div>{t("ai.chatExamples.1")}</div>
                        <div>{t("ai.chatExamples.2")}</div>
                        <div>{t("ai.chatExamples.3")}</div>
                      </div>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`text-[10px] px-2 py-1 rounded ${msg.role === "user" ? "bg-primary/10 ml-4" : "bg-muted/30 mr-4"}`}>
                      <div className="text-[8px] text-muted-foreground mb-0.5">{msg.role === "user" ? "You" : "AI"}</div>
                      {msg.text}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-1.5 border-t shrink-0">
                  <div className="flex gap-1">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={t("ai.chatPlaceholder")}
                      className="h-6 text-[9px] flex-1"
                      onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                    />
                    <Button size="sm" className="h-6 w-6 p-0" onClick={sendChatMessage} disabled={!chatInput.trim()}>
                      <Send className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sticky AI Command Box (all tabs except chat) */}
          {activeTab !== "chat" && (
            <div className="shrink-0 border-t bg-background/95 backdrop-blur p-1.5 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] relative">
              {/* Slash command menu */}
              {showSlashMenu && (
                <div className="absolute bottom-full left-1.5 right-1.5 mb-1 bg-background border rounded-md shadow-lg max-h-40 overflow-auto z-20">
                  {slashCommands.map((cmd) => (
                    <button
                      key={cmd.cmd}
                      className="w-full text-left px-2 py-1 text-[9px] hover:bg-muted/40 flex items-center gap-2"
                      onClick={() => { setAiCommand(cmd.cmd + " "); setShowSlashMenu(false); }}
                    >
                      <span className="font-mono text-primary">{cmd.cmd}</span>
                      <span className="text-muted-foreground">{cmd.desc}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-1">
                <Input
                  value={aiCommand}
                  onChange={(e) => { setAiCommand(e.target.value); setShowSlashMenu(e.target.value === "/"); }}
                  placeholder={`${t("ai.commandPlaceholder")} (${t("ai.commandSlash")})`}
                  className="h-6 text-[9px] flex-1"
                  onKeyDown={handleCommandKeyDown}
                />
                <Button size="sm" className="h-6 w-6 p-0" onClick={handleAiCommand} disabled={!aiCommand.trim()}>
                  <Wand2 className="size-3" />
                </Button>
              </div>
              {/* Quick command chips */}
              <div className="flex gap-0.5 mt-1 flex-wrap">
                <button className="h-4 px-1.5 rounded text-[7px] border hover:bg-primary/5 transition-colors font-mono" onClick={() => { setAiCommand("/summary"); handleAiCommand(); }}>
                  /summary
                </button>
                <button className="h-4 px-1.5 rounded text-[7px] border hover:bg-primary/5 transition-colors font-mono" onClick={() => { setAiCommand("/translate"); handleAiCommand(); }}>
                  /translate
                </button>
                <button className="h-4 px-1.5 rounded text-[7px] border hover:bg-primary/5 transition-colors font-mono" onClick={() => { setAiCommand("/tasks"); handleAiCommand(); }}>
                  /tasks
                </button>
                <button className="h-4 px-1.5 rounded text-[7px] border hover:bg-primary/5 transition-colors font-mono" onClick={() => { setAiCommand("/minutes"); handleAiCommand(); }}>
                  /minutes
                </button>
                <button className="h-4 px-1.5 rounded text-[7px] border hover:bg-primary/5 transition-colors" onClick={generate} disabled={generating}>
                  ↻ Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}

// --- AI Block Component ---
function AIBlock({ title, items, icon, onCopy, onRegenerate }: {
  title: string; items: string[]; icon: string;
  onCopy: () => void; onRegenerate: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="border rounded">
      <button className="w-full flex items-center gap-1 px-2 py-1 hover:bg-muted/20 transition-colors" onClick={() => setCollapsed(!collapsed)}>
        <span className="text-[9px]">{icon}</span>
        <span className="text-[9px] font-medium flex-1 text-left">{title} ({items.length})</span>
        <button className="size-3.5 rounded hover:bg-muted flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onRegenerate(); }}>
          <RefreshCw className="size-2 text-muted-foreground" />
        </button>
        <button className="size-3.5 rounded hover:bg-muted flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onCopy(); }}>
          <Copy className="size-2 text-muted-foreground" />
        </button>
        {collapsed ? <ChevronRight className="size-2.5 text-muted-foreground" /> : <ChevronDown className="size-2.5 text-muted-foreground" />}
      </button>
      {!collapsed && (
        <div className="px-2 pb-1.5 space-y-0.5">
          {items.map((item, i) => (
            <div key={i} className="text-[9px] pl-2 border-l-2 border-muted py-0.5 leading-relaxed">{item}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- AI Analysis Modules ---
type AnalysisModule = "sentiment" | "topics" | "speakers" | "timeline" | "followups";

const analysisModules: { id: AnalysisModule; labelKey: string; icon: any; descKey: string }[] = [
  { id: "sentiment", labelKey: "ai.sentiment", icon: TrendingUp, descKey: "ai.sentimentDesc" },
  { id: "topics", labelKey: "ai.topics", icon: Hash, descKey: "ai.topicsDesc" },
  { id: "speakers", labelKey: "ai.speakerInsights", icon: Users, descKey: "ai.speakerInsightsDesc" },
  { id: "timeline", labelKey: "ai.timeline", icon: Clock, descKey: "ai.timelineDesc" },
  { id: "followups", labelKey: "ai.followups", icon: ArrowUp, descKey: "ai.followupsDesc" },
];

function AnalysisModulesPanel({ onGenerate, generating }: { onGenerate: () => void; generating: boolean }) {
  const { t } = useT();
  return (
    <div className="p-2 space-y-1.5">
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">{t("ai.analysisModules")}</div>
      <div className="space-y-0.5">
        {analysisModules.map((mod) => {
          const Icon = mod.icon;
          return (
            <div key={mod.id} className="flex items-center gap-1.5 px-1.5 py-1 rounded border hover:bg-muted/20 transition-colors group">
              <Icon className="size-3 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-medium">{t(mod.labelKey)}</div>
                <div className="text-[7px] text-muted-foreground">{t(mod.descKey)}</div>
              </div>
              <button className="size-4 rounded hover:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={onGenerate} disabled={generating}>
                <Sparkles className="size-2.5 text-primary" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
