"""RecLLM Python — Analytics API Routes"""

from fastapi import APIRouter

from app.database.db import get_cursor

router = APIRouter()


@router.get("/overview")
async def get_overview():
    """Get dashboard overview statistics."""
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) as cnt FROM recordings")
        total_recordings = cur.fetchone()["cnt"]

        cur.execute("SELECT COALESCE(SUM(duration_seconds), 0) as total FROM recordings WHERE duration_seconds > 0")
        total_seconds = cur.fetchone()["total"]

        cur.execute("SELECT COUNT(*) as cnt FROM utterances")
        total_utterances = cur.fetchone()["cnt"]

        cur.execute("SELECT COUNT(DISTINCT speaker) as cnt FROM utterances")
        unique_speakers = cur.fetchone()["cnt"]

        cur.execute("""
            SELECT
                SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing
            FROM recordings
        """)
        status_counts = cur.fetchone()

        cur.execute("SELECT AVG(wpm) as avg_wpm FROM utterances WHERE wpm > 0")
        avg_wpm_row = cur.fetchone()
        avg_wpm = round(avg_wpm_row["avg_wpm"] or 0, 1)

        cur.execute("""
            SELECT
                SUM(CASE WHEN wpm < 120 THEN 1 ELSE 0 END) as slow,
                SUM(CASE WHEN wpm >= 120 AND wpm <= 160 THEN 1 ELSE 0 END) as normal,
                SUM(CASE WHEN wpm > 160 THEN 1 ELSE 0 END) as fast
            FROM utterances WHERE wpm > 0
        """)
        speed_counts = cur.fetchone()

    return {
        "totalRecordings": total_recordings,
        "totalHours": round(total_seconds / 3600, 1),
        "totalUtterances": total_utterances,
        "uniqueSpeakers": unique_speakers,
        "avgWpm": avg_wpm,
        "statusCounts": {
            "done": status_counts["done"] or 0,
            "failed": status_counts["failed"] or 0,
            "pending": status_counts["pending"] or 0,
            "processing": status_counts["processing"] or 0,
        },
        "speedCounts": {
            "slow": speed_counts["slow"] or 0,
            "normal": speed_counts["normal"] or 0,
            "fast": speed_counts["fast"] or 0,
        },
    }


@router.get("/today")
async def get_today_stats():
    """Get today's processing statistics."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) as cnt FROM recordings
            WHERE date(created_at) = date('now')
        """)
        today_imported = cur.fetchone()["cnt"]

        cur.execute("""
            SELECT COUNT(*) as cnt FROM recordings
            WHERE date(processed_at) = date('now') AND status = 'done'
        """)
        today_completed = cur.fetchone()["cnt"]

        cur.execute("""
            SELECT COALESCE(SUM(size_bytes), 0) as total FROM recordings
            WHERE date(created_at) = date('now')
        """)
        today_size = cur.fetchone()["total"]

    return {
        "imported": today_imported,
        "completed": today_completed,
        "sizeBytes": today_size,
    }


@router.get("/speakers")
async def get_speaker_stats():
    """Get speaker statistics."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT name, display_name, recording_count, total_utterances,
                   avg_wpm, estimated_voice_type, voice_confidence, last_seen
            FROM speakers
            ORDER BY total_utterances DESC
            LIMIT 50
        """)
        rows = cur.fetchall()

    return {"speakers": [dict(r) for r in rows]}
