import { useState, useRef, useCallback } from "react";
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
} from "lucide-react";
import { SessionList } from "./session-list";
import { TranscriptEditor } from "./transcript-editor";
import { useTranscripts } from "../transcript-store";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { toast } from "sonner";
import { notifySummaryGenerated, notifySummaryFailed } from "../notification-store";
import { notifyProviderError } from "../notify";

type AITab = "summary" | "keypoints" | "actions" | "translation" | "chat";

const aiTabs: { id: AITab; label: string; icon: any }[] = [
  { id: "summary", label: "Summary", icon: FileText },
  { id: "keypoints", label: "Key Points", icon: BarChart3 },
  { id: "actions", label: "Actions", icon: CheckCircle2 },
  { id: "translation", label: "Translate", icon: Globe },
  { id: "chat", label: "AI Chat", icon: MessageSquare },
];

type TranscriptFilter = "all" | "questions" | "decisions" | "tasks" | "risks";

export function TranscriptWorkspace() {
  const { transcripts, summaries, addSummary, setActiveId } = useTranscripts();
  const [selectedId, setSelectedId] = useState<string | null>(
    transcripts.length > 0 ? transcripts[0].fileId : null
  );
  const [activeTab, setActiveTab] = useState<AITab>("summary");
  const [generating, setGenerating] = useState(false);
  const [summaryLang, setSummaryLang] = useState<"en" | "ja">("en");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [filter, setFilter] = useState<TranscriptFilter>("all");
  const [aiCommand, setAiCommand] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setActiveId(id);
  };

  const active = selectedId ? transcripts.find((t) => t.fileId === selectedId) || null : null;
  const summary = selectedId ? summaries.find((s) => s.fileId === selectedId) || null : null;
  const speakerCount = active ? new Set(active.utterances.map((u) => u.speaker)).size : 0;
  const lastEnd = active ? Math.max(...active.utterances.map((u) => u.endMs), 0) : 0;

  const generate = useCallback(async () => {
    if (!active) return;
    if (!window.electronAPI?.summarize) { toast.error("Not available in browser mode"); return; }
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
      toast.success("Summary generated");
      notifySummaryGenerated(active.fileName);
    } else {
      notifyProviderError(result.error || "Unknown error", "AI Summary");
      notifySummaryFailed(active.fileName, result.error);
    }
  }, [active, summaryLang, addSummary]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [...prev, { role: "user", text: chatInput }]);
    setTimeout(() => {
      setChatMessages((prev) => [...prev, { role: "ai", text: "I'll analyze the transcript for you. This feature connects to your configured AI provider for context-aware responses." }]);
    }, 500);
    setChatInput("");
  };

  const handleAiCommand = () => {
    if (!aiCommand.trim()) return;
    toast.info(`AI Command: "${aiCommand}"`, { description: "Processing..." });
    setAiCommand("");
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex flex-col h-full -m-6">
      {/* Compact toolbar */}
      <div className="h-8 border-b bg-background flex items-center px-2 gap-1.5 shrink-0">
        <span className="text-[10px] font-medium">Transcripts</span>
        {active && (
          <>
            <Badge variant="outline" className="h-4 text-[8px] px-1 font-mono">{active.utterances.length} seg</Badge>
            <Badge variant="outline" className="h-4 text-[8px] px-1 font-mono">{speakerCount} spk</Badge>
            <Badge variant="outline" className="h-4 text-[8px] px-1 font-mono">{active.languageCode.toUpperCase()}</Badge>
            <Badge variant="outline" className="h-4 text-[8px] px-1 font-mono">{Math.floor(lastEnd / 60000)}m</Badge>
          </>
        )}
        <div className="flex-1" />
        {/* Filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={filter !== "all" ? "secondary" : "ghost"} size="sm" className="h-5 text-[9px] gap-0.5 px-1.5">
              <ListFilter className="size-2.5" />{filter !== "all" ? filter : "Filter"}
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
              <Download className="size-2.5" />Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-[10px]" onClick={() => {
              if (!active || !window.electronAPI?.pdf) return;
              window.electronAPI.pdf.exportReport({ fileName: active.fileName, processedAt: active.completedAt, languageCode: active.languageCode, utterances: active.utterances, summary: summary?.summary, pointNotes: summary?.pointNotes, actionItems: summary?.actionItems, decisions: summary?.decisions, risks: summary?.risks }).then((r) => { if (r.ok) toast.success("PDF exported"); });
            }}>PDF Report</DropdownMenuItem>
            <DropdownMenuItem className="text-[10px]" onClick={() => {
              if (!active || !window.electronAPI?.export) return;
              const lines = active.utterances.map((u) => `[${Math.floor(u.startMs/60000)}:${Math.floor((u.startMs%60000)/1000).toString().padStart(2,"0")}] ${u.speaker}: ${u.text}`);
              window.electronAPI.export.saveTxt(active.fileName, lines.join("\n")).then((r) => { if (r?.ok) toast.success("TXT exported"); });
            }}>Plain Text</DropdownMenuItem>
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
          <TranscriptEditor fileId={selectedId} />
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
                      <Icon className="size-2.5" />{tab.label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[9px]">{tab.label}</TooltipContent>
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
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium flex-1">Executive Summary</span>
                  <Tooltip><TooltipTrigger asChild>
                    <button className="size-4 rounded hover:bg-muted flex items-center justify-center" onClick={generate} disabled={generating}>
                      {generating ? <Loader2 className="size-2.5 animate-spin" /> : <RefreshCw className="size-2.5 text-muted-foreground" />}
                    </button>
                  </TooltipTrigger><TooltipContent className="text-[9px]">Regenerate</TooltipContent></Tooltip>
                  {summary && <Tooltip><TooltipTrigger asChild>
                    <button className="size-4 rounded hover:bg-muted flex items-center justify-center" onClick={() => copyToClipboard(summary.summary)}>
                      <Copy className="size-2.5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger><TooltipContent className="text-[9px]">Copy</TooltipContent></Tooltip>}
                </div>
                {summary ? (
                  <p className="text-[10px] leading-relaxed">{summary.summary}</p>
                ) : (
                  <div className="text-center py-4">
                    <Sparkles className="size-4 mx-auto opacity-20 mb-1" />
                    <div className="text-[9px] text-muted-foreground mb-2">No summary yet</div>
                    <Button size="sm" className="h-5 text-[9px] gap-1" onClick={generate} disabled={generating}>
                      {generating ? <Loader2 className="size-2.5 animate-spin" /> : <Sparkles className="size-2.5" />}
                      Generate Summary
                    </Button>
                  </div>
                )}
                {summary?.decisions && summary.decisions.length > 0 && (
                  <AIBlock title="Decisions" items={summary.decisions} icon="⚖️" onCopy={() => copyToClipboard(summary.decisions.join("\n"))} onRegenerate={generate} />
                )}
                {summary?.risks && summary.risks.length > 0 && (
                  <AIBlock title="Risks" items={summary.risks} icon="⚠️" onCopy={() => copyToClipboard(summary.risks.join("\n"))} onRegenerate={generate} />
                )}
              </div>
            )}

            {/* Key Points Tab */}
            {activeTab === "keypoints" && (
              <div className="p-2 space-y-2">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium flex-1">Key Points</span>
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
                    <div className="text-[9px] text-muted-foreground mb-2">Generate summary to extract key points</div>
                    <Button size="sm" className="h-5 text-[9px] gap-1" onClick={generate} disabled={generating}>
                      <Sparkles className="size-2.5" />Generate
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Actions Tab */}
            {activeTab === "actions" && (
              <div className="p-2 space-y-2">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium flex-1">Action Items</span>
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
                    <div className="text-[9px] text-muted-foreground mb-2">Generate summary to extract actions</div>
                    <Button size="sm" className="h-5 text-[9px] gap-1" onClick={generate} disabled={generating}>
                      <Sparkles className="size-2.5" />Generate
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Translation Tab */}
            {activeTab === "translation" && (
              <div className="p-2 space-y-2">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium flex-1">Translation</span>
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
                    <Globe className="size-2.5" />Translate Full Transcript
                  </button>
                  <button className="w-full h-6 rounded border text-[9px] flex items-center justify-center gap-1 hover:bg-primary/5 hover:border-primary/30 transition-colors">
                    <Languages className="size-2.5" />Bilingual View
                  </button>
                  <button className="w-full h-6 rounded border text-[9px] flex items-center justify-center gap-1 hover:bg-primary/5 hover:border-primary/30 transition-colors">
                    <Mic2 className="size-2.5" />Translate by Speaker
                  </button>
                </div>
                <div className="text-[8px] text-muted-foreground">Preserves timestamps and speaker labels.</div>
              </div>
            )}

            {/* AI Chat Tab */}
            {activeTab === "chat" && (
              <div className="flex flex-col h-full">
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-6">
                      <MessageSquare className="size-4 mx-auto opacity-20 mb-1" />
                      <div className="text-[9px] text-muted-foreground">Ask AI about this transcript</div>
                      <div className="text-[8px] text-muted-foreground mt-1 space-y-0.5">
                        <div>"Summarize professionally"</div>
                        <div>"Extract all deadlines"</div>
                        <div>"What did Speaker A decide?"</div>
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
                      placeholder="Ask about this transcript..."
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
            <div className="shrink-0 border-t bg-background/95 backdrop-blur p-1.5 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex gap-1">
                <Input
                  value={aiCommand}
                  onChange={(e) => setAiCommand(e.target.value)}
                  placeholder="Ask AI about this transcript…"
                  className="h-6 text-[9px] flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAiCommand()}
                />
                <Button size="sm" className="h-6 w-6 p-0" onClick={handleAiCommand} disabled={!aiCommand.trim()}>
                  <Wand2 className="size-3" />
                </Button>
              </div>
              {/* Pinned AI actions */}
              <div className="flex gap-0.5 mt-1">
                <button className="h-4 px-1.5 rounded text-[7px] border hover:bg-primary/5 transition-colors" onClick={generate} disabled={generating}>↻ Summary</button>
                <button className="h-4 px-1.5 rounded text-[7px] border hover:bg-primary/5 transition-colors" onClick={generate} disabled={generating}>↻ Key Points</button>
                <button className="h-4 px-1.5 rounded text-[7px] border hover:bg-primary/5 transition-colors" onClick={generate} disabled={generating}>↻ Actions</button>
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
