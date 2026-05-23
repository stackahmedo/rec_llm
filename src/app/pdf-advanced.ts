/**
 * Advanced PDF Features — combine, redact, forms, OCR, watermarks, signatures, comments, review.
 */

// --- Combine PDFs ---
export interface CombineJob {
  id: string;
  files: { id: string; name: string; pageCount: number; order: number }[];
  status: "pending" | "processing" | "done" | "failed";
  outputPath?: string;
  error?: string;
}

export function createCombineJob(files: { id: string; name: string; pageCount: number }[]): CombineJob {
  return {
    id: `combine_${Date.now()}`,
    files: files.map((f, i) => ({ ...f, order: i })),
    status: "pending",
  };
}

export function reorderCombineFiles(job: CombineJob, fromIdx: number, toIdx: number): CombineJob {
  const files = [...job.files];
  const [moved] = files.splice(fromIdx, 1);
  files.splice(toIdx, 0, moved);
  return { ...job, files: files.map((f, i) => ({ ...f, order: i })) };
}

// --- Redaction ---
export interface RedactionMark {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  reason?: string;
  pattern?: RedactionPattern;
  applied: boolean;
}

export type RedactionPattern = "manual" | "email" | "phone" | "ssn" | "name" | "address" | "custom";

export const redactionPatterns: { id: RedactionPattern; label: string; regex?: string }[] = [
  { id: "manual", label: "Manual Selection" },
  { id: "email", label: "Email Addresses", regex: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" },
  { id: "phone", label: "Phone Numbers", regex: "\\+?[\\d\\s\\-().]{7,15}" },
  { id: "ssn", label: "SSN / ID Numbers", regex: "\\d{3}-\\d{2}-\\d{4}" },
  { id: "name", label: "Person Names" },
  { id: "address", label: "Addresses" },
  { id: "custom", label: "Custom Pattern" },
];

export function findRedactionTargets(text: string, pattern: RedactionPattern, customRegex?: string): { start: number; end: number; match: string }[] {
  const patternDef = redactionPatterns.find((p) => p.id === pattern);
  const regexStr = pattern === "custom" ? customRegex : patternDef?.regex;
  if (!regexStr) return [];
  try {
    const regex = new RegExp(regexStr, "g");
    const matches: { start: number; end: number; match: string }[] = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, match: m[0] });
    }
    return matches;
  } catch { return []; }
}

// --- Form Builder ---
export type FormFieldType = "text" | "checkbox" | "radio" | "dropdown" | "signature" | "date" | "number";

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  placeholder?: string;
  options?: string[]; // for radio/dropdown
  value?: string;
  validation?: string;
}

export function createFormField(type: FormFieldType, page: number, x: number, y: number): FormField {
  const defaults: Record<FormFieldType, Partial<FormField>> = {
    text: { width: 200, height: 24, placeholder: "Enter text..." },
    checkbox: { width: 16, height: 16 },
    radio: { width: 16, height: 16, options: ["Option 1", "Option 2"] },
    dropdown: { width: 200, height: 24, options: ["Select...", "Option 1", "Option 2"] },
    signature: { width: 200, height: 60, placeholder: "Sign here" },
    date: { width: 140, height: 24, placeholder: "YYYY-MM-DD" },
    number: { width: 100, height: 24, placeholder: "0" },
  };
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
    page,
    x,
    y,
    required: false,
    ...defaults[type],
  } as FormField;
}

// --- OCR Layer ---
export interface OcrResult {
  pages: OcrPage[];
  language: string;
  confidence: number;
  processedAt: number;
}

export interface OcrPage {
  pageNumber: number;
  text: string;
  blocks: OcrBlock[];
}

export interface OcrBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

// --- Watermarks ---
export type WatermarkType = "text" | "image" | "pattern";
export type WatermarkPosition = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "diagonal";

export interface WatermarkConfig {
  enabled: boolean;
  type: WatermarkType;
  text?: string;
  imageUrl?: string;
  position: WatermarkPosition;
  opacity: number;
  rotation: number;
  fontSize: number;
  color: string;
  pages: "all" | "first" | "last" | "odd" | "even" | number[];
}

export const defaultWatermark: WatermarkConfig = {
  enabled: false,
  type: "text",
  text: "CONFIDENTIAL",
  position: "diagonal",
  opacity: 0.15,
  rotation: -45,
  fontSize: 48,
  color: "#000000",
  pages: "all",
};

export const watermarkPresets: { id: string; label: string; config: Partial<WatermarkConfig> }[] = [
  { id: "confidential", label: "Confidential", config: { text: "CONFIDENTIAL", position: "diagonal", opacity: 0.12, rotation: -45 } },
  { id: "draft", label: "Draft", config: { text: "DRAFT", position: "diagonal", opacity: 0.2, rotation: -45, color: "#FF0000" } },
  { id: "internal", label: "Internal Only", config: { text: "INTERNAL", position: "center", opacity: 0.1, rotation: 0 } },
  { id: "copy", label: "Copy", config: { text: "COPY", position: "top-right", opacity: 0.3, rotation: 0, fontSize: 24 } },
  { id: "approved", label: "Approved", config: { text: "APPROVED", position: "bottom-right", opacity: 0.25, rotation: 0, fontSize: 20, color: "#22C55E" } },
];

// --- Digital Signatures ---
export interface DigitalSignature {
  id: string;
  signerName: string;
  signerEmail?: string;
  signedAt?: number;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  status: "pending" | "signed" | "rejected" | "expired";
  reason?: string;
  certificate?: string;
  visualType: "drawn" | "typed" | "image" | "certificate";
}

export function createSignatureField(page: number, x: number, y: number, signerName: string): DigitalSignature {
  return {
    id: `sig_${Date.now()}`,
    signerName,
    page,
    x,
    y,
    width: 200,
    height: 60,
    status: "pending",
    visualType: "typed",
  };
}

// --- Comment Threads ---
export interface CommentThread {
  id: string;
  page: number;
  x: number;
  y: number;
  segmentIndex?: number;
  resolved: boolean;
  comments: Comment[];
  createdAt: number;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  editedAt?: number;
}

export function createThread(page: number, x: number, y: number, author: string, text: string): CommentThread {
  return {
    id: `thread_${Date.now()}`,
    page,
    x,
    y,
    resolved: false,
    comments: [{
      id: `comment_${Date.now()}`,
      author,
      text,
      createdAt: Date.now(),
    }],
    createdAt: Date.now(),
  };
}

export function addReply(thread: CommentThread, author: string, text: string): CommentThread {
  return {
    ...thread,
    comments: [...thread.comments, {
      id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      author,
      text,
      createdAt: Date.now(),
    }],
  };
}

// --- Review Mode ---
export type ReviewStatus = "draft" | "in-review" | "approved" | "rejected" | "changes-requested";

export interface ReviewState {
  status: ReviewStatus;
  reviewers: Reviewer[];
  currentRound: number;
  history: ReviewEvent[];
}

export interface Reviewer {
  name: string;
  email?: string;
  role: "reviewer" | "approver" | "observer";
  decision?: "approved" | "rejected" | "changes-requested";
  decidedAt?: number;
}

export interface ReviewEvent {
  type: "status_change" | "comment" | "decision" | "revision";
  actor: string;
  timestamp: number;
  detail: string;
}

export function createReviewState(): ReviewState {
  return {
    status: "draft",
    reviewers: [],
    currentRound: 1,
    history: [{
      type: "status_change",
      actor: "System",
      timestamp: Date.now(),
      detail: "Document created as draft",
    }],
  };
}

export function submitForReview(state: ReviewState, reviewers: Reviewer[]): ReviewState {
  return {
    ...state,
    status: "in-review",
    reviewers,
    history: [...state.history, {
      type: "status_change",
      actor: "Author",
      timestamp: Date.now(),
      detail: `Submitted for review (round ${state.currentRound})`,
    }],
  };
}

export function recordDecision(state: ReviewState, reviewerName: string, decision: "approved" | "rejected" | "changes-requested"): ReviewState {
  const reviewers = state.reviewers.map((r) =>
    r.name === reviewerName ? { ...r, decision, decidedAt: Date.now() } : r
  );
  const allDecided = reviewers.filter((r) => r.role !== "observer").every((r) => r.decision);
  const allApproved = reviewers.filter((r) => r.role === "approver").every((r) => r.decision === "approved");
  const anyRejected = reviewers.some((r) => r.decision === "rejected");

  let status: ReviewStatus = state.status;
  if (allDecided) {
    if (allApproved) status = "approved";
    else if (anyRejected) status = "rejected";
    else status = "changes-requested";
  }

  return {
    ...state,
    status,
    reviewers,
    history: [...state.history, {
      type: "decision",
      actor: reviewerName,
      timestamp: Date.now(),
      detail: `${decision} (round ${state.currentRound})`,
    }],
  };
}

// --- Split View Modes ---
export type SplitMode = "none" | "source" | "compare" | "comments";

// --- Multi-document Tab State ---
export interface DocumentTab {
  id: string;
  fileId: string;
  fileName: string;
  dirty: boolean;
  scrollPosition: number;
  zoom: number;
}
