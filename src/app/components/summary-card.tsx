import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { useTranscripts } from "../transcript-store";

export function SummaryCard() {
  const { getActive, getActiveSummary, addSummary } = useTranscripts();
  const [generating, setGenerating] = useState(false);
  const [language, setLanguage] = useState<'en' | 'ja'>('en');

  const active = getActive();
  const summary = getActiveSummary();

  const generate = async () => {
    if (!active) {
      toast.error("No transcript available", { description: "Transcribe a file first." });
      return;
    }
    if (!window.electronAPI?.summarize) {
      toast.error("Summary not available in browser mode");
      return;
    }

    setGenerating(true);
    const utterances = active.utterances.map((u) => ({
      speaker: u.speaker,
      startMs: u.startMs,
      text: u.text,
    }));
    const result = await window.electronAPI.summarize.generate(active.fullText, language, utterances);
    setGenerating(false);

    if (result.ok) {
      const summaryData = {
        fileId: active.fileId,
        language,
        summary: result.summary || '',
        pointNotes: result.pointNotes || [],
        actionItems: result.actionItems || [],
        decisions: result.decisions || [],
        risks: result.risks || [],
        generatedAt: new Date().toISOString(),
      };
      addSummary(summaryData);

      // Persist summary to disk
      window.electronAPI?.history?.save({
        id: active.fileId,
        fileName: active.fileName,
        filePath: '',
        sizeBytes: 0,
        status: 'done' as const,
        languageCode: active.languageCode,
        speakerCount: new Set(active.utterances.map((u) => u.speaker)).size,
        createdAt: '',
        completedAt: active.completedAt || new Date().toISOString(),
        transcript: {
          fullText: active.fullText,
          utterances: active.utterances,
        },
        summary: {
          language: summaryData.language,
          summary: summaryData.summary,
          pointNotes: summaryData.pointNotes,
          actionItems: summaryData.actionItems,
          decisions: summaryData.decisions,
          risks: summaryData.risks,
          generatedAt: summaryData.generatedAt,
        },
      });

      toast.success("Summary generated");
    } else {
      toast.error("Summary failed", { description: result.error });
    }
  };

  const hasSummary = !!summary;
  const items = hasSummary ? summary.pointNotes : [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              {hasSummary ? "Session Summary" : "Summary"}
            </CardTitle>
            <CardDescription>
              {hasSummary
                ? `Generated ${summary.language === 'ja' ? 'in Japanese' : 'in English'} · ${active?.fileName || ''}`
                : "No summary generated yet. Transcribe a file and click Summarize."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={language} onValueChange={(v) => setLanguage(v as 'en' | 'ja')}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={generate} disabled={generating || !active}>
              {generating ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Sparkles className="size-4 mr-1" />}
              {generating ? "Generating..." : "Summarize"}
            </Button>
            <Badge variant="secondary">{hasSummary ? "Ready" : "Draft"}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasSummary && summary.summary && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="text-muted-foreground mb-1">Summary</div>
            <p className="leading-relaxed">{summary.summary}</p>
          </div>
        )}

        <ScrollArea className="h-72 pr-4">
          <div className="space-y-4">
            {items.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-2">{hasSummary ? "Key Points" : "Points"}</div>
                <ol className="space-y-2">
                  {items.map((it, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0 tabular-nums text-muted-foreground">{i + 1}</span>
                      <span className="leading-relaxed">{it}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {hasSummary && summary.actionItems.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-2">Action Items</div>
                <ul className="space-y-1.5">
                  {summary.actionItems.map((it, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasSummary && summary.decisions.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-2">Decisions</div>
                <ul className="space-y-1.5">
                  {summary.decisions.map((it, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-emerald-600">✓</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasSummary && summary.risks.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-2">Risks / Issues</div>
                <ul className="space-y-1.5">
                  {summary.risks.map((it, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-amber-600">⚠</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
