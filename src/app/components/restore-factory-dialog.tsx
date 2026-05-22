import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AlertTriangle } from "lucide-react";

interface RestoreFactoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const CONFIRM_PHRASE = "OKAY";

export function RestoreFactoryDialog({ open, onOpenChange, onConfirm }: RestoreFactoryDialogProps) {
  const [typed, setTyped] = useState("");
  const confirmed = typed === CONFIRM_PHRASE;

  const handleClose = () => {
    setTyped("");
    onOpenChange(false);
  };

  const handleRestore = () => {
    if (!confirmed) return;
    setTyped("");
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" />
            Restore Factory Settings?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-[11px] leading-relaxed border border-red-200 dark:border-red-900 rounded p-2.5 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300">
            This action will permanently delete all local app data, settings, API keys, transcripts, queue history, cache files, and saved preferences. This cannot be undone.
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Type <span className="font-mono font-bold text-foreground">OKAY</span> to confirm
            </label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type OKAY"
              className="h-8 text-sm font-mono"
              autoComplete="off"
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !confirmed) e.preventDefault();
                if (e.key === "Enter" && confirmed) handleRestore();
              }}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-7 text-xs"
              disabled={!confirmed}
              onClick={handleRestore}
            >
              Restore and Delete Everything
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
