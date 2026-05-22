import { useState, lazy, Suspense } from "react";
import { SidebarNav } from "./components/sidebar-nav";
import { DashboardStatus } from "./components/dashboard-status";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Search, Sparkles, Loader2 } from "lucide-react";
import { Toaster } from "./components/ui/sonner";
import { I18nProvider, useT } from "./i18n";
import { TranscriptProvider } from "./transcript-store";

// Lazy-loaded heavy pages
const UploadWorkstation = lazy(() => import("./components/upload-workstation").then((m) => ({ default: m.UploadWorkstation })));
const TranscriptViewer = lazy(() => import("./components/transcript-viewer").then((m) => ({ default: m.TranscriptViewer })));
const SummaryCard = lazy(() => import("./components/summary-card").then((m) => ({ default: m.SummaryCard })));
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
  const { t } = useT();
  const [view, setView] = useState("dashboard");
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
            <Input placeholder={t("header.search")} className="pl-9" />
          </div>
          <Button>
            <Sparkles className="size-4 mr-2" /> {t("header.newSession")}
          </Button>
        </header>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {view === "dashboard" && (
            <DashboardStatus onNavigate={setView} />
          )}

          <Suspense fallback={<PageLoader />}>
            {view === "upload" && <UploadWorkstation />}

            {view === "transcripts" && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2"><TranscriptViewer /></div>
                <SummaryCard />
              </div>
            )}

            {view === "pdf" && <PdfEditor />}

            {view === "library" && <FileLibrary />}

            {view === "speakers" && <SpeakerPanel />}

            {view === "settings" && <SettingsPanel />}
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
        <Shell />
      </TranscriptProvider>
    </I18nProvider>
  );
}
