"""RecLLM Python — AI Processing API Routes (Summarize, Grammar, Translate)"""

import json
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database.db import get_cursor
from app.core.job_queue import JobQueue, JobType

logger = logging.getLogger(__name__)

router = APIRouter()


class SummarizeRequest(BaseModel):
    recording_id: str
    language: str = "ja"


class GrammarRequest(BaseModel):
    recording_id: str


class TranslateRequest(BaseModel):
    recording_id: str
    target_language: str = "en"
    mode: str = "full"  # full | bilingual


@router.post("/summarize")
async def summarize_recording(req: SummarizeRequest):
    """Generate AI summary for a recording."""
    # Verify recording exists and has utterances
    with get_cursor() as cur:
        cur.execute("SELECT id, status FROM recordings WHERE id = ?", (req.recording_id,))
        recording = cur.fetchone()
        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found")
        if recording["status"] != "done":
            raise HTTPException(status_code=400, detail="Recording not yet transcribed")

        cur.execute("SELECT COUNT(*) as cnt FROM utterances WHERE recording_id = ?", (req.recording_id,))
        count = cur.fetchone()["cnt"]
        if count == 0:
            raise HTTPException(status_code=400, detail="No transcript data available")

    # Get API key
    api_key, provider = _get_summary_client_info()
    if not api_key:
        raise HTTPException(status_code=400, detail="No AI API key configured (Gemini or OpenAI required)")

    # Create client and generate
    try:
        client = _create_client(provider, api_key)
        from app.ai.summarization import generate_summary
        result = await generate_summary(req.recording_id, client, req.language)
        await client.close()

        if not result.ok:
            raise HTTPException(status_code=500, detail=result.error or "Summary generation failed")

        return {
            "ok": True,
            "summary": result.summary,
            "pointNotes": result.point_notes,
            "actionItems": result.action_items,
            "decisions": result.decisions,
            "risks": result.risks,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/grammar")
async def correct_grammar(req: GrammarRequest):
    """Apply grammar correction to a recording's transcript."""
    with get_cursor() as cur:
        cur.execute("SELECT id FROM recordings WHERE id = ?", (req.recording_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Recording not found")

    api_key, provider = _get_summary_client_info()
    if not api_key:
        raise HTTPException(status_code=400, detail="No AI API key configured")

    try:
        client = _create_client(provider, api_key)
        from app.ai.grammar_correction import correct_grammar as do_correct
        result = await do_correct(req.recording_id, client)
        await client.close()

        if not result.ok:
            raise HTTPException(status_code=500, detail=result.error or "Grammar correction failed")

        return {"ok": True, "correctedCount": result.corrected_count}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/translate")
async def translate_recording(req: TranslateRequest):
    """Translate a recording's transcript."""
    with get_cursor() as cur:
        cur.execute("SELECT id FROM recordings WHERE id = ?", (req.recording_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Recording not found")

    api_key, provider = _get_summary_client_info()
    if not api_key:
        raise HTTPException(status_code=400, detail="No AI API key configured")

    try:
        client = _create_client(provider, api_key)
        from app.ai.translation import translate_transcript
        result = await translate_transcript(req.recording_id, req.target_language, client, req.mode)
        await client.close()

        if not result.ok:
            raise HTTPException(status_code=500, detail=result.error or "Translation failed")

        return {"ok": True, "translatedCount": result.translated_count, "targetLanguage": result.target_language}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summaries/{recording_id}")
async def get_summaries(recording_id: str):
    """Get all summaries for a recording."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM summaries WHERE recording_id = ? ORDER BY generated_at DESC",
            (recording_id,),
        )
        rows = cur.fetchall()

    summaries = []
    for row in rows:
        summaries.append({
            "id": row["id"],
            "summaryType": row["summary_type"],
            "language": row["language"],
            "summary": row["summary"],
            "pointNotes": json.loads(row["point_notes"] or "[]"),
            "actionItems": json.loads(row["action_items"] or "[]"),
            "decisions": json.loads(row["decisions"] or "[]"),
            "risks": json.loads(row["risks"] or "[]"),
            "generatedAt": row["generated_at"],
        })

    return {"summaries": summaries}


def _get_summary_client_info() -> tuple[str | None, str]:
    """Get the best available AI API key and provider."""
    with get_cursor() as cur:
        cur.execute("SELECT value FROM settings WHERE key = ?", ("api_keys",))
        row = cur.fetchone()
        if not row:
            return None, ""
        try:
            keys = json.loads(row["value"])
        except (json.JSONDecodeError, TypeError):
            return None, ""

    # Prefer Gemini, then OpenAI
    if keys.get("gemini"):
        return keys["gemini"], "gemini"
    if keys.get("openai"):
        return keys["openai"], "openai"
    return None, ""


def _create_client(provider: str, api_key: str):
    """Create the appropriate AI client."""
    if provider == "gemini":
        from app.ai.clients.gemini_client import GeminiClient
        return GeminiClient(api_key)
    else:
        from app.ai.clients.openai_client import OpenAIClient
        return OpenAIClient(api_key)
