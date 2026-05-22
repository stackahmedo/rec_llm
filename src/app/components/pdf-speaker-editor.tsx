import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Switch } from "./ui/switch";
import { Palette, RotateCw, User } from "lucide-react";
import { SpeakerProfile, resetColors, resetNames } from "../pdf-speaker-store";

interface SpeakerEditorProps {
  profiles: SpeakerProfile[];
  onChange: (profiles: SpeakerProfile[]) => void;
}

export function SpeakerEditor({ profiles, onChange }: SpeakerEditorProps) {
  const updateProfile = (id: string, patch: Partial<SpeakerProfile>) => {
    onChange(profiles.map((p) => p.id === id ? { ...p, ...patch } : p));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-muted-foreground uppercase tracking-wider text-xs flex items-center gap-1.5">
          <User className="size-3" /> Speakers ({profiles.length})
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => onChange(resetNames(profiles))}
            title="Reset all names"
          >
            <RotateCw className="size-3 mr-1" />Names
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => onChange(resetColors(profiles))}
            title="Reset all colors"
          >
            <Palette className="size-3 mr-1" />Colors
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {profiles.map((profile) => (
          <div key={profile.id} className="flex items-center gap-2 p-1.5 rounded border bg-muted/20">
            {/* Color picker */}
            <input
              type="color"
              value={profile.color}
              onChange={(e) => updateProfile(profile.id, { color: e.target.value })}
              className="size-6 rounded cursor-pointer border-0 p-0"
              title="Speaker color"
            />

            {/* Name input */}
            <Input
              value={profile.displayName}
              onChange={(e) => updateProfile(profile.id, { displayName: e.target.value })}
              className="h-6 text-xs flex-1"
              placeholder={profile.id}
            />

            {/* Original ID badge */}
            {profile.displayName !== profile.id && (
              <span className="text-[9px] text-muted-foreground shrink-0">({profile.id})</span>
            )}

            {/* Enable toggle */}
            <Switch
              checked={profile.enabled}
              onCheckedChange={(v) => updateProfile(profile.id, { enabled: v })}
              className="scale-75"
            />
          </div>
        ))}
      </div>

      {profiles.length === 0 && (
        <div className="text-xs text-muted-foreground text-center py-2">
          Select a transcript to see speakers
        </div>
      )}
    </div>
  );
}
