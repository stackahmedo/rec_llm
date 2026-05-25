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
  Wifi, HardDrive, Trash2, FolderOpen, AlertTriangle,
} from "lucide-react";
import { useT, Lang } from "../i18n";
import { RestoreFactoryDialog } from "./restore-factory-dialog";

// --- Model Registry (architecture for future dynamic lists) ---
interface ModelMeta {
  id: string;
  label: string;
  category: string;
  speed: "fast" | "medium" | "slow";
  costTier: "free" | "cheap" | "standard" | "premium";
  quality: "basic" | "good" | "best";
  useCase: string;
  deprecated?: boolean;
}

const GEMINI_MODELS: ModelMeta[] = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", category: "Balanced", speed: "fast", costTier: "standard", quality: "good", useCase: "General summarization, fast turnaround" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", category: "Cheap / Fast", speed: "fast", costTier: "cheap", quality: "basic", useCase: "High-volume batch processing" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", category: "High Quality", speed: "slow", costTier: "premium", quality: "best", useCase: "Complex analysis, detailed reports" },
];

const DEPRECATED_GEMINI = ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-001", "gemini-2.0-flash-lite-001"];

function getActiveGeminiModels(): ModelMeta[] {
  return GEMINI_MODELS.filter((m) => !m.deprecated);
}

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

const tabs: { id: SettingsTab; labelKey: string; icon: any }[] = [
  { id: "general", labelKey: "settings.tab.general", icon: Settings2 },
  { id: "transcription", labelKey: "settings.tab.transcription", icon: Mic },
  { id: "ai-providers", labelKey: "settings.tab.aiProviders", icon: Sparkles },
  { id: "pipeline", labelKey: "settings.tab.pipeline", icon: GitBranch },
  { id: "processing", labelKey: "settings.tab.processing", icon: Cpu },
  { id: "storage", labelKey: "settings.tab.storage", icon: Database },
  { id: "export", labelKey: "settings.tab.export", icon: Download },
  { id: "advanced", labelKey: "settings.tab.advanced", icon: Wrench },
];

export function SettingsPanel() {
  const { lang, setLang, t } = useT();
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
  const [gemModel, setGemModel] = useState("gemini-2.5-flash");

  const [gptKey, setGptKey] = useState("");
  const [gptState, setGptState] = useState<CheckState>("idle");
  const [gptModel, setGptModel] = useState("gpt-4o");
  const [gptProviderType, setGptProviderType] = useState<"official" | "custom">("official");
  const [gptBaseUrl, setGptBaseUrl] = useState("https://api.openai.com/v1");

  const [summaryProvider, setSummaryProvider] = useState<"gemini" | "chatgpt">("gemini");
  const [summaryLang, setSummaryLang] = useState("ja");

  // Processing
  const [autoRetry, setAutoRetry] = useState(true);
  const [autoCompress, setAutoCompress] = useState(true);
  const [autoSaveTxt, setAutoSaveTxt] = useState(true);
  const [speakerMemoryEnabled, setSpeakerMemoryEnabled] = useState(true);

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
        if (models.gemini) {
          // Auto-migrate deprecated models
          if (DEPRECATED_GEMINI.includes(models.gemini)) {
            setGemModel("gemini-2.5-flash");
            toast.warning("Gemini model updated", { description: `${models.gemini} is deprecated. Migrated to Gemini 2.5 Flash.` });
          } else {
            setGemModel(models.gemini);
          }
        }
        if (models.chatgpt) setGptModel(models.chatgpt);
      }
      const openaiProv = await api.get('openaiProvider') as { providerType?: string; baseUrl?: string } | null;
      if (openaiProv) {
        if (openaiProv.providerType === "custom" || openaiProv.providerType === "official") setGptProviderType(openaiProv.providerType);
        if (openaiProv.baseUrl) setGptBaseUrl(openaiProv.baseUrl);
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
      const smEnabled = await api.get('speakerMemory.enabled');
      if (smEnabled === false) setSpeakerMemoryEnabled(false);
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
    if (!gemKey.trim()) { toast.error("Missing API key"); setGemState("fail"); return; }
    setGemState("checking");
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gemModel}?key=${gemKey.trim()}`);
      if (response.status === 200) {
        setGemState("ok");
        toast.success("Gemini connected");
      } else if (response.status === 400 || response.status === 403) {
        setGemState("fail");
        toast.error("Invalid API key", { description: "The key was rejected by Google." });
      } else if (response.status === 404) {
        setGemState("fail");
        toast.error("Model unavailable", { description: `${gemModel} is not available. It may be retired or require different permissions.` });
      } else if (response.status === 429) {
        setGemState("fail");
        toast.error("Quota exceeded", { description: "Rate limit or quota reached. Try again later." });
      } else {
        setGemState("fail");
        const body = await response.text().catch(() => "");
        toast.error(`Gemini error (${response.status})`, { description: body.slice(0, 120) || "Unexpected response." });
      }
    } catch { setGemState("fail"); toast.error("Network error", { description: "Could not reach Google AI. Check your connection." }); }
  };

  const checkOpenAI = async () => {
    if (!gptKey.trim()) { toast.error("Missing API key"); setGptState("fail"); return; }
    setGptState("checking");
    const baseUrl = gptProviderType === "custom" ? gptBaseUrl.trim().replace(/\/+$/, '') : "https://api.openai.com/v1";
    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: { "Authorization": `Bearer ${gptKey.trim()}` },
      });
      if (response.status === 200) {
        setGptState("ok");
        toast.success(`Connected to ${gptProviderType === "custom" ? baseUrl : "OpenAI"}`);
      } else if (response.status === 401) {
        setGptState("fail");
        toast.error("Invalid API key", { description: "The key was rejected by the provider." });
      } else if (response.status === 404) {
        setGptState("fail");
        toast.error("Wrong base URL", { description: `${baseUrl}/models returned 404.` });
      } else {
        setGptState("fail");
        const body = await response.text().catch(() => "");
        toast.error(`Provider error (${response.status})`, { description: body.slice(0, 120) || "Unexpected response." });
      }
    } catch (err: any) {
      setGptState("fail");
      toast.error("Network error", { description: `Could not reach ${baseUrl}. Check the URL and your connection.` });
    }
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
    await api.set('openaiProvider', { providerType: gptProviderType, baseUrl: gptBaseUrl });
    await api.set('preferences', { summaryProvider, asmDiarize, asmLang, summaryLang, autoRetry, autoCompress, autoSaveTxt });
    setDirty(false);
    toast.success(t("settings.saved"));
  };

  const resetAll = async () => {
    const api = window.electronAPI?.settings;
    if (api) { await api.delete('apiKeys'); await api.delete('models'); await api.delete('preferences'); }
    setAsmKey(""); setGemKey(""); setGptKey("");
    setAsmState("idle"); setGemState("idle"); setGptState("idle");
    setDirty(false);
    toast.message(t("settings.resetDone"));
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
              {t(tab.labelKey)}
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
              gptProviderType={gptProviderType} setGptProviderType={(v) => { setGptProviderType(v); markDirty(); }}
              gptBaseUrl={gptBaseUrl} setGptBaseUrl={(v) => { setGptBaseUrl(v); markDirty(); }}
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
              speakerMemory={speakerMemoryEnabled} setSpeakerMemory={(v) => { setSpeakerMemoryEnabled(v); window.electronAPI?.settings?.set('speakerMemory.enabled', v); }}
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
  const [uiScale, setUiScale] = useState(() => {
    try { return localStorage.getItem("recllm-ui-scale") || "default"; } catch { return "default"; }
  });

  const handleScale = (s: string) => {
    setUiScale(s);
    document.documentElement.setAttribute("data-ui-scale", s);
    try { localStorage.setItem("recllm-ui-scale", s); } catch {}
  };

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

      <SectionLabel>UI Text Size</SectionLabel>
      <div className="grid grid-cols-4 gap-1.5">
        {([["compact", "Compact"], ["default", "Default"], ["large", "Large"], ["extra-large", "Extra Large"]] as const).map(([v, label]) => (
          <button
            key={v}
            className={`border rounded px-2 py-1.5 text-[10px] transition-colors ${uiScale === v ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/40"}`}
            onClick={() => handleScale(v)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-muted-foreground">Adjusts interface text scaling for readability. Updates live.</p>
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
function AIProvidersTab({ summaryProvider, setSummaryProvider, summaryLang, setSummaryLang, gemKey, setGemKey, gemState, checkGemini, gemModel, setGemModel, gptKey, setGptKey, gptState, checkOpenAI, gptModel, setGptModel, gptProviderType, setGptProviderType, gptBaseUrl, setGptBaseUrl, asmState, ffmpegOk }: {
  summaryProvider: "gemini" | "chatgpt"; setSummaryProvider: (v: "gemini" | "chatgpt") => void;
  summaryLang: string; setSummaryLang: (v: string) => void;
  gemKey: string; setGemKey: (v: string) => void;
  gemState: CheckState; checkGemini: () => void;
  gemModel: string; setGemModel: (v: string) => void;
  gptKey: string; setGptKey: (v: string) => void;
  gptState: CheckState; checkOpenAI: () => void;
  gptModel: string; setGptModel: (v: string) => void;
  gptProviderType: "official" | "custom"; setGptProviderType: (v: "official" | "custom") => void;
  gptBaseUrl: string; setGptBaseUrl: (v: string) => void;
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
              {getActiveGeminiModels().map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex flex-col">
                    <span>{m.label}</span>
                    <span className="text-[9px] text-muted-foreground">{m.category} · {m.useCase.split(',')[0]}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* OpenAI / Compatible */}
      <SectionLabel>OpenAI / Compatible Provider</SectionLabel>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] w-16 shrink-0">Provider</span>
          <div className="flex gap-0.5 flex-1">
            {([["official", "Official OpenAI"], ["custom", "Custom / Compatible"]] as const).map(([v, label]) => (
              <button key={v} className={`flex-1 h-7 rounded text-[10px] border transition-colors ${gptProviderType === v ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted/50"}`}
                onClick={() => setGptProviderType(v)}>{label}</button>
            ))}
          </div>
        </div>
        {gptProviderType === "custom" && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] w-16 shrink-0">Base URL</span>
            <Input value={gptBaseUrl} onChange={(e) => setGptBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" className="h-7 text-[11px] flex-1 font-mono" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[11px] w-16 shrink-0">API Key</span>
          <KeyInput value={gptKey} onChange={setGptKey} placeholder="sk-..." onTest={checkOpenAI} state={gptState} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] w-16 shrink-0">Model</span>
          {gptProviderType === "official" ? (
            <Select value={gptModel} onValueChange={setGptModel}>
              <SelectTrigger className="h-7 text-[11px] flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input value={gptModel} onChange={(e) => setGptModel(e.target.value)} placeholder="gpt-4o" className="h-7 text-[11px] flex-1 font-mono" />
          )}
        </div>
        {gptProviderType === "custom" && (
          <div className="text-[9px] text-muted-foreground pl-[72px]">
            Any OpenAI-compatible endpoint. Test connection uses the base URL and model above.
          </div>
        )}
      </div>
    </div>
  );
}

// --- Tab: Pipeline Orchestration ---
interface PipelineStage {
  id: string;
  label: string;
  provider: string;
  model: string;
  fallback?: string;
  retries: number;
  timeout: number;
  enabled: boolean;
  tags: string[];
}

const defaultPipeline: PipelineStage[] = [
  { id: "transcription", label: "Transcription", provider: "AssemblyAI", model: "universal-3-pro", fallback: "", retries: 2, timeout: 300, enabled: true, tags: ["Fast", "Accurate"] },
  { id: "diarization", label: "Speaker Detection", provider: "AssemblyAI", model: "diarization", fallback: "", retries: 1, timeout: 120, enabled: true, tags: ["Built-in"] },
  { id: "summary", label: "Summary & Analysis", provider: "Gemini", model: "gemini-2.5-flash", fallback: "OpenAI", retries: 2, timeout: 60, enabled: true, tags: ["JSON", "Fast"] },
  { id: "translation", label: "Translation", provider: "Gemini", model: "gemini-2.5-flash", fallback: "", retries: 1, timeout: 60, enabled: false, tags: ["Multi-lang"] },
  { id: "export", label: "PDF Export", provider: "Local", model: "built-in", fallback: "", retries: 0, timeout: 30, enabled: true, tags: ["Offline"] },
];

const pipelinePresets: Record<string, Partial<PipelineStage>[]> = {
  cheapest: [
    { id: "summary", provider: "Gemini", model: "gemini-2.5-flash-lite" },
  ],
  balanced: [
    { id: "summary", provider: "Gemini", model: "gemini-2.5-flash" },
  ],
  fastest: [
    { id: "summary", provider: "Gemini", model: "gemini-2.5-flash-lite", retries: 0, timeout: 30 },
  ],
  quality: [
    { id: "summary", provider: "Gemini", model: "gemini-2.5-pro", timeout: 120 },
  ],
};

const workflowPresets = [
  { id: "meeting", label: "Meeting Intelligence", desc: "Full analysis with actions & decisions" },
  { id: "legal", label: "Legal Review", desc: "Verbatim transcript, speaker attribution" },
  { id: "podcast", label: "Podcast Workflow", desc: "Summary + key moments" },
  { id: "medical", label: "Medical Notes", desc: "Structured clinical notes" },
];

function PipelineTab({ summaryProvider }: { summaryProvider: string }) {
  const { t } = useT();
  const [stages, setStages] = useState<PipelineStage[]>(() => {
    try {
      const saved = localStorage.getItem("recllm-pipeline-stages");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (process.env.NODE_ENV !== 'production') console.log('[Pipeline] hydrate from localStorage');
          return parsed;
        }
      }
    } catch {}
    return defaultPipeline;
  });
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string>(() => {
    try { return localStorage.getItem("recllm-pipeline-preset") || "balanced"; } catch { return "balanced"; }
  });
  const [concurrency, setConcurrency] = useState<number>(() => {
    try { return Number(localStorage.getItem("recllm-pipeline-concurrency")) || 2; } catch { return 2; }
  });
  const [chunkStrategy, setChunkStrategy] = useState<"auto" | "fixed" | "speaker">(() => {
    try { return (localStorage.getItem("recllm-pipeline-chunk") as any) || "auto"; } catch { return "auto"; }
  });

  // Persist pipeline state on change
  useEffect(() => {
    try {
      localStorage.setItem("recllm-pipeline-stages", JSON.stringify(stages));
      if (process.env.NODE_ENV !== 'production') console.log('[Pipeline] save stages');
    } catch {}
  }, [stages]);

  useEffect(() => {
    try { localStorage.setItem("recllm-pipeline-preset", activePreset); } catch {}
  }, [activePreset]);

  useEffect(() => {
    try { localStorage.setItem("recllm-pipeline-concurrency", String(concurrency)); } catch {}
  }, [concurrency]);

  useEffect(() => {
    try { localStorage.setItem("recllm-pipeline-chunk", chunkStrategy); } catch {}
  }, [chunkStrategy]);

  const applyPreset = (presetId: string) => {
    setActivePreset(presetId);
    const patches = pipelinePresets[presetId];
    if (!patches) return;
    setStages((prev) => prev.map((s) => {
      const patch = patches.find((p) => p.id === s.id);
      return patch ? { ...s, ...patch } : s;
    }));
  };

  const updateStage = (id: string, patch: Partial<PipelineStage>) => {
    setStages((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
    setActivePreset("custom");
  };

  return (
    <div className="space-y-3">
      {/* Pipeline Presets */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{t("settings.preset")}:</span>
        {(["cheapest", "balanced", "fastest", "quality", "custom"] as const).map((p) => (
          <button
            key={p}
            className={`h-5 px-2 rounded text-[9px] border transition-colors ${activePreset === p ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted/50"}`}
            onClick={() => p !== "custom" && applyPreset(p)}
            disabled={p === "custom"}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Pipeline Flow Visualization */}
      <div className="border rounded p-2 bg-muted/10">
        <div className="flex items-center gap-1 flex-wrap">
          {stages.filter((s) => s.enabled).map((s, i, arr) => (
            <div key={s.id} className="flex items-center gap-1">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-background border text-[9px]">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span className="font-medium">{s.label}</span>
              </div>
              {i < arr.length - 1 && <span className="text-muted-foreground text-[9px]">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Stage Cards */}
      <div className="space-y-1">
        {stages.map((stage) => (
          <div key={stage.id} className={`border rounded transition-colors ${!stage.enabled ? "opacity-50" : ""}`}>
            {/* Stage header */}
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-muted/20"
              onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
            >
              <input
                type="checkbox"
                checked={stage.enabled}
                onChange={(e) => { e.stopPropagation(); updateStage(stage.id, { enabled: e.target.checked }); }}
                className="size-3 rounded accent-primary"
              />
              <span className="text-[11px] font-medium flex-1">{stage.label}</span>
              <span className="text-[9px] text-muted-foreground font-mono">{stage.provider}</span>
              <span className="text-[9px] text-muted-foreground font-mono">{stage.model}</span>
              {stage.fallback && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">fallback: {stage.fallback}</span>
              )}
              {stage.tags.map((t) => (
                <span key={t} className="text-[8px] px-1 py-0.5 rounded bg-primary/5 text-primary/70">{t}</span>
              ))}
              <span className="text-[9px] text-muted-foreground">{expandedStage === stage.id ? "−" : "+"}</span>
            </div>

            {/* Expanded settings */}
            {expandedStage === stage.id && (
              <div className="px-2.5 pb-2 pt-1 border-t bg-muted/5 space-y-1.5">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <div>
                    <div className="text-[9px] text-muted-foreground mb-0.5">{t("settings.provider")}</div>
                    <Input value={stage.provider} onChange={(e) => updateStage(stage.id, { provider: e.target.value })} className="h-6 text-[10px] font-mono" />
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground mb-0.5">{t("settings.model")}</div>
                    <Input value={stage.model} onChange={(e) => updateStage(stage.id, { model: e.target.value })} className="h-6 text-[10px] font-mono" />
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground mb-0.5">{t("settings.fallbackProvider")}</div>
                    <Input value={stage.fallback || ""} onChange={(e) => updateStage(stage.id, { fallback: e.target.value })} placeholder="None" className="h-6 text-[10px] font-mono" />
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground mb-0.5">{t("settings.timeout")}</div>
                    <Input type="number" value={stage.timeout} onChange={(e) => updateStage(stage.id, { timeout: Number(e.target.value) })} className="h-6 text-[10px] font-mono" />
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground mb-0.5">{t("settings.retries")}</div>
                    <Input type="number" value={stage.retries} onChange={(e) => updateStage(stage.id, { retries: Number(e.target.value) })} min={0} max={5} className="h-6 text-[10px] font-mono" />
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground mb-0.5">{t("settings.tags")}</div>
                    <Input value={stage.tags.join(", ")} onChange={(e) => updateStage(stage.id, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} className="h-6 text-[10px]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Runtime Controls */}
      <div className="border rounded p-2 space-y-1.5">
        <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">{t("settings.section.runtime")}</div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-[9px] text-muted-foreground mb-0.5">{t("settings.concurrency")}</div>
            <Input type="number" value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))} min={1} max={8} className="h-6 text-[10px] font-mono" />
          </div>
          <div>
            <div className="text-[9px] text-muted-foreground mb-0.5">{t("settings.chunkStrategy")}</div>
            <Select value={chunkStrategy} onValueChange={(v: any) => setChunkStrategy(v)}>
              <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="fixed">Fixed (10k chars)</SelectItem>
                <SelectItem value="speaker">By Speaker Turn</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[9px] text-muted-foreground mb-0.5">{t("settings.parallelStages")}</div>
            <Badge variant="outline" className="text-[9px] h-5">Sequential</Badge>
          </div>
        </div>
      </div>

      {/* Workflow Presets */}
      <div className="border rounded p-2 space-y-1.5">
        <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">{t("settings.section.workflowTemplates")}</div>
        <div className="grid grid-cols-2 gap-1">
          {workflowPresets.map((w) => (
            <button key={w.id} className="text-left p-1.5 rounded border hover:bg-muted/20 transition-colors">
              <div className="text-[10px] font-medium">{w.label}</div>
              <div className="text-[9px] text-muted-foreground">{w.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Tab: Processing ---
function ProcessingTab({ autoRetry, setAutoRetry, autoCompress, setAutoCompress, autoSaveTxt, setAutoSaveTxt, asmDiarize, setAsmDiarize, speakerMemory, setSpeakerMemory }: {
  autoRetry: boolean; setAutoRetry: (v: boolean) => void;
  autoCompress: boolean; setAutoCompress: (v: boolean) => void;
  autoSaveTxt: boolean; setAutoSaveTxt: (v: boolean) => void;
  asmDiarize: boolean; setAsmDiarize: (v: boolean) => void;
  speakerMemory: boolean; setSpeakerMemory: (v: boolean) => void;
}) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <SectionLabel>{t("settings.section.queueBehavior")}</SectionLabel>
      <Row label={t("settings.autoRetry")}><Switch checked={autoRetry} onCheckedChange={setAutoRetry} className="scale-75" /></Row>
      <Row label={t("settings.autoCompress")}><Switch checked={autoCompress} onCheckedChange={setAutoCompress} className="scale-75" /></Row>

      <Separator />

      <SectionLabel>{t("settings.section.transcription")}</SectionLabel>
      <Row label={t("settings.speakerDiarization")}><Switch checked={asmDiarize} onCheckedChange={setAsmDiarize} className="scale-75" /></Row>
      <Row label={t("settings.rememberSpeakers")}><Switch checked={speakerMemory} onCheckedChange={setSpeakerMemory} className="scale-75" /></Row>
      <Row label={t("settings.aiSpeakerSuggestion")}><Switch checked={speakerMemory} onCheckedChange={setSpeakerMemory} className="scale-75" /></Row>
      <Row label={t("settings.languageDetection")}><Badge variant="outline" className="text-[9px] h-4">Auto</Badge></Row>

      <Separator />

      <SectionLabel>{t("settings.section.output")}</SectionLabel>
      <Row label={t("settings.autoSaveTxt")}><Switch checked={autoSaveTxt} onCheckedChange={setAutoSaveTxt} className="scale-75" /></Row>
    </div>
  );
}

// --- Tab: Export ---
function ExportTab() {
  const [exportFolder, setExportFolder] = useState<string>("");

  useEffect(() => {
    const api = window.electronAPI?.settings;
    if (!api) return;
    api.get('exportFolder').then((v) => {
      if (typeof v === 'string') setExportFolder(v);
    });
  }, []);

  const pickFolder = async () => {
    const result = await window.electronAPI?.export?.selectFolder();
    if (result?.ok && result.path) {
      setExportFolder(result.path);
      await window.electronAPI?.settings?.set('exportFolder', result.path);
      toast.success("Export folder set");
    }
  };

  const clearFolder = async () => {
    setExportFolder("");
    await window.electronAPI?.settings?.delete('exportFolder');
    toast.message("Export folder cleared — will use save dialog");
  };

  return (
    <div className="space-y-4">
      <SectionLabel>Export Location</SectionLabel>
      <p className="text-[9px] text-muted-foreground">All exports (PDF, TXT, DOCX) will save directly to this folder. Leave empty to choose each time.</p>
      <div className="flex items-center gap-1.5">
        <Input
          value={exportFolder}
          readOnly
          placeholder="No folder set — save dialog will appear"
          className="h-7 text-[11px] font-mono flex-1"
        />
        <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] shrink-0" onClick={pickFolder}>
          <FolderOpen className="size-3 mr-1" />Browse
        </Button>
        {exportFolder && (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] shrink-0 text-red-500 hover:text-red-600" onClick={clearFolder}>
            <Trash2 className="size-3" />
          </Button>
        )}
      </div>

      <Separator />

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
  const [restoreOpen, setRestoreOpen] = useState(false);

  const handleFactoryRestore = async () => {
    const api = window.electronAPI?.settings;
    if (api) {
      await api.delete('apiKeys');
      await api.delete('models');
      await api.delete('preferences');
    }
    // Clear localStorage
    try { localStorage.clear(); } catch {}
    toast.success("App restored to factory settings. All local data has been removed.");
    // Reload to clean state
    setTimeout(() => window.location.reload(), 1500);
  };

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

        <Separator />

        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-8 text-[11px] w-full justify-start gap-1.5"
          onClick={() => setRestoreOpen(true)}
        >
          <AlertTriangle className="size-3" />Restore Factory Settings
        </Button>
      </div>

      <RestoreFactoryDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        onConfirm={handleFactoryRestore}
      />
    </div>
  );
}
