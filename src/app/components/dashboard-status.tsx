import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  CheckCircle2, XCircle, AlertCircle, Clock, FileAudio, HardDrive,
  Zap, Download, AlertTriangle, Database, Wifi, Upload,
} from "lucide-react";
import { useTranscripts } from "../transcript-store";

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
  }, []);

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

  function StatusDot({ active, label }: { active: boolean | "na"; label: string }) {
    const color = active === "na" ? "bg-gray-400" : active ? "bg-emerald-500" : "bg-red-500";
    const text = active === "na" ? "Not installed" : active ? "Active" : "Inactive";
    return (
      <div className="flex items-center justify-between py-1.5">
        <span>{label}</span>
        <div className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${color}`} />
          <span className="text-muted-foreground text-xs w-20">{text}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* 1. System Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Wifi className="size-4" />System Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 text-sm">
          <StatusDot active={keyStatus.assemblyai} label="AssemblyAI" />
          <StatusDot active={keyStatus.gemini} label="Gemini" />
          <StatusDot active={keyStatus.chatgpt} label="ChatGPT" />
          <StatusDot active={"na"} label="Gemma (local)" />
        </CardContent>
      </Card>

      {/* 2. Today's Processing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Clock className="size-4" />Today's Processing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-2xl font-semibold">{todayDone + todayFailed}</div>
              <div className="text-muted-foreground">Files processed</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{formatBytes(todaySize)}</div>
              <div className="text-muted-foreground">Total size</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-emerald-600">{todayDone}</div>
              <div className="text-muted-foreground">Successful</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-red-600">{todayFailed}</div>
              <div className="text-muted-foreground">Failed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Recent Jobs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><FileAudio className="size-4" />Recent Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <div className="text-muted-foreground text-sm">No jobs yet. Upload an audio file to get started.</div>
          ) : (
            <div className="space-y-2 text-sm">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between gap-2">
                  <span className="truncate flex-1">{job.fileName}</span>
                  <Badge variant={job.status === 'done' ? 'default' : 'destructive'} className="shrink-0">
                    {job.status}
                  </Badge>
                  {job.status === 'done' && onNavigate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 shrink-0"
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

      {/* 4. API Health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Zap className="size-4" />API Health</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Transcription</span>
            <span>{keyStatus.assemblyai ? "AssemblyAI" : "Not configured"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Summary provider</span>
            <span className="capitalize">{provider}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Provider status</span>
            <span>{keyStatus[provider as keyof ApiKeyStatus] ? "Configured" : "No key"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Usage</span>
            <span>—</span>
          </div>
        </CardContent>
      </Card>

      {/* 5. Long Audio Readiness */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Upload className="size-4" />Long Audio Readiness</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <span>Streaming upload enabled</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <span>Chunked summary enabled</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <span>Recommended: MP3 / M4A</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <span>Max file: 5 GB (API limit)</span>
          </div>
        </CardContent>
      </Card>

      {/* 6. Output Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Download className="size-4" />Output Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-sm text-center">
            <div>
              <div className="text-2xl font-semibold">{pdfsGenerated}</div>
              <div className="text-muted-foreground">PDFs</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{summariesGenerated}</div>
              <div className="text-muted-foreground">Summaries</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{pendingExports}</div>
              <div className="text-muted-foreground">Pending</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 7. Error Center */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="size-4" />Error Center</CardTitle>
        </CardHeader>
        <CardContent>
          {failedJobs.length === 0 ? (
            <div className="text-muted-foreground text-sm flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" /> No errors
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {failedJobs.map((job) => (
                <div key={job.id} className="flex items-center gap-2">
                  <XCircle className="size-3.5 text-red-500 shrink-0" />
                  <span className="truncate">{job.fileName}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 8. Storage Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Database className="size-4" />Storage Status</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {storageStats ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total storage</span>
                <span>{formatBytes(storageStats.totalSize)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transcript files</span>
                <span>{storageStats.transcriptCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Summary files</span>
                <span>{storageStats.summaryCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">History index</span>
                <span>{formatBytes(storageStats.historySize)}</span>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground">Loading...</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
