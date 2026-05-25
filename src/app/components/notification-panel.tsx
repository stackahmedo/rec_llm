import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import {
  Bell, CheckCircle2, AlertTriangle, XCircle, Info,
  Check, Trash2, X,
} from "lucide-react";
import {
  AppNotification, loadNotifications, getUnreadCount,
  markAllRead, markRead, clearNotifications, subscribeNotifications,
} from "../notification-store";

interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationButton({ onClick, className }: { onClick: () => void; className?: string }) {
  const [unread, setUnread] = useState(getUnreadCount);

  useEffect(() => {
    const unsub = subscribeNotifications(() => setUnread(getUnreadCount()));
    return unsub;
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`relative h-9 w-9 ${className || ""}`}
      onClick={onClick}
      title="通知"
    >
      <Bell className="size-4" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Button>
  );
}

export function NotificationPanel({ open, onOpenChange }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>(loadNotifications);

  useEffect(() => {
    if (open) setNotifications(loadNotifications());
    const unsub = subscribeNotifications(() => setNotifications(loadNotifications()));
    return unsub;
  }, [open]);

  const handleMarkAllRead = () => {
    markAllRead();
    setNotifications(loadNotifications());
  };

  const handleClear = () => {
    clearNotifications();
    setNotifications([]);
  };

  const handleMarkRead = (id: string) => {
    markRead(id);
    setNotifications(loadNotifications());
  };

  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />

      {/* Panel */}
      <div className="absolute right-0 top-full mt-2 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover text-popover-foreground shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{unreadCount} new</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={handleMarkAllRead}>
                <Check className="size-3 mr-1" />Read all
              </Button>
            )}
            {notifications.length > 0 && (
              <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={handleClear}>
                <Trash2 className="size-3 mr-1" />Clear
              </Button>
            )}
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => onOpenChange(false)}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* List */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
            <Bell className="size-6 opacity-30 mb-2" />
            <span>No notifications yet.</span>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="p-1.5 space-y-0.5">
              {notifications.slice(0, 50).map((n) => (
                <NotificationItem key={n.id} notification={n} onRead={() => handleMarkRead(n.id)} />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground text-center">
          Latest {Math.min(notifications.length, 100)} notifications · Stored locally
        </div>
      </div>
    </>
  );
}

function NotificationItem({ notification, onRead }: { notification: AppNotification; onRead: () => void }) {
  const n = notification;
  const Icon = n.type === "success" ? CheckCircle2 :
    n.type === "error" ? XCircle :
    n.type === "warning" ? AlertTriangle : Info;

  const iconColor = n.type === "success" ? "text-emerald-500" :
    n.type === "error" ? "text-red-500" :
    n.type === "warning" ? "text-amber-500" : "text-blue-500";

  const timeAgo = formatTimeAgo(n.timestamp);

  return (
    <div
      className={`flex items-start gap-2.5 p-2.5 rounded cursor-pointer transition-colors hover:bg-muted/60 ${!n.read ? "bg-muted/30" : ""}`}
      onClick={onRead}
    >
      <Icon className={`size-4 shrink-0 mt-0.5 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${!n.read ? "" : "text-muted-foreground"}`}>{n.title}</span>
          {!n.read && <span className="size-1.5 rounded-full bg-blue-500 shrink-0" />}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{n.message}</div>
        <div className="text-[10px] text-muted-foreground/70 mt-0.5">{timeAgo}</div>
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
