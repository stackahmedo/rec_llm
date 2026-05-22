import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Zap, Target, Brain, Users, Briefcase, Mic2 } from "lucide-react";

export interface ProcessingPreset {
  id: string;
  label: string;
  description: string;
  icon: any;
  settings: {
    diarization: boolean;
    maxSpeakers?: number;
    language: 'auto' | 'en' | 'ja' | 'mixed';
    summarize: boolean;
    accuracy: 'fast' | 'balanced' | 'high';
  };
}

export const presets: ProcessingPreset[] = [
  {
    id: "fast",
    label: "Fast Draft",
    description: "Quick transcription, no diarization or summary",
    icon: Zap,
    settings: { diarization: false, language: 'auto', summarize: false, accuracy: 'fast' },
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Diarization + summary, standard accuracy",
    icon: Target,
    settings: { diarization: true, language: 'auto', summarize: true, accuracy: 'balanced' },
  },
  {
    id: "high",
    label: "High Accuracy",
    description: "Best model, full analysis pipeline",
    icon: Brain,
    settings: { diarization: true, language: 'auto', summarize: true, accuracy: 'high' },
  },
  {
    id: "meeting",
    label: "Meeting Analysis",
    description: "Diarization + action items + decisions",
    icon: Users,
    settings: { diarization: true, maxSpeakers: 10, language: 'auto', summarize: true, accuracy: 'balanced' },
  },
  {
    id: "japanese_business",
    label: "Japanese Business",
    description: "Japanese language, formal summary style",
    icon: Briefcase,
    settings: { diarization: true, language: 'ja', summarize: true, accuracy: 'high' },
  },
  {
    id: "interview",
    label: "Interview Mode",
    description: "2 speakers max, detailed transcript",
    icon: Mic2,
    settings: { diarization: true, maxSpeakers: 2, language: 'auto', summarize: true, accuracy: 'high' },
  },
];

interface ProcessingPresetsProps {
  value: string;
  onChange: (presetId: string) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
}

export function ProcessingPresets({ value, onChange, language, onLanguageChange }: ProcessingPresetsProps) {
  const active = presets.find((p) => p.id === value) || presets[1];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Preset selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Preset</span>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-7 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {presets.map((p) => {
              const Icon = p.icon;
              return (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <Icon className="size-3" />
                    <span>{p.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Language selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Language</span>
        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto Detect</SelectItem>
            <SelectItem value="ja">Japanese</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="mixed">Mixed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active preset badges */}
      <div className="flex items-center gap-1.5">
        {active.settings.diarization && <Badge variant="outline" className="h-5 text-[10px]">Diarization</Badge>}
        {active.settings.summarize && <Badge variant="outline" className="h-5 text-[10px]">Summary</Badge>}
        <Badge variant="outline" className="h-5 text-[10px] capitalize">{active.settings.accuracy}</Badge>
      </div>
    </div>
  );
}
