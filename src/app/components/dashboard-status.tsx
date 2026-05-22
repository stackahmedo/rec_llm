import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import {
  CheckCircle2, XCircle, AlertCircle, Clock, FileAudio, HardDrive,
  Zap, Download, AlertTriangle, Database, Wifi, Upload, Play,
  Cpu, MemoryStick, Sparkles, ArrowRight, Trash2, FileText, Bell,
  RefreshCw, Settings,
} from "lucide-react";
import { useTranscripts } from "../transcript-store";
import { checkAllProviders, loadCachedStatus, getStatusDisplay, ApiStatusState, ProviderStatus } from "../api-status-service";
import { notifyApiStatus } from "../notification-store";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
}

interface ApiKeyStatus {
  assemblyai: boolean;
  gemini: boolean;
  chatgpt: boolean;
  gemma: boolean;
}

interface StorageStats {
  historySize: number;
  transcriptCount: number;
  summaryCount: number;
  transcriptSize: number;
  summarySize: number;
  totalSize: number;
}

interface DashboardStatusProps {
  onNavigate?: (view: string) => void;
}

export function DashboardStatus({ onNavigate }: DashboardStatusProps) {
  const { history, summaries, transcripts, setActiveId } = useTranscripts();
  const [keyStatus, setKeyStatus] = useState<ApiKeyStatus>({ assemblyai: false, gemini: false, chatgpt: false, gemma: false });
  const [provider, setProvider] = useState<string>("gemini");
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [ffmpegOk, setFfmpegOk] = useState<boolean | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatusState | null>(loadCachedStatus);
  const [apiChecking, setApiChecking] = useState(false);
  const prevStatusRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const api = window.electronAPI?.settings;
    if (!api) return;
    (async () => {
      const keys = await api.get('apiKeys') as Record<string, string> | null;
      if (keys) {
        setKeyStatus({
          assemblyai: (keys.assemblyai?.length || 0) >= 20,
          gemini: (keys.gemini?.length || 0) >= 10,
          chatgpt: (keys.chatgpt?.length || 0) >= 10,
          gemma: (keys.gemma?.length || 0) >= 10,
        });
      }
      const prefs = await api.get('preferences') as Record<string, unknown> | null;
      if (prefs?.summaryProvider) setProvider(prefs.summaryProvider as string);
    })();
    window.electronAPI?.audio?.ffmpegCheck().then((r) => setFfmpegOk(r.ok));
  }, []);

  // API status check on mount
  useEffect(() => {
    runApiCheck(false);
  }, []);

  const runApiCheck = async (manual: boolean) => {
    setApiChecking(true);
    try {
      const result = await checkAllProviders();
      setApiStatus(result);

      // Notify only on meaningful status changes (not on first load unless manual)
      if (manual || Object.keys(prevStatusRef.current).length > 0) {
        for (const p of result.providers) {
          const prev = prevStatusRef.current[p.provider];
          if (prev && prev !== p.status) {
            notifyApiStatus(p.label, p.status === "connected");
          }
        }
      }
      // Update prev ref
      const newPrev: Record<string, string> = {};
      result.providers.forEach((p) => { newPrev[p.provider] = p.status; });
      prevStatusRef.current = newPrev;
    } catch {}
    setApiChecking(false);
  };

  useEffect(() => {
    const api = window.electronAPI?.storage;
    if (!api) return;
    api.stats().then(setStorageStats);
  }, [history.length]);

  // Today's processing
  const today = new Date().toISOString().slice(0, 10);
  const todayJobs = history.filter((j) => j.completedAt?.startsWith(today));
  const todayDone = todayJobs.filter((j) => j.status === 'done').length;
  const todayFailed = todayJobs.filter((j) => j.status === 'failed').length;
  const todaySize = todayJobs.reduce((s, j) => s + j.sizeBytes, 0);

  // Recent jobs
  const recentJobs = history.slice(0, 5);

  // Errors
  const failedJobs = history.filter((j) => j.status === 'failed').slice(0, 5);

  // Output
  const pdfsGenerated = history.filter((j) => j.pdfPath).length;
  const summariesGenerated = summaries.length;
  const pendingExports = history.filter((j) => j.status === 'done' && !summaries.find((s) => s.fileId === j.id)).length;

  // Notifications
  const notifications: Array<{ type: "warning" | "error" | "info" | "success"; message: string }> = [];
  if (!keyStatus.assemblyai) notifications.push({ type: "error", message: "AssemblyAI key not configured" });
  if (!keyStatus.gemini && !keyStatus.chatgpt) notifications.push({ type: "warning", message: "No summary provider configured" });
  if (ffmpegOk === false) notifications.push({ type: "error", message: "FFmpeg not found — reinstall RecLLM" });
  if (failedJobs.length > 0) notifications.push({ type: "warning", message: `${failedJobs.length} failed job${failedJobs.length > 1 ? 's' : ''} need attention` });
  if (storageStats && storageStats.totalSize > 500 * 1024 * 1024) notifications.push({ type: "info", message: `Storage: ${formatBytes(storageStats.totalSize)} used` });
  if (todayDone > 0) notifications.push({ type: "success", message: `${todayDone} file${todayDone > 1 ? 's' : ''} completed today` });

  // Recommendations
  const recommendations: string[] = [];
  if (!keyStatus.assemblyai) recommendations.push("Configure AssemblyAI key to start transcribing");
  if (history.length > 0 && summaries.length === 0) recommendations.push("Generate AI summaries for completed transcripts");
  if (failedJobs.length > 0) recommendations.push("Retry failed jobs or check API connection");
  if (pendingExports > 3) recommendations.push("Export pending transcripts to PDF");
  if (storageStats && storageStats.totalSize > 1024 * 1024 * 1024) recommendations.push("Clear cache to free disk space");
  if (recommendations.length === 0) recommendations.push("All systems ready. Upload audio to begin.");

  function StatusDot({ active, label }: { active: boolean | "na"; label: string }) {
    const color = active === "na" ? "bg-gray-400" : active ? "bg-emerald-500" : "bg-red-500";
    const text = active === "na" ? "Not installed" : active ? "Active" : "Inactive";
    return (
      <div className="flex items-center justify-between py-1">
        <span className="text-xs">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${color}`} />
          <span className="text-muted-foreground text-[10px] w-16">{text}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Row 1: Wide panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Queue Status - wide */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Cpu className="size-4" />Processing Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-3 text-center">
              <div className="p-2 rounded bg-muted/40">
                <div className="text-xl font-semibold">0</div>
                <div className="text-[10px] text-muted-foreground uppercase">Waiting</div>
              </div>
              <div className="p-2 rounded bg-blue-500/10">
                <div className="text-xl font-semibold text-blue-600">0</div>
                <div className="text-[10px] text-muted-foreground uppercase">Processing</div>
              </div>
              <div className="p-2 rounded bg-indigo-500/10">
                <div className="text-xl font-semibold text-indigo-600">0</div>
                <div className="text-[10px] text-muted-foreground uppercase">Rendering</div>
              </div>
              <div className="p-2 rounded bg-emerald-500/10">
                <div className="text-xl font-semibold text-emerald-600">{todayDone}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Completed</div>
              </div>
              <div className="p-2 rounded bg-red-500/10">
                <div className="text-xl font-semibold text-red-600">{todayFailed}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Failed</div>
              </div>
            </div>
            {/* Progress bar for today */}
            {(todayDone + todayFailed) > 0 && (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Today's throughput</span>
                  <span>{todayDone}/{todayDone + todayFailed} successful</span>
                </div>
                <Progress value={todayDone / Math.max(1, todayDone + todayFailed) * 100} className="h-1.5" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Bell className="size-4" />Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-[140px] overflow-auto">
              {notifications.map((n, i) => (
                <div key={i} className={`flex items-start gap-2 text-xs p-1.5 rounded ${
                  n.type === "error" ? "bg-red-500/10 text-red-600" :
                  n.type === "warning" ? "bg-amber-500/10 text-amber-600" :
                  n.type === "success" ? "bg-emerald-500/10 text-emerald-600" :
                  "bg-blue-500/10 text-blue-600"
                }`}>
                  {n.type === "error" ? <XCircle className="size-3.5 shrink-0 mt-0.5" /> :
                   n.type === "warning" ? <AlertTriangle className="size-3.5 shrink-0 mt-0.5" /> :
                   n.type === "success" ? <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" /> :
                   <AlertCircle className="size-3.5 shrink-0 mt-0.5" />}
                  <span>{n.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Mixed sizes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* API Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wifi className="size-4" />API Status
              <div className="flex-1" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => runApiCheck(true)}
                disabled={apiChecking}
                title="Check again"
              >
                <RefreshCw className={`size-3 ${apiChecking ? "animate-spin" : ""}`} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {apiStatus ? (
              <>
                {apiStatus.providers.map((p) => {
                  const display = getStatusDisplay(p.status);
                  return (
                    <div key={p.provider} className="flex items-center justify-between py-1">
                      <span className="text-xs">{p.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${display.bgColor}`} />
                        <span className={`text-[10px] w-16 ${display.color}`}>{display.label}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs">FFmpeg</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${ffmpegOk === null ? "bg-gray-400" : ffmpegOk ? "bg-emerald-500" : "bg-red-500"}`} />
                    <span className="text-[10px] text-muted-foreground w-16">{ffmpegOk === null ? "Unknown" : ffmpegOk ? "Ready" : "Missing"}</span>
                  </div>
                </div>
                {apiStatus.lastFullCheck && (
                  <div className="text-[9px] text-muted-foreground pt-1 border-t mt-1">
                    Checked {new Date(apiStatus.lastFullCheck).toLocaleTimeString()}
                  </div>
                )}
                {apiStatus.providers.some((p) => p.status === "missing_key") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] w-full mt-1"
                    onClick={() => onNavigate?.("settings")}
                  >
                    <Settings className="size-3 mr-1" />Configure keys
                  </Button>
                )}
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Checking...</div>
            )}
          </CardContent>
        </Card>

        {/* Today's Processing */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Clock className="size-4" />Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-xl font-semibold">{todayDone + todayFailed}</div>
                <div className="text-[10px] text-muted-foreground">Files</div>
              </div>
              <div>
                <div className="text-xl font-semibold">{formatBytes(todaySize)}</div>
                <div className="text-[10px] text-muted-foreground">Size</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Output Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Download className="size-4" />Output</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <div className="text-xl font-semibold">{pdfsGenerated}</div>
                <div className="text-[10px] text-muted-foreground">PDFs</div>
              </div>
              <div>
                <div className="text-xl font-semibold">{summariesGenerated}</div>
                <div className="text-[10px] text-muted-foreground">Summaries</div>
              </div>
              <div>
                <div className="text-xl font-semibold">{pendingExports}</div>
                <div className="text-[10px] text-muted-foreground">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Storage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Database className="size-4" />Storage</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1.5">
            {storageStats ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-mono">{formatBytes(storageStats.totalSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transcripts</span>
                  <span className="font-mono">{storageStats.transcriptCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Summaries</span>
                  <span className="font-mono">{storageStats.summaryCount}</span>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">Loading...</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Recent + Recommendations + Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Recent Jobs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><FileAudio className="size-4" />Recent Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {recentJobs.length === 0 ? (
              <div className="text-muted-foreground text-xs">No jobs yet. Upload audio to get started.</div>
            ) : (
              <div className="space-y-1.5">
                {recentJobs.map((job) => (
                  <div key={job.id} className="flex items-center gap-2 text-xs">
                    <span className={`size-2 rounded-full shrink-0 ${job.status === 'done' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="truncate flex-1">{job.fileName}</span>
                    {job.status === 'done' && onNavigate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] shrink-0"
                        onClick={() => { setActiveId(job.id); onNavigate("transcripts"); }}
                      >
                        Open
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Smart Recommendations */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="size-4" />Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-xs p-1.5 rounded bg-muted/40">
                  <ArrowRight className="size-3 shrink-0 mt-0.5 text-primary" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Zap className="size-4" />Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs justify-start"
                onClick={() => onNavigate?.("upload")}
              >
                <Upload className="size-3 mr-1.5" />Upload Audio
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs justify-start"
                onClick={() => onNavigate?.("pdf")}
              >
                <FileText className="size-3 mr-1.5" />Export PDF
              </Button>
              {transcripts.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs justify-start"
                  onClick={() => { setActiveId(transcripts[0].fileId); onNavigate?.("transcripts"); }}
                >
                  <FileAudio className="size-3 mr-1.5" />Latest Transcript
                </Button>
              )}
              {failedJobs.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs justify-start text-amber-600"
                  onClick={() => onNavigate?.("upload")}
                >
                  <Play className="size-3 mr-1.5" />Retry Failed
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs justify-start"
                onClick={() => onNavigate?.("settings")}
              >
                <Wifi className="size-3 mr-1.5" />API Settings
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs justify-start"
                onClick={() => onNavigate?.("library")}
              >
                <HardDrive className="size-3 mr-1.5" />File Library
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Error Center + API Health */}
      {(failedJobs.length > 0 || !keyStatus.assemblyai) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Error Center */}
          {failedJobs.length > 0 && (
            <Card className="border-red-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-red-600"><AlertTriangle className="size-4" />Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {failedJobs.map((job) => (
                    <div key={job.id} className="flex items-center gap-2 text-xs">
                      <XCircle className="size-3 text-red-500 shrink-0" />
                      <span className="truncate flex-1">{job.fileName}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] shrink-0"
                        onClick={() => onNavigate?.("upload")}
                      >
                        Retry
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* API Health */}
          {!keyStatus.assemblyai && (
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-600"><Zap className="size-4" />Setup Required</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="p-2 rounded bg-amber-500/10 text-amber-700">
                  Configure API keys in Settings to enable transcription and AI analysis.
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onNavigate?.("settings")}
                >
                  Open Settings
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
