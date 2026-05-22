// Document store — persistent editable document data

export interface DocumentData {
  fileId: string;
  title: string;
  summary: string;
  pointNotes: string[];
  actionItems: string[];
  decisions: string[];
  risks: string[];
  speakerNames: Record<string, string>;
  editedUtterances: Record<number, string>;
  lastSavedAt: string;
}

export function createEmptyDocument(fileId: string): DocumentData {
  return {
    fileId,
    title: "",
    summary: "",
    pointNotes: [],
    actionItems: [],
    decisions: [],
    risks: [],
    speakerNames: {},
    editedUtterances: {},
    lastSavedAt: "",
  };
}

export async function loadDocument(fileId: string): Promise<DocumentData | null> {
  const api = window.electronAPI?.document;
  if (!api) return null;
  const data = await api.load(fileId);
  return data as DocumentData | null;
}

export async function saveDocument(doc: DocumentData): Promise<boolean> {
  const api = window.electronAPI?.document;
  if (!api) return false;
  const updated = { ...doc, lastSavedAt: new Date().toISOString() };
  return api.save(doc.fileId, updated);
}

export async function documentExists(fileId: string): Promise<boolean> {
  const api = window.electronAPI?.document;
  if (!api) return false;
  return api.exists(fileId);
}
