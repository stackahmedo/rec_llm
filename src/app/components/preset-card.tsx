import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import { Settings2 } from "lucide-react";
import { useUploadJobs, UploadPreset } from "../upload-job-store";

export function PresetCard() {
  const { preset, setPreset } = useUploadJobs();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings2 className="size-4" />Processing Preset
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Transcript Language */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-muted-foreground font-medium">Transcript Language</label>
          <Select value={preset.transcriptLanguage} onValueChange={(v) => setPreset({ transcriptLanguage: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto Detect</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ja">Japanese</SelectItem>
              <SelectItem value="bn">Bengali</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Language */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-muted-foreground font-medium">Summary Language</label>
          <Select value={preset.summaryLanguage} onValueChange={(v) => setPreset({ summaryLanguage: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ja">Japanese</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Output Type */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-muted-foreground font-medium">Output Type</label>
          <Select value={preset.outputType} onValueChange={(v: UploadPreset["outputType"]) => setPreset({ outputType: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="transcript">Transcript only</SelectItem>
              <SelectItem value="transcript+summary">Transcript + Summary</SelectItem>
              <SelectItem value="transcript+summary+pdf">Transcript + Summary + PDF</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Speaker Detection */}
        <div className="flex items-center justify-between">
          <label className="text-xs">Speaker Detection</label>
          <Switch
            checked={preset.speakerDetection}
            onCheckedChange={(v) => setPreset({ speakerDetection: v })}
            className="scale-75"
          />
        </div>

        {/* Expected Speakers */}
        {preset.speakerDetection && (
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-muted-foreground font-medium">Expected Speakers</label>
            <Select value={String(preset.expectedSpeakers)} onValueChange={(v) => setPreset({ expectedSpeakers: Number(v) })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Auto</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5+</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Auto Save TXT */}
        <div className="flex items-center justify-between">
          <label className="text-xs">Auto-save TXT</label>
          <Switch
            checked={preset.autoSaveTxt}
            onCheckedChange={(v) => setPreset({ autoSaveTxt: v })}
            className="scale-75"
          />
        </div>

        {/* Active badges */}
        <div className="flex flex-wrap gap-1 pt-1 border-t">
          <Badge variant="outline" className="text-[9px] h-4">{preset.transcriptLanguage === "auto" ? "Auto" : preset.transcriptLanguage.toUpperCase()}</Badge>
          {preset.outputType.includes("summary") && <Badge variant="outline" className="text-[9px] h-4">Summary</Badge>}
          {preset.outputType.includes("pdf") && <Badge variant="outline" className="text-[9px] h-4">PDF</Badge>}
          {preset.speakerDetection && <Badge variant="outline" className="text-[9px] h-4">Diarization</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}
