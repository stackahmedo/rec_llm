export interface SpeakerProfile {
  id: string;          // original speaker ID from transcript
  displayName: string; // editable display name
  color: string;       // hex color
  enabled: boolean;    // show in PDF
}

export interface SpeakerProfileMap {
  transcriptId: string;
  profiles: SpeakerProfile[];
}

const defaultColors = [
  "#2563eb", "#dc2626", "#d97706", "#059669",
  "#7c3aed", "#0891b2", "#be185d", "#ea580c",
  "#4f46e5", "#0d9488", "#b91c1c", "#65a30d",
];

export function generateProfiles(speakers: string[]): SpeakerProfile[] {
  return speakers.map((id, i) => ({
    id,
    displayName: id,
    color: defaultColors[i % defaultColors.length],
    enabled: true,
  }));
}

export function getDisplayName(profiles: SpeakerProfile[], id: string): string {
  const p = profiles.find((s) => s.id === id);
  return p?.displayName || id;
}

export function getColor(profiles: SpeakerProfile[], id: string): string | undefined {
  const p = profiles.find((s) => s.id === id);
  return p?.enabled ? p.color : undefined;
}

const STORAGE_KEY = "recllm-speaker-profiles";

export function loadSpeakerProfiles(transcriptId: string): SpeakerProfile[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${transcriptId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function saveSpeakerProfiles(transcriptId: string, profiles: SpeakerProfile[]): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}-${transcriptId}`, JSON.stringify(profiles));
  } catch {}
}

export function resetColors(profiles: SpeakerProfile[]): SpeakerProfile[] {
  return profiles.map((p, i) => ({ ...p, color: defaultColors[i % defaultColors.length] }));
}

export function resetNames(profiles: SpeakerProfile[]): SpeakerProfile[] {
  return profiles.map((p) => ({ ...p, displayName: p.id }));
}
