export interface PdfTemplateConfig {
  id: string;
  name: string;
  description: string;
  category: "business" | "meeting" | "legal" | "japanese" | "personal" | "custom";
  isDefault: boolean;
  isBuiltIn: boolean;
  settings: {
    fontSize: "small" | "medium" | "large";
    pageSize: "A4" | "Letter";
    orientation: "portrait" | "landscape";
    columns: 1 | 2;
    margin: "small" | "medium" | "large";
    header: HeaderConfig;
    footer: FooterConfig;
    sections: SectionConfig;
    speakerColorsEnabled: boolean;
  };
}

export interface HeaderConfig {
  enabled: boolean;
  mode: "auto" | "custom";
  title: string;
  subtitle: string;
  showFileName: boolean;
  showDate: boolean;
  showTime: boolean;
  showLogo: boolean;
  companyName: string;
  alignment: "left" | "center" | "right";
}

export interface FooterConfig {
  enabled: boolean;
  mode: "auto" | "custom";
  text: string;
  showPageNumbers: boolean;
  showConfidential: boolean;
  showGeneratedBy: boolean;
  alignment: "left" | "center" | "right";
}

export interface SectionConfig {
  summary: boolean;
  keyPoints: boolean;
  actionItems: boolean;
  decisions: boolean;
  risks: boolean;
  transcript: boolean;
  appendix: boolean;
}

const defaultHeader: HeaderConfig = {
  enabled: true,
  mode: "auto",
  title: "RecLLM — Transcript Report",
  subtitle: "",
  showFileName: true,
  showDate: true,
  showTime: false,
  showLogo: true,
  companyName: "",
  alignment: "left",
};

const defaultFooter: FooterConfig = {
  enabled: true,
  mode: "auto",
  text: "",
  showPageNumbers: true,
  showConfidential: false,
  showGeneratedBy: true,
  alignment: "center",
};

const defaultSections: SectionConfig = {
  summary: true,
  keyPoints: true,
  actionItems: true,
  decisions: true,
  risks: true,
  transcript: true,
  appendix: true,
};

export const builtInTemplates: PdfTemplateConfig[] = [
  {
    id: "business",
    name: "Business Report",
    description: "Professional corporate style",
    category: "business",
    isDefault: true,
    isBuiltIn: true,
    settings: {
      fontSize: "medium",
      pageSize: "A4",
      orientation: "portrait",
      columns: 1,
      margin: "medium",
      header: { ...defaultHeader },
      footer: { ...defaultFooter },
      sections: { ...defaultSections },
      speakerColorsEnabled: true,
    },
  },
  {
    id: "meeting",
    name: "Meeting Minutes",
    description: "Action-focused layout",
    category: "meeting",
    isDefault: false,
    isBuiltIn: true,
    settings: {
      fontSize: "medium",
      pageSize: "A4",
      orientation: "portrait",
      columns: 1,
      margin: "medium",
      header: { ...defaultHeader, title: "Meeting Minutes" },
      footer: { ...defaultFooter, showConfidential: true },
      sections: { ...defaultSections, appendix: false },
      speakerColorsEnabled: true,
    },
  },
  {
    id: "legal",
    name: "Legal / Official",
    description: "Formal document style",
    category: "legal",
    isDefault: false,
    isBuiltIn: true,
    settings: {
      fontSize: "small",
      pageSize: "A4",
      orientation: "portrait",
      columns: 1,
      margin: "large",
      header: { ...defaultHeader, title: "Official Transcript Record", showLogo: false },
      footer: { ...defaultFooter, showConfidential: true, showPageNumbers: true },
      sections: { ...defaultSections, summary: false, keyPoints: false },
      speakerColorsEnabled: false,
    },
  },
  {
    id: "simple",
    name: "Simple Transcript",
    description: "Clean text-only output",
    category: "personal",
    isDefault: false,
    isBuiltIn: true,
    settings: {
      fontSize: "medium",
      pageSize: "A4",
      orientation: "portrait",
      columns: 1,
      margin: "medium",
      header: { ...defaultHeader, mode: "custom", title: "Transcript", showLogo: false },
      footer: { ...defaultFooter, showGeneratedBy: false },
      sections: { summary: false, keyPoints: false, actionItems: false, decisions: false, risks: false, transcript: true, appendix: false },
      speakerColorsEnabled: false,
    },
  },
  {
    id: "timeline",
    name: "Speaker Timeline",
    description: "Time-based speaker view",
    category: "business",
    isDefault: false,
    isBuiltIn: true,
    settings: {
      fontSize: "small",
      pageSize: "A4",
      orientation: "landscape",
      columns: 1,
      margin: "small",
      header: { ...defaultHeader, title: "Speaker Timeline Report" },
      footer: { ...defaultFooter },
      sections: { ...defaultSections, summary: false },
      speakerColorsEnabled: true,
    },
  },
  {
    id: "japanese",
    name: "Japanese Enterprise",
    description: "日本語ビジネス形式",
    category: "japanese",
    isDefault: false,
    isBuiltIn: true,
    settings: {
      fontSize: "medium",
      pageSize: "A4",
      orientation: "portrait",
      columns: 1,
      margin: "medium",
      header: { ...defaultHeader, title: "議事録レポート", alignment: "center" },
      footer: { ...defaultFooter, showConfidential: true, text: "社外秘" },
      sections: { ...defaultSections },
      speakerColorsEnabled: true,
    },
  },
];

const STORAGE_KEY = "recllm-pdf-templates";

export function loadCustomTemplates(): PdfTemplateConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

export function saveCustomTemplates(templates: PdfTemplateConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {}
}

export function getAllTemplates(): PdfTemplateConfig[] {
  return [...builtInTemplates, ...loadCustomTemplates()];
}

export function getDefaultTemplate(): PdfTemplateConfig {
  const all = getAllTemplates();
  return all.find((t) => t.isDefault) || builtInTemplates[0];
}
