"""RecLLM Python Core — Search API Routes"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.database.db import get_cursor

router = APIRouter()


class SearchQuery(BaseModel):
    query: str
    date_from: str | None = None
    date_to: str | None = None
    language: str | None = None
    speaker: str | None = None
    limit: int = 50


@router.post("/")
async def search_transcripts(params: SearchQuery):
    """Full-text search across all transcripts using FTS5."""
    q = params.query.strip()
    if not q:
        return {"results": [], "total": 0}

    results = []

    # Try FTS5 first
    safe_query = q.replace('"', '').replace("'", "").replace("*", "").strip()
    if safe_query:
        try:
            with get_cursor() as cur:
                cur.execute("""
                    SELECT si.recording_id, si.file_name, si.speaker, si.text,
                           r.processed_at, r.language_code, r.status
                    FROM search_index si
                    JOIN recordings r ON r.id = si.recording_id
                    WHERE search_index MATCH ?
                    ORDER BY rank
                    LIMIT ?
                """, (f'"{safe_query}"', params.limit))
                rows = cur.fetchall()

                for row in rows:
                    # Apply filters
                    if params.date_from and row["processed_at"] and row["processed_at"] < params.date_from:
                        continue
                    if params.date_to and row["processed_at"] and row["processed_at"] > params.date_to + "T23:59:59":
                        continue
                    if params.language and row["language_code"] and row["language_code"] != params.language:
                        continue
                    if params.speaker and row["speaker"] and params.speaker.lower() not in row["speaker"].lower():
                        continue

                    # Extract snippet
                    text = row["text"] or ""
                    idx = text.lower().find(q.lower())
                    start = max(0, idx - 40)
                    end = min(len(text), idx + len(q) + 40)
                    snippet = text[start:end]
                    if start > 0:
                        snippet = "..." + snippet
                    if end < len(text):
                        snippet += "..."

                    results.append({
                        "recording_id": row["recording_id"],
                        "file_name": row["file_name"],
                        "speaker": row["speaker"],
                        "matched_text": snippet,
                        "match_field": "Transcript",
                        "date": row["processed_at"],
                        "language": row["language_code"],
                    })

                if results:
                    return {"results": results, "total": len(results)}
        except Exception:
            pass  # FTS5 failed, fall through to LIKE search

    # Fallback: LIKE search on utterances
    with get_cursor() as cur:
        cur.execute("""
            SELECT u.recording_id, u.speaker, u.text, u.start_ms,
                   r.original_file_name, r.processed_at, r.language_code
            FROM utterances u
            JOIN recordings r ON r.id = u.recording_id
            WHERE u.text LIKE ?
            LIMIT ?
        """, (f"%{q}%", params.limit))
        rows = cur.fetchall()

        for row in rows:
            if params.date_from and row["processed_at"] and row["processed_at"] < params.date_from:
                continue
            if params.date_to and row["processed_at"] and row["processed_at"] > params.date_to + "T23:59:59":
                continue
            if params.language and row["language_code"] and row["language_code"] != params.language:
                continue
            if params.speaker and row["speaker"] and params.speaker.lower() not in row["speaker"].lower():
                continue

            text = row["text"] or ""
            idx = text.lower().find(q.lower())
            start = max(0, idx - 40)
            end = min(len(text), idx + len(q) + 40)
            snippet = text[start:end]
            if start > 0:
                snippet = "..." + snippet
            if end < len(text):
                snippet += "..."

            results.append({
                "recording_id": row["recording_id"],
                "file_name": row["original_file_name"],
                "speaker": row["speaker"],
                "matched_text": snippet,
                "match_field": "Transcript",
                "date": row["processed_at"],
                "language": row["language_code"],
            })

    return {"results": results, "total": len(results)}
