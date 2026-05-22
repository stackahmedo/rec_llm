import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Search, Download, Sparkles, Filter } from "lucide-react";
import { SessionList } from "./session-list";
import { TranscriptEditor } from "./transcript-editor";
import { SummaryInspector } from "./summary-inspector";
import { useTranscripts } from "../transcript-store";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { toast } from "sonner";

export function TranscriptWorkspace() {
  const { transcripts, setActiveId } = useTranscripts();
  const [selectedId, setSelectedId] = useState<string | null>(
    transcripts.length > 0 ? transcripts[0].fileId : null
  );

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setActiveId(id);
  };

  const active = selectedId ? transcripts.find((t) => t.fileId === selectedId) || null : null;

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Toolbar */}
      <div className="h-9 border-b bg-muted/10 flex items-center px-3 gap-2 shrink-0">
        <span className="text-[11px] font-medium">Transcripts</span>
        {active && (
          <Badge variant="outline" className="h-4 text-[9px] px-1.5 font-mono">
            {active.utterances.length} segments
          </Badge>
        )}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" disabled>
          <Filter className="size-3" />Filter
        </Button>
        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" disabled={!active}>
          <Sparkles className="size-3" />AI Actions
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" disabled={!active}>
              <Download className="size-3" />Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-[11px]" onClick={() => {
              if (!active || !window.electronAPI?.pdf) return;
              window.electronAPI.pdf.exportReport({
                fileName: active.fileName, processedAt: active.completedAt,
                languageCode: active.languageCode, utterances: active.utterances,
              }).then((r) => {
                if (r.ok) toast.success("PDF exported");
              });
            }}>PDF Report</DropdownMenuItem>
            <DropdownMenuItem className="text-[11px]" onClick={() => {
              if (!active || !window.electronAPI?.export) return;
              const lines = active.utterances.map((u) => `[${Math.floor(u.startMs/60000)}:${Math.floor((u.startMs%60000)/1000).toString().padStart(2,"0")}] ${u.speaker}: ${u.text}`);
              window.electronAPI.export.saveTxt(active.fileName, lines.join("\n")).then((r) => {
                if (r?.ok) toast.success("TXT exported");
              });
            }}>Plain Text</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 3-panel workspace */}
      <div className="flex-1 min-h-0 flex">
        {/* Left: Session list */}
        <div className="w-52 xl:w-56 border-r shrink-0 overflow-hidden bg-card">
          <SessionList selectedId={selectedId} onSelect={handleSelect} />
        </div>

        {/* Center: Transcript editor */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <TranscriptEditor fileId={selectedId} />
        </div>

        {/* Right: Summary inspector */}
        <div className="w-60 xl:w-64 border-l shrink-0 overflow-hidden bg-card">
          <SummaryInspector fileId={selectedId} />
        </div>
      </div>
    </div>
  );
}
