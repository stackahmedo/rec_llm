/**
 * AI Report Composer — section management, AI rewrite, translation, presets.
 */

// --- Section Types ---
export interface ReportSection {
  id: string;
  type: SectionType;
  label: string;
  enabled: boolean;
  content?: string;
  aiGenerated?: boolean;
  language?: string;
  order: number;
}

export type SectionType =
  | "summary"
  | "keyPoints"
  | "actionItems"
  | "decisions"
  | "risks"
  | "transcript"
  | "appendix"
  | "translation"
  | "custom"
  | "branding"
  | "toc";

// --- AI Rewrite Modes ---
export type RewriteMode = "concise" | "formal" | "casual" | "executive" | "technical" | "expand";

export const rewriteModes: { id: RewriteMode; label: string; desc: string }[] = [
  { id: "concise", label: "Concise", desc: "Shorter, tighter language" },
  { id: "formal", label: "Formal", desc: "Professional business tone" },
  { id: "casual", label: "Casual", desc: "Conversational, friendly" },
  { id: "executive", label: "Executive", desc: "High-level summary for leadership" },
  { id: "technical", label: "Technical", desc: "Detailed, precise language" },
  { id: "expand", label: "Expand", desc: "Add detail and context" },
];

// --- Smart Templates ---
export interface SmartTemplate {
  id: string;
  label: string;
  desc: string;
  category: "business" | "legal" | "creative" | "technical" | "custom";
  sections: SectionType[];
  branding?: BrandingConfig;
  aiInstructions?: string;
}

export interface BrandingConfig {
  companyName: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  headerStyle: "minimal" | "full" | "branded";
}

export const defaultBranding: BrandingConfig = {
  companyName: "",
  primaryColor: "#1a1a2e",
  accentColor: "#4361ee",
  fontFamily: "Inter",
  headerStyle: "minimal",
};

// --- Export Presets ---
export interface ExportPreset {
  id: string;
  name: string;
  template: string;
  sections: SectionType[];
  sectionOrder: string[];
  branding?: BrandingConfig;
  language: string;
  pageSize: string;
  orientation: string;
  createdAt: number;
}

// --- Smart Templates Library ---
export const smartTemplates: SmartTemplate[] = [
  {
    id: "executive-brief",
    label: "Executive Brief",
    desc: "1-page summary for leadership",
    category: "business",
    sections: ["summary", "decisions", "actionItems", "risks"],
    aiInstructions: "Write in executive summary style. Focus on outcomes and decisions. Keep under 500 words total.",
  },
  {
    id: "meeting-minutes",
    label: "Meeting Minutes",
    desc: "Structured meeting record",
    category: "business",
    sections: ["summary", "keyPoints", "actionItems", "decisions", "transcript"],
    aiInstructions: "Format as official meeting minutes. Include attendees, agenda items, and next steps.",
  },
  {
    id: "legal-transcript",
    label: "Legal Transcript",
    desc: "Verbatim with speaker attribution",
    category: "legal",
    sections: ["toc", "transcript", "appendix"],
    aiInstructions: "Maintain verbatim accuracy. Include timestamps and speaker identification.",
  },
  {
    id: "podcast-summary",
    label: "Podcast Summary",
    desc: "Key moments and highlights",
    category: "creative",
    sections: ["summary", "keyPoints", "transcript"],
    aiInstructions: "Write engaging summaries. Highlight quotable moments and key takeaways.",
  },
  {
    id: "technical-review",
    label: "Technical Review",
    desc: "Detailed technical discussion notes",
    category: "technical",
    sections: ["summary", "keyPoints", "decisions", "risks", "actionItems", "appendix"],
    aiInstructions: "Focus on technical details, architecture decisions, and implementation notes.",
  },
  {
    id: "client-report",
    label: "Client Report",
    desc: "Branded deliverable for clients",
    category: "business",
    sections: ["branding", "toc", "summary", "keyPoints", "actionItems", "appendix"],
    branding: { ...defaultBranding, headerStyle: "branded" },
    aiInstructions: "Professional client-facing language. Avoid internal jargon.",
  },
  {
    id: "research-notes",
    label: "Research Notes",
    desc: "Academic/research discussion notes",
    category: "technical",
    sections: ["summary", "keyPoints", "decisions", "risks", "transcript"],
    aiInstructions: "Academic tone. Organize by research themes and findings.",
  },
  {
    id: "japanese-business",
    label: "日本語ビジネス",
    desc: "Japanese enterprise format",
    category: "business",
    sections: ["summary", "keyPoints", "actionItems", "decisions", "transcript"],
    aiInstructions: "日本語のビジネス文書形式で作成。敬語を使用し、要点を簡潔にまとめる。",
  },
];

// --- Translation Languages ---
export const translationLanguages = [
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "ko", label: "한국어" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "ar", label: "العربية" },
];

// --- Section Metadata ---
export const sectionMeta: Record<SectionType, { label: string; icon: string; desc: string }> = {
  summary: { label: "Summary", icon: "📝", desc: "AI-generated overview" },
  keyPoints: { label: "Key Points", icon: "💡", desc: "Main discussion topics" },
  actionItems: { label: "Action Items", icon: "✅", desc: "Tasks and assignments" },
  decisions: { label: "Decisions", icon: "⚖️", desc: "Concrete decisions made" },
  risks: { label: "Risks & Issues", icon: "⚠️", desc: "Concerns and blockers" },
  transcript: { label: "Full Transcript", icon: "📄", desc: "Complete speaker text" },
  appendix: { label: "Appendix", icon: "📎", desc: "Additional materials" },
  translation: { label: "Translation", icon: "🌐", desc: "Translated content" },
  custom: { label: "Custom Section", icon: "✏️", desc: "User-defined content" },
  branding: { label: "Branding Header", icon: "🏢", desc: "Company branding block" },
  toc: { label: "Table of Contents", icon: "📑", desc: "Auto-generated TOC" },
};

// --- Preset Storage ---
const PRESETS_KEY = "recllm-export-presets";

export function loadExportPresets(): ExportPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveExportPresets(presets: ExportPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export function addExportPreset(preset: Omit<ExportPreset, "id" | "createdAt">): ExportPreset {
  const presets = loadExportPresets();
  const newPreset: ExportPreset = {
    ...preset,
    id: `preset_${Date.now()}`,
    createdAt: Date.now(),
  };
  presets.push(newPreset);
  saveExportPresets(presets);
  return newPreset;
}

export function removeExportPreset(id: string) {
  const presets = loadExportPresets().filter((p) => p.id !== id);
  saveExportPresets(presets);
}

// --- Section Reordering ---
export function reorderSections(sections: ReportSection[], fromIndex: number, toIndex: number): ReportSection[] {
  const result = [...sections];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result.map((s, i) => ({ ...s, order: i }));
}

// --- Default Report Sections ---
export function createDefaultSections(): ReportSection[] {
  return [
    { id: "sec_summary", type: "summary", label: "Summary", enabled: true, order: 0 },
    { id: "sec_keypoints", type: "keyPoints", label: "Key Points", enabled: true, order: 1 },
    { id: "sec_actions", type: "actionItems", label: "Action Items", enabled: true, order: 2 },
    { id: "sec_decisions", type: "decisions", label: "Decisions", enabled: true, order: 3 },
    { id: "sec_risks", type: "risks", label: "Risks & Issues", enabled: true, order: 4 },
    { id: "sec_transcript", type: "transcript", label: "Full Transcript", enabled: true, order: 5 },
    { id: "sec_appendix", type: "appendix", label: "Appendix", enabled: false, order: 6 },
  ];
}

export function createSectionsFromTemplate(template: SmartTemplate): ReportSection[] {
  return template.sections.map((type, i) => ({
    id: `sec_${type}_${i}`,
    type,
    label: sectionMeta[type]?.label || type,
    enabled: true,
    order: i,
    aiGenerated: type !== "transcript" && type !== "toc" && type !== "branding",
  }));
}
