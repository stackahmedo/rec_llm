"""RecLLM Python — Speaker Analysis API Routes"""

from fastapi import APIRouter, HTTPException

from app.database.db import get_cursor
from app.ai.speaker_analysis import analyze_speakers, classify_voice_type

router = APIRouter()


@router.get("/{recording_id}")
async def get_speakers(recording_id: str):
    """Get speaker analysis for a recording."""
    with get_cursor() as cur:
        cur.execute("SELECT id FROM recordings WHERE id = ?", (recording_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Recording not found")

    results = analyze_speakers(recording_id)
    return {"speakers": results}


@router.get("/")
async def list_all_speakers(limit: int = 50):
    """List all known speakers across recordings."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT name, display_name, recording_count, total_utterances,
                   avg_wpm, estimated_voice_type, voice_confidence, first_seen, last_seen
            FROM speakers
            ORDER BY total_utterances DESC
            LIMIT ?
        """, (limit,))
        rows = cur.fetchall()

    return {"speakers": [dict(r) for r in rows]}


@router.put("/{recording_id}/rename")
async def rename_speaker_global(recording_id: str, old_name: str, new_name: str):
    """Rename a speaker in a recording and update the speakers table."""
    with get_cursor() as cur:
        cur.execute(
            "UPDATE utterances SET speaker = ? WHERE recording_id = ? AND speaker = ?",
            (new_name, recording_id, old_name),
        )
        count = cur.rowcount

        if count == 0:
            raise HTTPException(status_code=404, detail=f"Speaker '{old_name}' not found")

        # Update speakers table
        cur.execute("UPDATE speakers SET name = ?, display_name = ? WHERE name = ?", (new_name, new_name, old_name))

    return {"ok": True, "renamed": count}
