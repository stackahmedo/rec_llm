import { useState } from "react";
import { SidebarNav } from "./components/sidebar-nav";
import { StatCard } from "./components/stat-card";
import { UploadPanel } from "./components/upload-panel";
import { TranscriptViewer } from "./components/transcript-viewer";
import { SpeakerPanel } from "./components/speaker-panel";
import { AnalyticsPanel } from "./components/analytics-panel";
import { SummaryCard } from "./components/summary-card";
import { PdfEditor } from "./components/pdf-editor";
import { FileLibrary } from "./components/file-library";
import { SettingsPanel } from "./components/settings-panel";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { AudioLines, Clock, Users, Sparkles, Search, AlertTriangle } from "lucide-react";
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
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label={t("stat.audioProcessed")}   value="412 h"  delta={t("stat.audioProcessed.delta")}   icon={Clock}      tone="positive" />
                <StatCard label={t("stat.activeRecordings")} value="9"      delta={t("stat.activeRecordings.delta")} icon={AudioLines} />
                <StatCard label={t("stat.speakerProfiles")}  value="6 / 10" delta={t("stat.speakerProfiles.delta")}  icon={Users}      tone="warning" />
                <StatCard label={t("stat.avgAccuracy")}      value="91%"    delta={t("stat.avgAccuracy.delta")}      icon={Sparkles}   tone="positive" />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                  <UploadPanel />
                  <AnalyticsPanel />
                </div>
                <div className="space-y-6">
                  <Card className="border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="size-4 text-amber-600" />
                        {t("attention.title")}
                      </CardTitle>
                      <CardDescription>{t("attention.sub")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { t: "Low-confidence segment in village_meeting_north.wav (74%)", b: t("attention.review") },
                        { t: "Unrecognized voice in interview_block_A.mp3 — assign speaker?", b: t("attention.assign") },
                        { t: "Diarization stalled on overlapping segment @ 02:18:44", b: t("attention.inspect") },
                      ].map((n, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 border-t pt-3 first:border-t-0 first:pt-0">
                          <div>{n.t}</div>
                          <Button variant="outline" size="sm">{n.b}</Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <SummaryCard />
                </div>
              </div>
            </>
          )}

          {view === "upload" && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2"><UploadPanel /></div>
              <Card>
                <CardHeader>
                  <CardTitle>Pipeline</CardTitle>
                  <CardDescription>Each file flows through these stages.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-4">
                    {[
                      ["Ingest", "Transfer from recorder, capture year & timestamp"],
                      ["Preprocess", "Noise reduction, normalization, channel split"],
                      ["Diarize", "Separate overlapping voices into channels"],
                      ["Transcribe", "Gemini batch transcription with confidence scores"],
                      ["Classify", "Tag each segment by 6 voice attributes"],
                      ["Summarize", "Generate structured 30-item digest"],
                    ].map(([t, d], i) => (
                      <li key={t} className="flex gap-3">
                        <div className="size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center tabular-nums shrink-0">{i + 1}</div>
                        <div>
                          <div>{t}</div>
                          <div className="text-muted-foreground">{d}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </div>
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

          {view === "analytics" && <AnalyticsPanel />}

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
