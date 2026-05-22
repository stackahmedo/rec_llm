import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Save } from "lucide-react";
import { PdfTemplateConfig, loadCustomTemplates, saveCustomTemplates } from "../pdf-template-store";

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSettings: PdfTemplateConfig["settings"];
  onSaved: () => void;
}

export function SaveTemplateDialog({ open, onOpenChange, currentSettings, onSaved }: SaveTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<PdfTemplateConfig["category"]>("custom");
  const [isDefault, setIsDefault] = useState(false);

  const handleSave = () => {
    if (!name.trim()) return;

    const newTemplate: PdfTemplateConfig = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      category,
      isDefault,
      isBuiltIn: false,
      settings: { ...currentSettings },
    };

    const existing = loadCustomTemplates();

    // If setting as default, unset others
    if (isDefault) {
      existing.forEach((t) => { t.isDefault = false; });
    }

    existing.push(newTemplate);
    saveCustomTemplates(existing);

    setName("");
    setDescription("");
    setCategory("custom");
    setIsDefault(false);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="size-4" /> Save Template
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs text-muted-foreground">Template Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-sm"
              placeholder="My Custom Template"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-8 text-sm"
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <Select value={category} onValueChange={(v) => setCategory(v as PdfTemplateConfig["category"])}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="legal">Legal</SelectItem>
                <SelectItem value="japanese">Japanese Enterprise</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Set as default template</span>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            <Save className="size-4 mr-1" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
