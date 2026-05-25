"""RecLLM Python Core — Grammar Correction"""

import logging
from dataclasses import dataclass

from app.database.db import get_cursor

logger = logging.getLogger(__name__)

GRAMMAR_SYSTEM_PROMPT = """You are a professional transcript editor. Fix grammar, punctuation, and spelling errors in the transcript.
Rules:
- Fix obvious errors only
- Do not change meaning or speaker intent
- Preserve technical terms and proper nouns
- Keep the same language
- Return ONLY the corrected text, nothing else"""

# Process in chunks to handle long transcripts
MAX_CHARS_PER_REQUEST = 15_000


@dataclass
class GrammarResult:
    ok: bool
    corrected_count: int = 0
    error: str | None = None


async def correct_grammar(
    recording_id: str,
    client,  # GeminiClient or OpenAIClient
) -> GrammarResult:
    """Correct grammar for all utterances in a recording."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, text FROM utterances WHERE recording_id = ? ORDER BY start_ms",
            (recording_id,),
        )
        utterances = cur.fetchall()

    if not utterances:
        return GrammarResult(ok=False, error="No transcript found")

    # Group utterances into batches by character count
    batches: list[list[dict]] = []
    current_batch: list[dict] = []
    current_chars = 0

    for u in utterances:
        text_len = len(u["text"])
        if current_chars + text_len > MAX_CHARS_PER_REQUEST and current_batch:
            batches.append(current_batch)
            current_batch = []
            current_chars = 0
        current_batch.append({"id": u["id"], "text": u["text"]})
        current_chars += text_len

    if current_batch:
        batches.append(current_batch)

    logger.info("[%s] Grammar correction: %d utterances in %d batches", recording_id, len(utterances), len(batches))

    corrected_count = 0

    for batch_idx, batch in enumerate(batches):
        try:
            # Build numbered text for batch
            numbered_lines = [f"{i + 1}. {item['text']}" for i, item in enumerate(batch)]
            prompt = (
                "Fix grammar and punctuation in each numbered line. "
                "Return the corrected lines in the same numbered format.\n\n"
                + "\n".join(numbered_lines)
            )

            response = await client.generate(prompt, GRAMMAR_SYSTEM_PROMPT)

            # Parse response: extract corrected lines
            corrected_lines = _parse_numbered_response(response, len(batch))

            # Update database
            with get_cursor() as cur:
                for i, item in enumerate(batch):
                    corrected = corrected_lines[i] if i < len(corrected_lines) else item["text"]
                    if corrected != item["text"]:
                        cur.execute(
                            "UPDATE utterances SET corrected_text = ? WHERE id = ?",
                            (corrected, item["id"]),
                        )
                        corrected_count += 1

        except Exception as e:
            logger.warning("Grammar batch %d failed: %s", batch_idx, e)

    return GrammarResult(ok=True, corrected_count=corrected_count)


def _parse_numbered_response(response: str, expected_count: int) -> list[str]:
    """Parse numbered response lines back into a list."""
    lines = response.strip().split("\n")
    results = []

    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Remove numbering: "1. text" -> "text"
        parts = line.split(". ", 1)
        if len(parts) == 2 and parts[0].isdigit():
            results.append(parts[1])
        else:
            results.append(line)

    # Pad if we got fewer results than expected
    while len(results) < expected_count:
        results.append("")

    return results[:expected_count]
