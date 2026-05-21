import { ipcMain, BrowserWindow, dialog } from 'electron';
import fs from 'fs';

export function registerExportHandlers(): void {
  // TXT export
  ipcMain.handle('export:saveTxt', async (_event, fileName: string, content: string): Promise<{ ok: boolean; error?: string; filePath?: string }> => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { ok: false, error: 'No active window.' };

    const defaultName = fileName.replace(/\.[^.]+$/, '') + '_transcript.txt';
    const result = await dialog.showSaveDialog(win, {
      title: 'Export as Text',
      defaultPath: defaultName,
      filters: [{ name: 'Text', extensions: ['txt'] }],
    });

    if (result.canceled || !result.filePath) return { ok: false, error: 'Export cancelled.' };

    try {
      fs.writeFileSync(result.filePath, content, 'utf-8');
      return { ok: true, filePath: result.filePath };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Write failed.' };
    }
  });

  // DOCX export (simple XML-based .docx)
  ipcMain.handle('export:saveDocx', async (_event, fileName: string, data: {
    utterances: Array<{ speaker: string; startMs: number; text: string }>;
    languageCode: string;
    summary?: string;
    pointNotes?: string[];
  }): Promise<{ ok: boolean; error?: string; filePath?: string }> => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { ok: false, error: 'No active window.' };

    const defaultName = fileName.replace(/\.[^.]+$/, '') + '_transcript.docx';
    const result = await dialog.showSaveDialog(win, {
      title: 'Export as Document',
      defaultPath: defaultName,
      filters: [{ name: 'Word Document', extensions: ['docx'] }],
    });

    if (result.canceled || !result.filePath) return { ok: false, error: 'Export cancelled.' };

    try {
      const docx = buildDocx(fileName, data);
      fs.writeFileSync(result.filePath, docx);
      return { ok: true, filePath: result.filePath };
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
