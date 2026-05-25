"""RecLLM Python Core — Recordings API Routes"""

import uuid
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from pydantic import BaseModel

from app.config import RECORDINGS_DIR, AUDIO_EXTENSIONS, ensure_dirs
from app.database.db import get_cursor
from app.audio.ffmpeg_runner import get_audio_metadata
from app.audio.duration_detector import get_tier_recommendation

router = APIRouter()


class RecordingResponse(BaseModel):
    id: str
    original_file_name: str
    duration_seconds: float | None
    language_code: str
    speaker_count: int
    status: str
    created_at: str


@router.get("/")
async def list_recordings(limit: int = 50, offset: int = 0):
    """List all recordings with pagination."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM recordings ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        )
        rows = cur.fetchall()
        cur.execute("SELECT COUNT(*) as cnt FROM recordings")
        total = cur.fetchone()["cnt"]

    return {
        "recordings": [dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{recording_id}")
async def get_recording(recording_id: str):
    """Get a single recording with its utterances."""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM recordings WHERE id = ?", (recording_id,))
        recording = cur.fetchone()
        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found")

        cur.execute(
            "SELECT * FROM utterances WHERE recording_id = ? ORDER BY start_ms",
            (recording_id,),
        )
        utterances = cur.fetchall()

    return {
        "recording": dict(recording),
        "utterances": [dict(u) for u in utterances],
    }


@router.post("/import")
async def import_file(file_path: str):
    """Import an audio file from a local path."""
    path = Path(file_path)
    if not path.exists():
        raise HTTPException(status_code=400, detail=f"File not found: {file_path}")

    ext = path.suffix.lstrip(".").lower()
    if ext not in AUDIO_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}")

    # Get metadata
    try:
        meta = get_audio_metadata(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read audio: {str(e)}")

    # Get tier recommendation
    recommendation = get_tier_recommendation(meta.duration_seconds)

    # Create recording entry
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

    return {
        "id": recording_id,
        "file_name": path.name,
        "duration_seconds": meta.duration_seconds,
        "tier": recommendation.tier.value,
        "recommendation": recommendation.reason,
        "total_chunks": recommendation.total_chunks,
    }


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload an audio file via multipart form data."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = Path(file.filename).suffix.lstrip(".").lower()
    if ext not in AUDIO_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}")

    ensure_dirs()
    recording_id = str(uuid.uuid4())[:12]
    save_path = RECORDINGS_DIR / f"{recording_id}.{ext}"

    # Save uploaded file
    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Get metadata
    try:
        meta = get_audio_metadata(str(save_path))
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Cannot read audio: {str(e)}")

    recommendation = get_tier_recommendation(meta.duration_seconds)
    now = datetime.now(timezone.utc).isoformat()

    with get_cursor() as cur:
        cur.execute(
            """INSERT INTO recordings (id, original_file_name, file_path, file_extension, size_bytes,
               duration_seconds, language_code, status, imported_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (recording_id, file.filename, str(save_path), ext, len(content),
             meta.duration_seconds, "auto", "pending", now, now),
        )

    return {
        "id": recording_id,
        "file_name": file.filename,
        "duration_seconds": meta.duration_seconds,
        "size_bytes": len(content),
        "tier": recommendation.tier.value,
        "recommendation": recommendation.reason,
        "total_chunks": recommendation.total_chunks,
    }


@router.put("/{recording_id}/utterances/{utterance_id}")
async def update_utterance(recording_id: str, utterance_id: int, text: str = Form(...)):
    """Edit a single utterance's text (transcript editing)."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT id FROM utterances WHERE id = ? AND recording_id = ?",
            (utterance_id, recording_id),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Utterance not found")

        cur.execute(
            "UPDATE utterances SET corrected_text = ? WHERE id = ?",
            (text, utterance_id),
        )

    return {"ok": True, "utterance_id": utterance_id}


@router.put("/{recording_id}/speaker")
async def rename_speaker(recording_id: str, old_name: str = Form(...), new_name: str = Form(...)):
    """Rename a speaker across all utterances in a recording."""
    with get_cursor() as cur:
        cur.execute(
            "UPDATE utterances SET speaker = ? WHERE recording_id = ? AND speaker = ?",
            (new_name, recording_id, old_name),
        )
        count = cur.rowcount

    if count == 0:
        raise HTTPException(status_code=404, detail=f"Speaker '{old_name}' not found")

    return {"ok": True, "renamed": count}


@router.delete("/{recording_id}")
async def delete_recording(recording_id: str):
    """Delete a recording and all associated data."""
    with get_cursor() as cur:
        cur.execute("SELECT id FROM recordings WHERE id = ?", (recording_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Recording not found")
        cur.execute("DELETE FROM recordings WHERE id = ?", (recording_id,))

    return {"ok": True}


@router.get("/{recording_id}/stats")
async def get_recording_stats(recording_id: str):
    """Get statistics for a recording."""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM recordings WHERE id = ?", (recording_id,))
        recording = cur.fetchone()
        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found")

        cur.execute(
            "SELECT COUNT(*) as cnt, COUNT(DISTINCT speaker) as speakers FROM utterances WHERE recording_id = ?",
            (recording_id,),
        )
        stats = cur.fetchone()

        cur.execute(
            "SELECT AVG(wpm) as avg_wpm FROM utterances WHERE recording_id = ? AND wpm > 0",
            (recording_id,),
        )
        speed = cur.fetchone()

    return {
        "utterance_count": stats["cnt"],
        "speaker_count": stats["speakers"],
        "avg_wpm": round(speed["avg_wpm"] or 0, 1),
        "duration_seconds": recording["duration_seconds"],
    }
