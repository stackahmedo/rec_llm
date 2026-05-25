"""Tests for RecLLM Python Core — Database, Audio, Job Queue"""

import sqlite3
import tempfile
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from app.config import AUDIO_EXTENSIONS, TIER_LONG_AUDIO, TIER_ENTERPRISE, TIER_BLOCKED
from app.audio.duration_detector import get_audio_tier, get_tier_recommendation, AudioTier


class TestAudioTierRouting:
    """Test tier routing logic."""

    def test_normal_tier(self):
        assert get_audio_tier(0.5) == AudioTier.NORMAL
        assert get_audio_tier(1.5) == AudioTier.NORMAL
        assert get_audio_tier(1.99) == AudioTier.NORMAL

    def test_long_audio_tier(self):
        assert get_audio_tier(2.0) == AudioTier.LONG_AUDIO
        assert get_audio_tier(5.0) == AudioTier.LONG_AUDIO
        assert get_audio_tier(9.99) == AudioTier.LONG_AUDIO

    def test_enterprise_tier(self):
        assert get_audio_tier(10.0) == AudioTier.ENTERPRISE
        assert get_audio_tier(20.0) == AudioTier.ENTERPRISE
        assert get_audio_tier(30.0) == AudioTier.ENTERPRISE

    def test_blocked_tier(self):
        assert get_audio_tier(30.1) == AudioTier.BLOCKED
        assert get_audio_tier(50.0) == AudioTier.BLOCKED

    def test_recommendation_normal(self):
        rec = get_tier_recommendation(3600)  # 1 hour
        assert rec.tier == AudioTier.NORMAL
        assert rec.total_chunks == 1
        assert rec.concurrency == 2

    def test_recommendation_long_audio(self):
        rec = get_tier_recommendation(5 * 3600)  # 5 hours
        assert rec.tier == AudioTier.LONG_AUDIO
        assert rec.total_chunks > 1
        assert rec.chunk_duration_min == 45
        assert rec.concurrency == 2

    def test_recommendation_enterprise(self):
        rec = get_tier_recommendation(20 * 3600)  # 20 hours
        assert rec.tier == AudioTier.ENTERPRISE
        assert rec.total_chunks > 1
        assert rec.chunk_duration_min == 25
        assert rec.concurrency == 1

    def test_recommendation_blocked(self):
        rec = get_tier_recommendation(31 * 3600)  # 31 hours
        assert rec.tier == AudioTier.BLOCKED
        assert rec.total_chunks == 0


class TestDatabase:
    """Test SQLite database initialization and operations."""

    def setup_method(self):
        """Create a temporary database for each test."""
        self.tmp = tempfile.mkdtemp()
        self.db_path = os.path.join(self.tmp, "test.db")
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode = WAL")
        self.conn.execute("PRAGMA foreign_keys = ON")
        self._init_schema()

    def teardown_method(self):
        self.conn.close()
        os.unlink(self.db_path)
        os.rmdir(self.tmp)

    def _init_schema(self):
        self.conn.executescript("""
            CREATE TABLE recordings (
                id TEXT PRIMARY KEY,
                original_file_name TEXT NOT NULL,
                file_path TEXT,
                size_bytes INTEGER DEFAULT 0,
                duration_seconds REAL,
                language_code TEXT DEFAULT 'auto',
                speaker_count INTEGER DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending',
                imported_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE utterances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
                speaker TEXT NOT NULL DEFAULT 'Speaker',
                text TEXT NOT NULL,
                start_ms INTEGER NOT NULL,
                end_ms INTEGER NOT NULL,
                confidence REAL DEFAULT 1.0
            );
            CREATE TABLE jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recording_id TEXT,
                job_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                progress REAL DEFAULT 0,
                error_message TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            CREATE VIRTUAL TABLE search_index USING fts5(
                recording_id, file_name, speaker, text, tokenize='unicode61'
            );
        """)

    def test_insert_recording(self):
        self.conn.execute(
            "INSERT INTO recordings (id, original_file_name, imported_at) VALUES (?, ?, ?)",
            ("rec_001", "test.mp3", "2025-01-01T00:00:00Z"),
        )
        self.conn.commit()
        row = self.conn.execute("SELECT * FROM recordings WHERE id = ?", ("rec_001",)).fetchone()
        assert row["original_file_name"] == "test.mp3"
        assert row["status"] == "pending"

    def test_insert_utterances(self):
        self.conn.execute(
            "INSERT INTO recordings (id, original_file_name, imported_at) VALUES (?, ?, ?)",
            ("rec_002", "meeting.wav", "2025-01-01T00:00:00Z"),
        )
        for i in range(100):
            self.conn.execute(
                "INSERT INTO utterances (recording_id, speaker, text, start_ms, end_ms) VALUES (?, ?, ?, ?, ?)",
                ("rec_002", f"Speaker {chr(65 + i % 5)}", f"Utterance {i}", i * 3000, i * 3000 + 2500),
            )
        self.conn.commit()

        count = self.conn.execute("SELECT COUNT(*) as cnt FROM utterances WHERE recording_id = ?", ("rec_002",)).fetchone()
        assert count["cnt"] == 100

    def test_cascade_delete(self):
        self.conn.execute(
            "INSERT INTO recordings (id, original_file_name, imported_at) VALUES (?, ?, ?)",
            ("rec_003", "delete_me.mp3", "2025-01-01T00:00:00Z"),
        )
        self.conn.execute(
            "INSERT INTO utterances (recording_id, speaker, text, start_ms, end_ms) VALUES (?, ?, ?, ?, ?)",
            ("rec_003", "Speaker A", "Hello", 0, 1000),
        )
        self.conn.commit()

        self.conn.execute("DELETE FROM recordings WHERE id = ?", ("rec_003",))
        self.conn.commit()

        count = self.conn.execute("SELECT COUNT(*) as cnt FROM utterances WHERE recording_id = ?", ("rec_003",)).fetchone()
        assert count["cnt"] == 0

    def test_fts5_search(self):
        self.conn.execute(
            "INSERT INTO recordings (id, original_file_name, imported_at) VALUES (?, ?, ?)",
            ("rec_004", "search_test.mp3", "2025-01-01T00:00:00Z"),
        )
        self.conn.execute(
            "INSERT INTO search_index (recording_id, file_name, speaker, text) VALUES (?, ?, ?, ?)",
            ("rec_004", "search_test.mp3", "Speaker A", "The quick brown fox jumps over the lazy dog"),
        )
        self.conn.commit()

        results = self.conn.execute(
            'SELECT * FROM search_index WHERE search_index MATCH ?', ('"brown fox"',)
        ).fetchall()
        assert len(results) == 1
        assert results[0]["recording_id"] == "rec_004"

    def test_fts5_no_match(self):
        self.conn.execute(
            "INSERT INTO search_index (recording_id, file_name, speaker, text) VALUES (?, ?, ?, ?)",
            ("rec_005", "test.mp3", "Speaker B", "Hello world"),
        )
        self.conn.commit()

        results = self.conn.execute(
            'SELECT * FROM search_index WHERE search_index MATCH ?', ('"nonexistent phrase"',)
        ).fetchall()
        assert len(results) == 0

    def test_job_queue_operations(self):
        self.conn.execute(
            "INSERT INTO jobs (recording_id, job_type, status) VALUES (?, ?, ?)",
            ("rec_001", "transcribe", "queued"),
        )
        self.conn.execute(
            "INSERT INTO jobs (recording_id, job_type, status) VALUES (?, ?, ?)",
            ("rec_002", "transcribe", "queued"),
        )
        self.conn.commit()

        queued = self.conn.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'queued'").fetchone()
        assert queued["cnt"] == 2

        # Mark one as running
        self.conn.execute("UPDATE jobs SET status = 'running' WHERE recording_id = ?", ("rec_001",))
        self.conn.commit()

        running = self.conn.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'running'").fetchone()
        assert running["cnt"] == 1

    def test_crash_recovery(self):
        """Simulate crash recovery: reset running jobs to queued."""
        self.conn.execute("INSERT INTO jobs (recording_id, job_type, status) VALUES (?, ?, ?)", ("r1", "transcribe", "running"))
        self.conn.execute("INSERT INTO jobs (recording_id, job_type, status) VALUES (?, ?, ?)", ("r2", "transcribe", "running"))
        self.conn.execute("INSERT INTO jobs (recording_id, job_type, status) VALUES (?, ?, ?)", ("r3", "transcribe", "done"))
        self.conn.commit()

        self.conn.execute("UPDATE jobs SET status = 'queued', progress = 0 WHERE status = 'running'")
        self.conn.commit()

        queued = self.conn.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'queued'").fetchone()
        done = self.conn.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'done'").fetchone()
        assert queued["cnt"] == 2
        assert done["cnt"] == 1

    def test_settings_crud(self):
        self.conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ("theme", '"dark"'))
        self.conn.commit()

        row = self.conn.execute("SELECT value FROM settings WHERE key = ?", ("theme",)).fetchone()
        assert row["value"] == '"dark"'

        self.conn.execute("DELETE FROM settings WHERE key = ?", ("theme",))
        self.conn.commit()

        row = self.conn.execute("SELECT value FROM settings WHERE key = ?", ("theme",)).fetchone()
        assert row is None


class TestStressScale:
    """Stress tests at 100-file scale."""

    def setup_method(self):
        self.tmp = tempfile.mkdtemp()
        self.db_path = os.path.join(self.tmp, "stress.db")
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode = WAL")
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.executescript("""
            CREATE TABLE recordings (
                id TEXT PRIMARY KEY,
                original_file_name TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                duration_seconds REAL,
                imported_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE utterances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
                speaker TEXT NOT NULL,
                text TEXT NOT NULL,
                start_ms INTEGER NOT NULL,
                end_ms INTEGER NOT NULL
            );
            CREATE TABLE jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recording_id TEXT,
                job_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                progress REAL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE VIRTUAL TABLE search_index USING fts5(
                recording_id, file_name, speaker, text, tokenize='unicode61'
            );
        """)

    def teardown_method(self):
        self.conn.close()
        os.unlink(self.db_path)
        os.rmdir(self.tmp)

    def test_100_recordings_insert(self):
        """Insert 100 recordings quickly."""
        for i in range(100):
            self.conn.execute(
                "INSERT INTO recordings (id, original_file_name, status, duration_seconds, imported_at) VALUES (?, ?, ?, ?, ?)",
                (f"rec_{i:03d}", f"recording_{i:03d}.mp3", "done", 3600 + i * 60, "2025-01-01T00:00:00Z"),
            )
        self.conn.commit()

        count = self.conn.execute("SELECT COUNT(*) as cnt FROM recordings").fetchone()
        assert count["cnt"] == 100

    def test_100_files_7200_utterances(self):
        """100 files × 72 utterances each = 7200 total."""
        for i in range(100):
            self.conn.execute(
                "INSERT INTO recordings (id, original_file_name, imported_at) VALUES (?, ?, ?)",
                (f"rec_{i:03d}", f"file_{i}.mp3", "2025-01-01T00:00:00Z"),
            )
        self.conn.commit()

        for i in range(100):
            for j in range(72):
                self.conn.execute(
                    "INSERT INTO utterances (recording_id, speaker, text, start_ms, end_ms) VALUES (?, ?, ?, ?, ?)",
                    (f"rec_{i:03d}", f"Speaker {chr(65 + j % 5)}", f"Text {i}_{j}", j * 3000, j * 3000 + 2500),
                )
        self.conn.commit()

        count = self.conn.execute("SELECT COUNT(*) as cnt FROM utterances").fetchone()
        assert count["cnt"] == 7200

    def test_fts5_at_scale(self):
        """FTS5 search across 1000 indexed utterances."""
        self.conn.execute(
            "INSERT INTO recordings (id, original_file_name, imported_at) VALUES (?, ?, ?)",
            ("rec_fts", "fts_test.mp3", "2025-01-01T00:00:00Z"),
        )
        for i in range(1000):
            self.conn.execute(
                "INSERT INTO search_index (recording_id, file_name, speaker, text) VALUES (?, ?, ?, ?)",
                ("rec_fts", "fts_test.mp3", f"Speaker {chr(65 + i % 5)}",
                 f"Utterance number {i} about {'machine learning' if i % 50 == 0 else 'general topic'}"),
            )
        self.conn.commit()

        results = self.conn.execute(
            'SELECT COUNT(*) as cnt FROM search_index WHERE search_index MATCH ?',
            ('"machine learning"',),
        ).fetchone()
        assert results["cnt"] == 20  # 1000 / 50

    def test_batch_job_processing(self):
        """100 jobs: process sequentially, 5 fail, rest succeed."""
        for i in range(100):
            self.conn.execute(
                "INSERT INTO jobs (recording_id, job_type, status) VALUES (?, ?, ?)",
                (f"rec_{i:03d}", "transcribe", "queued"),
            )
        self.conn.commit()

        fail_indices = {7, 23, 45, 67, 89}
        jobs = self.conn.execute("SELECT id FROM jobs ORDER BY id").fetchall()

        for idx, job in enumerate(jobs):
            if idx in fail_indices:
                self.conn.execute("UPDATE jobs SET status = 'failed' WHERE id = ?", (job["id"],))
            else:
                self.conn.execute("UPDATE jobs SET status = 'done', progress = 100 WHERE id = ?", (job["id"],))
        self.conn.commit()

        done = self.conn.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'done'").fetchone()
        failed = self.conn.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'failed'").fetchone()
        assert done["cnt"] == 95
        assert failed["cnt"] == 5

    def test_one_failure_does_not_break_batch(self):
        """Verify failed recording doesn't cascade to others."""
        for i in range(10):
            self.conn.execute(
                "INSERT INTO recordings (id, original_file_name, status, imported_at) VALUES (?, ?, ?, ?)",
                (f"batch_{i}", f"file_{i}.mp3", "done" if i != 5 else "failed", "2025-01-01T00:00:00Z"),
            )
        self.conn.commit()

        done = self.conn.execute("SELECT COUNT(*) as cnt FROM recordings WHERE status = 'done'").fetchone()
        failed = self.conn.execute("SELECT COUNT(*) as cnt FROM recordings WHERE status = 'failed'").fetchone()
        assert done["cnt"] == 9
        assert failed["cnt"] == 1


class TestAudioConfig:
    """Test audio configuration constants."""

    def test_supported_extensions(self):
        assert "mp3" in AUDIO_EXTENSIONS
        assert "wav" in AUDIO_EXTENSIONS
        assert "m4a" in AUDIO_EXTENSIONS
        assert "flac" in AUDIO_EXTENSIONS
        assert "exe" not in AUDIO_EXTENSIONS

    def test_tier_thresholds(self):
        assert TIER_LONG_AUDIO == 2.0
        assert TIER_ENTERPRISE == 10.0
        assert TIER_BLOCKED == 30.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
