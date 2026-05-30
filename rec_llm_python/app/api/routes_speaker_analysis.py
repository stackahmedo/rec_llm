"""RecLLM — Speaker Intelligence API Routes"""

import logging
from dataclasses import asdict

from fastapi import APIRouter, HTTPException

from app.services.speaker_intelligence import analyze_recording, get_analysis, get_overlaps

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{recording_id}/speaker-analysis")
async def get_speaker_analysis(recording_id: str):
    """Get speaker analysis results for a recording."""
    result = get_analysis(recording_id)
    if not result:
        return {"recording_id": recording_id, "analyzed": False, "message": "No analysis available. Run POST to analyze."}

    return {
        "recording_id": result.recording_id,
        "analyzed": True,
        "total_speakers": result.total_speakers,
        "analysis_duration_sec": result.analysis_duration_sec,
        "voice_profiles": [asdict(p) for p in result.voice_profiles],
        "speed_profiles": [asdict(p) for p in result.speed_profiles],
        "overlaps": [asdict(o) for o in result.overlaps],
        "error": result.error,
    }


@router.post("/{recording_id}/analyze-speakers")
async def run_speaker_analysis(recording_id: str):
    """Run speaker intelligence analysis on a recording."""
    from app.database.db import get_cursor

    with get_cursor() as cur:
        cur.execute("SELECT id FROM recordings WHERE id = ?", (recording_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Recording not found")

    try:
        result = analyze_recording(recording_id)
    except Exception as e:
        logger.exception("Speaker analysis failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)[:200]}")

    return {
        "recording_id": result.recording_id,
        "analyzed": True,
        "total_speakers": result.total_speakers,
        "analysis_duration_sec": result.analysis_duration_sec,
        "voice_profiles": [asdict(p) for p in result.voice_profiles],
        "speed_profiles": [asdict(p) for p in result.speed_profiles],
        "overlaps": [asdict(o) for o in result.overlaps],
        "error": result.error,
    }


@router.get("/{recording_id}/overlaps")
async def get_recording_overlaps(recording_id: str):
    """Get overlap regions for a recording."""
    from app.database.db import get_cursor

    with get_cursor() as cur:
        cur.execute("SELECT id FROM recordings WHERE id = ?", (recording_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Recording not found")

    overlaps = get_overlaps(recording_id)
    return {
        "recording_id": recording_id,
        "overlaps": [asdict(o) for o in overlaps],
        "total_overlaps": len(overlaps),
    }
