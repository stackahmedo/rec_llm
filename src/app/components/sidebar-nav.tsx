import { LayoutDashboard, Upload, FileText, Users, Settings, FileEdit, Database } from "lucide-react";
import { Button } from "./ui/button";
import { useT } from "../i18n";
import { useEffect, useState } from "react";
import logo from "../../assets/logo.png";

interface SidebarNavProps {
  active: string;
  onChange: (v: string) => void;
}

export function SidebarNav({ active, onChange }: SidebarNavProps) {
  const { t } = useT();
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({});

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
        });
      }
    })();
  }, []);

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
        <img
          src={logo}
          alt="RecLLM"
          className="size-9 rounded-md object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
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
      <div className="p-3 border-t space-y-2">
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className={`size-2 rounded-full ${keyStatus.assemblyai ? 'bg-emerald-500' : 'bg-red-500'}`} />
            ASM
          </span>
          <span className="flex items-center gap-1">
            <span className={`size-2 rounded-full ${keyStatus.gemini ? 'bg-emerald-500' : keyStatus.chatgpt ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            LLM
          </span>
        </div>
        <div className="text-center text-muted-foreground text-xs">
          Local Desktop Mode
        </div>
      </div>
    </aside>
  );
}
