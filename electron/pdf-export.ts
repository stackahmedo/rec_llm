import { ipcMain, BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import path from 'path';

interface PdfExportData {
  fileName: string;
  processedAt: string;
  languageCode: string;
  summary?: string;
  pointNotes?: string[];
  actionItems?: string[];
  decisions?: string[];
  risks?: string[];
  utterances?: Array<{ speaker: string; startMs: number; endMs: number; text: string }>;
}

function msToTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(data: PdfExportData): string {
  const sections: string[] = [];

  // Metadata block
  const speakerCount = data.utterances
    ? new Set(data.utterances.map((u) => u.speaker)).size
    : 0;
  const duration = data.utterances && data.utterances.length > 0
    ? msToTimestamp(data.utterances[data.utterances.length - 1].endMs)
    : '—';

  sections.push(`
    <div class="meta-grid">
      <div class="meta-item"><span class="meta-label">File</span><span class="meta-value">${escapeHtml(data.fileName)}</span></div>
      <div class="meta-item"><span class="meta-label">Processed</span><span class="meta-value">${escapeHtml(data.processedAt)}</span></div>
      <div class="meta-item"><span class="meta-label">Language</span><span class="meta-value">${escapeHtml(data.languageCode)}</span></div>
      <div class="meta-item"><span class="meta-label">Duration</span><span class="meta-value">${duration}</span></div>
      <div class="meta-item"><span class="meta-label">Speakers</span><span class="meta-value">${speakerCount}</span></div>
      <div class="meta-item"><span class="meta-label">Utterances</span><span class="meta-value">${data.utterances?.length || 0}</span></div>
    </div>
  `);

  // Summary
  if (data.summary) {
    sections.push(`
      <div class="section">
        <h2>Summary</h2>
        <p>${escapeHtml(data.summary)}</p>
      </div>
    `);
  }

  // Point Notes
  if (data.pointNotes && data.pointNotes.length > 0) {
    sections.push(`
      <div class="section">
        <h2>Key Points</h2>
        <ol>
          ${data.pointNotes.map((n) => `<li>${escapeHtml(n)}</li>`).join('\n')}
        </ol>
      </div>
    `);
  }

  // Action Items
  if (data.actionItems && data.actionItems.length > 0) {
    sections.push(`
      <div class="section">
        <h2>Action Items</h2>
        <ul>
          ${data.actionItems.map((n) => `<li>${escapeHtml(n)}</li>`).join('\n')}
        </ul>
      </div>
    `);
  }

  // Decisions
  if (data.decisions && data.decisions.length > 0) {
    sections.push(`
      <div class="section">
        <h2>Decisions</h2>
        <ul>
          ${data.decisions.map((n) => `<li>${escapeHtml(n)}</li>`).join('\n')}
        </ul>
      </div>
    `);
  }

  // Risks
  if (data.risks && data.risks.length > 0) {
    sections.push(`
      <div class="section">
        <h2>Risks / Issues</h2>
        <ul>
          ${data.risks.map((n) => `<li>${escapeHtml(n)}</li>`).join('\n')}
        </ul>
      </div>
    `);
  }

  // No summary notice
  if (!data.summary && (!data.pointNotes || data.pointNotes.length === 0)) {
    sections.push(`
      <div class="section">
        <p class="no-data">No summary was generated for this transcript. Use the Summarize feature to add one.</p>
      </div>
    `);
  }

  // Transcript appendix
  if (data.utterances && data.utterances.length > 0) {
    const rows = data.utterances.map((u) => `
      <tr>
        <td class="ts">${msToTimestamp(u.startMs)}</td>
        <td class="speaker">${escapeHtml(u.speaker)}</td>
        <td class="text-cell">${escapeHtml(u.text)}</td>
      </tr>
    `).join('\n');

    sections.push(`
      <div class="section transcript">
        <h2>Transcript Appendix (${escapeHtml(data.languageCode)})</h2>
        <table>
          <thead>
            <tr><th>Time</th><th>Speaker</th><th>Text</th></tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `);
  }

  return `<!DOCTYPE html>
<html lang="${data.languageCode}">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", "Meiryo", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11px;
      line-height: 1.6;
      color: #1a1a1a;
      padding: 40px;
    }
    .header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 20px;
      color: #2563eb;
      margin-bottom: 2px;
    }
    .header .subtitle {
      font-size: 12px;
      color: #444;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 20px;
      padding: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 9px;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
    }
    .meta-value {
      font-size: 11px;
      font-weight: 500;
      color: #1e293b;
      word-break: break-all;
    }
    .section {
      margin-bottom: 16px;
    }
    .section h2 {
      font-size: 13px;
      color: #2563eb;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .section p {
      margin-bottom: 8px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .section ol, .section ul {
      padding-left: 20px;
    }
    .section li {
      margin-bottom: 4px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .no-data {
      color: #94a3b8;
      font-style: italic;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 4px 8px;
      text-align: left;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
    }
    .ts { width: 60px; white-space: nowrap; font-family: monospace; }
    .speaker { width: 70px; white-space: nowrap; font-weight: 500; }
    .text-cell { width: auto; }
    .transcript { page-break-before: always; }
    .footer {
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      color: #999;
      font-size: 9px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>RecLLM — Transcript Report</h1>
    <div class="subtitle">${escapeHtml(data.fileName)}</div>
  </div>

  ${sections.join('\n')}

  <div class="footer">
    Generated by RecLLM · ${new Date().toISOString().slice(0, 10)}
  </div>
</body>
</html>`;
}

export function registerPdfHandlers(): void {
  ipcMain.handle('pdf:exportReport', async (_event, data: PdfExportData): Promise<{ ok: boolean; error?: string; filePath?: string }> => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { ok: false, error: 'No active window.' };

    const defaultName = data.fileName.replace(/\.[^.]+$/, '') + '_report.pdf';

    const result = await dialog.showSaveDialog(win, {
      title: 'Export PDF Report',
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, error: 'Export cancelled.' };
    }

    try {
      const html = buildHtml(data);

      const pdfWin = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: { offscreen: true },
      });

      await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      // Wait for content to render
      await new Promise((resolve) => setTimeout(resolve, 500));

      const pdfBuffer = await pdfWin.webContents.printToPDF({
        printBackground: true,
        margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
        pageSize: 'A4',
      });

      pdfWin.close();

      fs.writeFileSync(result.filePath, pdfBuffer);
      return { ok: true, filePath: result.filePath };
    } catch (err: any) {
      return { ok: false, error: err.message || 'PDF generation failed.' };
    }
  });
}
