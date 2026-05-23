import { useState, lazy, Suspense, useEffect } from "react";
import { SidebarNav } from "./components/sidebar-nav";
import { DashboardStatus } from "./components/dashboard-status";
import { SearchPanel } from "./components/search-panel";
import { NotificationButton, NotificationPanel } from "./components/notification-panel";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Search, Sparkles, Loader2 } from "lucide-react";
import { Toaster } from "./components/ui/sonner";
import { I18nProvider, useT } from "./i18n";
import { TranscriptProvider } from "./transcript-store";
import { UploadJobProvider } from "./upload-job-store";
import { PageErrorBoundary } from "./components/error-boundary";

// UI Scale hook
function useUiScale() {
  const [scale, setScale] = useState<string>(() => {
    try { return localStorage.getItem("recllm-ui-scale") || "default"; } catch { return "default"; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-ui-scale", scale);
    try { localStorage.setItem("recllm-ui-scale", scale); } catch {}
  }, [scale]);

  return { scale, setScale };
}

// Lazy-loaded heavy pages
const UploadWorkstation = lazy(() => import("./components/upload-workstation").then((m) => ({ default: m.UploadWorkstation })));
const TranscriptWorkspace = lazy(() => import("./components/transcript-workspace").then((m) => ({ default: m.TranscriptWorkspace })));
const PdfEditor = lazy(() => import("./components/pdf-editor").then((m) => ({ default: m.PdfEditor })));
const FileLibrary = lazy(() => import("./components/file-library").then((m) => ({ default: m.FileLibrary })));
const SpeakerPanel = lazy(() => import("./components/speaker-panel").then((m) => ({ default: m.SpeakerPanel })));
const SettingsPanel = lazy(() => import("./components/settings-panel").then((m) => ({ default: m.SettingsPanel })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-32">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function Shell() {
  const { t, lang } = useT();
  const { scale } = useUiScale();
  const [view, setView] = useState("dashboard");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
      if (meta && e.key === "n") { e.preventDefault(); setView("upload"); }
      if (meta && e.key === "e") { e.preventDefault(); setView("pdf"); }
      if (meta && e.key === ",") { e.preventDefault(); setView("settings"); }
      if (meta && e.key === "1") { e.preventDefault(); setView("dashboard"); }
      if (meta && e.key === "2") { e.preventDefault(); setView("upload"); }
      if (meta && e.key === "3") { e.preventDefault(); setView("transcripts"); }
      if (meta && e.key === "4") { e.preventDefault(); setView("pdf"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const titles: Record<string, { title: string; sub: string }> = {
    dashboard:   { title: t("nav.dashboard"),   sub: t("page.dashboard.sub")   },
    upload:      { title: t("nav.upload"),      sub: t("page.upload.sub")      },
    transcripts: { title: t("nav.transcripts"), sub: t("page.transcripts.sub") },
    pdf:         { title: t("nav.pdf"),         sub: t("page.pdf.sub")         },
    library:     { title: t("nav.library"),     sub: t("page.library.sub")     },
    speakers:    { title: t("nav.speakers"),    sub: t("page.speakers.sub")    },
    analytics:   { title: t("nav.analytics"),   sub: t("page.analytics.sub")   },
    settings:    { title: t("nav.settings"),    sub: t("page.settings.sub")    },
  };
  const meta = titles[view];

  return (
    <div className="h-screen w-full flex bg-background text-foreground">
      <SidebarNav active={view} onChange={setView} />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b px-6 py-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1>{meta.title}</h1>
            <p className="text-muted-foreground">{meta.sub}</p>
          </div>
          <div className="relative w-72 max-w-full">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("header.search")}
              className="pl-9 cursor-pointer"
              readOnly
              onClick={() => setSearchOpen(true)}
              onFocus={() => setSearchOpen(true)}
            />
          </div>
          <div className="relative">
            <NotificationButton onClick={() => setNotifOpen(!notifOpen)} />
            <NotificationPanel open={notifOpen} onOpenChange={setNotifOpen} />
          </div>
          <Button onClick={() => setView("upload")}>
            <Sparkles className="size-4 mr-2" /> {t("header.newSession")}
          </Button>
        </header>

        <SearchPanel
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onNavigate={(v, fileId) => { setView(v); }}
        />

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {view === "dashboard" && (
            <PageErrorBoundary fallbackTitle="Dashboard error">
              <DashboardStatus onNavigate={setView} />
            </PageErrorBoundary>
          )}

          <Suspense fallback={<PageLoader />}>
            {view === "upload" && <PageErrorBoundary fallbackTitle="Upload error"><UploadWorkstation /></PageErrorBoundary>}

            {view === "transcripts" && <PageErrorBoundary fallbackTitle="Transcript error"><TranscriptWorkspace /></PageErrorBoundary>}

            {view === "pdf" && <PageErrorBoundary fallbackTitle="PDF Editor error"><PdfEditor /></PageErrorBoundary>}

            {view === "library" && <PageErrorBoundary fallbackTitle="Library error"><FileLibrary /></PageErrorBoundary>}

            {view === "speakers" && <PageErrorBoundary fallbackTitle="Speakers error"><SpeakerPanel /></PageErrorBoundary>}

            {view === "settings" && <PageErrorBoundary fallbackTitle="Settings error"><SettingsPanel /></PageErrorBoundary>}
          </Suspense>
        </div>
      </main>
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <TranscriptProvider>
        <UploadJobProvider>
          <Shell />
        </UploadJobProvider>
      </TranscriptProvider>
    </I18nProvider>
  );
}
