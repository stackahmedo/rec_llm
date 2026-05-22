import { useState, useMemo } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./ui/resizable";
import { UploadPanel } from "./upload-panel";
import { PresetCard } from "./preset-card";
import { ProcessedFilesCard } from "./processed-files-card";
import { ProcessingContext } from "./processing-context";
import { ResourceMonitor } from "./resource-monitor";
import { useTranscripts } from "../transcript-store";
import { useUploadJobs } from "../upload-job-store";

export function UploadWorkstation() {
  const { history } = useTranscripts();
  const { jobs } = useUploadJobs();
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Derive queue stats from global job store
  const queueStats = useMemo(() => ({
    queued: jobs.filter((f) => f.stage === "queued").length,
    processing: jobs.filter((f) => ["uploading", "transcribing", "analyzing", "summarizing", "saving"].includes(f.stage)).length,
    done: jobs.filter((f) => f.stage === "done").length,
    failed: jobs.filter((f) => f.stage === "failed").length,
  }), [jobs]);

  // Get active file for context panel — map UploadJob to ActiveFile shape
  const activeJob = selectedFileId ? jobs.find((j) => j.id === selectedFileId) || null : null;
  const activeFile = activeJob ? {
    id: activeJob.id,
    name: activeJob.fileName,
    stage: activeJob.stage,
    sizeBytes: activeJob.sizeBytes,
    audioMeta: activeJob.audioMeta,
    recommendation: activeJob.recommendation,
    processingStartedAt: activeJob.startedAt,
    speakers: activeJob.speakers,
  } : null;

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Main resizable area */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Center: Upload + Queue + Processed Files */}
          <ResizablePanel defaultSize={72} minSize={50}>
            <div className="h-full overflow-auto p-4 space-y-4">
              <UploadPanel
                onFileSelect={(id) => setSelectedFileId(id)}
                selectedFileId={selectedFileId}
              />
              <ProcessedFilesCard />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Preset + Context Intelligence */}
          <ResizablePanel defaultSize={28} minSize={20} maxSize={40}>
            <div className="h-full border-l bg-card overflow-auto p-3 space-y-3">
              <PresetCard />
              <ProcessingContext activeFile={activeFile} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Bottom: Resource Monitor */}
      <ResourceMonitor queueStats={queueStats} />
    </div>
  );
}
