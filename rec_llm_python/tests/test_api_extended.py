"""RecLLM Python — Extended API Tests (AI, Speakers, Batch, Watcher, Exports)"""

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
    db_path = os.path.join(tmp_dir, "test_extended.db")

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
    """Seed test data."""
    from app.database.db import get_db
    db = get_db()
    db.execute("DELETE FROM recordings")
    db.execute("DELETE FROM utterances")
    db.execute("DELETE FROM jobs")
    db.execute("DELETE FROM settings")
    db.commit()

    # Insert test recording with utterances
    db.execute("""
        INSERT INTO recordings (id, original_file_name, file_path, file_extension, size_bytes,
            duration_seconds, language_code, speaker_count, status, imported_at, created_at)
        VALUES ('ext_001', 'extended_test.mp3', '/tmp/extended_test.mp3', 'mp3', 8000000,
            7200.0, 'ja', 4, 'done', '2025-02-01T10:00:00Z', '2025-02-01T10:00:00Z')
    """)

    for i in range(20):
        speaker = f"Speaker {chr(65 + i % 4)}"
        db.execute("""
            INSERT INTO utterances (recording_id, speaker, text, start_ms, end_ms, word_count, wpm, speed_label)
            VALUES ('ext_001', ?, ?, ?, ?, ?, ?, ?)
        """, (speaker, f"Extended test utterance {i}", i * 10000, i * 10000 + 8000, 4, 130 + i * 2, "normal"))

    db.commit()
    yield


class TestWatcherAPI:
    def test_watcher_status_initial(self, client):
        resp = client.get("/api/watcher/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["active"] is False
        assert data["folderPath"] is None

    def test_watcher_start_invalid_folder(self, client):
        resp = client.post("/api/watcher/start", json={"folder_path": "/nonexistent/xyz"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is False

    def test_watcher_start_valid_folder(self, client):
        tmp = tempfile.mkdtemp()
        resp = client.post("/api/watcher/start", json={"folder_path": tmp})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True

        # Check status
        resp = client.get("/api/watcher/status")
        assert resp.json()["active"] is True

        # Stop
        resp = client.post("/api/watcher/stop")
        assert resp.status_code == 200

        resp = client.get("/api/watcher/status")
        assert resp.json()["active"] is False

    def test_watcher_stop_when_not_running(self, client):
        resp = client.post("/api/watcher/stop")
        assert resp.status_code == 200


class TestSpeakersAPI:
    def test_list_speakers_empty(self, client):
        resp = client.get("/api/speakers/")
        assert resp.status_code == 200
        assert "speakers" in resp.json()

    def test_analyze_speakers(self, client):
        resp = client.get("/api/speakers/ext_001")
        assert resp.status_code == 200
        data = resp.json()
        assert "speakers" in data
        assert len(data["speakers"]) == 4  # 4 distinct speakers

    def test_analyze_speakers_not_found(self, client):
        resp = client.get("/api/speakers/nonexistent")
        assert resp.status_code == 404


class TestAIAPI:
    def test_summarize_no_api_key(self, client):
        resp = client.post("/api/ai/summarize", json={"recording_id": "ext_001", "language": "ja"})
        assert resp.status_code == 400
        assert "API key" in resp.json()["detail"]

    def test_summarize_not_found(self, client):
        resp = client.post("/api/ai/summarize", json={"recording_id": "nonexistent"})
        assert resp.status_code == 404

    def test_grammar_no_api_key(self, client):
        resp = client.post("/api/ai/grammar", json={"recording_id": "ext_001"})
        assert resp.status_code == 400

    def test_translate_no_api_key(self, client):
        resp = client.post("/api/ai/translate", json={"recording_id": "ext_001", "target_language": "en"})
        assert resp.status_code == 400

    def test_get_summaries_empty(self, client):
        resp = client.get("/api/ai/summaries/ext_001")
        assert resp.status_code == 200
        assert resp.json()["summaries"] == []


class TestBatchAPI:
    def test_batch_import_empty(self, client):
        resp = client.post("/api/batch/batch-import", json={"files": []})
        assert resp.status_code == 200
        data = resp.json()
        assert data["imported"] == 0
        assert data["failed"] == 0

    def test_batch_import_nonexistent_files(self, client):
        resp = client.post("/api/batch/batch-import", json={
            "files": [
                {"file_path": "/nonexistent/file1.mp3"},
                {"file_path": "/nonexistent/file2.wav"},
            ]
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["imported"] == 0
        assert data["failed"] == 2
        assert len(data["errors"]) == 2

    def test_batch_import_unsupported_format(self, client):
        # Create a temp file with unsupported extension
        tmp = tempfile.NamedTemporaryFile(suffix=".exe", delete=False)
        tmp.write(b"fake")
        tmp.close()

        resp = client.post("/api/batch/batch-import", json={
            "files": [{"file_path": tmp.name}]
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["failed"] == 1
        assert "Unsupported" in data["errors"][0]["error"]

        os.unlink(tmp.name)


class TestExportsExtended:
    def test_export_txt_success(self, client):
        resp = client.post("/api/exports/", json={
            "recording_id": "ext_001",
            "export_type": "txt",
            "include_metadata": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["exportType"] == "txt"
        assert Path(data["filePath"]).exists()

    def test_export_unsupported_type(self, client):
        resp = client.post("/api/exports/", json={
            "recording_id": "ext_001",
            "export_type": "csv",
        })
        assert resp.status_code in (400, 500)  # Unsupported type returns error

    def test_export_history_after_export(self, client):
        # First create an export
        client.post("/api/exports/", json={
            "recording_id": "ext_001",
            "export_type": "txt",
        })

        resp = client.get("/api/exports/history?recording_id=ext_001")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["exports"]) >= 1


class TestAnalyticsExtended:
    def test_overview_with_data(self, client):
        resp = client.get("/api/analytics/overview")
        assert resp.status_code == 200
        data = resp.json()
        assert data["totalRecordings"] == 1
        assert data["totalUtterances"] == 20
        assert data["uniqueSpeakers"] == 4
        assert data["totalHours"] == 2.0  # 7200 seconds

    def test_speed_counts(self, client):
        resp = client.get("/api/analytics/overview")
        data = resp.json()
        # All utterances have wpm 130-168, so mix of normal and fast
        assert data["speedCounts"]["normal"] + data["speedCounts"]["fast"] == 20


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
