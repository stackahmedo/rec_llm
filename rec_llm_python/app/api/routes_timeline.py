"""RecLLM Python — Recording Timeline API"""

from fastapi import APIRouter, HTTPException

from app.database.db import get_cursor

router = APIRouter()


@router.get("/{recording_id}/timeline")
async def recording_timeline(recording_id: str, bucket_minutes: int = 5):
    """Get a timeline of speech activity for a recording, bucketed by time intervals."""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM recordings WHERE id = ?", (recording_id,))
        recording = cur.fetchone()
        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found")

        duration_sec = recording["duration_seconds"] or 0
        if duration_sec == 0:
            return {"recordingId": recording_id, "buckets": [], "bucketMinutes": bucket_minutes}

        bucket_ms = bucket_minutes * 60 * 1000
        total_buckets = max(1, int((duration_sec * 1000) / bucket_ms) + 1)

        # Get utterances
        cur.execute("""
            SELECT speaker, start_ms, end_ms, word_count, wpm, speed_label
            FROM utterances WHERE recording_id = ? ORDER BY start_ms
        """, (recording_id,))
        utterances = cur.fetchall()

    # Build timeline buckets
    buckets = []
    for i in range(total_buckets):
        start = i * bucket_ms
        end = (i + 1) * bucket_ms

        bucket_utterances = [
            u for u in utterances
            if u["start_ms"] < end and u["end_ms"] > start
        ]

        speakers_in_bucket = set(u["speaker"] for u in bucket_utterances)
        total_words = sum(u["word_count"] or 0 for u in bucket_utterances)
        speech_ms = sum(
            min(u["end_ms"], end) - max(u["start_ms"], start)
            for u in bucket_utterances
        )

        buckets.append({
            "index": i,
            "startMs": start,
            "endMs": end,
            "utteranceCount": len(bucket_utterances),
            "speakerCount": len(speakers_in_bucket),
            "speakers": list(speakers_in_bucket),
            "totalWords": total_words,
            "speechMs": speech_ms,
            "speechRatio": round(speech_ms / bucket_ms, 2) if bucket_ms > 0 else 0,
        })

    return {
        "recordingId": recording_id,
        "durationSeconds": duration_sec,
        "bucketMinutes": bucket_minutes,
        "totalBuckets": len(buckets),
        "buckets": buckets,
    }
