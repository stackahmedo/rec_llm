import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { Download, FileText, CheckCircle2 } from "lucide-react";
import { useTranscripts } from "../transcript-store";

export function PdfEditor() {
  const { getActive, getActiveSummary, transcripts, setActiveId } = useTranscripts();
  const [exported, setExported] = useState(false);

  const active = getActive();
  const summary = getActiveSummary();

  const exportPdf = async () => {
    if (!active) {
      toast.error("No transcript to export");
      return;
    }
    if (!window.electronAPI?.pdf) {
      toast.error("PDF export not available in browser mode");
      return;
    }

    const result = await window.electronAPI.pdf.exportReport({
      fileName: active.fileName,
      processedAt: active.completedAt || new Date().toISOString(),
      languageCode: active.languageCode,
      summary: summary?.summary,
      pointNotes: summary?.pointNotes,
      actionItems: summary?.actionItems,
      decisions: summary?.decisions,
      risks: summary?.risks,
      utterances: active.utterances,
    });

    if (result.ok) {
      setExported(true);
      toast.success("PDF exported", { description: result.filePath });
    } else {
      toast.error("Export failed", { description: result.error });
    }
  };

  // No transcript available
  if (!active && transcripts.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <FileText className="size-10 mx-auto mb-3 opacity-50" />
          <div className="text-lg">No completed file selected</div>
          <div className="mt-1">Transcribe an audio file first, then return here to export a PDF report.</div>
        </CardContent>
      </Card>
    );
  }

  const speakerCount = active
    ? new Set(active.utterances.map((u) => u.speaker)).size
    : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* File selector */}
      {transcripts.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Transcript</CardTitle>
            <CardDescription>Choose which transcript to export as PDF.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {transcripts.map((tr) => (
                <Badge
                  key={tr.fileId}
                  variant={tr.fileId === active?.fileId ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => { setActiveId(tr.fileId); setExported(false); }}
                >
                  {tr.fileName}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report preview */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>PDF Report</CardTitle>
              <CardDescription>
                {active ? active.fileName : "No file selected"}
              </CardDescription>
            </div>
            {exported && (
              <Badge className="bg-emerald-600 gap-1">
                <CheckCircle2 className="size-3" /> Exported
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {active ? (
            <>
              {/* Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Language</div>
                  <div>{active.languageCode}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Speakers</div>
                  <div>{speakerCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Utterances</div>
                  <div>{active.utterances.length}</div>
                </div>
              </div>

              {/* Summary status */}
              <div className="border rounded-md p-3 space-y-1">
                <div className="text-sm font-medium">Report Contents</div>
                <div className="text-sm text-muted-foreground flex flex-col gap-1">
                  <span>
                    {summary ? "✓ Summary included" : "— No summary (generate one for a richer report)"}
                  </span>
                  <span>
                    {summary?.pointNotes?.length ? `✓ ${summary.pointNotes.length} key points` : "— No key points"}
                  </span>
                  <span>
                    {summary?.actionItems?.length ? `✓ ${summary.actionItems.length} action items` : "— No action items"}
                  </span>
                  <span>
                    {summary?.decisions?.length ? `✓ ${summary.decisions.length} decisions` : "— No decisions"}
                  </span>
                  <span>
                    {summary?.risks?.length ? `✓ ${summary.risks.length} risks/issues` : "— No risks"}
                  </span>
                  <span>✓ Full transcript appendix ({active.utterances.length} utterances)</span>
                </div>
              </div>

              {/* Export button */}
              <Button type="button" onClick={exportPdf} className="w-full">
                <Download className="size-4 mr-2" />
                Export PDF Report
              </Button>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-4">
              Select a transcript above to preview and export.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
