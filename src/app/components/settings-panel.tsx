import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Switch } from "./ui/switch";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import {
  Key, Eye, EyeOff, CheckCircle2, XCircle, Loader2, Mic, Sparkles,
  ExternalLink, Save, RotateCcw, Lock,
} from "lucide-react";
import { RoleEngines } from "./role-engines";
import { useT, Lang } from "../i18n";
import { Languages } from "lucide-react";

type CheckState = "idle" | "checking" | "ok" | "fail";

const PLACEHOLDER_KEYS = [
  'your_api_key', 'your_api_key_here', 'paste_key_here',
  'your-api-key', 'api_key', 'api-key', 'sk-xxx', 'xxx',
  'insert_key_here', 'replace_with_your_key',
];

function isPlaceholderKey(key: string): boolean {
  const lower = key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return PLACEHOLDER_KEYS.some((p) => lower === p.replace(/[^a-z0-9_-]/g, ''));
}

function modelDisplayName(providerId: string, model: string): string {
  if (providerId === "assembly") {
    switch (model) {
      case "universal-3-pro+universal-2": return "Universal-3 Pro + fallback (recommended)";
      case "universal-2": return "Universal-2 only (99 languages)";
      default: return model;
    }
  }
  return model;
}

interface ProviderCardProps {
  id: string;
  name: string;
  description: string;
  docsUrl: string;
  apiKey: string;
  onKeyChange: (v: string) => void;
  state: CheckState;
  onCheck: () => void;
  active: boolean;
  models: string[];
  model: string;
  onModelChange: (v: string) => void;
}

function ProviderCard(p: ProviderCardProps) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  const stateBadge = {
    idle:     <Badge variant="outline">{t("settings.notVerified")}</Badge>,
    checking: <Badge variant="secondary"><Loader2 className="size-3 mr-1 animate-spin" />{t("settings.checking")}</Badge>,
    ok:       <Badge className="bg-emerald-600"><CheckCircle2 className="size-3 mr-1" />{t("settings.connected")}</Badge>,
    fail:     <Badge variant="destructive"><XCircle className="size-3 mr-1" />{t("settings.invalidKey")}</Badge>,
  }[p.state];

  return (
    <div className={`border rounded-lg p-4 transition-colors ${p.active ? "border-primary bg-primary/5" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div>{p.name}</div>
            {p.active && <Badge variant="default">{t("settings.active")}</Badge>}
          </div>
          <div className="text-muted-foreground mt-0.5">{p.description}</div>
        </div>
        {stateBadge}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_12rem] gap-3 mt-4">
        <div>
          <Label htmlFor={`${p.id}-key`}>{t("settings.apiKey")}</Label>
          <div className="relative mt-1">
            <Key className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`${p.id}-key`}
              type={show ? "text" : "password"}
              placeholder={`Paste your ${p.name} API key`}
              value={p.apiKey}
              onChange={(e) => p.onKeyChange(e.target.value)}
              className="pl-9 pr-10 font-mono"
            />
            <Button
              variant="ghost" size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setShow(!show)}
              type="button"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
        </div>
        <div>
          <Label>{t("settings.model")}</Label>
          <Select value={p.model} onValueChange={p.onModelChange}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {p.models.map((m) => (
                <SelectItem key={m} value={m}>
                  {modelDisplayName(p.id, m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 gap-2 flex-wrap">
        <a href={p.docsUrl} target="_blank" rel="noreferrer"
           className="text-muted-foreground inline-flex items-center hover:text-foreground">
          {t("settings.getKey")} <ExternalLink className="size-3 ml-1" />
        </a>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={p.onCheck} disabled={!p.apiKey || p.state === "checking"}>
            {p.state === "checking" ? <Loader2 className="size-4 mr-1 animate-spin" /> : <CheckCircle2 className="size-4 mr-1" />}
            {t("settings.checkConnection")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const { t, lang, setLang } = useT();
  // Transcription — AssemblyAI
  const [asmKey, setAsmKey] = useState("");
  const [asmState, setAsmState] = useState<CheckState>("idle");
  const [asmModel, setAsmModel] = useState("universal-3-pro+universal-2");
  const [asmDiarize, setAsmDiarize] = useState(true);
  const [asmLang, setAsmLang] = useState("auto");

  const checkAssembly = async () => {
    setAsmState("checking");
    const api = window.electronAPI?.assemblyai;
    if (!api) {
      setAsmState("idle");
      toast.message("Desktop mode required for real API validation", {
        description: "Run the app via Electron to validate keys against the real API.",
      });
      return;
    }
    const result = await api.validateKey();
    setAsmState(result.ok ? "ok" : "fail");
    if (result.ok) toast.success("AssemblyAI connected", { description: "API key verified · diarization available." });
    else toast.error("AssemblyAI rejected the key", { description: result.error || "Check your key." });
  };

  // Summary — choose Gemini / ChatGPT / Gemma
  const [summaryProvider, setSummaryProvider] = useState<"gemini" | "chatgpt" | "gemma">("gemini");

  const [gemKey, setGemKey] = useState("");
  const [gemState, setGemState] = useState<CheckState>("idle");
  const [gemModel, setGemModel] = useState("gemini-1.5-pro");

  const [gptKey, setGptKey] = useState("");
  const [gptState, setGptState] = useState<CheckState>("idle");
  const [gptModel, setGptModel] = useState("gpt-4o");

  const [gemmaKey, setGemmaKey] = useState("");
  const [gemmaState, setGemmaState] = useState<CheckState>("idle");
  const [gemmaModel, setGemmaModel] = useState("gemma-2-27b-it");

  // Load saved settings on mount
  useEffect(() => {
    const api = window.electronAPI?.settings;
    if (!api) return;
    (async () => {
      const keys = await api.get('apiKeys') as Record<string, string> | null;
      if (keys) {
        if (keys.assemblyai) setAsmKey(keys.assemblyai);
        if (keys.gemini) setGemKey(keys.gemini);
        if (keys.chatgpt) setGptKey(keys.chatgpt);
        if (keys.gemma) setGemmaKey(keys.gemma);
      }
      const models = await api.get('models') as Record<string, string> | null;
      if (models) {
        if (models.assemblyai) setAsmModel(models.assemblyai);
        if (models.gemini) setGemModel(models.gemini);
        if (models.chatgpt) setGptModel(models.chatgpt);
        if (models.gemma) setGemmaModel(models.gemma);
      }
      const prefs = await api.get('preferences') as Record<string, unknown> | null;
      if (prefs) {
        if (typeof prefs.summaryProvider === 'string') setSummaryProvider(prefs.summaryProvider as any);
        if (typeof prefs.asmDiarize === 'boolean') setAsmDiarize(prefs.asmDiarize);
        if (typeof prefs.asmLang === 'string') setAsmLang(prefs.asmLang);
      }
    })();
  }, []);

  const makeChecker = (
    key: string,
    setState: (s: CheckState) => void,
    name: string,
    provider: string,
  ) => async () => {
    if (!window.electronAPI?.settings) {
      setState("idle");
      toast.message("Desktop mode required for real API validation", {
        description: "Run the app via Electron to validate keys against the real API.",
      });
      return;
    }

    const trimmed = key.trim();
    if (!trimmed || trimmed.length < 10) {
      setState("fail");
      toast.error(`${name}: no valid key`, { description: "Paste a key and save settings first." });
      return;
    }

    setState("checking");

    // Gemma via Groq — validate with a real API call
    if (provider === "gemma") {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { "Authorization": `Bearer ${key}` },
        });
        if (response.status === 200) {
          setState("ok");
          toast.success(`${name} connected via Groq`);
        } else if (response.status === 401) {
          setState("fail");
          toast.error(`${name}: invalid Groq API key`);
        } else {
          setState("fail");
          toast.error(`${name}: unexpected response (${response.status})`);
        }
      } catch {
        setState("fail");
        toast.error(`${name}: network error — cannot reach Groq API`);
      }
      return;
    }

    // Gemini — validate with a real API call
    if (provider === "gemini") {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (response.status === 200) {
          setState("ok");
          toast.success(`${name} connected`);
        } else if (response.status === 400 || response.status === 403) {
          setState("fail");
          toast.error(`${name}: invalid API key`);
        } else {
          setState("fail");
          toast.error(`${name}: unexpected response (${response.status})`);
        }
      } catch {
        setState("fail");
        toast.error(`${name}: network error`);
      }
      return;
    }

    // ChatGPT — validate with a real API call
    if (provider === "chatgpt") {
      try {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: { "Authorization": `Bearer ${key}` },
        });
        if (response.status === 200) {
          setState("ok");
          toast.success(`${name} connected`);
        } else if (response.status === 401) {
          setState("fail");
          toast.error(`${name}: invalid API key`);
        } else {
          setState("fail");
          toast.error(`${name}: unexpected response (${response.status})`);
        }
      } catch {
        setState("fail");
        toast.error(`${name}: network error`);
      }
      return;
    }

    // Fallback
    setState("fail");
    toast.error(`${name}: validation not configured`);
  };

  const saveAll = async () => {
    const api = window.electronAPI?.settings;
    if (!api) {
      toast.message("Desktop mode required", { description: "Settings are not persisted in browser mode." });
      return;
    }

    // Validate no placeholder keys
    const keysToSave = {
      assemblyai: asmKey.trim(),
      gemini: gemKey.trim(),
      chatgpt: gptKey.trim(),
      gemma: gemmaKey.trim(),
    };

    for (const [provider, key] of Object.entries(keysToSave)) {
      if (key && isPlaceholderKey(key)) {
        toast.error(`Invalid ${provider} key`, {
          description: `Please paste your real API key from the provider dashboard.`,
        });
        return;
      }
    }

    await api.set('apiKeys', keysToSave);
    await api.set('models', {
      assemblyai: asmModel,
      gemini: gemModel,
      chatgpt: gptModel,
      gemma: gemmaModel,
    });
    await api.set('preferences', {
      summaryProvider,
      asmDiarize,
      asmLang,
    });
    toast.success("Settings saved", { description: "Encrypted and stored locally." });
  };

  const resetAll = async () => {
    const api = window.electronAPI?.settings;
    if (api) {
      await api.delete('apiKeys');
      await api.delete('models');
      await api.delete('preferences');
    }
    setAsmKey(""); setAsmState("idle");
    setGemKey(""); setGemState("idle");
    setGptKey(""); setGptState("idle");
    setGemmaKey(""); setGemmaState("idle");
    toast.message("Settings reset");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="size-4" />{t("settings.language.title")}
          </CardTitle>
          <CardDescription>{t("settings.language.desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={lang}
            onValueChange={(v) => setLang(v as Lang)}
            className="grid grid-cols-1 md:grid-cols-3 gap-3"
          >
            {[
              { v: "en",   label: t("settings.language.english"),  flag: "🇺🇸" },
              { v: "ja",   label: t("settings.language.japanese"), flag: "🇯🇵" },
              { v: "both", label: t("settings.language.both"),     flag: "🌐" },
            ].map((o) => (
              <label key={o.v} htmlFor={`lang-${o.v}`}
                className={`border rounded-lg p-3 cursor-pointer flex items-center gap-3 transition-colors ${lang === o.v ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                <RadioGroupItem value={o.v} id={`lang-${o.v}`} />
                <span className="text-2xl">{o.flag}</span>
                <div>{o.label}</div>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Transcription engine */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mic className="size-4" />{t("settings.transcription.title")}
              </CardTitle>
              <CardDescription>{t("settings.transcription.desc")}</CardDescription>
            </div>
            <Badge variant="secondary">AssemblyAI</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <ProviderCard
            id="assembly"
            name="AssemblyAI"
            description="Long-form transcription with speaker diarization, sentiment, and entity detection."
            docsUrl="https://www.assemblyai.com/app/account"
            apiKey={asmKey}
            onKeyChange={setAsmKey}
            state={asmState}
            onCheck={checkAssembly}
            active
            models={["universal-3-pro+universal-2", "universal-2"]}
            model={asmModel}
            onModelChange={setAsmModel}
          />

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Default language</Label>
              <Select value={asmLang} onValueChange={setAsmLang}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ja">Japanese</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="bn">Bengali</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-between gap-3 border rounded-md p-3">
              <div>
                <Label className="leading-none">Speaker diarization</Label>
                <div className="text-muted-foreground mt-1">Separate overlapping voices into channels.</div>
              </div>
              <Switch checked={asmDiarize} onCheckedChange={setAsmDiarize} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary engine */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4" />{t("settings.summary.title")}
              </CardTitle>
              <CardDescription>{t("settings.summary.desc")}</CardDescription>
            </div>
            <Badge variant="outline" className="capitalize">{summaryProvider}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <RadioGroup
            value={summaryProvider}
            onValueChange={(v) => setSummaryProvider(v as any)}
            className="grid grid-cols-1 md:grid-cols-3 gap-3"
          >
            {[
              { v: "gemini",  t: "Google Gemini",   d: "Long-context, multilingual" },
              { v: "chatgpt", t: "OpenAI ChatGPT",  d: "Strong reasoning, JSON mode" },
              { v: "gemma",   t: "Gemma (via Groq)", d: "Optional · requires Groq API key" },
            ].map((o) => (
              <label key={o.v} htmlFor={`sp-${o.v}`}
                className={`border rounded-lg p-3 cursor-pointer flex items-start gap-3 transition-colors ${summaryProvider === o.v ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                <RadioGroupItem value={o.v} id={`sp-${o.v}`} className="mt-1" />
                <div>
                  <div>{o.t}</div>
                  <div className="text-muted-foreground">{o.d}</div>
                </div>
              </label>
            ))}
          </RadioGroup>

          <Separator />

          <ProviderCard
            id="gemini"
            name="Google Gemini"
            description="Google AI Studio key (starts with AIza...). Long-context summarization."
            docsUrl="https://aistudio.google.com/app/apikey"
            apiKey={gemKey}
            onKeyChange={setGemKey}
            state={gemState}
            onCheck={makeChecker(gemKey, setGemState, "Gemini", "gemini")}
            active={summaryProvider === "gemini"}
            models={["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"]}
            model={gemModel}
            onModelChange={setGemModel}
          />

          <ProviderCard
            id="chatgpt"
            name="OpenAI ChatGPT"
            description="OpenAI API key (sk-...). Supports JSON-mode output for the 30-item digest."
            docsUrl="https://platform.openai.com/api-keys"
            apiKey={gptKey}
            onKeyChange={setGptKey}
            state={gptState}
            onCheck={makeChecker(gptKey, setGptState, "ChatGPT", "chatgpt")}
            active={summaryProvider === "chatgpt"}
            models={["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-mini"]}
            model={gptModel}
            onModelChange={setGptModel}
          />

          <ProviderCard
            id="gemma"
            name="Gemma (via Groq) — Optional"
            description="Requires a Groq API key (free at console.groq.com). Not installed locally."
            docsUrl="https://console.groq.com/keys"
            apiKey={gemmaKey}
            onKeyChange={setGemmaKey}
            state={gemmaState}
            onCheck={makeChecker(gemmaKey, setGemmaState, "Gemma", "gemma")}
            active={summaryProvider === "gemma"}
            models={["gemma-2-27b-it", "gemma-2-9b-it", "gemma-7b-it"]}
            model={gemmaModel}
            onModelChange={setGemmaModel}
          />

          {summaryProvider === "gemma" && !gemmaKey && (
            <div className="text-amber-600 dark:text-amber-400 text-sm border border-amber-300 dark:border-amber-700 rounded-md p-3 bg-amber-50 dark:bg-amber-950/30">
              Gemma local model not installed. To use Gemma, enter a Groq API key above. Local model download will be available in a future update.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Roles & engines */}
      <RoleEngines />

      {/* Security & misc */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="size-4" />{t("settings.storage.title")}</CardTitle>
          <CardDescription>{t("settings.storage.desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            ["Speaker profile slots", "6 of 10 used"],
            ["Manual correction → training", "Enabled"],
            ["Encrypted storage", "AES-256 at rest"],
            ["Role-based access", "3 roles · 7 members"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b pb-3 last:border-b-0 last:pb-0">
              <div>{k}</div>
              <Badge variant="outline">{v}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={resetAll}><RotateCcw className="size-4 mr-1" />{t("settings.reset")}</Button>
        <Button type="button" onClick={saveAll}><Save className="size-4 mr-1" />{t("settings.save")}</Button>
      </div>
    </div>
  );
}
