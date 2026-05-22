import { useState } from "react";
import { UploadToolbar } from "./upload-toolbar";
import { ProcessingQueue } from "./processing-queue";
import { ReportInspector } from "./report-inspector";
import { StatusBar } from "./status-bar";
import { useProcessingEngine } from "../hooks/use-processing-engine";

export function UploadWorkstation() {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Run the processing engine (queue processor + progress listener)
  useProcessingEngine();

  const handleOpenReport = (id: string) => {
    setSelectedFileId(id);
    // Future: navigate to document editor or open modal
  };

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Top: Compact upload toolbar — sticky */}
      <UploadToolbar />

      {/* Main: Queue + Inspector */}
      <div className="flex-1 min-h-0 flex">
        {/* Left: Processing queue */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <ProcessingQueue
            selectedId={selectedFileId}
            onSelect={setSelectedFileId}
            onOpenReport={handleOpenReport}
          />
        </div>

        {/* Right: Report inspector — sticky */}
        <div className="w-72 xl:w-80 border-l shrink-0 overflow-hidden bg-card">
          <ReportInspector selectedId={selectedFileId} />
        </div>
      </div>

      {/* Bottom: Status bar */}
      <StatusBar />
    </div>
  );
}
