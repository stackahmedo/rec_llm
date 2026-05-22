import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Separator } from "./ui/separator";
import { toast } from "sonner";
import {
  Eye, EyeOff, CheckCircle2, XCircle, Loader2, Save, RotateCcw,
  Settings2, Mic, Sparkles, Cpu, Download, Wrench, Database, GitBranch,
  Wifi, HardDrive, Trash2, FolderOpen,
} from "lucide-react";
import { useT, Lang } from "../i18n";

type CheckState = "idle" | "checking" | "ok" | "fail";
type SettingsTab = "general" | "transcription" | "ai-providers" | "pipeline" | "processing" | "storage" | "export" | "advanced";

const PLACEHOLDER_KEYS = [
  'your_api_key', 'your_api_key_here', 'paste_key_here',
  'your-api-key', 'api_key', 'api-key', 'sk-xxx', 'xxx',
  'insert_key_here', 'replace_with_your_key',
];

function isPlaceholderKey(key: string): boolean {
  const lower = key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return PLACEHOLDER_KEYS.some((p) => lower === p.replace(/[^a-z0-9_-]/g, ''));
}

const tabs: { id: SettingsTab; label: string; icon: any }[] = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "transcription", label: "Transcription", icon: Mic },
  { id: "ai-providers", label: "AI Providers", icon: Sparkles },
  { id: "pipeline", label: "Pipeline Roles", icon: GitBranch },
  { id: "processing", label: "Processing", icon: Cpu },
  { id: "storage", label: "Storage & Cache", icon: Database },
  { id: "export", label: "Export", icon: Download },
  { id: "advanced", label: "Advanced", icon: Wrench },
];

export function SettingsPanel() {
  const { lang, setLang } = useT();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [dirty, setDirty] = useState(false);

  // API Keys
  const [asmKey, setAsmKey] = useState("");
  const [asmState, setAsmState] = useState<CheckState>("idle");
  const [asmModel, setAsmModel] = useState("universal-3-pro+universal-2");
  const [asmLang, setAsmLang] = useState("auto");
  const [asmDiarize, setAsmDiarize] = useState(true);

  const [gemKey, setGemKey] = useState("");
  const [gemState, setGemState] = useState<CheckState>("idle");
  const [gemModel, setGemModel] = useState("gemini-1.5-pro");

  const [gptKey, setGptKey] = useState("");
  const [gptState, setGptState] = useState<CheckState>("idle");
  const [gptModel, setGptModel] = useState("gpt-4o");

  const [summaryProvider, setSummaryProvider] = useState<"gemini" | "chatgpt">("gemini");
  const [summaryLang, setSummaryLang] = useState("en");

  // Processing
  const [autoRetry, setAutoRetry] = useState(true);
  const [autoCompress, setAutoCompress] = useState(true);
  const [autoSaveTxt, setAutoSaveTxt] = useState(true);

  // System info
  const [ffmpegOk, setFfmpegOk] = useState<boolean | null>(null);
  const [storageSize, setStorageSize] = useState(0);
  const [transcriptCount, setTranscriptCount] = useState(0);

  // Load settings
  useEffect(() => {
    const api = window.electronAPI?.settings;
    if (!api) return;
    (async () => {
      const keys = await api.get('apiKeys') as Record<string, string> | null;
      if (keys) {
        if (keys.assemblyai) setAsmKey(keys.assemblyai);
        if (keys.gemini) setGemKey(keys.gemini);
        if (keys.chatgpt) setGptKey(keys.chatgpt);
      }
      const models = await api.get('models') as Record<string, string> | null;
      if (models) {
        if (models.assemblyai) setAsmModel(models.assemblyai);
        if (models.gemini) setGemModel(models.gemini);
        if (models.chatgpt) setGptModel(models.chatgpt);
      }
      const prefs = await api.get('preferences') as Record<string, unknown> | null;
      if (prefs) {
        if (typeof prefs.summaryProvider === 'string') setSummaryProvider(prefs.summaryProvider as any);
        if (typeof prefs.asmDiarize === 'boolean') setAsmDiarize(prefs.asmDiarize);
        if (typeof prefs.asmLang === 'string') setAsmLang(prefs.asmLang);
        if (typeof prefs.summaryLang === 'string') setSummaryLang(prefs.summaryLang);
        if (typeof prefs.autoRetry === 'boolean') setAutoRetry(prefs.autoRetry);
        if (typeof prefs.autoCompress === 'boolean') setAutoCompress(prefs.autoCompress);
        if (typeof prefs.autoSaveTxt === 'boolean') setAutoSaveTxt(prefs.autoSaveTxt);
      }
    })();
    window.electronAPI?.audio?.ffmpegCheck().then((r) => setFfmpegOk(r.ok));
    window.electronAPI?.storage?.stats().then((s) => {
      setStorageSize(s.totalSize);
      setTranscriptCount(s.transcriptCount);
    });
  }, []);

  const markDirty = () => setDirty(true);

  const checkAssembly = async () => {
    setAsmState("checking");
    const api = window.electronAPI?.assemblyai;
    if (!api) { setAsmState("idle"); toast.message("Desktop mode required"); return; }
    const result = await api.validateKey();
    setAsmState(result.ok ? "ok" : "fail");
    if (result.ok) toast.success("AssemblyAI connected");
    else toast.error("AssemblyAI key invalid", { description: result.error });
  };

  const checkGemini = async () => {
    setGemState("checking");
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${gemKey.trim()}`);
      setGemState(response.status === 200 ? "ok" : "fail");
      if (response.status === 200) toast.success("Gemini connected");
      else toast.error("Gemini key invalid");
    } catch { setGemState("fail"); toast.error("Gemini: network error"); }
  };

  const checkOpenAI = async () => {
    setGptState("checking");
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { "Authorization": `Bearer ${gptKey.trim()}` },
      });
      setGptState(response.status === 200 ? "ok" : "fail");
      if (response.status === 200) toast.success("OpenAI connected");
      else toast.error("OpenAI key invalid");
    } catch { setGptState("fail"); toast.error("OpenAI: network error"); }
  };

  const saveAll = async () => {
    const api = window.electronAPI?.settings;
    if (!api) { toast.message("Desktop mode required"); return; }

    const keysToSave: Record<string, string> = {};
    if (asmKey.trim() && !isPlaceholderKey(asmKey)) keysToSave.assemblyai = asmKey.trim();
    if (gemKey.trim() && !isPlaceholderKey(gemKey)) keysToSave.gemini = gemKey.trim();
    if (gptKey.trim() && !isPlaceholderKey(gptKey)) keysToSave.chatgpt = gptKey.trim();

    await api.set('apiKeys', keysToSave);
    await api.set('models', { assemblyai: asmModel, gemini: gemModel, chatgpt: gptModel });
    await api.set('preferences', { summaryProvider, asmDiarize, asmLang, summaryLang, autoRetry, autoCompress, autoSaveTxt });
    setDirty(false);
    toast.success("Settings saved");
  };

  const resetAll = async () => {
    const api = window.electronAPI?.settings;
    if (api) { await api.delete('apiKeys'); await api.delete('models'); await api.delete('preferences'); }
    setAsmKey(""); setGemKey(""); setGptKey("");
    setAsmState("idle"); setGemState("idle"); setGptState("idle");
    setDirty(false);
    toast.message("Settings reset");
  };

  return (
    <div className="flex h-full -m-6">
      {/* Left nav */}
      <div className="w-44 border-r bg-muted/10 shrink-0 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors
                ${active ? "bg-primary/10 text-primary border-r-2 border-primary font-medium" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="size-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 overflow-auto p-4 max-w-3xl">
          {activeTab === "general" && (
            <GeneralTab lang={lang} setLang={setLang} markDirty={markDirty} />
          )}
          {activeTab === "transcription" && (
            <TranscriptionTab
              asmKey={asmKey} setAsmKey={(v) => { setAsmKey(v); markDirty(); }}
              asmState={asmState} checkAssembly={checkAssembly}
              asmModel={asmModel} setAsmModel={(v) => { setAsmModel(v); markDirty(); }}
              asmLang={asmLang} setAsmLang={(v) => { setAsmLang(v); markDirty(); }}
              asmDiarize={asmDiarize} setAsmDiarize={(v) => { setAsmDiarize(v); markDirty(); }}
            />
          )}
          {activeTab === "ai-providers" && (
            <AIProvidersTab
              summaryProvider={summaryProvider} setSummaryProvider={(v) => { setSummaryProvider(v); markDirty(); }}
              summaryLang={summaryLang} setSummaryLang={(v) => { setSummaryLang(v); markDirty(); }}
              gemKey={gemKey} setGemKey={(v) => { setGemKey(v); markDirty(); }}
              gemState={gemState} checkGemini={checkGemini}
              gemModel={gemModel} setGemModel={(v) => { setGemModel(v); markDirty(); }}
              gptKey={gptKey} setGptKey={(v) => { setGptKey(v); markDirty(); }}
              gptState={gptState} checkOpenAI={checkOpenAI}
              gptModel={gptModel} setGptModel={(v) => { setGptModel(v); markDirty(); }}
              asmState={asmState}
              ffmpegOk={ffmpegOk}
            />
          )}
          {activeTab === "pipeline" && <PipelineTab summaryProvider={summaryProvider} />}
          {activeTab === "processing" && (
            <ProcessingTab
              autoRetry={autoRetry} setAutoRetry={(v) => { setAutoRetry(v); markDirty(); }}
              autoCompress={autoCompress} setAutoCompress={(v) => { setAutoCompress(v); markDirty(); }}
              autoSaveTxt={autoSaveTxt} setAutoSaveTxt={(v) => { setAutoSaveTxt(v); markDirty(); }}
              asmDiarize={asmDiarize} setAsmDiarize={(v) => { setAsmDiarize(v); markDirty(); }}
            />
          )}
          {activeTab === "storage" && (
            <StorageTab storageSize={storageSize} transcriptCount={transcriptCount} />
          )}
          {activeTab === "export" && <ExportTab />}
          {activeTab === "advanced" && (
            <AdvancedTab ffmpegOk={ffmpegOk} storageSize={storageSize} transcriptCount={transcriptCount} resetAll={resetAll} />
          )}
        </div>

        {/* Sticky save bar */}
        <div className={`h-10 border-t flex items-center justify-end px-4 gap-2 shrink-0 transition-colors ${dirty ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" : "bg-muted/10"}`}>
          {dirty && <span className="text-[10px] text-amber-600 dark:text-amber-400 mr-auto">Unsaved changes</span>}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={resetAll}>
            <RotateCcw className="size-3 mr-1" />Reset
          </Button>
          <Button type="button" size="sm" className="h-7 text-xs" onClick={saveAll}>
            <Save className="size-3 mr-1" />Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Shared UI ---

function SectionLabel({ children }: { children: string }) {
  return <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">{children}</div>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[11px] shrink-0">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function StatusDot({ state }: { state: CheckState }) {
  const color = { idle: "bg-slate-400", checking: "bg-yellow-500 animate-pulse", ok: "bg-emerald-500", fail: "bg-red-500" }[state];
  return <span className={`size-2 rounded-full ${color}`} />;
}

function KeyInput({ value, onChange, placeholder, onTest, state }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  onTest?: () => void; state?: CheckState;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-1.5 flex-1">
      <div className="relative flex-1">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-7 text-[11px] font-mono pr-7"
        />
        <button
          type="button"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
        </button>
      </div>
      {onTest && (
        <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] shrink-0" onClick={onTest} disabled={state === "checking"}>
          {state === "checking" ? <Loader2 className="size-3 animate-spin" /> : "Test"}
        </Button>
      )}
      {state && state !== "idle" && state !== "checking" && <StatusDot state={state} />}
    </div>
  );
}

// --- Tab: General ---
function GeneralTab({ lang, setLang, markDirty }: { lang: Lang; setLang: (l: Lang) => void; markDirty: () => void }) {
  return (
    <div className="space-y-4">
      <SectionLabel>Interface Language</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {([["en", "English"], ["ja", "日本語"], ["both", "Both"]] as const).map(([v, label]) => (
          <button
            key={v}
            className={`border rounded px-3 py-1.5 text-[11px] transition-colors ${lang === v ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/40"}`}
            onClick={() => { setLang(v); markDirty(); }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Tab: Transcription ---
function TranscriptionTab({ asmKey, setAsmKey, asmState, checkAssembly, asmModel, setAsmModel, asmLang, setAsmLang, asmDiarize, setAsmDiarize }: {
  asmKey: string; setAsmKey: (v: string) => void;
  asmState: CheckState; checkAssembly: () => void;
  asmModel: string; setAsmModel: (v: string) => void;
  asmLang: string; setAsmLang: (v: string) => void;
  asmDiarize: boolean; setAsmDiarize: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionLabel>AssemblyAI</SectionLabel>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] w-16 shrink-0">API Key</span>
          <KeyInput value={asmKey} onChange={setAsmKey} placeholder="Paste AssemblyAI key" onTest={checkAssembly} state={asmState} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] w-16 shrink-0">Model</span>
          <Select value={asmModel} onValueChange={setAsmModel}>
            <SelectTrigger className="h-7 text-[11px] flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="universal-3-pro+universal-2">Universal-3 Pro + fallback</SelectItem>
              <SelectItem value="universal-2">Universal-2 only (99 languages)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] w-16 shrink-0">Language</span>
          <Select value={asmLang} onValueChange={setAsmLang}>
            <SelectTrigger className="h-7 text-[11px] flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ja">Japanese</SelectItem>
              <SelectItem value="bn">Bengali</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Row label="Speaker diarization">
          <Switch checked={asmDiarize} onCheckedChange={setAsmDiarize} className="scale-75" />
        </Row>
      </div>
    </div>
  );
}

// --- Tab: AI Providers ---
function AIProvidersTab({ summaryProvider, setSummaryProvider, summaryLang, setSummaryLang, gemKey, setGemKey, gemState, checkGemini, gemModel, setGemModel, gptKey, setGptKey, gptState, checkOpenAI, gptModel, setGptModel, asmState, ffmpegOk }: {
  summaryProvider: "gemini" | "chatgpt"; setSummaryProvider: (v: "gemini" | "chatgpt") => void;
  summaryLang: string; setSummaryLang: (v: string) => void;
  gemKey: string; setGemKey: (v: string) => void;
  gemState: CheckState; checkGemini: () => void;
  gemModel: string; setGemModel: (v: string) => void;
  gptKey: string; setGptKey: (v: string) => void;
  gptState: CheckState; checkOpenAI: () => void;
  gptModel: string; setGptModel: (v: string) => void;
  asmState: CheckState;
  ffmpegOk: boolean | null;
}) {
  return (
    <div className="space-y-4">
      {/* Connection Health */}
      <SectionLabel>Connection Health</SectionLabel>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] border rounded p-2 bg-muted/10">
        <div className="flex items-center gap-1.5">
          <StatusDot state={asmState} />
          <span>AssemblyAI</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusDot state={gemState} />
          <span>Gemini</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusDot state={gptState} />
          <span>OpenAI</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${ffmpegOk ? "bg-emerald-500" : ffmpegOk === null ? "bg-yellow-500" : "bg-red-500"}`} />
          <span>FFmpeg</span>
        </div>
      </div>

      <Separator />

      {/* Summary Provider */}
      <SectionLabel>Summary Provider</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {([["gemini", "Google Gemini"], ["chatgpt", "OpenAI ChatGPT"]] as const).map(([v, label]) => (
          <button
            key={v}
            className={`border rounded px-3 py-1.5 text-[11px] transition-colors ${summaryProvider === v ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/40"}`}
            onClick={() => setSummaryProvider(v)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] w-24 shrink-0">Summary language</span>
        <Select value={summaryLang} onValueChange={setSummaryLang}>
          <SelectTrigger className="h-7 text-[11px] flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ja">Japanese</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Gemini */}
      <SectionLabel>Google Gemini</SectionLabel>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] w-16 shrink-0">API Key</span>
          <KeyInput value={gemKey} onChange={setGemKey} placeholder="AIza..." onTest={checkGemini} state={gemState} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] w-16 shrink-0">Model</span>
          <Select value={gemModel} onValueChange={setGemModel}>
            <SelectTrigger className="h-7 text-[11px] flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
              <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
              <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* OpenAI */}
      <SectionLabel>OpenAI ChatGPT</SectionLabel>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] w-16 shrink-0">API Key</span>
          <KeyInput value={gptKey} onChange={setGptKey} placeholder="sk-..." onTest={checkOpenAI} state={gptState} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] w-16 shrink-0">Model</span>
          <Select value={gptModel} onValueChange={setGptModel}>
            <SelectTrigger className="h-7 text-[11px] flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
              <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// --- Tab: Pipeline Roles ---
function PipelineTab({ summaryProvider }: { summaryProvider: string }) {
  const roles = [
    { role: "Transcription", provider: "AssemblyAI", model: "Universal-3 Pro" },
    { role: "Summarization", provider: summaryProvider === "gemini" ? "Gemini" : "OpenAI", model: summaryProvider === "gemini" ? "1.5 Pro" : "GPT-4o" },
    { role: "Translation", provider: "Gemini", model: "1.5 Pro" },
    { role: "Speaker ID", provider: "AssemblyAI", model: "Diarization" },
  ];

  return (
    <div className="space-y-4">
      <SectionLabel>Role → Provider Mapping</SectionLabel>
      <div className="border rounded overflow-hidden">
        <div className="grid grid-cols-3 gap-0 text-[10px] text-muted-foreground uppercase tracking-wider bg-muted/30 px-2.5 py-1.5 border-b">
          <span>Role</span>
          <span>Provider</span>
          <span>Model</span>
        </div>
        {roles.map((r) => (
          <div key={r.role} className="grid grid-cols-3 gap-0 text-[11px] px-2.5 py-1.5 border-b last:border-b-0 hover:bg-muted/20">
            <span className="font-medium">{r.role}</span>
            <span className="text-muted-foreground">{r.provider}</span>
            <span className="font-mono text-[10px]">{r.model}</span>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground">
        Configure providers in the AI Providers tab. Role assignments update automatically.
      </div>
    </div>
  );
}

// --- Tab: Processing ---
function ProcessingTab({ autoRetry, setAutoRetry, autoCompress, setAutoCompress, autoSaveTxt, setAutoSaveTxt, asmDiarize, setAsmDiarize }: {
  autoRetry: boolean; setAutoRetry: (v: boolean) => void;
  autoCompress: boolean; setAutoCompress: (v: boolean) => void;
  autoSaveTxt: boolean; setAutoSaveTxt: (v: boolean) => void;
  asmDiarize: boolean; setAsmDiarize: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionLabel>Queue Behavior</SectionLabel>
      <Row label="Auto-retry on failure"><Switch checked={autoRetry} onCheckedChange={setAutoRetry} className="scale-75" /></Row>
      <Row label="Auto-compress large files"><Switch checked={autoCompress} onCheckedChange={setAutoCompress} className="scale-75" /></Row>

      <Separator />

      <SectionLabel>Transcription</SectionLabel>
      <Row label="Speaker diarization"><Switch checked={asmDiarize} onCheckedChange={setAsmDiarize} className="scale-75" /></Row>
      <Row label="Language detection"><Badge variant="outline" className="text-[9px] h-4">Auto</Badge></Row>

      <Separator />

      <SectionLabel>Output</SectionLabel>
      <Row label="Auto-save TXT after transcription"><Switch checked={autoSaveTxt} onCheckedChange={setAutoSaveTxt} className="scale-75" /></Row>
    </div>
  );
}

// --- Tab: Export ---
function ExportTab() {
  return (
    <div className="space-y-4">
      <SectionLabel>PDF Export</SectionLabel>
      <Row label="Default template"><Badge variant="outline" className="text-[9px] h-4">Business Report</Badge></Row>
      <Row label="Page size"><Badge variant="outline" className="text-[9px] h-4">A4</Badge></Row>
      <Row label="Include summary"><Badge variant="outline" className="text-[9px] h-4">Yes</Badge></Row>

      <Separator />

      <SectionLabel>TXT Export</SectionLabel>
      <Row label="Format"><Badge variant="outline" className="text-[9px] h-4 font-mono">[HH:MM:SS] Speaker: text</Badge></Row>
      <Row label="Include header"><Badge variant="outline" className="text-[9px] h-4">Yes</Badge></Row>
    </div>
  );
}

// --- Tab: Storage & Cache ---
function StorageTab({ storageSize, transcriptCount }: { storageSize: number; transcriptCount: number }) {
  return (
    <div className="space-y-4">
      <SectionLabel>Workspace</SectionLabel>
      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[11px]">
        <span className="text-muted-foreground">Storage path</span>
        <span className="font-mono text-[10px] truncate">recllm-data/</span>
        <span className="text-muted-foreground">Total size</span>
        <span className="font-mono">{(storageSize / (1024 * 1024)).toFixed(1)} MB</span>
        <span className="text-muted-foreground">Transcripts</span>
        <span className="font-mono">{transcriptCount}</span>
        <span className="text-muted-foreground">Export directory</span>
        <span className="font-mono text-[10px] truncate">~/Documents/</span>
        <span className="text-muted-foreground">Temp directory</span>
        <span className="font-mono text-[10px] truncate">recllm-data/temp/</span>
      </div>

      <Separator />

      <SectionLabel>Cache</SectionLabel>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground flex-1">Audio compression cache and intermediate files</span>
        <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" disabled>
          <Trash2 className="size-2.5 mr-1" />Clear Cache
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" disabled>
          <FolderOpen className="size-2.5 mr-1" />Open
        </Button>
      </div>
    </div>
  );
}

// --- Tab: Advanced ---
function AdvancedTab({ ffmpegOk, storageSize, transcriptCount, resetAll }: {
  ffmpegOk: boolean | null; storageSize: number; transcriptCount: number; resetAll: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionLabel>System Status</SectionLabel>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-[11px]">
          <span className={`size-2 rounded-full ${ffmpegOk ? "bg-emerald-500" : ffmpegOk === null ? "bg-yellow-500" : "bg-red-500"}`} />
          <span>FFmpeg</span>
          <span className="text-muted-foreground ml-auto font-mono">{ffmpegOk ? "Ready" : ffmpegOk === null ? "Checking..." : "Not found"}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="size-2 rounded-full bg-slate-400" />
          <span>GPU</span>
          <span className="text-muted-foreground ml-auto font-mono">Not detected</span>
        </div>
      </div>

      <Separator />

      <SectionLabel>Danger Zone</SectionLabel>
      <div className="space-y-1.5">
        <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] w-full justify-start border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={resetAll}>
          <RotateCcw className="size-3 mr-1.5" />Reset All Settings
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] w-full justify-start border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" disabled>
          <Trash2 className="size-3 mr-1.5" />Clear Processing Queue
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] w-full justify-start border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" disabled>
          <Trash2 className="size-3 mr-1.5" />Delete All Cache
        </Button>
      </div>
    </div>
  );
}
