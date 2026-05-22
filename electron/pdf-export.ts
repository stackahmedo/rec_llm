import { ipcMain, BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';

// --- Types ---
interface SpeakerConfig {
  id: string;
  displayName: string;
  color: string;
  enabled: boolean;
}

interface HeaderConfig {
  enabled: boolean;
  mode: 'auto' | 'custom';
  title: string;
  subtitle: string;
  showFileName: boolean;
  showDate: boolean;
  showTime: boolean;
  showLogo: boolean;
  companyName: string;
  alignment: 'left' | 'center' | 'right';
}

interface FooterConfig {
  enabled: boolean;
  mode: 'auto' | 'custom';
  text: string;
  showPageNumbers: boolean;
  showConfidential: boolean;
  showGeneratedBy: boolean;
  alignment: 'left' | 'center' | 'right';
}

interface PdfExportConfig {
  pageSize: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  margin: 'small' | 'medium' | 'large';
  fontSize: 'small' | 'medium' | 'large';
  columns: 1 | 2;
  header: HeaderConfig;
  footer: FooterConfig;
  speakerColorsEnabled: boolean;
  speakers: SpeakerConfig[];
  timeFormat: 'start' | 'start-end' | 'hidden';
  sections: {
    summary: boolean;
    keyPoints: boolean;
    actionItems: boolean;
    decisions: boolean;
    risks: boolean;
    transcript: boolean;
    appendix: boolean;
  };
}

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
  config?: PdfExportConfig;
}

// --- Utilities ---
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

function getMarginPx(margin: string): number {
  switch (margin) {
    case 'small': return 24;
    case 'large': return 56;
    default: return 40;
  }
}

function getFontSizePx(size: string): number {
  switch (size) {
    case 'small': return 9;
    case 'large': return 13;
    default: return 11;
  }
}

function getSpeakerDisplay(speakerId: string, speakers: SpeakerConfig[]): { name: string; color: string | null } {
  const profile = speakers.find((s) => s.id === speakerId);
  if (!profile || !profile.enabled) return { name: speakerId, color: null };
  return { name: profile.displayName || speakerId, color: profile.color };
}

function getAlignStyle(alignment: string): string {
  return `text-align: ${alignment};`;
}

// --- HTML Builder ---
function buildHtml(data: PdfExportData): string {
  const config = data.config || getDefaultConfig();
  const marginPx = getMarginPx(config.margin);
  const baseFontSize = getFontSizePx(config.fontSize);
  const lineHeight = 1.6;

  const sections: string[] = [];

  // --- Header ---
  if (config.header.enabled) {
    const align = getAlignStyle(config.header.alignment);
    const title = config.header.mode === 'custom' && config.header.title
      ? config.header.title
      : 'RecLLM — Transcript Report';
    const subtitle = config.header.subtitle || '';
    const metaParts: string[] = [];
    if (config.header.showFileName) metaParts.push(escapeHtml(data.fileName));
    if (config.header.companyName) metaParts.push(escapeHtml(config.header.companyName));
    if (config.header.showDate) metaParts.push(new Date().toISOString().slice(0, 10));
    if (config.header.showTime) metaParts.push(new Date().toISOString().slice(11, 16));

    sections.push(`
      <div class="header" style="${align}">
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}
        ${metaParts.length > 0 ? `<div class="header-meta">${metaParts.join(' · ')}</div>` : ''}
      </div>
    `);
  }

  // --- Metadata Grid ---
  const speakerCount = data.utterances
    ? new Set(data.utterances.map((u) => u.speaker)).size
    : 0;
  const duration = data.utterances && data.utterances.length > 0
    ? msToTimestamp(data.utterances[data.utterances.length - 1].endMs)
    : '—';

  sections.push(`
    <div class="meta-grid">
      <div class="meta-item"><span class="meta-label">File</span><span class="meta-value">${escapeHtml(data.fileName)}</span></div>
      <div class="meta-item"><span class="meta-label">Processed</span><span class="meta-value">${escapeHtml(data.processedAt.slice(0, 10))}</span></div>
      <div class="meta-item"><span class="meta-label">Language</span><span class="meta-value">${escapeHtml(data.languageCode)}</span></div>
      <div class="meta-item"><span class="meta-label">Duration</span><span class="meta-value">${duration}</span></div>
      <div class="meta-item"><span class="meta-label">Speakers</span><span class="meta-value">${speakerCount}</span></div>
      <div class="meta-item"><span class="meta-label">Segments</span><span class="meta-value">${data.utterances?.length || 0}</span></div>
    </div>
  `);

  // --- Summary ---
  if (config.sections.summary && data.summary) {
    sections.push(`
      <div class="section">
        <h2>Summary</h2>
        <p>${escapeHtml(data.summary)}</p>
      </div>
    `);
  }

  // --- Key Points ---
  if (config.sections.keyPoints && data.pointNotes && data.pointNotes.length > 0) {
    sections.push(`
      <div class="section">
        <h2>Key Points</h2>
        <ol>
          ${data.pointNotes.map((n) => `<li>${escapeHtml(n)}</li>`).join('\n')}
        </ol>
      </div>
    `);
  }

  // --- Action Items ---
  if (config.sections.actionItems && data.actionItems && data.actionItems.length > 0) {
    sections.push(`
      <div class="section">
        <h2>Action Items</h2>
        <ul>
          ${data.actionItems.map((n) => `<li>${escapeHtml(n)}</li>`).join('\n')}
        </ul>
      </div>
    `);
  }

  // --- Decisions ---
  if (config.sections.decisions && data.decisions && data.decisions.length > 0) {
    sections.push(`
      <div class="section">
        <h2>Decisions</h2>
        <ul>
          ${data.decisions.map((n) => `<li>${escapeHtml(n)}</li>`).join('\n')}
        </ul>
      </div>
    `);
  }

  // --- Risks ---
  if (config.sections.risks && data.risks && data.risks.length > 0) {
    sections.push(`
      <div class="section">
        <h2>Risks / Issues</h2>
        <ul>
          ${data.risks.map((n) => `<li>${escapeHtml(n)}</li>`).join('\n')}
        </ul>
      </div>
    `);
  }

  // --- No summary notice ---
  if (!data.summary && (!data.pointNotes || data.pointNotes.length === 0)) {
    sections.push(`
      <div class="section">
        <p class="no-data">No summary was generated for this transcript.</p>
      </div>
    `);
  }

  // --- Speaker Legend ---
  if (config.speakerColorsEnabled && data.utterances && data.utterances.length > 0) {
    const uniqueSpeakers = Array.from(new Set(data.utterances.map((u) => u.speaker)));
    const legendItems = uniqueSpeakers.map((id) => {
      const { name, color } = getSpeakerDisplay(id, config.speakers);
      const dot = color ? `<span class="speaker-dot" style="background:${color}"></span>` : '';
      return `<span class="legend-item">${dot}${escapeHtml(name)}</span>`;
    }).join('');

    sections.push(`
      <div class="section speaker-legend">
        <h2>Speakers</h2>
        <div class="legend-row">${legendItems}</div>
      </div>
    `);
  }

  // --- Transcript Table ---
  if (config.sections.transcript && data.utterances && data.utterances.length > 0) {
    const showTime = config.timeFormat !== 'hidden';
    const showEndTime = config.timeFormat === 'start-end';

    const rows = data.utterances.map((u) => {
      const { name, color } = getSpeakerDisplay(u.speaker, config.speakers);
      const speakerStyle = config.speakerColorsEnabled && color ? ` style="color:${color};font-weight:600"` : '';

      const timeCell = showTime
        ? `<td class="ts">${msToTimestamp(u.startMs)}${showEndTime ? `<br/><span class="ts-end">${msToTimestamp(u.endMs)}</span>` : ''}</td>`
        : '';

      return `
        <tr>
          ${timeCell}
          <td class="speaker"${speakerStyle}>${escapeHtml(name)}</td>
          <td class="text-cell">${escapeHtml(u.text)}</td>
        </tr>
      `;
    }).join('\n');

    const timeHeader = showTime ? '<th class="ts-header">Time</th>' : '';

    sections.push(`
      <div class="section transcript">
        <h2>Transcript${data.languageCode ? ` (${escapeHtml(data.languageCode)})` : ''}</h2>
        <table>
          <thead>
            <tr>${timeHeader}<th class="speaker-header">Speaker</th><th>Text</th></tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `);
  }

  // --- Footer ---
  const footerHtml = buildFooterHtml(config.footer);

  // --- Full HTML ---
  return `<!DOCTYPE html>
<html lang="${data.languageCode || 'en'}">
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: ${config.pageSize} ${config.orientation};
      margin: ${marginPx}px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", "Meiryo", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: ${baseFontSize}px;
      line-height: ${lineHeight};
      color: #1a1a1a;
      padding: ${marginPx}px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: ${baseFontSize + 9}px;
      color: #2563eb;
      margin-bottom: 2px;
    }
    .header .subtitle {
      font-size: ${baseFontSize + 1}px;
      color: #444;
      margin-top: 2px;
    }
    .header .header-meta {
      font-size: ${baseFontSize - 2}px;
      color: #64748b;
      margin-top: 4px;
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
    .meta-item { display: flex; flex-direction: column; }
    .meta-label {
      font-size: ${baseFontSize - 2}px;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
    }
    .meta-value {
      font-size: ${baseFontSize}px;
      font-weight: 500;
      color: #1e293b;
      word-break: break-all;
    }
    .section { margin-bottom: 16px; }
    .section h2 {
      font-size: ${baseFontSize + 2}px;
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
    .section ol, .section ul { padding-left: 20px; }
    .section li {
      margin-bottom: 4px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .no-data { color: #94a3b8; font-style: italic; }
    .speaker-legend { margin-bottom: 12px; }
    .legend-row { display: flex; flex-wrap: wrap; gap: 12px; }
    .legend-item { display: inline-flex; align-items: center; gap: 4px; font-size: ${baseFontSize - 1}px; }
    .speaker-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${baseFontSize - 1}px;
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
    th { background: #f3f4f6; font-weight: 600; }
    .ts, .ts-header { width: 70px; white-space: nowrap; font-family: monospace; }
    .ts-end { color: #94a3b8; font-size: ${baseFontSize - 2}px; }
    .speaker, .speaker-header { width: 90px; white-space: nowrap; }
    .text-cell { width: auto; }
    .transcript { page-break-before: always; }
    .footer {
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      color: #999;
      font-size: ${baseFontSize - 2}px;
    }
    ${config.columns === 2 ? `
    .section p, .section ol, .section ul {
      column-count: 2;
      column-gap: 24px;
    }` : ''}
  </style>
</head>
<body>
  ${sections.join('\n')}
  ${footerHtml}
</body>
</html>`;
}

function buildFooterHtml(footer: FooterConfig): string {
  if (!footer.enabled) return '';

  const parts: string[] = [];
  if (footer.showGeneratedBy) parts.push('Generated by RecLLM');
  if (footer.showConfidential) parts.push('CONFIDENTIAL');
  if (footer.mode === 'custom' && footer.text) parts.push(escapeHtml(footer.text));
  parts.push(new Date().toISOString().slice(0, 10));
  if (footer.showPageNumbers) parts.push('Page 1');

  const align = getAlignStyle(footer.alignment);
  return `<div class="footer" style="${align}">${parts.join(' · ')}</div>`;
}

function getDefaultConfig(): PdfExportConfig {
  return {
    pageSize: 'A4',
    orientation: 'portrait',
    margin: 'medium',
    fontSize: 'medium',
    columns: 1,
    header: {
      enabled: true, mode: 'auto', title: 'RecLLM — Transcript Report', subtitle: '',
      showFileName: true, showDate: true, showTime: false, showLogo: true, companyName: '', alignment: 'left',
    },
    footer: {
      enabled: true, mode: 'auto', text: '',
      showPageNumbers: true, showConfidential: false, showGeneratedBy: true, alignment: 'center',
    },
    speakerColorsEnabled: true,
    speakers: [],
    timeFormat: 'start',
    sections: {
      summary: true, keyPoints: true, actionItems: true,
      decisions: true, risks: true, transcript: true, appendix: true,
    },
  };
}

// --- IPC Handlers ---
export function registerPdfHandlers(): void {
  ipcMain.handle('pdf:exportReport', async (_event, data: PdfExportData): Promise<{ ok: boolean; error?: string; filePath?: string }> => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { ok: false, error: 'No active window.' };

    const config = data.config || getDefaultConfig();
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
      await new Promise((resolve) => setTimeout(resolve, 600));

      const pdfBuffer = await pdfWin.webContents.printToPDF({
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        pageSize: config.pageSize === 'Letter' ? 'Letter' : 'A4',
        landscape: config.orientation === 'landscape',
      });

      pdfWin.close();
      fs.writeFileSync(result.filePath, pdfBuffer);
      return { ok: true, filePath: result.filePath };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'PDF generation failed.';
      return { ok: false, error: msg };
    }
  });

  // Print: generate temp PDF and open system print dialog
  ipcMain.handle('pdf:print', async (_event, data: PdfExportData): Promise<{ ok: boolean; error?: string }> => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { ok: false, error: 'No active window.' };

    try {
      const html = buildHtml(data);
      const config = data.config || getDefaultConfig();

      const pdfWin = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: { offscreen: true },
      });

      await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      await new Promise((resolve) => setTimeout(resolve, 600));

      const pdfBuffer = await pdfWin.webContents.printToPDF({
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        pageSize: config.pageSize === 'Letter' ? 'Letter' : 'A4',
        landscape: config.orientation === 'landscape',
      });

      pdfWin.close();

      // Write temp file
      const tmpPath = path.join(os.tmpdir(), `recllm-print-${Date.now()}.pdf`);
      fs.writeFileSync(tmpPath, pdfBuffer);

      // Open with system default (triggers print dialog on most systems)
      const { shell } = require('electron');
      await shell.openPath(tmpPath);

      // Clean up after delay
      setTimeout(() => {
        try { fs.unlinkSync(tmpPath); } catch {}
      }, 30000);

      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Print failed.';
      return { ok: false, error: msg };
    }
  });
}
