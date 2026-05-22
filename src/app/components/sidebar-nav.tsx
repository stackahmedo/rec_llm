import { LayoutDashboard, Upload, FileText, Users, Settings, FileEdit, Database } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
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
  const [hovered, setHovered] = useState(false);

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
    <TooltipProvider delayDuration={300}>
      <aside
        className="border-r bg-sidebar text-sidebar-foreground flex flex-col h-full shrink-0 overflow-hidden transition-all duration-200 ease-in-out"
        style={{ width: hovered ? 220 : 64 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Logo */}
        <div className="h-14 border-b flex items-center px-3 gap-2.5 shrink-0">
          <img
            src={logo}
            alt="RecLLM"
            className="size-8 rounded-md object-contain shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className={`overflow-hidden transition-all duration-200 ${hovered ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
            <div className="text-sm font-medium leading-tight whitespace-nowrap">{t("brand.name")}</div>
            <div className="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">{t("brand.tagline")}</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-2 space-y-0.5">
          {items.map((it) => {
            const Icon = it.icon;
            const isActive = active === it.id;

            const button = (
              <Button
                key={it.id}
                variant={isActive ? "secondary" : "ghost"}
                className={`w-full gap-3 h-9 ${hovered ? 'justify-start px-3' : 'justify-center px-0'}`}
                onClick={() => onChange(it.id)}
              >
                <Icon className="size-4 shrink-0" />
                <span className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${hovered ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
                  {it.label}
                </span>
              </Button>
            );

            if (hovered) {
              return <div key={it.id}>{button}</div>;
            }

            return (
              <Tooltip key={it.id}>
                <TooltipTrigger asChild>
                  {button}
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {it.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Footer status */}
        <div className="border-t p-2 shrink-0">
          <div className={`flex items-center gap-2 text-[10px] text-muted-foreground ${hovered ? 'justify-start px-2' : 'justify-center'}`}>
            <span className="flex items-center gap-1">
              <span className={`size-2 rounded-full ${keyStatus.assemblyai ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {hovered && <span>ASM</span>}
            </span>
            <span className="flex items-center gap-1">
              <span className={`size-2 rounded-full ${keyStatus.gemini ? 'bg-emerald-500' : keyStatus.chatgpt ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              {hovered && <span>LLM</span>}
            </span>
          </div>
          {hovered && (
            <div className="text-center text-muted-foreground text-[10px] mt-1 whitespace-nowrap">
              Local Desktop Mode
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
