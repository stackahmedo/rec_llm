import { AudioLines, LayoutDashboard, Upload, FileText, Users, BarChart3, Settings, Bell, FileEdit, Database } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useT } from "../i18n";

interface SidebarNavProps {
  active: string;
  onChange: (v: string) => void;
}

export function SidebarNav({ active, onChange }: SidebarNavProps) {
  const { t } = useT();
  const items = [
    { id: "dashboard",   label: t("nav.dashboard"),   icon: LayoutDashboard },
    { id: "upload",      label: t("nav.upload"),      icon: Upload },
    { id: "transcripts", label: t("nav.transcripts"), icon: FileText },
    { id: "pdf",         label: t("nav.pdf"),         icon: FileEdit },
    { id: "library",     label: t("nav.library"),     icon: Database },
    { id: "speakers",    label: t("nav.speakers"),    icon: Users },
    { id: "analytics",   label: t("nav.analytics"),   icon: BarChart3 },
    { id: "settings",    label: t("nav.settings"),    icon: Settings },
  ];
  return (
    <aside className="w-64 border-r bg-sidebar text-sidebar-foreground flex flex-col h-full">
      <div className="p-5 border-b flex items-center gap-2">
        <div className="size-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
          <AudioLines className="size-5" />
        </div>
        <div>
          <div className="leading-tight">{t("brand.name")}</div>
          <div className="text-muted-foreground leading-tight">{t("brand.tagline")}</div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map((it) => {
          const Icon = it.icon;
          const isActive = active === it.id;
          return (
            <Button
              key={it.id}
              variant={isActive ? "secondary" : "ghost"}
              className="w-full justify-start gap-3"
              onClick={() => onChange(it.id)}
            >
              <Icon className="size-4" />
              {it.label}
              {it.id === "transcripts" && (
                <Badge variant="outline" className="ml-auto">3</Badge>
              )}
            </Button>
          );
        })}
      </nav>
      <div className="p-3 border-t flex items-center gap-3">
        <div className="size-9 rounded-full bg-muted flex items-center justify-center">
          U
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate">User</div>
          <div className="text-muted-foreground truncate">{t("user.role")}</div>
        </div>
        <Button variant="ghost" size="icon">
          <Bell className="size-4" />
        </Button>
      </div>
    </aside>
  );
}
