"""RecLLM Python Core — Translation"""

import logging
from dataclasses import dataclass

from app.database.db import get_cursor

logger = logging.getLogger(__name__)

TRANSLATION_SYSTEM_PROMPT = """You are a professional translator. Translate the transcript accurately.
Rules:
- Preserve speaker labels exactly as-is
- Maintain paragraph structure
- Keep technical terms accurate
- Do not add commentary
- Return ONLY the translated text"""

MAX_CHARS_PER_REQUEST = 20_000


@dataclass
class TranslationResult:
    ok: bool
    target_language: str = ""
    translated_count: int = 0
    error: str | None = None


async def translate_transcript(
    recording_id: str,
    target_language: str,
    client,  # GeminiClient or OpenAIClient
    mode: str = "full",  # "full" | "bilingual" | "by_speaker"
) -> TranslationResult:
    """Translate all utterances in a recording."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, speaker, text FROM utterances WHERE recording_id = ? ORDER BY start_ms",
            (recording_id,),
        )
        utterances = cur.fetchall()

    if not utterances:
        return TranslationResult(ok=False, error="No transcript found")

    # Group into batches
    batches: list[list[dict]] = []
    current_batch: list[dict] = []
    current_chars = 0

    for u in utterances:
        text_len = len(u["text"])
        if current_chars + text_len > MAX_CHARS_PER_REQUEST and current_batch:
            batches.append(current_batch)
            current_batch = []
            current_chars = 0
        current_batch.append({"id": u["id"], "speaker": u["speaker"], "text": u["text"]})
        current_chars += text_len

    if current_batch:
        batches.append(current_batch)

    logger.info("[%s] Translation to %s: %d utterances in %d batches", recording_id, target_language, len(utterances), len(batches))

    translated_count = 0
    lang_name = _get_language_name(target_language)

    for batch_idx, batch in enumerate(batches):
        try:
            lines = [f"{item['speaker']}: {item['text']}" for item in batch]
            text_block = "\n".join(lines)

            if mode == "bilingual":
                prompt = (
                    f"Translate each line to {lang_name}. "
                    f"Return each line as: [original] | [translation]\n\n{text_block}"
                )
            else:
                prompt = f"Translate the following to {lang_name}:\n\n{text_block}"

            response = await client.generate(prompt, TRANSLATION_SYSTEM_PROMPT)

            # Parse and save translations
            translated_lines = response.strip().split("\n")
            with get_cursor() as cur:
                for i, item in enumerate(batch):
                    if i < len(translated_lines):
                        translated = translated_lines[i].strip()
                        # Remove speaker prefix if present in translation
                        if translated.startswith(f"{item['speaker']}:"):
                            translated = translated[len(item['speaker']) + 1:].strip()
                        if translated:
                            cur.execute(
                                "UPDATE utterances SET corrected_text = ? WHERE id = ?",
                                (translated, item["id"]),
                            )
                            translated_count += 1

        except Exception as e:
            logger.warning("Translation batch %d failed: %s", batch_idx, e)

    return TranslationResult(ok=True, target_language=target_language, translated_count=translated_count)


def _get_language_name(code: str) -> str:
    """Convert language code to full name."""
    names = {
        "en": "English",
        "ja": "Japanese",
        "zh": "Chinese",
        "ko": "Korean",
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "pt": "Portuguese",
        "bn": "Bengali",
    }
    return names.get(code, code)
