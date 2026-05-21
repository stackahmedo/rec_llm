import { AudioLines, LayoutDashboard, Upload, FileText, Users, Settings, FileEdit, Database } from "lucide-react";
import { Button } from "./ui/button";
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
            </Button>
          );
        })}
      </nav>
      <div className="p-3 border-t text-center text-muted-foreground text-xs">
        Local Desktop Mode
      </div>
    </aside>
  );
}
