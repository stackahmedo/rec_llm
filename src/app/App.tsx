import { useState } from "react";
import { SidebarNav } from "./components/sidebar-nav";
import { UploadPanel } from "./components/upload-panel";
import { UploadWorkstation } from "./components/upload-workstation";
import { TranscriptViewer } from "./components/transcript-viewer";
import { SpeakerPanel } from "./components/speaker-panel";
import { SummaryCard } from "./components/summary-card";
import { PdfEditor } from "./components/pdf-editor";
import { FileLibrary } from "./components/file-library";
import { SettingsPanel } from "./components/settings-panel";
import { DashboardStatus } from "./components/dashboard-status";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import { Search, Sparkles } from "lucide-react";
import { Toaster } from "./components/ui/sonner";
import { I18nProvider, useT } from "./i18n";
import { TranscriptProvider } from "./transcript-store";

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

          {view === "upload" && (
            <UploadWorkstation />
          )}

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
