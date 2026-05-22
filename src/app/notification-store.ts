// Notification service — local app notification store

export type NotificationType = "success" | "warning" | "error" | "info";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  source: string; // e.g. "upload", "pdf", "api", "system"
}

const STORAGE_KEY = "recllm-notifications";
const MAX_NOTIFICATIONS = 100;

// In-memory subscribers for real-time updates
type Listener = () => void;
const listeners: Set<Listener> = new Set();

function notifyListeners(): void {
  listeners.forEach((fn) => fn());
}

export function subscribeNotifications(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function loadNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return [];
  }
}

function saveNotifications(notifications: AppNotification[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {}
}

export function addNotification(
  type: NotificationType,
  title: string,
  message: string,
  source: string
): AppNotification {
  const notifications = loadNotifications();
  const entry: AppNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
    source,
  };
  notifications.unshift(entry);
  const trimmed = notifications.slice(0, MAX_NOTIFICATIONS);
  saveNotifications(trimmed);
  notifyListeners();
  return entry;
}

export function markAllRead(): void {
  const notifications = loadNotifications();
  notifications.forEach((n) => { n.read = true; });
  saveNotifications(notifications);
  notifyListeners();
}

export function markRead(id: string): void {
  const notifications = loadNotifications();
  const n = notifications.find((x) => x.id === id);
  if (n) { n.read = true; saveNotifications(notifications); notifyListeners(); }
}

export function clearNotifications(): void {
  saveNotifications([]);
  notifyListeners();
}

export function getUnreadCount(): number {
  return loadNotifications().filter((n) => !n.read).length;
}

// Convenience helpers for common events
export function notifySessionStarted(fileName: string): void {
  addNotification("info", "Processing started", `Transcribing: ${fileName}`, "upload");
}

export function notifySessionCompleted(fileName: string): void {
  addNotification("success", "Processing complete", `${fileName} transcribed successfully`, "upload");
}

export function notifySessionFailed(fileName: string, error?: string): void {
  addNotification("error", "Processing failed", `${fileName}: ${error || "Unknown error"}`, "upload");
}

export function notifyPdfExported(fileName: string, filePath?: string): void {
  addNotification("success", "PDF exported", `${fileName} saved${filePath ? ` to ${filePath}` : ""}`, "pdf");
}

export function notifyPdfFailed(fileName: string, error?: string): void {
  addNotification("error", "PDF export failed", `${fileName}: ${error || "Unknown error"}`, "pdf");
}

export function notifyApiStatus(provider: string, connected: boolean): void {
  if (connected) {
    addNotification("info", "API connected", `${provider} is now available`, "api");
  } else {
    addNotification("warning", "API disconnected", `${provider} key missing or invalid`, "api");
  }
}

export function notifyFileError(operation: string, error?: string): void {
  addNotification("error", "File operation failed", `${operation}: ${error || "Unknown error"}`, "system");
}

export function notifySummaryGenerated(fileName: string): void {
  addNotification("success", "Summary generated", `AI analysis complete for ${fileName}`, "api");
}

export function notifySummaryFailed(fileName: string, error?: string): void {
  addNotification("error", "Summary failed", `${fileName}: ${error || "Unknown error"}`, "api");
}
