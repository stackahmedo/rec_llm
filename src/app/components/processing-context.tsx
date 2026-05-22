import { useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import {
  FileAudio, Clock, Waves, Mic2, Languages, AlertTriangle,
  CheckCircle2, Download, Sparkles, Info,
} from "lucide-react";
import { useTranscripts } from "../transcript-store";

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

interface ActiveFile {
  id: string;
  name: string;
  stage: string;
  sizeBytes: number;
  audioMeta?: { duration: number; codec: string; bitrate: number; sampleRate: number; channels: number };
  recommendation?: { action: string; reason: string };
  processingStartedAt?: number;
  speakers?: number;
}

interface ProcessingContextProps {
  activeFile: ActiveFile | null;
}

export function ProcessingContext({ activeFile }: ProcessingContextProps) {
  const { getActiveSummary } = useTranscripts();
  const summary = getActiveSummary();

  if (!activeFile) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
        <FileAudio className="size-10 mb-3 opacity-40" />
        <div className="text-sm font-medium">No file selected</div>
        <div className="text-xs mt-1">Upload or select a file to see processing details</div>
      </div>
    );
  }

  const meta = activeFile.audioMeta;
  const isProcessing = ["uploading", "transcribing", "analyzing", "preprocessing"].includes(activeFile.stage);
  const isDone = activeFile.stage === "done";
  const isFailed = activeFile.stage === "failed";

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {/* File Info Header */}
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">File Intelligence</div>
          <div className="text-sm font-medium truncate">{activeFile.name}</div>
          <Badge variant="outline" className="text-xs">
            {activeFile.stage === "done" ? "Completed" : activeFile.stage === "failed" ? "Failed" : activeFile.stage}
          </Badge>
        </div>

        {/* Metadata */}
        {meta && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Audio Metadata</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 p-1.5 rounded bg-muted/40">
                <Clock className="size-3 text-muted-foreground" />
                <span className="font-mono">{formatDuration(meta.duration)}</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded bg-muted/40">
                <Waves className="size-3 text-muted-foreground" />
                <span className="font-mono">{meta.codec.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded bg-muted/40">
                <Info className="size-3 text-muted-foreground" />
                <span className="font-mono">{meta.bitrate} kbps</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded bg-muted/40">
                <Mic2 className="size-3 text-muted-foreground" />
                <span className="font-mono">{meta.sampleRate} Hz</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded bg-muted/40">
                <Languages className="size-3 text-muted-foreground" />
                <span className="font-mono">{meta.channels}ch</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded bg-muted/40">
                <FileAudio className="size-3 text-muted-foreground" />
                <span className="font-mono">{formatBytes(activeFile.sizeBytes)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Warnings */}
        {activeFile.recommendation && activeFile.recommendation.action !== 'direct' && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Warnings</div>
            <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs">
              <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>{activeFile.recommendation.reason}</span>
            </div>
          </div>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Processing</div>
            <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="capitalize">{activeFile.stage}...</span>
              </div>
              {activeFile.processingStartedAt && (
                <div className="text-muted-foreground">
                  Elapsed: {formatDuration((Date.now() - activeFile.processingStartedAt) / 1000)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Completed */}
        {isDone && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Results</div>
            <div className="flex items-center gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              <span>Transcription complete</span>
            </div>
            {activeFile.speakers && activeFile.speakers > 0 && (
              <div className="text-xs text-muted-foreground">{activeFile.speakers} speakers detected</div>
            )}

            {summary && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Summary preview</div>
                <div className="text-xs p-2 rounded bg-muted/40 line-clamp-4">{summary.summary}</div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="text-xs h-7">
                <Download className="size-3 mr-1" />Export
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7">
                <Sparkles className="size-3 mr-1" />Summarize
              </Button>
            </div>
          </div>
        )}

        {/* Failed */}
        {isFailed && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Error</div>
            <div className="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-xs">
              <AlertTriangle className="size-3.5 text-red-500 shrink-0 mt-0.5" />
              <span>Processing failed. Check connection and retry.</span>
            </div>
          </div>
        )}

        {/* Estimated Cost */}
        {meta && !isDone && !isFailed && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Estimate</div>
            <div className="text-xs space-y-1 text-muted-foreground">
              <div className="flex justify-between">
                <span>API cost</span>
                <span className="font-mono">${(meta.duration / 3600 * 0.65).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Est. time</span>
                <span className="font-mono">{formatDuration(Math.max(30, meta.duration * 0.3))}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
