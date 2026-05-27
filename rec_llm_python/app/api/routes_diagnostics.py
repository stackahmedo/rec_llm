"""RecLLM Python — Diagnostics & Developer API Routes"""

import json
import shutil
import platform
import sys
import subprocess
import logging
from pathlib import Path
from collections import deque

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import APP_DATA_DIR, DB_PATH, RECORDINGS_DIR, CHUNKS_DIR, EXPORTS_DIR, LOG_FILE
from app.database.db import get_cursor

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/diagnostics")
async def get_diagnostics():
    """Full system diagnostics for developer panel."""
    diag = {
        "app_version": "0.3.2",
        "python_version": sys.version.split()[0],
        "platform": platform.system(),
        "architecture": platform.machine(),
        "hostname": platform.node(),
    }

    # FFmpeg
    ffmpeg_path = shutil.which("ffmpeg")
    diag["ffmpeg"] = {
        "detected": ffmpeg_path is not None,
        "path": ffmpeg_path or "",
        "version": "",
    }
    if ffmpeg_path:
        try:
            result = subprocess.run(
                [ffmpeg_path, "-version"],
                capture_output=True, text=True, timeout=5,
            )
            first_line = result.stdout.split("\n")[0] if result.stdout else ""
            diag["ffmpeg"]["version"] = first_line
        except Exception:
            pass

    # Database
    try:
        with get_cursor() as cur:
            cur.execute("SELECT COUNT(*) as cnt FROM recordings")
            rec_count = cur.fetchone()["cnt"]
            cur.execute("SELECT COUNT(*) as cnt FROM utterances")
            utt_count = cur.fetchone()["cnt"]
            cur.execute("SELECT COUNT(*) as cnt FROM jobs")
            job_count = cur.fetchone()["cnt"]
            cur.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'running'")
            active_jobs = cur.fetchone()["cnt"]
            cur.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'failed'")
            failed_jobs = cur.fetchone()["cnt"]

        diag["database"] = {
            "connected": True,
            "path": str(DB_PATH),
            "size_mb": round(DB_PATH.stat().st_size / (1024**2), 2) if DB_PATH.exists() else 0,
            "recordings": rec_count,
            "utterances": utt_count,
            "jobs_total": job_count,
            "jobs_active": active_jobs,
            "jobs_failed": failed_jobs,
        }
    except Exception as e:
        diag["database"] = {"connected": False, "error": str(e)}

    # Storage
    try:
        usage = shutil.disk_usage(str(APP_DATA_DIR))
        recordings_size = sum(f.stat().st_size for f in RECORDINGS_DIR.glob("*") if f.is_file()) if RECORDINGS_DIR.exists() else 0
        chunks_size = sum(f.stat().st_size for f in CHUNKS_DIR.glob("*") if f.is_file()) if CHUNKS_DIR.exists() else 0

        diag["storage"] = {
            "data_dir": str(APP_DATA_DIR),
            "recordings_dir": str(RECORDINGS_DIR),
            "exports_dir": str(EXPORTS_DIR),
            "disk_free_gb": round(usage.free / (1024**3), 1),
            "disk_total_gb": round(usage.total / (1024**3), 1),
            "recordings_size_mb": round(recordings_size / (1024**2), 1),
            "cache_size_mb": round(chunks_size / (1024**2), 1),
        }
    except Exception as e:
        diag["storage"] = {"error": str(e)}

    # API keys status
    try:
        with get_cursor() as cur:
            cur.execute("SELECT value FROM settings WHERE key = ?", ("api_keys",))
            row = cur.fetchone()
            if row:
                keys = json.loads(row["value"])
                diag["api_keys"] = {
                    "assemblyai": "configured" if keys.get("assemblyai") else "missing",
                    "gemini": "configured" if keys.get("gemini") else "missing",
                    "openai": "configured" if keys.get("openai") else "missing",
                }
            else:
                diag["api_keys"] = {"assemblyai": "missing", "gemini": "missing", "openai": "missing"}
    except Exception:
        diag["api_keys"] = {"assemblyai": "unknown", "gemini": "unknown", "openai": "unknown"}

    # Last errors
    diag["last_errors"] = _get_recent_errors(5)

    return diag


@router.get("/logs")
async def get_logs(limit: int = 100, level: str | None = None):
    """Get recent log lines."""
    if not LOG_FILE.exists():
        return {"lines": [], "total": 0}

    lines = []
    try:
        with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as f:
            all_lines = deque(f, maxlen=500)

        for line in all_lines:
            line = line.rstrip()
            if not line:
                continue
            if level:
                level_upper = level.upper()
                if level_upper == "ERROR" and "[ERROR]" not in line:
                    continue
                elif level_upper == "WARNING" and "[WARNING]" not in line:
                    continue
                elif level_upper == "INFO" and "[INFO]" not in line:
                    continue
            lines.append(line)

        lines = lines[-limit:]
    except Exception as e:
        return {"lines": [f"Error reading log: {e}"], "total": 0}

    return {"lines": lines, "total": len(lines)}


@router.post("/diagnostics/run")
async def run_diagnostics():
    """Run a full health check and return results."""
    results = []

    # Check database
    try:
        with get_cursor() as cur:
            cur.execute("SELECT 1")
        results.append({"check": "Database", "status": "ok", "detail": str(DB_PATH)})
    except Exception as e:
        results.append({"check": "Database", "status": "error", "detail": str(e)})

    # Check FFmpeg
    ffmpeg_path = shutil.which("ffmpeg")
    if ffmpeg_path:
        try:
            subprocess.run([ffmpeg_path, "-version"], capture_output=True, timeout=5, check=True)
            results.append({"check": "FFmpeg", "status": "ok", "detail": ffmpeg_path})
        except Exception as e:
            results.append({"check": "FFmpeg", "status": "error", "detail": str(e)})
    else:
        results.append({"check": "FFmpeg", "status": "error", "detail": "Not found in PATH"})

    # Check ffprobe
    ffprobe_path = shutil.which("ffprobe")
    if ffprobe_path:
        results.append({"check": "ffprobe", "status": "ok", "detail": ffprobe_path})
    else:
        results.append({"check": "ffprobe", "status": "error", "detail": "Not found in PATH"})

    # Check disk space
    try:
        usage = shutil.disk_usage(str(APP_DATA_DIR))
        free_gb = usage.free / (1024**3)
        if free_gb < 1:
            results.append({"check": "Disk Space", "status": "warning", "detail": f"{free_gb:.1f} GB free"})
        else:
            results.append({"check": "Disk Space", "status": "ok", "detail": f"{free_gb:.1f} GB free"})
    except Exception as e:
        results.append({"check": "Disk Space", "status": "error", "detail": str(e)})

    # Check data directories
    for name, path in [("Data Dir", APP_DATA_DIR), ("Recordings", RECORDINGS_DIR), ("Exports", EXPORTS_DIR)]:
        if path.exists():
            results.append({"check": name, "status": "ok", "detail": str(path)})
        else:
            results.append({"check": name, "status": "warning", "detail": f"Missing: {path}"})

    # Check API keys
    try:
        with get_cursor() as cur:
            cur.execute("SELECT value FROM settings WHERE key = ?", ("api_keys",))
            row = cur.fetchone()
            if row:
                keys = json.loads(row["value"])
                for provider in ["assemblyai", "gemini", "openai"]:
                    if keys.get(provider):
                        results.append({"check": f"API Key: {provider}", "status": "ok", "detail": "Configured"})
                    else:
                        results.append({"check": f"API Key: {provider}", "status": "warning", "detail": "Not set"})
            else:
                for provider in ["assemblyai", "gemini", "openai"]:
                    results.append({"check": f"API Key: {provider}", "status": "warning", "detail": "Not set"})
    except Exception:
        results.append({"check": "API Keys", "status": "error", "detail": "Cannot read settings"})

    return {"results": results, "total_checks": len(results)}


class TestProviderRequest(BaseModel):
    provider: str


@router.post("/settings/test-provider")
async def test_provider(req: TestProviderRequest):
    """Test connectivity to an AI provider."""
    provider = req.provider.lower()

    with get_cursor() as cur:
        cur.execute("SELECT value FROM settings WHERE key = ?", ("api_keys",))
        row = cur.fetchone()

    if not row:
        return {"provider": provider, "status": "error", "message": "No API keys configured"}

    try:
        keys = json.loads(row["value"])
    except Exception:
        return {"provider": provider, "status": "error", "message": "Cannot parse API keys"}

    key = keys.get(provider, "")
    if not key:
        return {"provider": provider, "status": "error", "message": f"No {provider} key configured"}

    if provider == "assemblyai":
        return await _test_assemblyai(key)
    elif provider == "gemini":
        return await _test_gemini(key)
    elif provider == "openai":
        return await _test_openai(key)
    else:
        return {"provider": provider, "status": "error", "message": f"Unknown provider: {provider}"}


async def _test_assemblyai(key: str) -> dict:
    """Test AssemblyAI API key."""
    import urllib.request
    import urllib.error
    try:
        req = urllib.request.Request(
            "https://api.assemblyai.com/v2/transcript?limit=1",
            headers={"Authorization": key},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                return {"provider": "assemblyai", "status": "ok", "message": "Connected"}
    except urllib.error.HTTPError as e:
        if e.code == 401:
            return {"provider": "assemblyai", "status": "error", "message": "Invalid API key (401)"}
        return {"provider": "assemblyai", "status": "error", "message": f"HTTP {e.code}"}
    except Exception as e:
        return {"provider": "assemblyai", "status": "error", "message": str(e)[:100]}
    return {"provider": "assemblyai", "status": "error", "message": "Unknown error"}


async def _test_gemini(key: str) -> dict:
    """Test Gemini API key."""
    import urllib.request
    import urllib.error
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                return {"provider": "gemini", "status": "ok", "message": "Connected"}
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            return {"provider": "gemini", "status": "error", "message": "Invalid API key"}
        return {"provider": "gemini", "status": "error", "message": f"HTTP {e.code}"}
    except Exception as e:
        return {"provider": "gemini", "status": "error", "message": str(e)[:100]}
    return {"provider": "gemini", "status": "error", "message": "Unknown error"}


async def _test_openai(key: str) -> dict:
    """Test OpenAI API key."""
    import urllib.request
    import urllib.error
    try:
        req = urllib.request.Request(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {key}"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                return {"provider": "openai", "status": "ok", "message": "Connected"}
    except urllib.error.HTTPError as e:
        if e.code == 401:
            return {"provider": "openai", "status": "error", "message": "Invalid API key (401)"}
        return {"provider": "openai", "status": "error", "message": f"HTTP {e.code}"}
    except Exception as e:
        return {"provider": "openai", "status": "error", "message": str(e)[:100]}
    return {"provider": "openai", "status": "error", "message": "Unknown error"}


@router.post("/storage/clear-cache")
async def clear_cache():
    """Clear temporary chunk files."""
    cleared = 0
    try:
        if CHUNKS_DIR.exists():
            for f in CHUNKS_DIR.iterdir():
                if f.is_file():
                    f.unlink()
                    cleared += 1
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True, "cleared_files": cleared}


def _get_recent_errors(limit: int = 5) -> list[str]:
    """Get recent error lines from log."""
    if not LOG_FILE.exists():
        return []
    try:
        with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as f:
            all_lines = deque(f, maxlen=500)
        errors = [l.rstrip() for l in all_lines if "[ERROR]" in l]
        return errors[-limit:]
    except Exception:
        return []
