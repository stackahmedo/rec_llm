/**
 * SQLite Database Layer for RecLLM
 *
 * Replaces JSON file storage with a proper database for scalability.
 * Uses better-sqlite3 (synchronous, fast, no native async overhead in Electron main process).
 *
 * Schema:
 * - recordings: metadata about each processed audio file
 * - utterances: individual transcript segments (speaker + text + timestamps)
 * - summaries: AI-generated summaries per recording
 * - speakers: unique speaker profiles across recordings
 * - processing_log: timestamped processing events
 * - search_index: FTS5 virtual table for full-text search
 */

import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(app.getPath('userData'), 'recllm-data');
const DB_PATH = path.join(DB_DIR, 'recllm.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  fs.mkdirSync(DB_DIR, { recursive: true });

  _db = new Database(DB_PATH);

  // Performance settings for desktop app
  _db.pragma('journal_mode = WAL');       // Write-Ahead Logging for concurrent reads
  _db.pragma('synchronous = NORMAL');     // Good balance of safety + speed
  _db.pragma('cache_size = -64000');      // 64MB cache
  _db.pragma('foreign_keys = ON');
  _db.pragma('temp_store = MEMORY');

  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    -- Core recordings table (replaces history.json)
    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      original_file_name TEXT,
      generated_file_name TEXT,
      file_path TEXT,
      file_extension TEXT,
      size_bytes INTEGER DEFAULT 0,
      duration_seconds REAL,
      status TEXT NOT NULL DEFAULT 'done' CHECK(status IN ('done', 'failed', 'processing')),
      language_code TEXT DEFAULT 'auto',
      speaker_count INTEGER DEFAULT 0,
      recording_date TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      uploaded_at TEXT,
      processed_at TEXT,
      pdf_path TEXT,
      noise_reduction INTEGER DEFAULT 0,
      model_provider TEXT,
      model_name TEXT
    );

    -- Utterances table (replaces per-file transcript JSON)
    CREATE TABLE IF NOT EXISTS utterances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
      chunk_index INTEGER DEFAULT 0,
      speaker TEXT NOT NULL DEFAULT 'Speaker',
      text TEXT NOT NULL,
      start_ms INTEGER NOT NULL,
      end_ms INTEGER NOT NULL,
      confidence REAL DEFAULT 1.0,
      word_count INTEGER,
      wpm INTEGER,
      speed_label TEXT,
      gender TEXT,
      age_range TEXT,
      pitch_hz REAL
    );

    -- Summaries table (replaces per-file summary JSON)
    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
      language TEXT NOT NULL DEFAULT 'ja',
      summary TEXT,
      point_notes TEXT,       -- JSON array
      action_items TEXT,      -- JSON array
      decisions TEXT,         -- JSON array
      risks TEXT,             -- JSON array
      generated_at TEXT NOT NULL
    );

    -- Speakers table (cross-recording speaker profiles)
    CREATE TABLE IF NOT EXISTS speakers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      display_name TEXT,
      recording_count INTEGER DEFAULT 1,
      total_utterances INTEGER DEFAULT 0,
      avg_wpm REAL,
      gender_estimate TEXT,
      gender_confidence REAL,
      first_seen TEXT,
      last_seen TEXT
    );

    -- Processing jobs log
    CREATE TABLE IF NOT EXISTS processing_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recording_id TEXT,
      level TEXT NOT NULL DEFAULT 'INFO',
      message TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_recordings_status ON recordings(status);
    CREATE INDEX IF NOT EXISTS idx_recordings_created ON recordings(created_at);
    CREATE INDEX IF NOT EXISTS idx_recordings_language ON recordings(language_code);
    CREATE INDEX IF NOT EXISTS idx_utterances_recording ON utterances(recording_id);
    CREATE INDEX IF NOT EXISTS idx_utterances_speaker ON utterances(speaker);
    CREATE INDEX IF NOT EXISTS idx_summaries_recording ON summaries(recording_id);
    CREATE INDEX IF NOT EXISTS idx_processing_log_recording ON processing_log(recording_id);

    -- FTS5 full-text search index
    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      recording_id,
      file_name,
      speaker,
      text,
      content='utterances',
      content_rowid='id',
      tokenize='unicode61'
    );

    -- Triggers to keep FTS index in sync
    CREATE TRIGGER IF NOT EXISTS utterances_ai AFTER INSERT ON utterances BEGIN
      INSERT INTO search_index(rowid, recording_id, file_name, speaker, text)
      SELECT NEW.id, NEW.recording_id, r.file_name, NEW.speaker, NEW.text
      FROM recordings r WHERE r.id = NEW.recording_id;
    END;

    CREATE TRIGGER IF NOT EXISTS utterances_ad AFTER DELETE ON utterances BEGIN
      INSERT INTO search_index(search_index, rowid, recording_id, file_name, speaker, text)
      SELECT 'delete', OLD.id, OLD.recording_id, r.file_name, OLD.speaker, OLD.text
      FROM recordings r WHERE r.id = OLD.recording_id;
    END;
  `);
}

// --- Migration: Import existing JSON data into SQLite ---

interface LegacyHistoryMeta {
  id: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  status: string;
  languageCode: string;
  speakerCount: number;
  createdAt: string;
  completedAt: string;
  pdfPath?: string;
  originalFileName?: string;
  generatedFileName?: string;
  duration?: number;
}

interface LegacyTranscript {
  fullText: string;
  utterances: Array<{
    speaker: string;
    startMs: number;
    endMs: number;
    text: string;
    gender?: string;
    ageRange?: string;
    pitchHz?: number;
  }>;
}

interface LegacySummary {
  language: string;
  summary: string;
  pointNotes: string[];
  actionItems: string[];
  decisions: string[];
  risks: string[];
  generatedAt: string;
}

export function migrateFromJson(): { migrated: number; errors: number } {
  const db = getDb();
  const historyFile = path.join(DB_DIR, 'history.json');
  const transcriptsDir = path.join(DB_DIR, 'transcripts');
  const summariesDir = path.join(DB_DIR, 'summaries');

  // Check if migration already done
  const count = db.prepare('SELECT COUNT(*) as cnt FROM recordings').get() as { cnt: number };
  if (count.cnt > 0) return { migrated: 0, errors: 0 };

  // Check if legacy data exists
  if (!fs.existsSync(historyFile)) return { migrated: 0, errors: 0 };

  let migrated = 0;
  let errors = 0;

  try {
    const raw = fs.readFileSync(historyFile, 'utf-8');
    const metas: LegacyHistoryMeta[] = JSON.parse(raw);

    const insertRecording = db.prepare(`
      INSERT OR IGNORE INTO recordings (id, file_name, original_file_name, generated_file_name, file_path, size_bytes, duration_seconds, status, language_code, speaker_count, created_at, completed_at, pdf_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertUtterance = db.prepare(`
      INSERT INTO utterances (recording_id, speaker, text, start_ms, end_ms, confidence, gender, age_range, pitch_hz)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSummary = db.prepare(`
      INSERT INTO summaries (recording_id, language, summary, point_notes, action_items, decisions, risks, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const migrateAll = db.transaction(() => {
      for (const meta of metas) {
        try {
          insertRecording.run(
            meta.id, meta.fileName, meta.originalFileName || null, meta.generatedFileName || null,
            meta.filePath, meta.sizeBytes, meta.duration || null,
            meta.status === 'done' ? 'done' : 'failed',
            meta.languageCode || 'auto', meta.speakerCount || 0,
            meta.createdAt, meta.completedAt, meta.pdfPath || null
          );

          // Import transcript
          const transcriptFile = path.join(transcriptsDir, `${meta.id}.json`);
          if (fs.existsSync(transcriptFile)) {
            const trRaw = fs.readFileSync(transcriptFile, 'utf-8');
            const tr: LegacyTranscript = JSON.parse(trRaw);
            for (const u of tr.utterances || []) {
              insertUtterance.run(
                meta.id, u.speaker, u.text, u.startMs, u.endMs,
                1.0, u.gender || null, u.ageRange || null, u.pitchHz || null
              );
            }
          }

          // Import summary
          const summaryFile = path.join(summariesDir, `${meta.id}.json`);
          if (fs.existsSync(summaryFile)) {
            const smRaw = fs.readFileSync(summaryFile, 'utf-8');
            const sm: LegacySummary = JSON.parse(smRaw);
            insertSummary.run(
              meta.id, sm.language, sm.summary,
              JSON.stringify(sm.pointNotes || []),
              JSON.stringify(sm.actionItems || []),
              JSON.stringify(sm.decisions || []),
              JSON.stringify(sm.risks || []),
              sm.generatedAt
            );
          }

          migrated++;
        } catch {
          errors++;
        }
      }
    });

    migrateAll();
  } catch {
    errors++;
  }

  return { migrated, errors };
}

// --- Query helpers ---

export function searchFts(query: string, limit: number = 50): Array<{
  recording_id: string;
  file_name: string;
  speaker: string;
  text: string;
}> {
  const db = getDb();
  // Escape FTS5 special characters
  const safeQuery = query.replace(/['"*()]/g, '').trim();
  if (!safeQuery) return [];

  try {
    const stmt = db.prepare(`
      SELECT recording_id, file_name, speaker, text
      FROM search_index
      WHERE search_index MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    return stmt.all(`"${safeQuery}"`, limit) as any[];
  } catch {
    // Fallback: simple LIKE query if FTS fails
    const stmt = db.prepare(`
      SELECT recording_id, (SELECT file_name FROM recordings WHERE id = utterances.recording_id) as file_name, speaker, text
      FROM utterances
      WHERE text LIKE ?
      LIMIT ?
    `);
    return stmt.all(`%${safeQuery}%`, limit) as any[];
  }
}

export function getRecordingStats(): {
  totalRecordings: number;
  totalDurationHours: number;
  totalUtterances: number;
  uniqueSpeakers: number;
  successRate: number;
} {
  const db = getDb();
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(duration_seconds), 0) / 3600.0 as hours,
      (SELECT COUNT(*) FROM utterances) as utterances,
      (SELECT COUNT(DISTINCT speaker) FROM utterances) as speakers,
      COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 0) as success_rate
    FROM recordings
  `).get() as any;

  return {
    totalRecordings: stats.total,
    totalDurationHours: Math.round(stats.hours * 10) / 10,
    totalUtterances: stats.utterances,
    uniqueSpeakers: stats.speakers,
    successRate: Math.round(stats.success_rate),
  };
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
