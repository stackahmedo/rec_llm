import { ipcMain, BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { exportTxtSchema, exportDocxSchema, fileNameSchema, validateSchema } from './shared/schemas';

let _getStore: (() => Promise<any>) | null = null;

function setStoreAccessor(accessor: () => Promise<any>) {
  _getStore = accessor;
}

async function getExportFolder(): Promise<string | null> {
  if (!_getStore) return null;
  const store = await _getStore();
  const folder = store.get('exportFolder') as string | undefined;
  if (!folder) return null;
  // Validate the folder exists and is a directory
  try {
    const stat = fs.statSync(folder);
    if (!stat.isDirectory()) return null;
  } catch {
    return null;
  }
  return folder;
}

/**
 * Sanitize a file name to prevent path traversal in export names.
 */
function sanitizeFileName(name: string): string {
  // Remove path separators and null bytes
  return name.replace(/[/\\:\0]/g, '_').replace(/\.\./g, '_');
}

async function resolveExportPath(defaultName: string): Promise<{ filePath: string | null; cancelled: boolean }> {
  const safeName = sanitizeFileName(defaultName);
  const folder = await getExportFolder();
  if (folder) {
    const resolved = path.join(folder, safeName);
    // Ensure resolved path is still within the export folder
    if (!resolved.startsWith(folder)) {
      return { filePath: null, cancelled: true };
    }
    return { filePath: resolved, cancelled: false };
  }

  const win = BrowserWindow.getFocusedWindow();
  if (!win) return { filePath: null, cancelled: true };

  const ext = path.extname(safeName).slice(1);
  const filterName = ext === 'txt' ? 'Text' : ext === 'docx' ? 'Word Document' : ext.toUpperCase();
  const result = await dialog.showSaveDialog(win, {
    title: `Export as ${filterName}`,
    defaultPath: safeName,
    filters: [{ name: filterName, extensions: [ext] }],
  });

  if (result.canceled || !result.filePath) return { filePath: null, cancelled: true };
  return { filePath: result.filePath, cancelled: false };
}

export function registerExportHandlers(): void {
  // Lazy store accessor (same pattern as settings.ts)
  let store: any = null;
  async function getStore() {
    if (!store) {
      const { default: Store } = await import('electron-store');
      store = new Store({ name: 'recllm-settings' });
    }
    return store;
  }
  setStoreAccessor(getStore);

  // Folder picker for export location
  ipcMain.handle('export:selectFolder', async (): Promise<{ ok: boolean; path?: string }> => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { ok: false };

    const result = await dialog.showOpenDialog(win, {
      title: 'Select Export Folder',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) return { ok: false };
    return { ok: true, path: result.filePaths[0] };
  });

  // TXT export
  ipcMain.handle('export:saveTxt', async (_event, fileName: unknown, content: unknown): Promise<{ ok: boolean; error?: string; filePath?: string }> => {
    const v = validateSchema(exportTxtSchema, { fileName, content });
    if (!v.ok) return { ok: false, error: v.error };

    const defaultName = sanitizeFileName(v.data.fileName.replace(/\.[^.]+$/, '') + '_transcript.txt');
    const { filePath, cancelled } = await resolveExportPath(defaultName);

    if (cancelled || !filePath) return { ok: false, error: 'Export cancelled.' };

    try {
      fs.writeFileSync(filePath, v.data.content, 'utf-8');
      return { ok: true, filePath };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Write failed.' };
    }
  });

  // DOCX export (simple XML-based .docx)
  ipcMain.handle('export:saveDocx', async (_event, fileName: unknown, data: unknown): Promise<{ ok: boolean; error?: string; filePath?: string }> => {
    const fnV = validateSchema(fileNameSchema, fileName);
    if (!fnV.ok) return { ok: false, error: fnV.error };
    const dV = validateSchema(exportDocxSchema, data);
    if (!dV.ok) return { ok: false, error: dV.error };

    const defaultName = sanitizeFileName(fnV.data.replace(/\.[^.]+$/, '') + '_transcript.docx');
    const { filePath, cancelled } = await resolveExportPath(defaultName);

    if (cancelled || !filePath) return { ok: false, error: 'Export cancelled.' };

    try {
      const docx = buildDocx(fnV.data, dV.data);
      fs.writeFileSync(filePath, docx);
      return { ok: true, filePath };
    } catch (err: any) {
      return { ok: false, error: err.message || 'DOCX generation failed.' };
    }
  });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function msToTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function buildDocx(fileName: string, data: {
  utterances: Array<{ speaker: string; startMs: number; text: string }>;
  languageCode: string;
  summary?: string;
  pointNotes?: string[];
}): Buffer {
  // Build a flat XML WordprocessingML document (single-file .docx alternative: .xml with Word namespace)
  // For true .docx we'd need a ZIP, but Word/LibreOffice can open .xml with Word namespaces.
  // We'll use the simpler "Word 2003 XML" format which is a single file.
  const paragraphs: string[] = [];

  // Title
  paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>RecLLM — Transcript Report</w:t></w:r></w:p>`);
  paragraphs.push(`<w:p><w:r><w:t>File: ${escapeXml(fileName)} | Language: ${escapeXml(data.languageCode)}</w:t></w:r></w:p>`);
  paragraphs.push(`<w:p/>`);

  // Summary
  if (data.summary) {
    paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Summary</w:t></w:r></w:p>`);
    paragraphs.push(`<w:p><w:r><w:t>${escapeXml(data.summary)}</w:t></w:r></w:p>`);
    paragraphs.push(`<w:p/>`);
  }

  // Key Points
  if (data.pointNotes && data.pointNotes.length > 0) {
    paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Key Points</w:t></w:r></w:p>`);
    data.pointNotes.forEach((note, i) => {
      paragraphs.push(`<w:p><w:r><w:t>${i + 1}. ${escapeXml(note)}</w:t></w:r></w:p>`);
    });
    paragraphs.push(`<w:p/>`);
  }

  // Transcript
  paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Conversation</w:t></w:r></w:p>`);
  data.utterances.forEach((u) => {
    paragraphs.push(`<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>[${msToTimestamp(u.startMs)}] ${escapeXml(u.speaker)}:</w:t></w:r><w:r><w:t xml:space="preserve"> ${escapeXml(u.text)}</w:t></w:r></w:p>`);
  });

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml"
  xmlns:wx="http://schemas.microsoft.com/office/word/2003/auxHint">
<w:body>
${paragraphs.join('\n')}
</w:body>
</w:wordDocument>`;

  return Buffer.from(xml, 'utf-8');
}
