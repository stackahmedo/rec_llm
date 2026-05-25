"""Tests for RecLLM Python — Long Audio Pipeline (Worker, Streaming Merge, Recovery)"""

import sqlite3
import tempfile
import os
import sys
import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from app.audio.duration_detector import get_tier_recommendation, AudioTier
from app.ai.clients.assemblyai_client import TranscriptionResult, Utterance


class TestStreamingMerge:
    """Test the streaming merge logic for chunked transcripts."""

    def test_merge_two_chunks(self):
        """Merge two sequential chunks with correct offset."""
        from app.core.worker import _streaming_merge

        chunks = [
            {"chunk_index": 0, "start_time_sec": 0, "end_time_sec": 300, "file_path": "/tmp/c0.wav"},
            {"chunk_index": 1, "start_time_sec": 300, "end_time_sec": 600, "file_path": "/tmp/c1.wav"},
        ]

        results = [
            TranscriptionResult(
                ok=True,
                full_text="Hello world",
                utterances=[
                    Utterance(speaker="A", text="Hello", start_ms=0, end_ms=2000),
                    Utterance(speaker="B", text="World", start_ms=3000, end_ms=5000),
                ],
                language_code="en",
            ),
            TranscriptionResult(
                ok=True,
                full_text="Second chunk",
                utterances=[
                    Utterance(speaker="A", text="Second", start_ms=1000, end_ms=3000),
                    Utterance(speaker="B", text="Chunk", start_ms=4000, end_ms=6000),
                ],
                language_code="en",
            ),
        ]

        merged = _streaming_merge(results, chunks)

        assert merged.ok
        assert len(merged.utterances) == 4
        # First chunk: no offset
        assert merged.utterances[0].start_ms == 0
        assert merged.utterances[0].text == "Hello"
        assert merged.utterances[1].start_ms == 3000
        # Second chunk: offset by 300000ms (300 sec)
        assert merged.utterances[2].start_ms == 301000  # 1000 + 300000
        assert merged.utterances[3].start_ms == 304000  # 4000 + 300000
        assert merged.language_code == "en"

    def test_merge_with_failed_chunk(self):
        """Merge skips failed chunks gracefully."""
        from app.core.worker import _streaming_merge

        chunks = [
            {"chunk_index": 0, "start_time_sec": 0, "end_time_sec": 300, "file_path": "/tmp/c0.wav"},
            {"chunk_index": 1, "start_time_sec": 300, "end_time_sec": 600, "file_path": "/tmp/c1.wav"},
            {"chunk_index": 2, "start_time_sec": 600, "end_time_sec": 900, "file_path": "/tmp/c2.wav"},
        ]

        results = [
            TranscriptionResult(ok=True, full_text="First", utterances=[
                Utterance(speaker="A", text="First chunk", start_ms=0, end_ms=5000),
            ], language_code="en"),
            None,  # Failed chunk
            TranscriptionResult(ok=True, full_text="Third", utterances=[
                Utterance(speaker="A", text="Third chunk", start_ms=0, end_ms=5000),
            ], language_code="en"),
        ]

        merged = _streaming_merge(results, chunks)

        assert merged.ok
        assert len(merged.utterances) == 2
        assert merged.utterances[0].text == "First chunk"
        assert merged.utterances[0].start_ms == 0
        assert merged.utterances[1].text == "Third chunk"
        assert merged.utterances[1].start_ms == 600000  # offset by 600 sec

    def test_merge_empty_results(self):
        """Merge handles all-failed scenario."""
        from app.core.worker import _streaming_merge

        chunks = [
            {"chunk_index": 0, "start_time_sec": 0, "end_time_sec": 300, "file_path": "/tmp/c0.wav"},
        ]
        results = [None]

        merged = _streaming_merge(results, chunks)
        assert merged.ok
        assert len(merged.utterances) == 0

    def test_merge_preserves_speaker_labels(self):
        """Merge preserves distinct speaker labels across chunks."""
        from app.core.worker import _streaming_merge

        chunks = [
            {"chunk_index": 0, "start_time_sec": 0, "end_time_sec": 600, "file_path": "/tmp/c0.wav"},
            {"chunk_index": 1, "start_time_sec": 600, "end_time_sec": 1200, "file_path": "/tmp/c1.wav"},
        ]

        results = [
            TranscriptionResult(ok=True, full_text="", utterances=[
                Utterance(speaker="Speaker A", text="Hello", start_ms=0, end_ms=2000),
                Utterance(speaker="Speaker B", text="Hi", start_ms=3000, end_ms=5000),
            ], language_code="ja"),
            TranscriptionResult(ok=True, full_text="", utterances=[
                Utterance(speaker="Speaker A", text="Bye", start_ms=0, end_ms=2000),
                Utterance(speaker="Speaker C", text="Later", start_ms=3000, end_ms=5000),
            ], language_code="ja"),
        ]

        merged = _streaming_merge(results, chunks)
        speakers = set(u.speaker for u in merged.utterances)
        assert speakers == {"Speaker A", "Speaker B", "Speaker C"}

    def test_merge_sorts_by_timestamp(self):
        """Merged utterances are sorted by start_ms."""
        from app.core.worker import _streaming_merge

        chunks = [
            {"chunk_index": 0, "start_time_sec": 0, "end_time_sec": 60, "file_path": "/tmp/c0.wav"},
            {"chunk_index": 1, "start_time_sec": 60, "end_time_sec": 120, "file_path": "/tmp/c1.wav"},
        ]

        results = [
            TranscriptionResult(ok=True, full_text="", utterances=[
                Utterance(speaker="A", text="Late in chunk 0", start_ms=50000, end_ms=55000),
                Utterance(speaker="A", text="Early in chunk 0", start_ms=1000, end_ms=3000),
            ], language_code="en"),
            TranscriptionResult(ok=True, full_text="", utterances=[
                Utterance(speaker="B", text="Early in chunk 1", start_ms=1000, end_ms=3000),
            ], language_code="en"),
        ]

        merged = _streaming_merge(results, chunks)
        timestamps = [u.start_ms for u in merged.utterances]
        assert timestamps == sorted(timestamps)

    def test_merge_large_scale_100_chunks(self):
        """Merge 100 chunks × 10 utterances each = 1000 total."""
        from app.core.worker import _streaming_merge

        chunks = [
            {"chunk_index": i, "start_time_sec": i * 300, "end_time_sec": (i + 1) * 300, "file_path": f"/tmp/c{i}.wav"}
            for i in range(100)
        ]

        results = [
            TranscriptionResult(ok=True, full_text=f"Chunk {i}", utterances=[
                Utterance(speaker=f"Speaker {j % 5}", text=f"Text {i}_{j}", start_ms=j * 25000, end_ms=j * 25000 + 20000)
                for j in range(10)
            ], language_code="en")
            for i in range(100)
        ]

        merged = _streaming_merge(results, chunks)
        assert merged.ok
        assert len(merged.utterances) == 1000
        # Verify sorted
        for i in range(len(merged.utterances) - 1):
            assert merged.utterances[i].start_ms <= merged.utterances[i + 1].start_ms

    def test_memory_freed_after_merge(self):
        """After merge, individual results are set to None (memory freed)."""
        from app.core.worker import _streaming_merge

        chunks = [
            {"chunk_index": 0, "start_time_sec": 0, "end_time_sec": 300, "file_path": "/tmp/c0.wav"},
            {"chunk_index": 1, "start_time_sec": 300, "end_time_sec": 600, "file_path": "/tmp/c1.wav"},
        ]

        results = [
            TranscriptionResult(ok=True, full_text="A", utterances=[
                Utterance(speaker="A", text="Hello", start_ms=0, end_ms=2000),
            ], language_code="en"),
            TranscriptionResult(ok=True, full_text="B", utterances=[
                Utterance(speaker="B", text="World", start_ms=0, end_ms=2000),
            ], language_code="en"),
        ]

        _streaming_merge(results, chunks)
        # After merge, results should be cleared
        assert results[0] is None
        assert results[1] is None


class TestCrashRecovery:
    """Test crash recovery for the job queue."""

    def setup_method(self):
        self.tmp = tempfile.mkdtemp()
        self.db_path = os.path.join(self.tmp, "recovery.db")
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript("""
            CREATE TABLE jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recording_id TEXT,
                job_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                progress REAL DEFAULT 0,
                error_message TEXT,
                metadata TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                started_at TEXT,
                completed_at TEXT
            );
            CREATE TABLE chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recording_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                start_time_sec REAL NOT NULL,
                end_time_sec REAL NOT NULL,
                file_path TEXT,
                status TEXT DEFAULT 'pending',
                retry_count INTEGER DEFAULT 0
            );
        """)

    def teardown_method(self):
        self.conn.close()
        os.unlink(self.db_path)
        os.rmdir(self.tmp)

    def test_recover_running_jobs(self):
        """Running jobs are reset to queued on recovery."""
        self.conn.execute("INSERT INTO jobs (recording_id, job_type, status) VALUES (?, ?, ?)", ("r1", "transcribe", "running"))
        self.conn.execute("INSERT INTO jobs (recording_id, job_type, status) VALUES (?, ?, ?)", ("r2", "transcribe", "running"))
        self.conn.execute("INSERT INTO jobs (recording_id, job_type, status) VALUES (?, ?, ?)", ("r3", "transcribe", "queued"))
        self.conn.execute("INSERT INTO jobs (recording_id, job_type, status) VALUES (?, ?, ?)", ("r4", "transcribe", "done"))
        self.conn.commit()

        # Simulate recovery
        self.conn.execute("UPDATE jobs SET status = 'queued', progress = 0 WHERE status = 'running'")
        self.conn.commit()

        queued = self.conn.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'queued'").fetchone()["cnt"]
        done = self.conn.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'done'").fetchone()["cnt"]
        assert queued == 3  # 2 recovered + 1 already queued
        assert done == 1

    def test_recover_processing_chunks(self):
        """Processing chunks are reset to pending on recovery."""
        for i in range(10):
            status = "processing" if i < 3 else ("done" if i < 7 else "pending")
            self.conn.execute(
                "INSERT INTO chunks (recording_id, chunk_index, start_time_sec, end_time_sec, status) VALUES (?, ?, ?, ?, ?)",
                ("rec_001", i, i * 300, (i + 1) * 300, status),
            )
        self.conn.commit()

        # Recovery: reset processing to pending
        self.conn.execute("UPDATE chunks SET status = 'pending' WHERE status = 'processing'")
        self.conn.commit()

        pending = self.conn.execute("SELECT COUNT(*) as cnt FROM chunks WHERE status = 'pending'").fetchone()["cnt"]
        done = self.conn.execute("SELECT COUNT(*) as cnt FROM chunks WHERE status = 'done'").fetchone()["cnt"]
        assert pending == 6  # 3 recovered + 3 already pending
        assert done == 4

    def test_retry_count_preserved(self):
        """Retry count is preserved across recovery."""
        self.conn.execute(
            "INSERT INTO chunks (recording_id, chunk_index, start_time_sec, end_time_sec, status, retry_count) VALUES (?, ?, ?, ?, ?, ?)",
            ("rec_001", 0, 0, 300, "processing", 2),
        )
        self.conn.commit()

        # Recovery resets status but keeps retry count
        self.conn.execute("UPDATE chunks SET status = 'pending' WHERE status = 'processing'")
        self.conn.commit()

        row = self.conn.execute("SELECT * FROM chunks WHERE recording_id = ? AND chunk_index = ?", ("rec_001", 0)).fetchone()
        assert row["status"] == "pending"
        assert row["retry_count"] == 2


class TestTierChunkCalculation:
    """Test chunk count calculations for different durations."""

    def test_5h_audio_chunks(self):
        rec = get_tier_recommendation(5 * 3600)
        assert rec.tier == AudioTier.LONG_AUDIO
        # 5h = 300min / 45min chunks ≈ 7 chunks
        assert rec.total_chunks >= 7

    def test_20h_audio_chunks(self):
        rec = get_tier_recommendation(20 * 3600)
        assert rec.tier == AudioTier.ENTERPRISE
        # 20h = 1200min / 25min chunks = 48 chunks
        assert rec.total_chunks >= 48

    def test_30h_audio_chunks(self):
        rec = get_tier_recommendation(30 * 3600)
        assert rec.tier == AudioTier.ENTERPRISE
        # 30h = 1800min / 25min chunks = 72 chunks
        assert rec.total_chunks >= 72

    def test_1h_no_chunks(self):
        rec = get_tier_recommendation(3600)
        assert rec.tier == AudioTier.NORMAL
        assert rec.total_chunks == 1


class TestSpeedDetection:
    """Test WPM and speed label calculation."""

    def test_slow_speed(self):
        # 50 words in 60 seconds = 50 WPM (slow)
        word_count = 50
        duration_sec = 60
        wpm = int(word_count / (duration_sec / 60))
        assert wpm == 50
        assert wpm < 120  # slow threshold

    def test_normal_speed(self):
        # 140 words in 60 seconds = 140 WPM (normal)
        word_count = 140
        duration_sec = 60
        wpm = int(word_count / (duration_sec / 60))
        assert wpm == 140
        assert 120 <= wpm <= 160

    def test_fast_speed(self):
        # 200 words in 60 seconds = 200 WPM (fast)
        word_count = 200
        duration_sec = 60
        wpm = int(word_count / (duration_sec / 60))
        assert wpm == 200
        assert wpm > 160


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
