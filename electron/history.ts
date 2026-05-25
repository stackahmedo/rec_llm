import { ipcMain, app } from 'electron';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { historyJobSchema, idSchema, documentIdSchema, validateSchema } from './shared/schemas';
import { getDb } from './database';

const DATA_DIR = path.join(app.getPath('userData'), 'recllm-data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const TRANSCRIPTS_DIR = path.join(DATA_DIR, 'transcripts');
const SUMMARIES_DIR = path.join(DATA_DIR, 'summaries');
const LOG_FILE = path.join(DATA_DIR, 'processing.log');

// --- Processing Log ---

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB max log size

async function ensureLogFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const stat = await fs.stat(LOG_FILE);
    // Rotate if too large
    if (stat.size > MAX_LOG_SIZE) {
      const backupPath = LOG_FILE + '.old';
      try { await fs.unlink(backupPath); } catch {}
      await fs.rename(LOG_FILE, backupPath);
    }
  } catch {
    // File doesn't exist yet — fine
  }
}

export async function writeLog(level: 'INFO' | 'WARN' | 'ERROR', message: string, detail?: string): Promise<void> {
  try {
    await ensureLogFile();
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${message}${detail ? ' | ' + detail : ''}\n`;
    await fs.appendFile(LOG_FILE, line, 'utf-8');
  } catch {
    // Logging should never crash the app
  }
}
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents');

// Sanitize IDs to prevent path traversal — allow only alphanumeric, dash, underscore, dot
function sanitizeId(id: string): string {
  const sanitized = id.replace(/[^a-zA-Z0-9_\-\.]/g, '');
  if (!sanitized || sanitized.startsWith('.')) {
    throw new Error(`Invalid ID: "${id}"`);
  }
  return sanitized;
}

interface HistoryMeta {
  id: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  status: 'done' | 'failed';
  languageCode: string;
  speakerCount: number;
  createdAt: string;
  completedAt: string;
  pdfPath?: string;
  // Extended metadata fields
  originalFileName?: string;
  generatedFileName?: string;
  displayName?: string;
  fileExtension?: string;
  duration?: number;
  sourcePath?: string;
  storagePath?: string;
  transcriptId?: string;
  jobId?: string;
  uploadedAt?: string;
  processedAt?: string;
}

interface TranscriptData {
  fullText: string;
  utterances: Array<{ speaker: string; startMs: number; endMs: number; text: string; gender?: string; ageRange?: string; pitchHz?: number }>;
}

interface SummaryData {
  language: string;
  summary: string;
  pointNotes: string[];
  actionItems: string[];
  decisions: string[];
  risks: string[];
  generatedAt: string;
}

interface HistoryJob extends HistoryMeta {
  transcript?: TranscriptData;
  summary?: SummaryData;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readHistoryMeta(): Promise<HistoryMeta[]> {
  await ensureDir(DATA_DIR);
  try {
    const raw = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(raw) as HistoryMeta[];
  } catch {
    return [];
  }
}

async function writeHistoryMeta(jobs: HistoryMeta[]): Promise<void> {
  await ensureDir(DATA_DIR);
  await fs.writeFile(HISTORY_FILE, JSON.stringify(jobs, null, 2), 'utf-8');
}

function transcriptPath(id: string): string {
  const safeId = sanitizeId(id);
  return path.join(TRANSCRIPTS_DIR, `${safeId}.json`);
}

function summaryPath(id: string): string {
  const safeId = sanitizeId(id);
  return path.join(SUMMARIES_DIR, `${safeId}.json`);
}

async function readTranscript(id: string): Promise<TranscriptData | undefined> {
  const p = transcriptPath(id);
  try {
    const raw = await fs.readFile(p, 'utf-8');
    return JSON.parse(raw) as TranscriptData;
  } catch {
    return undefined;
  }
}

async function readSummary(id: string): Promise<SummaryData | undefined> {
  const p = summaryPath(id);
  try {
    const raw = await fs.readFile(p, 'utf-8');
    return JSON.parse(raw) as SummaryData;
  } catch {
    return undefined;
  }
}

async function writeTranscript(id: string, data: TranscriptData): Promise<void> {
  await ensureDir(TRANSCRIPTS_DIR);
  await fs.writeFile(transcriptPath(id), JSON.stringify(data), 'utf-8');
  await writeTranscriptTxt(id, data);
}

async function writeTranscriptTxt(id: string, data: TranscriptData): Promise<void> {
  await ensureDir(TRANSCRIPTS_DIR);
  const safeId = sanitizeId(id);
  const txtPath = path.join(TRANSCRIPTS_DIR, `${safeId}.txt`);
  const lines = data.utterances.map((u) => {
    const ts = msToTimestamp(u.startMs);
    return `[${ts}] ${u.speaker}: ${u.text}`;
  });
  await fs.writeFile(txtPath, lines.join('\n'), 'utf-8');
}

function msToTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Generate a filesystem-safe name with date/time prefix.
 * Format: YYYYMMDD_HHMMSS_sanitized-original-name.ext
 * Does NOT rename the user's source file — only for internal/export naming.
 */
function generateFileName(originalName: string, date?: Date): string {
  const d = date || new Date();
  const prefix = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;

  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);

  // Sanitize: replace spaces with hyphens, remove unsafe chars, collapse multiple hyphens
  const sanitized = base
    .replace(/\s+/g, '-')
    .replace(/[^\w\-　-鿿豈-﫿]/g, '') // keep alphanumeric, hyphens, CJK
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    || 'audio';

  return `${prefix}_${sanitized}${ext.toLowerCase()}`;
}

/**
 * Ensure uniqueness by appending _2, _3, etc. if name already exists in the list.
 */
function ensureUniqueName(name: string, existingNames: string[]): string {
  if (!existingNames.includes(name)) return name;
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let counter = 2;
  while (existingNames.includes(`${base}_${counter}${ext}`)) {
    counter++;
  }
  return `${base}_${counter}${ext}`;
}

async function writeSummary(id: string, data: SummaryData): Promise<void> {
  await ensureDir(SUMMARIES_DIR);
  await fs.writeFile(summaryPath(id), JSON.stringify(data), 'utf-8');
}

export function registerHistoryHandlers(): void {
  ipcMain.handle('history:load', async (): Promise<HistoryJob[]> => {
    const metas = await readHistoryMeta();
    // Migration: backfill metadata for old entries that lack generatedFileName
    let needsWrite = false;
    const existingNames = metas.map((m) => m.generatedFileName || '').filter(Boolean);
    for (const meta of metas) {
      if (!meta.originalFileName) {
        meta.originalFileName = meta.fileName;
        needsWrite = true;
      }
      if (!meta.generatedFileName) {
        const generated = generateFileName(meta.originalFileName || meta.fileName, new Date(meta.completedAt || meta.createdAt));
        meta.generatedFileName = ensureUniqueName(generated, existingNames);
        existingNames.push(meta.generatedFileName);
        needsWrite = true;
      }
      if (!meta.displayName) {
        meta.displayName = meta.generatedFileName;
        needsWrite = true;
      }
      if (!meta.fileExtension) {
        meta.fileExtension = path.extname(meta.fileName).slice(1).toLowerCase();
        needsWrite = true;
      }
      if (!meta.uploadedAt) { meta.uploadedAt = meta.createdAt; needsWrite = true; }
      if (!meta.processedAt) { meta.processedAt = meta.completedAt; needsWrite = true; }
      if (!meta.sourcePath && meta.filePath) { meta.sourcePath = meta.filePath; needsWrite = true; }
      if (!meta.jobId) { meta.jobId = meta.id; needsWrite = true; }
      if (!meta.transcriptId) { meta.transcriptId = meta.id; needsWrite = true; }
    }
    if (needsWrite) {
      await writeHistoryMeta(metas);
    }
    return metas.map((meta) => ({ ...meta }));
  });

  ipcMain.handle('history:loadTranscript', async (_event, id: unknown): Promise<{ transcript?: TranscriptData; summary?: SummaryData } | null> => {
    const v = validateSchema(idSchema, id);
    if (!v.ok) return null;
    try {
      const safeId = sanitizeId(v.data);
      const transcript = await readTranscript(safeId);
      const summary = await readSummary(safeId);
      if (!transcript && !summary) return null;
      return { transcript, summary };
    } catch {
      return null;
    }
  });

  ipcMain.handle('history:save', async (_event, job: unknown): Promise<boolean> => {
    const v = validateSchema(historyJobSchema, job);
    if (!v.ok) return false;
    try {
      const safeId = sanitizeId(v.data.id);
      const metas = await readHistoryMeta();
      const { transcript, summary, ...meta } = v.data;
      meta.id = safeId;

      await writeLog('INFO', `Job saved: ${meta.fileName}`, `id=${safeId} status=${meta.status}`);

      // Populate metadata fields if not already set
      if (!meta.originalFileName) {
        meta.originalFileName = meta.fileName;
      }
      if (!meta.generatedFileName) {
        const existingNames = metas.map((m) => m.generatedFileName || '').filter(Boolean);
        const generated = generateFileName(meta.originalFileName || meta.fileName, new Date(meta.completedAt || meta.createdAt));
        meta.generatedFileName = ensureUniqueName(generated, existingNames);
      }
      if (!meta.displayName) {
        meta.displayName = meta.generatedFileName;
      }
      if (!meta.fileExtension) {
        meta.fileExtension = path.extname(meta.fileName).slice(1).toLowerCase();
      }
      if (!meta.uploadedAt) {
        meta.uploadedAt = meta.createdAt;
      }
      if (!meta.processedAt) {
        meta.processedAt = meta.completedAt;
      }
      if (!meta.sourcePath && meta.filePath) {
        meta.sourcePath = meta.filePath;
      }
      if (!meta.jobId) {
        meta.jobId = safeId;
      }
      if (!meta.transcriptId) {
        meta.transcriptId = safeId;
      }

      const idx = metas.findIndex((j) => j.id === safeId);
      if (idx >= 0) {
        metas[idx] = meta;
      } else {
        metas.unshift(meta);
      }
      await writeHistoryMeta(metas);

      if (transcript) {
        await writeTranscript(safeId, transcript);
      }
      if (summary) {
        await writeSummary(safeId, summary);
      }

      // Dual-write to SQLite (primary going forward)
      try {
        const db = getDb();
        const insertRec = db.prepare(`
          INSERT OR REPLACE INTO recordings (id, file_name, original_file_name, generated_file_name, file_path, file_extension, size_bytes, duration_seconds, status, language_code, speaker_count, created_at, completed_at, uploaded_at, processed_at, pdf_path)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertRec.run(
          safeId, meta.fileName, meta.originalFileName || null, meta.generatedFileName || null,
          meta.filePath, meta.fileExtension || null, meta.sizeBytes || 0, meta.duration || null,
          meta.status, meta.languageCode || 'auto', meta.speakerCount || 0,
          meta.createdAt, meta.completedAt, meta.uploadedAt || null, meta.processedAt || null, meta.pdfPath || null
        );

        if (transcript && transcript.utterances) {
          const insertUtt = db.prepare(`
            INSERT INTO utterances (recording_id, speaker, text, start_ms, end_ms, confidence, gender, age_range, pitch_hz)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          const insertMany = db.transaction((utts: any[]) => {
            for (const u of utts) {
              insertUtt.run(safeId, u.speaker, u.text, u.startMs, u.endMs, 1.0, u.gender || null, u.ageRange || null, u.pitchHz || null);
            }
          });
          insertMany(transcript.utterances);
        }

        if (summary) {
          const insertSum = db.prepare(`
            INSERT OR REPLACE INTO summaries (recording_id, language, summary, point_notes, action_items, decisions, risks, generated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          insertSum.run(
            safeId, summary.language || 'ja', summary.summary || '',
            JSON.stringify(summary.pointNotes || []),
            JSON.stringify(summary.actionItems || []),
            JSON.stringify(summary.decisions || []),
            JSON.stringify(summary.risks || []),
            summary.generatedAt || new Date().toISOString()
          );
        }
      } catch (dbErr) {
        // SQLite write failure is non-critical — JSON is the fallback
        console.warn('[database] dual-write failed:', dbErr instanceof Error ? dbErr.message : dbErr);
      }

      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('history:delete', async (_event, id: unknown): Promise<boolean> => {
    const v = validateSchema(idSchema, id);
    if (!v.ok) return false;
    try {
      const safeId = sanitizeId(v.data);
      const metas = await readHistoryMeta();
      const filtered = metas.filter((j) => j.id !== safeId);
      await writeHistoryMeta(filtered);

      const tp = transcriptPath(safeId);
      const sp = summaryPath(safeId);
      await fs.unlink(tp).catch(() => {});
      await fs.unlink(sp).catch(() => {});

      // Also delete from SQLite
      try {
        const db = getDb();
        db.prepare('DELETE FROM recordings WHERE id = ?').run(safeId);
      } catch {}

      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('history:clear', async (): Promise<boolean> => {
    await writeHistoryMeta([]);
    try {
      const transcriptFiles = await fs.readdir(TRANSCRIPTS_DIR);
      for (const f of transcriptFiles) {
        await fs.unlink(path.join(TRANSCRIPTS_DIR, f));
      }
    } catch {}
    try {
      const summaryFiles = await fs.readdir(SUMMARIES_DIR);
      for (const f of summaryFiles) {
        await fs.unlink(path.join(SUMMARIES_DIR, f));
      }
    } catch {}
    return true;
  });

  // --- Full-text search across all stored transcripts ---
  ipcMain.handle('history:search', async (_event, query: unknown, filters?: unknown): Promise<{
    ok: boolean;
    results: Array<{
      fileId: string;
      fileName: string;
      matchedText: string;
      matchField: string;
      speaker?: string;
      timestamp?: string;
      date?: string;
      language?: string;
    }>;
  }> => {
    if (typeof query !== 'string' || !query.trim()) return { ok: true, results: [] };
    const q = query.trim().toLowerCase();
    const filterData = (filters && typeof filters === 'object') ? filters as Record<string, string> : {};

    const results: Array<{
      fileId: string;
      fileName: string;
      matchedText: string;
      matchField: string;
      speaker?: string;
      timestamp?: string;
      date?: string;
      language?: string;
    }> = [];

    // Try FTS5 search first (fast path)
    try {
      const db = getDb();
      const recCount = (db.prepare('SELECT COUNT(*) as cnt FROM recordings').get() as any)?.cnt || 0;
      if (recCount > 0) {
        const safeQuery = q.replace(/['"*()]/g, '').trim();
        if (safeQuery) {
          const ftsResults = db.prepare(`
            SELECT si.recording_id, si.file_name, si.speaker, si.text,
                   r.completed_at, r.language_code,
                   u.start_ms
            FROM search_index si
            JOIN recordings r ON r.id = si.recording_id
            LEFT JOIN utterances u ON u.recording_id = si.recording_id AND u.text = si.text
            WHERE search_index MATCH ?
            ORDER BY rank
            LIMIT 100
          `).all(`"${safeQuery}"`) as any[];

          for (const row of ftsResults) {
            if (filterData.dateFrom && row.completed_at && row.completed_at < filterData.dateFrom) continue;
            if (filterData.dateTo && row.completed_at && row.completed_at > filterData.dateTo + 'T23:59:59') continue;
            if (filterData.language && row.language_code && row.language_code !== filterData.language) continue;
            if (filterData.speaker && row.speaker && !row.speaker.toLowerCase().includes(filterData.speaker.toLowerCase())) continue;

            const idx = row.text.toLowerCase().indexOf(q);
            const start = Math.max(0, idx - 40);
            const end = Math.min(row.text.length, idx + q.length + 40);
            let snippet = row.text.slice(start, end);
            if (start > 0) snippet = '...' + snippet;
            if (end < row.text.length) snippet += '...';

            results.push({
              fileId: row.recording_id,
              fileName: row.file_name || row.recording_id,
              matchedText: snippet,
              matchField: 'Transcript',
              speaker: row.speaker,
              timestamp: row.start_ms ? msToTimestamp(row.start_ms) : undefined,
              date: row.completed_at,
              language: row.language_code,
            });
          }

          if (results.length > 0) return { ok: true, results };
        }
      }
    } catch {
      // FTS5 failed — fall through to file-based search
    }

    try {
      const metas = await readHistoryMeta();
      const MAX_RESULTS = 100;

      for (const meta of metas) {
        if (results.length >= MAX_RESULTS) break;

        // Apply date filter
        if (filterData.dateFrom && meta.completedAt && meta.completedAt < filterData.dateFrom) continue;
        if (filterData.dateTo && meta.completedAt && meta.completedAt > filterData.dateTo + 'T23:59:59') continue;
        if (filterData.language && meta.languageCode && meta.languageCode !== filterData.language) continue;

        // Match file name
        if (meta.fileName?.toLowerCase().includes(q)) {
          results.push({
            fileId: meta.id,
            fileName: meta.fileName,
            matchedText: meta.fileName,
            matchField: 'File name',
            date: meta.completedAt,
            language: meta.languageCode,
          });
        }

        // Search transcript file on disk
        const transcript = await readTranscript(meta.id);
        if (!transcript) continue;

        let fileMatches = 0;
        for (const u of transcript.utterances || []) {
          if (fileMatches >= 5) break; // Max 5 matches per file
          if (results.length >= MAX_RESULTS) break;

          // Speaker filter
          if (filterData.speaker && !u.speaker.toLowerCase().includes(filterData.speaker.toLowerCase())) continue;

          if (u.text.toLowerCase().includes(q)) {
            const idx = u.text.toLowerCase().indexOf(q);
            const start = Math.max(0, idx - 40);
            const end = Math.min(u.text.length, idx + q.length + 40);
            let snippet = u.text.slice(start, end);
            if (start > 0) snippet = '...' + snippet;
            if (end < u.text.length) snippet += '...';

            results.push({
              fileId: meta.id,
              fileName: meta.fileName || meta.id,
              matchedText: snippet,
              matchField: 'Transcript',
              speaker: u.speaker,
              timestamp: msToTimestamp(u.startMs),
              date: meta.completedAt,
              language: meta.languageCode,
            });
            fileMatches++;
          }
        }

        // Search summary
        const summary = await readSummary(meta.id);
        if (summary && results.length < MAX_RESULTS) {
          const summaryTexts = [
            summary.summary,
            ...(summary.pointNotes || []),
            ...(summary.actionItems || []),
            ...(summary.decisions || []),
            ...(summary.risks || []),
          ];
          for (const text of summaryTexts) {
            if (!text) continue;
            if (text.toLowerCase().includes(q)) {
              const idx = text.toLowerCase().indexOf(q);
              const start = Math.max(0, idx - 40);
              const end = Math.min(text.length, idx + q.length + 40);
              let snippet = text.slice(start, end);
              if (start > 0) snippet = '...' + snippet;
              if (end < text.length) snippet += '...';

              results.push({
                fileId: meta.id,
                fileName: meta.fileName || meta.id,
                matchedText: snippet,
                matchField: 'Summary',
                date: summary.generatedAt,
                language: summary.language,
              });
              break; // One summary match per file
            }
          }
        }
      }

      return { ok: true, results };
    } catch {
      return { ok: true, results: [] };
    }
  });

  // --- Document edit persistence ---
  ipcMain.handle('document:save', async (_event, fileId: unknown, data: unknown): Promise<boolean> => {
    const v = validateSchema(documentIdSchema, fileId);
    if (!v.ok) return false;
    try {
      const safeId = sanitizeId(v.data);
      await ensureDir(DOCUMENTS_DIR);
      const docPath = path.join(DOCUMENTS_DIR, `${safeId}.json`);
      await fs.writeFile(docPath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('document:load', async (_event, fileId: unknown): Promise<unknown | null> => {
    const v = validateSchema(documentIdSchema, fileId);
    if (!v.ok) return null;
    try {
      const safeId = sanitizeId(v.data);
      const docPath = path.join(DOCUMENTS_DIR, `${safeId}.json`);
      const raw = await fs.readFile(docPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  ipcMain.handle('document:exists', async (_event, fileId: unknown): Promise<boolean> => {
    const v = validateSchema(documentIdSchema, fileId);
    if (!v.ok) return false;
    try {
      const safeId = sanitizeId(v.data);
      const docPath = path.join(DOCUMENTS_DIR, `${safeId}.json`);
      await fs.access(docPath);
      return true;
    } catch {
      return false;
    }
  });
}
