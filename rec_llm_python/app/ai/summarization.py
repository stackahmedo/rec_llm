"""RecLLM Python Core — AI Summarization (Single + MapReduce)"""

import json
import logging
from dataclasses import dataclass

from app.database.db import get_cursor

logger = logging.getLogger(__name__)

SUMMARY_SYSTEM_PROMPT = """You are an expert meeting analyst. Analyze the transcript and produce a structured summary.
Return valid JSON with these fields:
- summary: string (executive summary, 2-4 sentences)
- pointNotes: string[] (3-7 key points)
- actionItems: string[] (action items with owners if mentioned)
- decisions: string[] (decisions made)
- risks: string[] (risks or concerns raised)

Be concise. Use the same language as the transcript."""

MAPREDUCE_CHUNK_PROMPT = """Summarize this transcript segment concisely. Extract key points, decisions, and action items.
Keep your summary under 500 words. Use the same language as the transcript.

Transcript segment:
{text}"""

MAPREDUCE_MERGE_PROMPT = """You are given multiple summaries from different segments of the same recording.
Merge them into a single coherent summary.

Return valid JSON:
- summary: string (executive summary covering all segments)
- pointNotes: string[] (all key points, deduplicated)
- actionItems: string[] (all action items)
- decisions: string[] (all decisions)
- risks: string[] (all risks)

Segment summaries:
{summaries}"""


@dataclass
class SummaryResult:
    ok: bool
    summary: str = ""
    point_notes: list[str] | None = None
    action_items: list[str] | None = None
    decisions: list[str] | None = None
    risks: list[str] | None = None
    error: str | None = None


async def generate_summary(
    recording_id: str,
    client,  # GeminiClient or OpenAIClient
    language: str = "ja",
) -> SummaryResult:
    """Generate a summary for a single recording."""
    # Load transcript text
    with get_cursor() as cur:
        cur.execute(
            "SELECT speaker, text, start_ms FROM utterances WHERE recording_id = ? ORDER BY start_ms",
            (recording_id,),
        )
        utterances = cur.fetchall()

    if not utterances:
        return SummaryResult(ok=False, error="No transcript found")

    # Build transcript text
    lines = [f"[{u['speaker']}]: {u['text']}" for u in utterances]
    full_text = "\n".join(lines)

    # Check if we need MapReduce (> 100k chars)
    if len(full_text) > 100_000:
        return await _mapreduce_summary(full_text, client, language)

    # Single-pass summary
    prompt = f"Transcript ({language}):\n\n{full_text[:80000]}"

    try:
        result = await client.generate_json(prompt, SUMMARY_SYSTEM_PROMPT)
        summary_result = SummaryResult(
            ok=True,
            summary=result.get("summary", ""),
            point_notes=result.get("pointNotes", []),
            action_items=result.get("actionItems", []),
            decisions=result.get("decisions", []),
            risks=result.get("risks", []),
        )

        # Save to database
        _save_summary(recording_id, summary_result, language)
        return summary_result

    except Exception as e:
        logger.error("Summary generation failed: %s", e)
        return SummaryResult(ok=False, error=str(e))


async def _mapreduce_summary(
    full_text: str,
    client,
    language: str,
) -> SummaryResult:
    """MapReduce summarization for very long transcripts."""
    # Split into chunks of ~30k chars
    chunk_size = 30_000
    text_chunks = []
    for i in range(0, len(full_text), chunk_size):
        text_chunks.append(full_text[i:i + chunk_size])

    logger.info("MapReduce: %d chunks for %d chars", len(text_chunks), len(full_text))

    # Map phase: summarize each chunk
    chunk_summaries = []
    for i, chunk in enumerate(text_chunks):
        try:
            prompt = MAPREDUCE_CHUNK_PROMPT.format(text=chunk)
            result = await client.generate(prompt)
            chunk_summaries.append(result)
        except Exception as e:
            logger.warning("MapReduce chunk %d failed: %s", i, e)
            chunk_summaries.append(f"[Chunk {i} failed: {e}]")

    # Reduce phase: merge all summaries
    merged_text = "\n\n---\n\n".join(
        f"Segment {i + 1}:\n{s}" for i, s in enumerate(chunk_summaries)
    )

    try:
        prompt = MAPREDUCE_MERGE_PROMPT.format(summaries=merged_text[:80000])
        result = await client.generate_json(prompt, SUMMARY_SYSTEM_PROMPT)
        return SummaryResult(
            ok=True,
            summary=result.get("summary", ""),
            point_notes=result.get("pointNotes", []),
            action_items=result.get("actionItems", []),
            decisions=result.get("decisions", []),
            risks=result.get("risks", []),
        )
    except Exception as e:
        logger.error("MapReduce merge failed: %s", e)
        return SummaryResult(ok=False, error=str(e))


def _save_summary(recording_id: str, result: SummaryResult, language: str):
    """Save summary to database."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    with get_cursor() as cur:
        cur.execute(
            """INSERT INTO summaries (recording_id, summary_type, language, summary, point_notes, action_items, decisions, risks, generated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (recording_id, "executive", language, result.summary,
             json.dumps(result.point_notes or []),
             json.dumps(result.action_items or []),
             json.dumps(result.decisions or []),
             json.dumps(result.risks or []),
             now),
        )
