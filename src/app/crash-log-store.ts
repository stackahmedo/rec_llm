// Crash log store — captures app errors locally for diagnostics

export interface CrashLogEntry {
  id: string;
  timestamp: string;
  type: "render" | "pdf" | "upload" | "api" | "io" | "unknown";
  message: string;
  source: string;
  stack?: string;
}

const STORAGE_KEY = "recllm-crash-logs";
const MAX_LOGS = 100;

export function loadCrashLogs(): CrashLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CrashLogEntry[];
  } catch {
    return [];
  }
}

export function saveCrashLog(entry: Omit<CrashLogEntry, "id" | "timestamp">): void {
  try {
    const logs = loadCrashLogs();
    const newEntry: CrashLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newEntry);
    // Trim to max
    const trimmed = logs.slice(0, MAX_LOGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function clearCrashLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function getCrashLogCount(): number {
  return loadCrashLogs().length;
}

// Global error capture — call once at app init
export function installGlobalErrorCapture(): void {
  window.addEventListener("error", (event) => {
    saveCrashLog({
      type: "unknown",
      message: event.message || "Uncaught error",
      source: event.filename ? `${event.filename}:${event.lineno}` : "window",
      stack: event.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    saveCrashLog({
      type: "unknown",
      message: reason?.message || String(reason) || "Unhandled promise rejection",
      source: "promise",
      stack: reason?.stack,
    });
  });
}

// Helper to log specific error types from app code
export function logPdfError(message: string, stack?: string): void {
  saveCrashLog({ type: "pdf", message, source: "pdf-export", stack });
}

export function logUploadError(message: string, stack?: string): void {
  saveCrashLog({ type: "upload", message, source: "upload-panel", stack });
}

export function logApiError(message: string, source: string, stack?: string): void {
  saveCrashLog({ type: "api", message, source, stack });
}

export function logIoError(message: string, source: string, stack?: string): void {
  saveCrashLog({ type: "io", message, source, stack });
}

export function logRenderError(message: string, source: string, stack?: string): void {
  saveCrashLog({ type: "render", message, source, stack });
}
