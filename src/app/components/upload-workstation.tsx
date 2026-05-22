import { useState, useMemo } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./ui/resizable";
import { UploadPanel } from "./upload-panel";
import { ProcessingContext } from "./processing-context";
import { ResourceMonitor } from "./resource-monitor";
import { useTranscripts } from "../transcript-store";

export function UploadWorkstation() {
  const { history } = useTranscripts();
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [fileStates, setFileStates] = useState<Map<string, any>>(new Map());

  // Derive queue stats from history + active processing
  const queueStats = useMemo(() => {
    const states = Array.from(fileStates.values());
    return {
      queued: states.filter((f) => f.stage === "queued").length,
      processing: states.filter((f) => ["uploading", "transcribing", "analyzing", "preprocessing"].includes(f.stage)).length,
      done: states.filter((f) => f.stage === "done").length,
      failed: states.filter((f) => f.stage === "failed").length,
    };
  }, [fileStates]);

  // Get active file for context panel
  const activeFile = selectedFileId ? fileStates.get(selectedFileId) || null : null;

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Main resizable area */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Center: Upload + Queue */}
          <ResizablePanel defaultSize={72} minSize={50}>
            <div className="h-full overflow-auto p-4">
              <UploadPanel
                onFileStateChange={(files) => {
                  const map = new Map<string, any>();
                  files.forEach((f) => map.set(f.id, f));
                  setFileStates(map);
                }}
                onFileSelect={(id) => setSelectedFileId(id)}
                selectedFileId={selectedFileId}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Context Intelligence */}
          <ResizablePanel defaultSize={28} minSize={20} maxSize={40}>
            <div className="h-full border-l bg-card">
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
