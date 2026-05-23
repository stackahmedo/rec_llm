import { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  Languages, Mic2, Sparkles, Download, FileText, Globe, Loader2,
  Clock, Activity, BarChart3,
} from "lucide-react";
import { useTranscripts } from "../transcript-store";
import { toast } from "sonner";
import { notifySummaryGenerated, notifySummaryFailed } from "../notification-store";
import { notifyProviderError } from "../notify";

interface SummaryInspectorProps {
  fileId: string | null;
}

export function SummaryInspector({ fileId }: SummaryInspectorProps) {
  const { transcripts, summaries, addSummary, getActiveSummary } = useTranscripts();
  const [generating, setGenerating] = useState(false);
  const [summaryLang, setSummaryLang] = useState<"en" | "ja">("en");

  const active = fileId ? transcripts.find((t) => t.fileId === fileId) || null : null;
  const summary = fileId ? summaries.find((s) => s.fileId === fileId) || null : null;

  const speakerCount = active ? new Set(active.utterances.map((u) => u.speaker)).size : 0;
  const segmentCount = active?.utterances.length || 0;
  const lastEnd = active ? Math.max(...active.utterances.map((u) => u.endMs), 0) : 0;

  const generate = async () => {
    if (!active) return;
    if (!window.electronAPI?.summarize) {
      toast.error("Summary not available in browser mode");
      return;
    }
    setGenerating(true);
    const utterances = active.utterances.map((u) => ({ speaker: u.speaker, startMs: u.startMs, text: u.text }));
    const result = await window.electronAPI.summarize.generate(active.fullText, summaryLang, utterances);
    setGenerating(false);

    if (result.ok) {
      const summaryData = {
        fileId: active.fileId,
        language: summaryLang,
        summary: result.summary || '',
        pointNotes: result.pointNotes || [],
        actionItems: result.actionItems || [],
        decisions: result.decisions || [],
        risks: result.risks || [],
        generatedAt: new Date().toISOString(),
      };
      addSummary(summaryData);
      window.electronAPI?.history?.save({
        id: active.fileId, fileName: active.fileName, filePath: '', sizeBytes: 0,
        status: 'done', languageCode: active.languageCode,
        speakerCount, createdAt: active.completedAt, completedAt: active.completedAt,
        transcript: { fullText: active.fullText, utterances: active.utterances },
        summary: summaryData,
      });
      toast.success("Summary generated");
      notifySummaryGenerated(active.fileName);
    } else {
      notifyProviderError(result.error || "Unknown error", "AI Summary");
      notifySummaryFailed(active.fileName, result.error);
    }
  };

  const exportPdf = async () => {
    if (!active) return;
    if (!window.electronAPI?.pdf) { toast.error("PDF export not available"); return; }
    const result = await window.electronAPI.pdf.exportReport({
      fileName: active.fileName, processedAt: active.completedAt,
      languageCode: active.languageCode, summary: summary?.summary,
      pointNotes: summary?.pointNotes, actionItems: summary?.actionItems,
      decisions: summary?.decisions, risks: summary?.risks, utterances: active.utterances,
    });
    if (result.ok) toast.success("PDF exported", { description: result.filePath });
    else if (result.error !== 'Export cancelled.') toast.error("PDF export failed", { description: result.error });
  };

  const exportTxt = async () => {
    if (!active) return;
    if (!window.electronAPI?.export) { toast.error("Export not available"); return; }
    const lines = active.utterances.map((u) => {
      const ts = `${Math.floor(u.startMs / 60000)}:${Math.floor((u.startMs % 60000) / 1000).toString().padStart(2, "0")}`;
      return `[${ts}] ${u.speaker}: ${u.text}`;
    });
    const content = `# ${active.fileName}\n# Language: ${active.languageCode}\n\n${lines.join("\n")}`;
    const result = await window.electronAPI.export.saveTxt(active.fileName, content);
    if (result?.ok) toast.success("TXT exported");
    else if (result?.error && result.error !== 'Export cancelled.') toast.error("Export failed");
  };

  // Empty state
  if (!active) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-3 text-center">
        <Sparkles className="size-5 opacity-30 mb-2" />
        <div className="text-[11px]">Select a transcript</div>
        <div className="text-[10px] mt-0.5">to view summary and metadata</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Metadata */}
      <div className="p-2.5 border-b">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Metadata</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          <div className="text-muted-foreground flex items-center gap-1"><Languages className="size-2.5" />Language</div>
          <div className="font-mono uppercase">{active.languageCode}</div>
          <div className="text-muted-foreground flex items-center gap-1"><Mic2 className="size-2.5" />Speakers</div>
          <div className="font-mono">{speakerCount}</div>
          <div className="text-muted-foreground flex items-center gap-1"><BarChart3 className="size-2.5" />Segments</div>
          <div className="font-mono">{segmentCount}</div>
          <div className="text-muted-foreground flex items-center gap-1"><Clock className="size-2.5" />Duration</div>
          <div className="font-mono">{Math.floor(lastEnd / 60000)}m {Math.floor((lastEnd % 60000) / 1000)}s</div>
          <div className="text-muted-foreground flex items-center gap-1"><Activity className="size-2.5" />Completed</div>
          <div className="font-mono">{active.completedAt.slice(0, 10)}</div>
        </div>
      </div>

      {/* Summary */}
      <div className="p-2.5 border-b">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Summary</div>
        {summary ? (
          <div className="space-y-2">
            <p className="text-[10px] leading-relaxed">{summary.summary}</p>
            {summary.pointNotes.length > 0 && (
              <div className="space-y-0.5">
                <div className="text-[9px] text-muted-foreground uppercase">Key Points</div>
                {summary.pointNotes.slice(0, 4).map((n, i) => (
                  <div key={i} className="text-[10px] pl-2 border-l-2 border-muted">{n}</div>
                ))}
              </div>
            )}
            {summary.actionItems.length > 0 && (
              <div className="space-y-0.5">
                <div className="text-[9px] text-muted-foreground uppercase">Actions</div>
                {summary.actionItems.slice(0, 3).map((a, i) => (
                  <div key={i} className="text-[10px] pl-2 border-l-2 border-amber-300">• {a}</div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[10px] text-muted-foreground">No summary generated yet.</div>
            <div className="flex items-center gap-1.5">
              <Select value={summaryLang} onValueChange={(v) => setSummaryLang(v as "en" | "ja")}>
                <SelectTrigger className="h-6 text-[10px] w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ja">Japanese</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" size="sm" className="h-6 text-[10px] gap-1" onClick={generate} disabled={generating}>
                {generating ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                Summarize
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-2.5">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Actions</div>
        <div className="space-y-1">
          <Button variant="outline" size="sm" className="w-full h-6 text-[10px] justify-start gap-1.5" onClick={exportPdf}>
            <FileText className="size-3" />Export PDF
          </Button>
          <Button variant="outline" size="sm" className="w-full h-6 text-[10px] justify-start gap-1.5" onClick={exportTxt}>
            <Download className="size-3" />Export TXT
          </Button>
          <Button variant="outline" size="sm" className="w-full h-6 text-[10px] justify-start gap-1.5" disabled>
            <Globe className="size-3" />Translate
          </Button>
          {!summary && (
            <Button variant="outline" size="sm" className="w-full h-6 text-[10px] justify-start gap-1.5" onClick={generate} disabled={generating}>
              <Sparkles className="size-3" />Generate Summary
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
