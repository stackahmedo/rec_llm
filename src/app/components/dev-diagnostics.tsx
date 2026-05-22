import { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  AlertTriangle, Bug, Copy, Trash2, X, ArrowLeft, Terminal,
} from "lucide-react";
import { CrashLogEntry, loadCrashLogs, clearCrashLogs } from "../crash-log-store";
import { toast } from "sonner";

interface DevDiagnosticsProps {
  mode: "error404" | "crashed";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (view: string) => void;
}

export function DevDiagnostics({ mode, open, onOpenChange, onNavigate }: DevDiagnosticsProps) {
  if (mode === "error404") {
    return <Error404Dialog open={open} onOpenChange={onOpenChange} onNavigate={onNavigate} />;
  }
  return <CrashLogDialog open={open} onOpenChange={onOpenChange} />;
}

// --- Error 404 Screen ---
function Error404Dialog({ open, onOpenChange, onNavigate }: { open: boolean; onOpenChange: (v: boolean) => void; onNavigate?: (view: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <Terminal className="size-4" /> Developer Diagnostics
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-8 text-center">
          <div className="text-6xl font-bold text-muted-foreground/30 mb-2">404</div>
          <h2 className="text-lg font-semibold mb-1">Page Not Found</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            The requested resource could not be located. This is a diagnostic test screen for error UI design.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-3.5 mr-1" /> Close
            </Button>
            <Button
              size="sm"
              onClick={() => { onOpenChange(false); onNavigate?.("dashboard"); }}
            >
              <ArrowLeft className="size-3.5 mr-1" /> Back to Dashboard
            </Button>
          </div>
        </div>
        <div className="border-t pt-3 text-[10px] text-muted-foreground text-center">
          Developer Diagnostics · Error UI Test · Not a real error
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Crash Log Screen ---
function CrashLogDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [logs, setLogs] = useState<CrashLogEntry[]>(() => loadCrashLogs());

  const handleClear = () => {
    clearCrashLogs();
    setLogs([]);
    toast.success("Crash logs cleared");
  };

  const handleCopyAll = () => {
    const text = logs.map((l) =>
      `[${l.timestamp}] [${l.type}] ${l.source}: ${l.message}${l.stack ? '\n' + l.stack : ''}`
    ).join('\n\n');
    navigator.clipboard.writeText(text || "No logs");
    toast.success("Logs copied to clipboard");
  };

  const handleCopyOne = (log: CrashLogEntry) => {
    const text = `[${log.timestamp}] [${log.type}] ${log.source}: ${log.message}${log.stack ? '\n' + log.stack : ''}`;
    navigator.clipboard.writeText(text);
    toast.success("Log entry copied");
  };

  const typeColor = (type: string) => {
    switch (type) {
      case "pdf": return "text-blue-500";
      case "upload": return "text-amber-500";
      case "api": return "text-purple-500";
      case "io": return "text-orange-500";
      case "render": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Bug className="size-4" />
            <span>Developer Diagnostics — Crash Logs</span>
            <Badge variant="outline" className="text-[10px] h-5 ml-2">{logs.length} entries</Badge>
            <div className="flex-1" />
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCopyAll}>
              <Copy className="size-3 mr-1" /> Copy All
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-600" onClick={handleClear}>
              <Trash2 className="size-3 mr-1" /> Clear
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <AlertTriangle className="size-8 opacity-30 mb-2" />
              <span className="text-sm">No crash logs found.</span>
              <span className="text-xs mt-1">Errors from PDF export, uploads, API calls, and rendering are captured here.</span>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="p-2.5 rounded border bg-muted/20 text-xs group">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={`text-[9px] h-4 ${typeColor(log.type)}`}>
                      {log.type}
                    </Badge>
                    <span className="text-muted-foreground font-mono text-[10px]">{log.timestamp.slice(0, 19).replace("T", " ")}</span>
                    <span className="text-muted-foreground text-[10px]">· {log.source}</span>
                    <div className="flex-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100"
                      onClick={() => handleCopyOne(log)}
                      title="Copy this log"
                    >
                      <Copy className="size-3" />
                    </Button>
                  </div>
                  <div className="text-foreground">{log.message}</div>
                  {log.stack && (
                    <pre className="mt-1 text-[10px] text-muted-foreground font-mono whitespace-pre-wrap break-all max-h-20 overflow-hidden">
                      {log.stack.split("\n").slice(0, 4).join("\n")}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t px-4 py-2 text-[10px] text-muted-foreground flex items-center gap-3 shrink-0">
          <span>Developer Diagnostics</span>
          <span>·</span>
          <span>Max {100} entries stored locally</span>
          <span>·</span>
          <span>No sensitive data collected</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
