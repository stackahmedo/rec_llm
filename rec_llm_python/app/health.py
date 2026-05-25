"""RecLLM Python — System Health Check (extended)"""

import shutil
import platform
import sys
from pathlib import Path

from app.config import APP_DATA_DIR, DB_PATH, RECORDINGS_DIR
from app.database.db import get_cursor


def get_system_health() -> dict:
    """Get comprehensive system health information."""
    health = {
        "status": "ok",
        "version": "0.3.1",
        "python": sys.version.split()[0],
        "platform": platform.system(),
        "architecture": platform.machine(),
    }

    # Database
    try:
        with get_cursor() as cur:
            cur.execute("SELECT COUNT(*) as cnt FROM recordings")
            health["db_recordings"] = cur.fetchone()["cnt"]
            cur.execute("SELECT COUNT(*) as cnt FROM utterances")
            health["db_utterances"] = cur.fetchone()["cnt"]
            cur.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'running'")
            health["active_jobs"] = cur.fetchone()["cnt"]
        health["db_status"] = "connected"
    except Exception as e:
        health["db_status"] = f"error: {str(e)}"
        health["status"] = "degraded"

    # Disk space
    try:
        usage = shutil.disk_usage(str(APP_DATA_DIR))
        health["disk_free_gb"] = round(usage.free / (1024**3), 1)
        health["disk_total_gb"] = round(usage.total / (1024**3), 1)
        if usage.free < 1024**3:  # Less than 1GB free
            health["status"] = "warning"
            health["disk_warning"] = "Low disk space"
    except Exception:
        pass

    # FFmpeg
    ffmpeg_path = shutil.which("ffmpeg")
    health["ffmpeg_available"] = ffmpeg_path is not None
    if not ffmpeg_path:
        health["status"] = "degraded"

    # Data directory
    health["data_dir"] = str(APP_DATA_DIR)
    health["db_path"] = str(DB_PATH)
    health["db_size_mb"] = round(DB_PATH.stat().st_size / (1024**2), 2) if DB_PATH.exists() else 0

    # API keys configured
    try:
        with get_cursor() as cur:
            cur.execute("SELECT value FROM settings WHERE key = ?", ("api_keys",))
            row = cur.fetchone()
            if row:
                import json
                keys = json.loads(row["value"])
                health["api_keys"] = {
                    "assemblyai": bool(keys.get("assemblyai")),
                    "gemini": bool(keys.get("gemini")),
                    "openai": bool(keys.get("openai")),
                }
            else:
                health["api_keys"] = {"assemblyai": False, "gemini": False, "openai": False}
    except Exception:
        health["api_keys"] = {"assemblyai": False, "gemini": False, "openai": False}

    return health
