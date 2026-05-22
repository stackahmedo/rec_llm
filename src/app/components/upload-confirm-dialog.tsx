import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import {
  FileAudio, HardDrive, AlertTriangle, X, Play, Trash2,
} from "lucide-react";
import { UploadJob } from "../upload-job-store";

interface UploadConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: UploadJob[];
  onConfirm: (fileIds: string[]) => void;
  onRemoveFile: (id: string) => void;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
}

export function UploadConfirmDialog({ open, onOpenChange, files, onConfirm, onRemoveFile }: UploadConfirmDialogProps) {
  const totalSize = files.reduce((s, f) => s + f.sizeBytes, 0);
  const hasLargeFile = files.some((f) => f.sizeBytes > 100 * 1024 * 1024);

  const handleStart = () => {
    onConfirm(files.map((f) => f.id));
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="size-4" />
            Start Processing
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* File list */}
          <div className="text-xs text-muted-foreground">
            {files.length} file{files.length !== 1 ? "s" : ""} selected · {formatBytes(totalSize)} total
          </div>

          <ScrollArea className="max-h-[200px]">
            <div className="space-y-1">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-2 p-2 rounded border bg-muted/20 text-xs">
                  <FileAudio className="size-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{f.fileName}</div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><HardDrive className="size-2.5" />{formatBytes(f.sizeBytes)}</span>
                      <span>{f.format}</span>
                      {f.audioMeta && <span>{Math.floor(f.audioMeta.duration / 60)}m{Math.floor(f.audioMeta.duration % 60)}s</span>}
                    </div>
                  </div>
                  {f.sizeBytes > 100 * 1024 * 1024 && (
                    <Badge variant="outline" className="text-[9px] h-4 text-amber-600 border-amber-300">Large</Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => onRemoveFile(f.id)}
                    title="Remove"
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Warnings */}
          {hasLargeFile && (
            <div className="flex items-start gap-2 p-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
              <span>Large files detected. Processing may take several minutes. Do not close the app during transcription.</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleStart} disabled={files.length === 0}>
              <Play className="size-3.5 mr-1" />
              Start Processing ({files.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
