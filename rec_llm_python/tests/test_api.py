"""RecLLM Python — API Integration Tests (FastAPI TestClient)"""

import sys
import os
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest

# Install test dependencies
try:
    from fastapi.testclient import TestClient
except ImportError:
    pytest.skip("fastapi[test] not installed", allow_module_level=True)


@pytest.fixture(scope="module")
def client():
    """Create a test client with fresh database."""
    tmp_dir = tempfile.mkdtemp()
    db_path = os.path.join(tmp_dir, "test_api.db")

    import app.config as config
    import app.database.db as db_mod

    # Close any existing connection from other tests
    if db_mod._connection:
        db_mod._connection.close()
        db_mod._connection = None

    # Patch paths to use temp directory
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
    """Seed test data before each test."""
    from app.database.db import get_db
    db = get_db()
    # Clear tables
    db.execute("DELETE FROM recordings")
    db.execute("DELETE FROM utterances")
    db.execute("DELETE FROM jobs")
    db.execute("DELETE FROM settings")
    db.commit()

    # Insert test recording
    db.execute("""
        INSERT INTO recordings (id, original_file_name, file_path, file_extension, size_bytes,
            duration_seconds, language_code, speaker_count, status, imported_at, created_at)
        VALUES ('test_001', 'meeting.mp3', '/tmp/meeting.mp3', 'mp3', 5000000,
            3600.0, 'ja', 3, 'done', '2025-01-15T10:00:00Z', '2025-01-15T10:00:00Z')
    """)

    # Insert utterances
    for i in range(10):
        db.execute("""
            INSERT INTO utterances (recording_id, speaker, text, start_ms, end_ms, word_count, wpm, speed_label)
            VALUES ('test_001', ?, ?, ?, ?, ?, ?, ?)
        """, (f"Speaker {chr(65 + i % 3)}", f"Test utterance number {i}", i * 5000, i * 5000 + 4000, 4, 140, "normal"))

    db.commit()
    yield


class TestHealthEndpoint:
    def test_health(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["version"] == "0.3.0"


class TestRecordingsAPI:
    def test_list_recordings(self, client):
        resp = client.get("/api/recordings/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert len(data["recordings"]) >= 1
        assert data["recordings"][0]["id"] == "test_001"

    def test_list_recordings_pagination(self, client):
        resp = client.get("/api/recordings/?limit=1&offset=0")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["recordings"]) == 1

    def test_get_recording(self, client):
        resp = client.get("/api/recordings/test_001")
        assert resp.status_code == 200
        data = resp.json()
        assert data["recording"]["id"] == "test_001"
        assert data["recording"]["original_file_name"] == "meeting.mp3"
        assert len(data["utterances"]) == 10

    def test_get_recording_not_found(self, client):
        resp = client.get("/api/recordings/nonexistent")
        assert resp.status_code == 404

    def test_delete_recording(self, client):
        resp = client.delete("/api/recordings/test_001")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

        # Verify deleted
        resp = client.get("/api/recordings/test_001")
        assert resp.status_code == 404

    def test_delete_recording_not_found(self, client):
        resp = client.delete("/api/recordings/nonexistent")
        assert resp.status_code == 404

    def test_get_recording_stats(self, client):
        resp = client.get("/api/recordings/test_001/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["utterance_count"] == 10
        assert data["speaker_count"] == 3
        assert data["duration_seconds"] == 3600.0

    def test_rename_speaker(self, client):
        resp = client.put(
            "/api/recordings/test_001/speaker",
            data={"old_name": "Speaker A", "new_name": "田中"},
        )
        assert resp.status_code == 200
        assert resp.json()["renamed"] >= 1

    def test_rename_speaker_not_found(self, client):
        resp = client.put(
            "/api/recordings/test_001/speaker",
            data={"old_name": "Nonexistent", "new_name": "New"},
        )
        assert resp.status_code == 404

    def test_update_utterance(self, client):
        # Get first utterance ID
        resp = client.get("/api/recordings/test_001")
        utt_id = resp.json()["utterances"][0]["id"]

        resp = client.put(
            f"/api/recordings/test_001/utterances/{utt_id}",
            data={"text": "Corrected text"},
        )
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


class TestJobsAPI:
    def test_list_jobs_empty(self, client):
        resp = client.get("/api/jobs/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["jobs"] == []

    def test_job_stats(self, client):
        resp = client.get("/api/jobs/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "queued" in data
        assert "done" in data

    def test_retry_job_not_found(self, client):
        resp = client.post("/api/jobs/9999/retry")
        assert resp.status_code == 404

    def test_cancel_job_not_found(self, client):
        resp = client.post("/api/jobs/9999/cancel")
        assert resp.status_code == 404

    def test_retry_all_failed(self, client):
        resp = client.post("/api/jobs/retry-all-failed")
        assert resp.status_code == 200
        assert resp.json()["retried"] == 0


class TestSearchAPI:
    def test_search_empty_query(self, client):
        resp = client.post("/api/search/", json={"query": ""})
        assert resp.status_code == 200
        assert resp.json()["results"] == []

    def test_search_with_results(self, client):
        # Index test data in FTS
        from app.database.db import get_db
        db = get_db()
        db.execute(
            "INSERT INTO search_index (recording_id, file_name, speaker, text) VALUES (?, ?, ?, ?)",
            ("test_001", "meeting.mp3", "Speaker A", "Test utterance number 0"),
        )
        db.commit()

        resp = client.post("/api/search/", json={"query": "utterance"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) >= 1

    def test_search_no_results(self, client):
        resp = client.post("/api/search/", json={"query": "xyznonexistent123"})
        assert resp.status_code == 200
        assert resp.json()["total"] == 0


class TestSettingsAPI:
    def test_get_all_settings_empty(self, client):
        resp = client.get("/api/settings/")
        assert resp.status_code == 200

    def test_set_and_get_setting(self, client):
        resp = client.put("/api/settings/", json={"key": "theme", "value": '"dark"'})
        assert resp.status_code == 200

        resp = client.get("/api/settings/theme")
        assert resp.status_code == 200
        assert resp.json()["value"] == "dark"

    def test_delete_setting(self, client):
        client.put("/api/settings/", json={"key": "temp", "value": '"val"'})
        resp = client.delete("/api/settings/temp")
        assert resp.status_code == 200

    def test_save_api_keys(self, client):
        resp = client.post("/api/settings/api-keys", json={
            "assemblyai": "test-key-123",
            "gemini": "",
            "openai": "sk-test",
        })
        assert resp.status_code == 200

    def test_api_keys_status(self, client):
        client.post("/api/settings/api-keys", json={
            "assemblyai": "test-key",
            "gemini": "",
            "openai": "",
        })
        resp = client.get("/api/settings/api-keys/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["assemblyai"] is True
        assert data["gemini"] is False


class TestAnalyticsAPI:
    def test_overview(self, client):
        resp = client.get("/api/analytics/overview")
        assert resp.status_code == 200
        data = resp.json()
        assert "totalRecordings" in data
        assert "totalHours" in data
        assert "totalUtterances" in data
        assert "uniqueSpeakers" in data
        assert "speedCounts" in data

    def test_today_stats(self, client):
        resp = client.get("/api/analytics/today")
        assert resp.status_code == 200
        data = resp.json()
        assert "imported" in data
        assert "completed" in data

    def test_speakers(self, client):
        resp = client.get("/api/analytics/speakers")
        assert resp.status_code == 200
        assert "speakers" in resp.json()


class TestExportsAPI:
    def test_export_history_empty(self, client):
        resp = client.get("/api/exports/history")
        assert resp.status_code == 200
        assert resp.json()["exports"] == []

    def test_export_recording_not_found(self, client):
        resp = client.post("/api/exports/", json={
            "recording_id": "nonexistent",
            "export_type": "txt",
        })
        assert resp.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
