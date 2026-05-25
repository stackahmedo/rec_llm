"""RecLLM Python — Database Migration System

Simple forward-only migration system for SQLite.
Migrations are numbered sequentially and tracked in a migrations table.
"""

import logging
from pathlib import Path

from app.database.db import get_db

logger = logging.getLogger(__name__)

MIGRATIONS = [
    # Migration 001: Add processed_at column to recordings
    {
        "id": 1,
        "name": "add_processed_at_column",
        "sql": """
            ALTER TABLE recordings ADD COLUMN processed_at TEXT;
        """,
    },
    # Migration 002: Add exports table
    {
        "id": 2,
        "name": "add_exports_table",
        "sql": """
            CREATE TABLE IF NOT EXISTS exports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recording_id TEXT NOT NULL,
                export_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size_bytes INTEGER DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (recording_id) REFERENCES recordings(id)
            );
        """,
    },
    # Migration 003: Add summaries table
    {
        "id": 3,
        "name": "add_summaries_table",
        "sql": """
            CREATE TABLE IF NOT EXISTS summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recording_id TEXT NOT NULL,
                summary_type TEXT NOT NULL DEFAULT 'executive',
                language TEXT NOT NULL DEFAULT 'ja',
                summary TEXT,
                point_notes TEXT,
                action_items TEXT,
                decisions TEXT,
                risks TEXT,
                generated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (recording_id) REFERENCES recordings(id)
            );
        """,
    },
    # Migration 004: Add speakers table
    {
        "id": 4,
        "name": "add_speakers_table",
        "sql": """
            CREATE TABLE IF NOT EXISTS speakers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                display_name TEXT,
                recording_count INTEGER DEFAULT 0,
                total_utterances INTEGER DEFAULT 0,
                avg_wpm REAL DEFAULT 0,
                estimated_voice_type TEXT,
                voice_confidence REAL DEFAULT 0,
                first_seen TEXT,
                last_seen TEXT
            );
        """,
    },
    # Migration 005: Add corrected_text to utterances
    {
        "id": 5,
        "name": "add_corrected_text_column",
        "sql": """
            ALTER TABLE utterances ADD COLUMN corrected_text TEXT;
        """,
    },
    # Migration 006: Add translated_text to utterances
    {
        "id": 6,
        "name": "add_translated_text_column",
        "sql": """
            ALTER TABLE utterances ADD COLUMN translated_text TEXT;
        """,
    },
]


def ensure_migrations_table():
    """Create the migrations tracking table if it doesn't exist."""
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    db.commit()


def get_applied_migrations() -> set[int]:
    """Get the set of already-applied migration IDs."""
    db = get_db()
    try:
        cursor = db.execute("SELECT id FROM _migrations")
        return {row[0] for row in cursor.fetchall()}
    except Exception:
        return set()


def run_migrations():
    """Run all pending migrations."""
    ensure_migrations_table()
    applied = get_applied_migrations()
    db = get_db()

    pending = [m for m in MIGRATIONS if m["id"] not in applied]
    if not pending:
        return 0

    count = 0
    for migration in pending:
        try:
            # Execute migration SQL (may fail if column already exists)
            for statement in migration["sql"].strip().split(";"):
                statement = statement.strip()
                if statement:
                    db.execute(statement)

            # Record migration
            db.execute(
                "INSERT INTO _migrations (id, name) VALUES (?, ?)",
                (migration["id"], migration["name"]),
            )
            db.commit()
            count += 1
            logger.info("Migration %d applied: %s", migration["id"], migration["name"])
        except Exception as e:
            # Column/table might already exist — that's OK
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                db.execute(
                    "INSERT OR IGNORE INTO _migrations (id, name) VALUES (?, ?)",
                    (migration["id"], migration["name"]),
                )
                db.commit()
                logger.info("Migration %d skipped (already applied): %s", migration["id"], migration["name"])
            else:
                logger.warning("Migration %d failed: %s — %s", migration["id"], migration["name"], e)
                db.rollback()

    return count
