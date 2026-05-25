"""RecLLM Python — Tests for Timeline, Stats, and Backup APIs"""

import sys
import os
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest

try:
    from fastapi.testclient import TestClient
except ImportError:
    pytest.skip("fastapi[test] not installed", allow_module_level=True)


@pytest.fixture(scope="module")
def client():
    """Create a test client with fresh database."""
    tmp_dir = tempfile.mkdtemp()
    db_path = os.path.join(tmp_dir, "test_new_apis.db")

    import app.config as config
    import app.database.db as db_mod

    if db_mod._connection:
        db_mod._connection.close()
        db_mod._connection = None

    config.DB_PATH = Path(db_path)
    config.APP_DATA_DIR = Path(tmp_dir)
    config.RECORDINGS_DIR = Path(tmp_dir) / "recordings"
    config.CHUNKS_DIR = Path(tmp_dir) / "chunks"
    config.TRANSCRIPTS_DIR = Path(tmp_dir) / "transcripts"
    config.EXPORTS_DIR = Path(tmp_dir) / "exports"
    config.ensure_dirs()

    from app.database.db import get_db, close_db
    from app.core.job_queue import JobQueue
    from app.api import create_app

    get_db()

    queue = JobQueue(max_concurrency=1)
    app = create_app(queue)
    with TestClient(app) as c:
        yield c

    close_db()


@pytest.fixture(autouse=True)
def seed_data(client):
    """Seed test data for new API tests."""
    from app.database.db import get_db
    db = get_db()
    db.execute("DELETE FROM recordings")
    db.execute("DELETE FROM utterances")
    db.execute("DELETE FROM jobs")
    db.execute("DELETE FROM settings")
    db.commit()

    # Insert test recording
    db.execute("""
        INSERT INTO recordings (id, original_file_name, file_path, file_extension, size_bytes,
            duration_seconds, language_code, speaker_count, status, imported_at, created_at)
        VALUES ('timeline_001', 'timeline_test.mp3', '/tmp/timeline_test.mp3', 'mp3', 5000000,
            3600.0, 'ja', 3, 'done', '2025-03-01T10:00:00Z', '2025-03-01T10:00:00Z')
    """)

    # Insert utterances spread across the recording
    for i in range(30):
        speaker = f"Speaker {chr(65 + i % 3)}"
        start_ms = i * 120000  # Every 2 minutes
        end_ms = start_ms + 60000  # 1 minute each
        db.execute("""
            INSERT INTO utterances (recording_id, speaker, text, start_ms, end_ms, word_count, wpm, speed_label)
            VALUES ('timeline_001', ?, ?, ?, ?, ?, ?, ?)
        """, (speaker, f"Timeline utterance {i}", start_ms, end_ms, 20, 130 + i, "normal"))

    db.commit()
    yield


class TestTimelineAPI:
    def test_timeline_default_buckets(self, client):
        resp = client.get("/api/recordings/timeline_001/timeline")
        assert resp.status_code == 200
        data = resp.json()
        assert data["recordingId"] == "timeline_001"
        assert data["bucketMinutes"] == 5
        assert data["durationSeconds"] == 3600.0
        assert len(data["buckets"]) > 0

    def test_timeline_custom_bucket_size(self, client):
        resp = client.get("/api/recordings/timeline_001/timeline?bucket_minutes=10")
        assert resp.status_code == 200
        data = resp.json()
        assert data["bucketMinutes"] == 10
        # 3600s / 600s = 6 buckets + 1
        assert len(data["buckets"]) <= 7

    def test_timeline_bucket_has_speech_data(self, client):
        resp = client.get("/api/recordings/timeline_001/timeline?bucket_minutes=5")
        data = resp.json()
        # First bucket should have utterances
        first_bucket = data["buckets"][0]
        assert "utteranceCount" in first_bucket
        assert "speechMs" in first_bucket
        assert "speakers" in first_bucket
        assert "speechRatio" in first_bucket

    def test_timeline_not_found(self, client):
        resp = client.get("/api/recordings/nonexistent/timeline")
        assert resp.status_code == 404


class TestRecordingStatsAPI:
    def test_stats_success(self, client):
        resp = client.get("/api/recordings/timeline_001/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["utterance_count"] == 30
        assert data["speaker_count"] == 3
        assert data["avg_wpm"] > 0
        assert data["duration_seconds"] == 3600.0

    def test_stats_not_found(self, client):
        resp = client.get("/api/recordings/nonexistent/stats")
        assert resp.status_code == 404


class TestBackupAPI:
    def test_list_backups_empty(self, client):
        resp = client.get("/api/backup/")
        assert resp.status_code == 200
        data = resp.json()
        assert "backups" in data
        assert data["count"] >= 0

    def test_create_backup(self, client):
        resp = client.post("/api/backup/create?label=test")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert "test" in data["name"]
        assert Path(data["path"]).exists()

    def test_list_backups_after_create(self, client):
        client.post("/api/backup/create?label=list_test")
        resp = client.get("/api/backup/")
        data = resp.json()
        assert data["count"] >= 1

    def test_cleanup_backups(self, client):
        # Create several backups
        for i in range(3):
            client.post(f"/api/backup/create?label=cleanup_{i}")

        resp = client.post("/api/backup/cleanup?keep=1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
