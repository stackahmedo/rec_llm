"""RecLLM Python Core — SQLite Database Layer"""

import sqlite3
from pathlib import Path
from contextlib import contextmanager
from typing import Generator

import app.config as config


_connection: sqlite3.Connection | None = None


def get_db() -> sqlite3.Connection:
    """Get or create the database connection (singleton)."""
    global _connection
    if _connection is not None:
        return _connection

    config.ensure_dirs()
    _connection = sqlite3.connect(str(config.DB_PATH), check_same_thread=False)
    _connection.row_factory = sqlite3.Row
    _connection.execute("PRAGMA journal_mode = WAL")
    _connection.execute("PRAGMA synchronous = NORMAL")
    _connection.execute("PRAGMA cache_size = -64000")  # 64MB
    _connection.execute("PRAGMA foreign_keys = ON")
    _connection.execute("PRAGMA temp_store = MEMORY")

    _init_schema(_connection)
    return _connection


@contextmanager
def get_cursor() -> Generator[sqlite3.Cursor, None, None]:
    """Context manager for database cursor with auto-commit."""
    db = get_db()
    cursor = db.cursor()
    try:
        yield cursor
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        cursor.close()


def close_db():
    """Close the database connection."""
    global _connection
    if _connection:
        _connection.close()
        _connection = None


def _init_schema(db: sqlite3.Connection):
    """Initialize database schema."""
    db.executescript("""
        CREATE TABLE IF NOT EXISTS recordings (
            id TEXT PRIMARY KEY,
            original_file_name TEXT NOT NULL,
            generated_file_name TEXT,
            display_name TEXT,
            file_path TEXT,
            file_extension TEXT,
            size_bytes INTEGER DEFAULT 0,
            duration_seconds REAL,
            recording_date TEXT,
            language_code TEXT DEFAULT 'auto',
            speaker_count INTEGER DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending', 'processing', 'done', 'failed')),
            noise_reduction INTEGER DEFAULT 0,
            model_provider TEXT,
            model_name TEXT,
            imported_at TEXT NOT NULL,
            processed_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL,
            start_time_sec REAL NOT NULL,
            end_time_sec REAL NOT NULL,
            file_path TEXT,
            status TEXT DEFAULT 'pending'
                CHECK(status IN ('pending', 'processing', 'done', 'failed', 'retrying')),
            retry_count INTEGER DEFAULT 0,
            error_message TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS utterances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
            chunk_id INTEGER REFERENCES chunks(id),
            speaker TEXT NOT NULL DEFAULT 'Speaker',
            text TEXT NOT NULL,
            corrected_text TEXT,
            start_ms INTEGER NOT NULL,
            end_ms INTEGER NOT NULL,
            confidence REAL DEFAULT 1.0,
            word_count INTEGER,
            wpm INTEGER,
            speed_label TEXT CHECK(speed_label IN ('slow', 'normal', 'fast', NULL)),
            estimated_voice_type TEXT,
            voice_confidence REAL,
            pitch_hz REAL
        );

        CREATE TABLE IF NOT EXISTS speakers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            display_name TEXT,
            recording_count INTEGER DEFAULT 1,
            total_utterances INTEGER DEFAULT 0,
            avg_wpm REAL,
            estimated_voice_type TEXT,
            voice_confidence REAL,
            first_seen TEXT,
            last_seen TEXT
        );

        CREATE TABLE IF NOT EXISTS summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
            summary_type TEXT DEFAULT 'executive'
                CHECK(summary_type IN ('executive', 'mapreduce', 'minutes')),
            language TEXT NOT NULL DEFAULT 'ja',
            summary TEXT,
            point_notes TEXT,
            action_items TEXT,
            decisions TEXT,
            risks TEXT,
            generated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recording_id TEXT REFERENCES recordings(id) ON DELETE SET NULL,
            job_type TEXT NOT NULL
                CHECK(job_type IN ('transcribe', 'summarize', 'export', 'grammar', 'translate')),
            status TEXT NOT NULL DEFAULT 'queued'
                CHECK(status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
            progress REAL DEFAULT 0,
            error_message TEXT,
            metadata TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            started_at TEXT,
            completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS exports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
            export_type TEXT NOT NULL CHECK(export_type IN ('pdf', 'txt', 'docx')),
            file_path TEXT NOT NULL,
            include_metadata INTEGER DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS metadata (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
            key TEXT NOT NULL,
            value TEXT,
            UNIQUE(recording_id, key)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        -- FTS5 full-text search
        CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
            recording_id,
            file_name,
            speaker,
            text,
            tokenize='unicode61'
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_recordings_status ON recordings(status);
        CREATE INDEX IF NOT EXISTS idx_recordings_date ON recordings(created_at);
        CREATE INDEX IF NOT EXISTS idx_chunks_recording ON chunks(recording_id);
        CREATE INDEX IF NOT EXISTS idx_utterances_recording ON utterances(recording_id);
        CREATE INDEX IF NOT EXISTS idx_utterances_speaker ON utterances(speaker);
        CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
        CREATE INDEX IF NOT EXISTS idx_jobs_recording ON jobs(recording_id);
        CREATE INDEX IF NOT EXISTS idx_summaries_recording ON summaries(recording_id);
    """)
