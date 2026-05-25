"""RecLLM Python — Batch Import API Route"""

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import AUDIO_EXTENSIONS, ensure_dirs
from app.database.db import get_cursor
from app.audio.ffmpeg_runner import get_audio_metadata
from app.audio.duration_detector import get_tier_recommendation
from app.core.job_queue import JobQueue, JobType

router = APIRouter()


class BatchImportItem(BaseModel):
    file_path: str


class BatchImportRequest(BaseModel):
    files: List[BatchImportItem]
    auto_start: bool = True


@router.post("/batch-import")
async def batch_import(req: BatchImportRequest):
    """Import multiple audio files at once and optionally queue them for processing."""
    ensure_dirs()
    results = []
    errors = []

    for item in req.files:
        path = Path(item.file_path)

        if not path.exists():
            errors.append({"file": item.file_path, "error": "File not found"})
            continue

        ext = path.suffix.lstrip(".").lower()
        if ext not in AUDIO_EXTENSIONS:
            errors.append({"file": item.file_path, "error": f"Unsupported format: {ext}"})
            continue

        try:
            meta = get_audio_metadata(item.file_path)
        except Exception as e:
            errors.append({"file": item.file_path, "error": f"Cannot read audio: {str(e)}"})
            continue

        recommendation = get_tier_recommendation(meta.duration_seconds)
        recording_id = str(uuid.uuid4())[:12]
        now = datetime.now(timezone.utc).isoformat()

        with get_cursor() as cur:
            cur.execute(
                """INSERT INTO recordings (id, original_file_name, file_path, file_extension, size_bytes,
                   duration_seconds, language_code, status, imported_at, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (recording_id, path.name, str(path), ext, meta.file_size_bytes,
                 meta.duration_seconds, "auto", "pending", now, now),
            )

        results.append({
            "id": recording_id,
            "file_name": path.name,
            "duration_seconds": meta.duration_seconds,
            "tier": recommendation.tier.value,
            "total_chunks": recommendation.total_chunks,
        })

    return {
        "imported": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors,
    }
