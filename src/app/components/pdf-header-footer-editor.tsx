import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Separator } from "./ui/separator";
import { HeaderConfig, FooterConfig } from "../pdf-template-store";

interface HeaderFooterEditorProps {
  header: HeaderConfig;
  footer: FooterConfig;
  onHeaderChange: (patch: Partial<HeaderConfig>) => void;
  onFooterChange: (patch: Partial<FooterConfig>) => void;
}

function SettingRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} className="scale-75" />
    </div>
  );
}

export function HeaderFooterEditor({ header, footer, onHeaderChange, onFooterChange }: HeaderFooterEditorProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="font-medium text-muted-foreground uppercase tracking-wider text-xs">Header</div>
        <SettingRow label="Enable header" checked={header.enabled} onChange={(v) => onHeaderChange({ enabled: v })} />

        {header.enabled && (
          <div className="space-y-2 pl-1">
            <div>
              <label className="text-xs text-muted-foreground">Mode</label>
              <Select value={header.mode} onValueChange={(v) => onHeaderChange({ mode: v as "auto" | "custom" })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Title</label>
              <Input
                value={header.title}
                onChange={(e) => onHeaderChange({ title: e.target.value })}
                className="h-7 text-xs"
                placeholder="Report title"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Subtitle</label>
              <Input
                value={header.subtitle}
                onChange={(e) => onHeaderChange({ subtitle: e.target.value })}
                className="h-7 text-xs"
                placeholder="Optional subtitle"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Company</label>
              <Input
                value={header.companyName}
                onChange={(e) => onHeaderChange({ companyName: e.target.value })}
                className="h-7 text-xs"
                placeholder="Company name"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Alignment</label>
              <Select value={header.alignment} onValueChange={(v) => onHeaderChange({ alignment: v as "left" | "center" | "right" })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <SettingRow label="Show file name" checked={header.showFileName} onChange={(v) => onHeaderChange({ showFileName: v })} />
            <SettingRow label="Show date" checked={header.showDate} onChange={(v) => onHeaderChange({ showDate: v })} />
            <SettingRow label="Show time" checked={header.showTime} onChange={(v) => onHeaderChange({ showTime: v })} />
            <SettingRow label="Show logo" checked={header.showLogo} onChange={(v) => onHeaderChange({ showLogo: v })} />
          </div>
        )}
      </div>

      <Separator />

      {/* Footer */}
      <div className="space-y-2">
        <div className="font-medium text-muted-foreground uppercase tracking-wider text-xs">Footer</div>
        <SettingRow label="Enable footer" checked={footer.enabled} onChange={(v) => onFooterChange({ enabled: v })} />

        {footer.enabled && (
          <div className="space-y-2 pl-1">
            <div>
              <label className="text-xs text-muted-foreground">Mode</label>
              <Select value={footer.mode} onValueChange={(v) => onFooterChange({ mode: v as "auto" | "custom" })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {footer.mode === "custom" && (
              <div>
                <label className="text-xs text-muted-foreground">Custom text</label>
                <Input
                  value={footer.text}
                  onChange={(e) => onFooterChange({ text: e.target.value })}
                  className="h-7 text-xs"
                  placeholder="Footer text"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground">Alignment</label>
              <Select value={footer.alignment} onValueChange={(v) => onFooterChange({ alignment: v as "left" | "center" | "right" })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <SettingRow label="Page numbers" checked={footer.showPageNumbers} onChange={(v) => onFooterChange({ showPageNumbers: v })} />
            <SettingRow label="Confidential" checked={footer.showConfidential} onChange={(v) => onFooterChange({ showConfidential: v })} />
            <SettingRow label="Generated by RecLLM" checked={footer.showGeneratedBy} onChange={(v) => onFooterChange({ showGeneratedBy: v })} />
          </div>
        )}
      </div>
    </div>
  );
}
