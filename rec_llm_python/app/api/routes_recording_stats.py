"""RecLLM Python — Recording Statistics API"""

from fastapi import APIRouter, HTTPException

from app.database.db import get_cursor

router = APIRouter()


@router.get("/{recording_id}/stats")
async def recording_stats(recording_id: str):
    """Get detailed statistics for a single recording."""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM recordings WHERE id = ?", (recording_id,))
        recording = cur.fetchone()
        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found")

        # Utterance stats
        cur.execute("""
            SELECT
                COUNT(*) as total_utterances,
                COUNT(DISTINCT speaker) as speaker_count,
                SUM(word_count) as total_words,
                AVG(wpm) as avg_wpm,
                MIN(wpm) as min_wpm,
                MAX(wpm) as max_wpm,
                SUM(end_ms - start_ms) as total_speech_ms
            FROM utterances WHERE recording_id = ?
        """, (recording_id,))
        utt_stats = cur.fetchone()

        # Speed distribution
        cur.execute("""
            SELECT speed_label, COUNT(*) as count
            FROM utterances WHERE recording_id = ?
            GROUP BY speed_label
        """, (recording_id,))
        speed_dist = {row["speed_label"]: row["count"] for row in cur.fetchall()}

        # Speaker breakdown
        cur.execute("""
            SELECT speaker, COUNT(*) as utterances, SUM(word_count) as words, AVG(wpm) as avg_wpm
            FROM utterances WHERE recording_id = ?
            GROUP BY speaker ORDER BY utterances DESC
        """, (recording_id,))
        speakers = [dict(row) for row in cur.fetchall()]

    duration_sec = recording["duration_seconds"] or 0
    total_speech_sec = (utt_stats["total_speech_ms"] or 0) / 1000

    return {
        "recordingId": recording_id,
        "fileName": recording["original_file_name"],
        "durationSeconds": duration_sec,
        "totalUtterances": utt_stats["total_utterances"] or 0,
        "totalWords": utt_stats["total_words"] or 0,
        "speakerCount": utt_stats["speaker_count"] or 0,
        "avgWpm": round(utt_stats["avg_wpm"] or 0, 1),
        "minWpm": round(utt_stats["min_wpm"] or 0, 1),
        "maxWpm": round(utt_stats["max_wpm"] or 0, 1),
        "speechRatio": round(total_speech_sec / duration_sec, 2) if duration_sec > 0 else 0,
        "silenceRatio": round(1 - (total_speech_sec / duration_sec), 2) if duration_sec > 0 else 0,
        "speedDistribution": speed_dist,
        "speakers": speakers,
    }
