/**
 * Notification system with deduplication, severity, and user-friendly messages.
 *
 * Architecture:
 * - User-facing: friendly messages via toast
 * - Developer: raw errors logged to console only
 * - Deduplication: same message within cooldown collapses
 * - Severity: info, warning, error, critical
 * - Categories: processing, export, ai-provider, system
 */

import { toast } from "sonner";

// --- Types ---
export type NotifySeverity = "info" | "warning" | "error" | "critical";
export type NotifyCategory = "processing" | "export" | "ai-provider" | "system";

interface NotifyOptions {
  severity?: NotifySeverity;
  category?: NotifyCategory;
  description?: string;
  technicalDetail?: string;
  action?: { label: string; onClick: () => void };
  dedupKey?: string;
}

// --- Deduplication state ---
const recentNotifications = new Map<string, { count: number; lastTime: number; toastId?: string | number }>();
const COOLDOWN_MS = 3000;
const DEDUP_WINDOW_MS = 10000;

// --- Error message mapping ---
const ERROR_MAP: Record<string, string> = {
  // JSON/Parse errors
  "Unexpected token '<'": "The AI provider returned an invalid response.",
  "Unexpected token": "The AI provider returned an invalid response.",
  "is not valid JSON": "The AI provider returned an invalid response.",
  "JSON.parse": "Failed to process the AI response.",
  // Gemini
  "Gemini API error": "Gemini encountered an issue processing your request.",
  "Model unavailable or retired": "Selected Gemini model is unavailable.",
  "Gemini returned HTML": "Gemini endpoint returned an unexpected response.",
  "Gemini returned an error page": "Gemini is temporarily unavailable.",
  // OpenAI
  "OpenAI provider error": "The AI provider encountered an issue.",
  "Provider returned HTML": "The provider endpoint is misconfigured.",
  "Provider returned an error page": "The provider is temporarily unavailable.",
  // Network
  "Network error": "Could not connect to the AI provider.",
  "timed out": "The request took too long. Try again.",
  "AbortError": "The request was cancelled.",
  "fetch failed": "Network connection failed.",
  // Auth
  "Invalid API key": "Your API key was rejected.",
  "401": "Authentication failed. Check your API key.",
  "403": "Access denied. Check your API key permissions.",
  // Rate limits
  "429": "Rate limit reached. Wait a moment and retry.",
  "quota exceeded": "API quota exceeded. Check your plan.",
  "Rate limit": "Rate limit reached. Wait a moment and retry.",
  // Model
  "404": "The requested resource was not found.",
  "model": "The selected model may be unavailable.",
};

function mapErrorMessage(raw: string): string {
  for (const [pattern, friendly] of Object.entries(ERROR_MAP)) {
    if (raw.toLowerCase().includes(pattern.toLowerCase())) {
      return friendly;
    }
  }
  // If no match, return a generic but safe message
  if (raw.length > 100 || raw.includes("<") || raw.includes("{")) {
    return "An unexpected error occurred.";
  }
  return raw;
}

// --- Core notify function ---
export function notify(title: string, opts: NotifyOptions = {}) {
  const { severity = "info", category, description, technicalDetail, action, dedupKey } = opts;

  // Map title to user-friendly if it looks technical
  const friendlyTitle = mapErrorMessage(title);

  // Deduplication
  const key = dedupKey || `${severity}:${friendlyTitle}`;
  const now = Date.now();
  const existing = recentNotifications.get(key);

  if (existing && (now - existing.lastTime) < DEDUP_WINDOW_MS) {
    existing.count++;
    existing.lastTime = now;
    // Update existing toast with count
    if (existing.toastId) {
      const countLabel = existing.count > 1 ? ` (${existing.count})` : "";
      toast.dismiss(existing.toastId);
      existing.toastId = showToast(severity, `${friendlyTitle}${countLabel}`, description, action);
    }
    return;
  }

  // Cooldown check
  if (existing && (now - existing.lastTime) < COOLDOWN_MS) {
    // Log but don't show
    if (technicalDetail) console.warn(`[notify:suppressed] ${technicalDetail}`);
    return;
  }

  // Show notification
  const toastId = showToast(severity, friendlyTitle, description, action);
  recentNotifications.set(key, { count: 1, lastTime: now, toastId });

  // Log technical detail to console only
  if (technicalDetail) {
    console.warn(`[${category || "system"}] ${title}`, technicalDetail);
  }

  // Cleanup old entries
  if (recentNotifications.size > 50) {
    const cutoff = now - 30000;
    for (const [k, v] of recentNotifications) {
      if (v.lastTime < cutoff) recentNotifications.delete(k);
    }
  }
}

function showToast(severity: NotifySeverity, title: string, description?: string, action?: { label: string; onClick: () => void }): string | number {
  const opts: any = {};
  if (description) opts.description = description;
  if (action) opts.action = { label: action.label, onClick: action.onClick };

  switch (severity) {
    case "info":
      return toast.message(title, opts);
    case "warning":
      return toast.warning(title, opts);
    case "error":
      return toast.error(title, opts);
    case "critical":
      opts.duration = 10000;
      return toast.error(title, opts);
    default:
      return toast.message(title, opts);
  }
}

// --- Convenience helpers ---
export function notifyError(title: string, opts: Omit<NotifyOptions, "severity"> = {}) {
  notify(title, { ...opts, severity: "error" });
}

export function notifyWarning(title: string, opts: Omit<NotifyOptions, "severity"> = {}) {
  notify(title, { ...opts, severity: "warning" });
}

export function notifySuccess(title: string, description?: string) {
  toast.success(title, description ? { description } : undefined);
}

export function notifyInfo(title: string, description?: string) {
  toast.message(title, description ? { description } : undefined);
}

// --- Provider-aware error handler ---
export function notifyProviderError(error: string, provider?: string) {
  const friendly = mapErrorMessage(error);
  const category: NotifyCategory = "ai-provider";

  // Determine action based on error type
  let action: NotifyOptions["action"] | undefined;
  const lowerErr = error.toLowerCase();

  if (lowerErr.includes("api key") || lowerErr.includes("auth") || lowerErr.includes("401")) {
    action = { label: "Open Settings", onClick: () => { /* handled by consumer */ } };
  } else if (lowerErr.includes("model") || lowerErr.includes("404")) {
    action = { label: "Change Model", onClick: () => { /* handled by consumer */ } };
  }

  notify(friendly, {
    severity: "error",
    category,
    description: provider ? `Provider: ${provider}` : undefined,
    technicalDetail: error,
    action,
    dedupKey: `provider:${provider}:${friendly}`,
  });
}

// --- Error Center log (in-memory for future UI) ---
interface ErrorLogEntry {
  timestamp: number;
  severity: NotifySeverity;
  category: NotifyCategory;
  title: string;
  detail?: string;
  provider?: string;
}

const errorLog: ErrorLogEntry[] = [];
const MAX_LOG_SIZE = 200;

export function logError(entry: Omit<ErrorLogEntry, "timestamp">) {
  errorLog.push({ ...entry, timestamp: Date.now() });
  if (errorLog.length > MAX_LOG_SIZE) errorLog.splice(0, errorLog.length - MAX_LOG_SIZE);
}

export function getErrorLog(): ErrorLogEntry[] {
  return [...errorLog];
}

export function clearErrorLog() {
  errorLog.length = 0;
}
