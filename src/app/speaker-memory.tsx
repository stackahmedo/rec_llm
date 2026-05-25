import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

export interface SpeakerProfile {
  label: string;
  customName: string;
  language: string;
  fileIds: string[];
  lastUsedAt: string;
  createdAt: string;
  // Registry fields
  aliases?: string[];
  notes?: string;
  confirmedFromTranscriptId?: string;
  confirmedSpeakerLabel?: string;
  evidenceText?: string;
  confidence?: number;
}

interface SpeakerMemoryStore {
  profiles: SpeakerProfile[];
  enabled: boolean;
  getSuggestion: (label: string) => SpeakerProfile | null;
  saveProfile: (label: string, customName: string, fileId: string, language?: string, registry?: Partial<SpeakerProfile>) => void;
  removeProfile: (label: string) => void;
  setEnabled: (enabled: boolean) => void;
  getAlias: (label: string) => string;
}

const Ctx = createContext<SpeakerMemoryStore>({
  profiles: [],
  enabled: true,
  getSuggestion: () => null,
  saveProfile: () => {},
  removeProfile: () => {},
  setEnabled: () => {},
  getAlias: () => "",
});

export function useSpeakerMemory() {
  return useContext(Ctx);
}

function migrateFromLocalStorage(): SpeakerProfile[] {
  try {
    const raw = localStorage.getItem("recllm-speaker-aliases");
    if (!raw) return [];
    const aliases = JSON.parse(raw) as Record<string, string>;
    const now = new Date().toISOString();
    return Object.entries(aliases).map(([label, customName]) => ({
      label,
      customName,
      language: "",
      fileIds: [],
      lastUsedAt: now,
      createdAt: now,
    }));
  } catch {
    return [];
  }
}

export function SpeakerMemoryProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<SpeakerProfile[]>([]);
  const [enabled, setEnabledState] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const api = window.electronAPI?.settings;
      if (!api) return;

      const enabledVal = await api.get("speakerMemory.enabled");
      if (enabledVal === false) setEnabledState(false);

      const stored = await api.get("speakerMemory.profiles") as SpeakerProfile[] | null;
      if (stored && Array.isArray(stored) && stored.length > 0) {
        setProfiles(stored);
      } else {
        const migrated = migrateFromLocalStorage();
        if (migrated.length > 0) {
          setProfiles(migrated);
          await api.set("speakerMemory.profiles", migrated);
          localStorage.removeItem("recllm-speaker-aliases");
        }
      }
      setLoaded(true);
    }
    load();
  }, []);

  const persist = useCallback(async (updated: SpeakerProfile[]) => {
    const api = window.electronAPI?.settings;
    if (api) await api.set("speakerMemory.profiles", updated);
  }, []);

  const getSuggestion = useCallback((label: string): SpeakerProfile | null => {
    if (!enabled) return null;
    return profiles.find((p) => p.label === label) || null;
  }, [profiles, enabled]);

  const saveProfile = useCallback((label: string, customName: string, fileId: string, language?: string, registry?: Partial<SpeakerProfile>) => {
    setProfiles((prev) => {
      const now = new Date().toISOString();
      const existing = prev.find((p) => p.label === label);
      let updated: SpeakerProfile[];

      if (existing) {
        updated = prev.map((p) =>
          p.label === label
            ? {
                ...p,
                ...registry,
                customName,
                language: language || p.language,
                fileIds: p.fileIds.includes(fileId) ? p.fileIds : [...p.fileIds, fileId],
                lastUsedAt: now,
              }
            : p
        );
      } else {
        updated = [...prev, {
          label,
          customName,
          language: language || "",
          fileIds: fileId ? [fileId] : [],
          lastUsedAt: now,
          createdAt: now,
          ...registry,
        }];
      }

      persist(updated);
      return updated;
    });
  }, [persist]);

  const removeProfile = useCallback((label: string) => {
    setProfiles((prev) => {
      const updated = prev.filter((p) => p.label !== label);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const setEnabled = useCallback(async (value: boolean) => {
    setEnabledState(value);
    const api = window.electronAPI?.settings;
    if (api) await api.set("speakerMemory.enabled", value);
  }, []);

  const getAlias = useCallback((label: string): string => {
    const profile = profiles.find((p) => p.label === label);
    return profile?.customName || "";
  }, [profiles]);

  return (
    <Ctx.Provider value={{ profiles, enabled, getSuggestion, saveProfile, removeProfile, setEnabled, getAlias }}>
      {children}
    </Ctx.Provider>
  );
}
