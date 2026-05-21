import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { toast } from "sonner";
import {
  Plus, Cpu, Mic, ScanText, Sparkles, Languages, Users, MessageSquare,
  Bot, Trash2, Pencil, KeyRound, CheckCircle2,
} from "lucide-react";

interface Engine {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  model: string;
  apiKey: string;
  custom?: boolean;
  verified?: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string;
  icon: any;
  engineId: string;
}

const initialEngines: Engine[] = [
  { id: "e1", name: "AssemblyAI · universal-2", provider: "AssemblyAI", endpoint: "https://api.assemblyai.com/v2", model: "universal-2", apiKey: "asm_••••••", verified: true },
  { id: "e2", name: "Gemini 1.5 Pro",          provider: "Google",     endpoint: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-1.5-pro", apiKey: "AIza••••", verified: true },
  { id: "e3", name: "ChatGPT 4o",              provider: "OpenAI",     endpoint: "https://api.openai.com/v1", model: "gpt-4o", apiKey: "sk-••••", verified: true },
  { id: "e4", name: "Gemma 2 27B",             provider: "Groq",       endpoint: "https://api.groq.com/openai/v1", model: "gemma-2-27b-it", apiKey: "gsk_••••", verified: false },
  { id: "e5", name: "Whisper Large v3",        provider: "OpenAI",     endpoint: "https://api.openai.com/v1", model: "whisper-1", apiKey: "sk-••••", verified: true },
  { id: "e6", name: "Claude 3.5 Sonnet",       provider: "Anthropic",  endpoint: "https://api.anthropic.com/v1", model: "claude-3-5-sonnet", apiKey: "sk-ant-••••", verified: true },
];

const initialRoles: Role[] = [
  { id: "transcription",  name: "Transcription",       description: "Audio → text",                    icon: Mic,            engineId: "e1" },
  { id: "diarization",    name: "Diarization",         description: "Separate overlapping voices",     icon: Users,          engineId: "e1" },
  { id: "summary",        name: "Summary",             description: "Generate 30-item digest",         icon: Sparkles,       engineId: "e2" },
  { id: "classification", name: "Voice Classification",description: "Gender, pace, age tagging",       icon: ScanText,       engineId: "e3" },
  { id: "translation",    name: "Translation",         description: "Translate transcripts",           icon: Languages,      engineId: "e2" },
  { id: "chatbot",        name: "Chat Assistant",      description: "Ask questions about recordings",  icon: MessageSquare,  engineId: "e6" },
];

export function RoleEngines() {
  const [engines, setEngines] = useState<Engine[]>(initialEngines);
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [open, setOpen] = useState(false);

  // New engine form
  const [draft, setDraft] = useState<Engine>({
    id: "", name: "", provider: "", endpoint: "", model: "", apiKey: "", custom: true,
  });
  const [authHeader, setAuthHeader] = useState("Bearer");
  const [streaming, setStreaming] = useState(true);

  const setRoleEngine = (roleId: string, engineId: string) => {
    setRoles((prev) => prev.map((r) => r.id === roleId ? { ...r, engineId } : r));
    const role = roles.find((r) => r.id === roleId);
    const engine = engines.find((e) => e.id === engineId);
    if (role && engine) toast.success(`${role.name} → ${engine.name}`);
  };

  const addEngine = () => {
    if (!draft.name || !draft.endpoint || !draft.model) {
      toast.error("Name, endpoint and model are required");
      return;
    }
    const e: Engine = { ...draft, id: `e${Date.now()}`, custom: true, verified: false };
    setEngines((prev) => [...prev, e]);
    setDraft({ id: "", name: "", provider: "", endpoint: "", model: "", apiKey: "", custom: true });
    setOpen(false);
    toast.success(`Added engine "${e.name}"`, {
      description: "Assign it to a role below to start using it.",
    });
  };

  const removeEngine = (id: string) => {
    if (roles.some((r) => r.engineId === id)) {
      toast.error("Cannot delete — engine is still assigned to a role");
      return;
    }
    setEngines((prev) => prev.filter((e) => e.id !== id));
  };

  const verifyEngine = (id: string) => {
    setEngines((prev) => prev.map((e) => e.id === id ? { ...e, verified: true } : e));
    toast.success("Engine verified");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="size-4" />Roles & AI Engines
            </CardTitle>
            <CardDescription>
              Assign a different engine (or your own custom one) to each pipeline role.
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="size-4 mr-1" />Add engine</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add custom AI engine</DialogTitle>
                <DialogDescription>
                  Register any OpenAI-compatible endpoint, a hosted model, or your own self-hosted server.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Engine name</Label>
                  <Input className="mt-1" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Llama 3.3 on Together" />
                </div>
                <div>
                  <Label>Provider</Label>
                  <Input className="mt-1" value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })} placeholder="Together / Local / Anthropic..." />
                </div>
                <div>
                  <Label>Model ID</Label>
                  <Input className="mt-1" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder="meta-llama/llama-3.3-70b" />
                </div>
                <div className="col-span-2">
                  <Label>Base endpoint URL</Label>
                  <Input className="mt-1 font-mono" value={draft.endpoint} onChange={(e) => setDraft({ ...draft, endpoint: e.target.value })} placeholder="https://api.together.xyz/v1" />
                </div>
                <div>
                  <Label>Auth header</Label>
                  <Select value={authHeader} onValueChange={setAuthHeader}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bearer">Bearer token</SelectItem>
                      <SelectItem value="x-api-key">x-api-key</SelectItem>
                      <SelectItem value="Basic">Basic auth</SelectItem>
                      <SelectItem value="none">None (local)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>API key</Label>
                  <div className="relative mt-1">
                    <KeyRound className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9 font-mono" type="password" value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} placeholder="sk-..." />
                  </div>
                </div>
                <div className="col-span-2">
                  <Label>Extra headers (JSON, optional)</Label>
                  <Textarea className="mt-1 font-mono" rows={3} placeholder='{ "HTTP-Referer": "voicelens.app" }' />
                </div>
                <div className="col-span-2 flex items-center justify-between border rounded-md p-3">
                  <div>
                    <Label className="leading-none">Streaming responses</Label>
                    <div className="text-muted-foreground mt-1">Enable SSE streaming for chat-style usage.</div>
                  </div>
                  <Switch checked={streaming} onCheckedChange={setStreaming} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={addEngine}>Add engine</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Roles → Engines table */}
        <div>
          <div className="text-muted-foreground mb-2">Pipeline roles</div>
          <div className="space-y-2">
            {roles.map((role) => {
              const Icon = role.icon;
              const engine = engines.find((e) => e.id === role.engineId);
              return (
                <div key={role.id} className="border rounded-lg p-3 flex items-center gap-3">
                  <div className="size-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div>{role.name}</div>
                    <div className="text-muted-foreground">{role.description}</div>
                  </div>
                  <Select value={role.engineId} onValueChange={(v) => setRoleEngine(role.id, v)}>
                    <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {engines.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          <div className="flex items-center gap-2">
                            {e.name}
                            {e.custom && <Badge variant="outline">custom</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {engine?.verified ? (
                    <Badge className="bg-emerald-600 shrink-0">
                      <CheckCircle2 className="size-3 mr-1" />Live
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0">Unverified</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Engine pool */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-muted-foreground">Engine pool ({engines.length})</div>
            <div className="text-muted-foreground">Any role can reuse these engines</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {engines.map((e) => {
              const usedBy = roles.filter((r) => r.engineId === e.id);
              return (
                <div key={e.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Bot className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{e.name}</span>
                          {e.custom && <Badge variant="outline">custom</Badge>}
                        </div>
                        <div className="text-muted-foreground truncate">{e.provider} · {e.model}</div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {!e.verified && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => verifyEngine(e.id)} title="Verify">
                          <CheckCircle2 className="size-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit">
                        <Pencil className="size-4" />
                      </Button>
                      {e.custom && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeEngine(e.id)} title="Delete">
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="text-muted-foreground font-mono truncate mt-2">{e.endpoint}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {usedBy.length === 0 ? (
                      <Badge variant="outline">Unused</Badge>
                    ) : usedBy.map((r) => (
                      <Badge key={r.id} variant="secondary">{r.name}</Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
