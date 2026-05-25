// API Status Service — checks provider connectivity without exposing keys

export type ApiStatusCode = "connected" | "missing_key" | "invalid_key" | "connection_failed" | "checking" | "unknown";

export interface ProviderStatus {
  provider: string;
  label: string;
  status: ApiStatusCode;
  lastChecked: string | null;
  error?: string;
}

export interface ApiStatusState {
  providers: ProviderStatus[];
  lastFullCheck: string | null;
}

const CACHE_KEY = "recllm-api-status-cache";
const CACHE_TTL_MS = 60_000; // 1 minute cache

// Load cached status
export function loadCachedStatus(): ApiStatusState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as ApiStatusState & { cachedAt: number };
    if (Date.now() - cached.cachedAt > CACHE_TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

function saveCachedStatus(state: ApiStatusState): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...state, cachedAt: Date.now() }));
  } catch {}
}

function statusFromKeyLength(len: number | undefined, minLen: number): ApiStatusCode {
  if (!len || len === 0) return "missing_key";
  if (len < minLen) return "invalid_key";
  return "unknown"; // key exists but not validated yet
}

export async function checkAllProviders(): Promise<ApiStatusState> {
  const api = window.electronAPI?.settings;
  if (!api) {
    return {
      providers: [
        { provider: "assemblyai", label: "AssemblyAI", status: "unknown", lastChecked: null, error: "Not in Electron" },
        { provider: "gemini", label: "Gemini", status: "unknown", lastChecked: null, error: "Not in Electron" },
        { provider: "chatgpt", label: "ChatGPT", status: "unknown", lastChecked: null, error: "Not in Electron" },
      ],
      lastFullCheck: null,
    };
  }

  const keys = await api.get("apiKeys") as Record<string, string> | null;
  const now = new Date().toISOString();

  const providers: ProviderStatus[] = [];

  // AssemblyAI — has real validation endpoint
  const asmKeyLen = keys?.assemblyai?.length || 0;
  if (asmKeyLen >= 10) {
    providers.push({ provider: "assemblyai", label: "AssemblyAI", status: "checking", lastChecked: now });
  } else {
    providers.push({
      provider: "assemblyai",
      label: "AssemblyAI",
      status: asmKeyLen === 0 ? "missing_key" : "invalid_key",
      lastChecked: now,
      error: asmKeyLen === 0 ? "No API key configured" : "Key too short",
    });
  }

  // Gemini — key presence check only (no cheap validation endpoint)
  const geminiKeyLen = keys?.gemini?.length || 0;
  providers.push({
    provider: "gemini",
    label: "Gemini",
    status: geminiKeyLen >= 10 ? "connected" : geminiKeyLen === 0 ? "missing_key" : "invalid_key",
    lastChecked: now,
    error: geminiKeyLen === 0 ? "No API key configured" : geminiKeyLen < 10 ? "Key too short" : undefined,
  });

  // ChatGPT — key presence check only
  const chatgptKeyLen = keys?.chatgpt?.length || 0;
  providers.push({
    provider: "chatgpt",
    label: "ChatGPT",
    status: chatgptKeyLen >= 10 ? "connected" : chatgptKeyLen === 0 ? "missing_key" : "invalid_key",
    lastChecked: now,
    error: chatgptKeyLen === 0 ? "No API key configured" : chatgptKeyLen < 10 ? "Key too short" : undefined,
  });

  // Validate AssemblyAI with real API call
  const asmIdx = providers.findIndex((p) => p.provider === "assemblyai");
  if (providers[asmIdx].status === "checking") {
    try {
      const result = await window.electronAPI!.assemblyai.validateKey();
      providers[asmIdx] = {
        ...providers[asmIdx],
        status: result.ok ? "connected" : "invalid_key",
        error: result.ok ? undefined : result.error,
        lastChecked: new Date().toISOString(),
      };
    } catch (err: unknown) {
      providers[asmIdx] = {
        ...providers[asmIdx],
        status: "connection_failed",
        error: err instanceof Error ? err.message : "Network error",
        lastChecked: new Date().toISOString(),
      };
    }
  }

  const state: ApiStatusState = { providers, lastFullCheck: now };
  saveCachedStatus(state);
  return state;
}

// Get display info for status codes
export function getStatusDisplay(status: ApiStatusCode): { label: string; labelJa: string; color: string; bgColor: string } {
  switch (status) {
    case "connected":
      return { label: "Connected", labelJa: "接続済み", color: "text-emerald-600", bgColor: "bg-emerald-500" };
    case "missing_key":
      return { label: "No key", labelJa: "キーなし", color: "text-red-600", bgColor: "bg-red-500" };
    case "invalid_key":
      return { label: "Invalid", labelJa: "無効", color: "text-red-600", bgColor: "bg-red-500" };
    case "connection_failed":
      return { label: "Failed", labelJa: "失敗", color: "text-red-600", bgColor: "bg-red-500" };
    case "checking":
      return { label: "Checking", labelJa: "確認中", color: "text-amber-600", bgColor: "bg-amber-500" };
    default:
      return { label: "Unknown", labelJa: "不明", color: "text-gray-500", bgColor: "bg-gray-400" };
  }
}

// Mask a key for safe display (first 4 + last 4 chars)
export function maskKey(key: string | undefined): string {
  if (!key || key.length < 8) return "••••••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
