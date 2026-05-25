"""RecLLM Python Core — Transcription Worker

Handles the full pipeline for a single recording:
1. Analyze audio metadata + determine tier
2. Optional noise reduction
3. Split into chunks (if long audio)
4. Upload + transcribe each chunk (with retry)
5. Streaming merge of results
6. Save to database
7. Update progress throughout
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from app.config import (
    CHUNKS_DIR, MAX_RETRIES, RATE_LIMIT_DELAY_SEC,
    CHUNK_DURATION_NORMAL_MIN, CHUNK_DURATION_ENTERPRISE_MIN,
    ensure_dirs,
)
from app.audio.ffmpeg_runner import get_audio_metadata, split_audio, apply_noise_reduction
from app.audio.duration_detector import get_tier_recommendation, AudioTier
from app.ai.clients.assemblyai_client import AssemblyAIClient, TranscriptionResult, Utterance
from app.core.job_queue import Job, JobQueue, JobStatus
from app.database.db import get_cursor

logger = logging.getLogger(__name__)


async def transcription_worker(job: Job, queue: JobQueue):
    """Main transcription worker — processes one recording end-to-end."""
    recording_id = job.recording_id
    if not recording_id:
        raise ValueError("Job has no recording_id")

    # Load recording info
    with get_cursor() as cur:
        cur.execute("SELECT * FROM recordings WHERE id = ?", (recording_id,))
        recording = cur.fetchone()
        if not recording:
            raise ValueError(f"Recording not found: {recording_id}")

    file_path = recording["file_path"]
    if not file_path or not Path(file_path).exists():
        raise FileNotFoundError(f"Audio file not found: {file_path}")

    # Get API key
    api_key = _get_api_key("assemblyai")
    if not api_key:
        raise ValueError("AssemblyAI API key not configured")

    # Update status
    _update_recording_status(recording_id, "processing")
    queue.update_progress(job.id, 5)

    ensure_dirs()

    # Step 1: Get metadata + tier
    logger.info("[%s] Analyzing audio: %s", recording_id, file_path)
    meta = get_audio_metadata(file_path)
    recommendation = get_tier_recommendation(meta.duration_seconds)

    if recommendation.tier == AudioTier.BLOCKED:
        raise ValueError(f"Audio too long ({meta.duration_seconds / 3600:.1f}h). Maximum is 30h.")

    queue.update_progress(job.id, 10)

    # Step 2: Noise reduction (if enabled)
    process_path = file_path
    settings = _get_settings()
    if settings.get("noise_reduction"):
        logger.info("[%s] Applying noise reduction...", recording_id)
        try:
            nr_path = CHUNKS_DIR / f"{recording_id}_denoised.wav"
            process_path = apply_noise_reduction(file_path, nr_path)
            queue.update_progress(job.id, 15)
        except Exception as e:
            logger.warning("[%s] Noise reduction failed, using original: %s", recording_id, e)

    # Step 3: Process based on tier
    client = AssemblyAIClient(api_key)
    try:
        if recommendation.tier == AudioTier.NORMAL:
            # Direct transcription (no chunking)
            result = await _transcribe_direct(client, process_path, recording_id, job, queue)
        else:
            # Chunked pipeline
            result = await _transcribe_chunked(
                client, process_path, recording_id, recommendation, job, queue
            )
    finally:
        await client.close()

    if not result or not result.ok:
        error = result.error if result else "Unknown transcription error"
        raise RuntimeError(error)

    # Step 4: Save results to database
    queue.update_progress(job.id, 90)
    _save_transcript(recording_id, result, meta)

    # Step 5: Mark complete
    _update_recording_status(recording_id, "done", {
        "language_code": result.language_code,
        "speaker_count": len(set(u.speaker for u in (result.utterances or []))),
        "duration_seconds": meta.duration_seconds,
    })
    queue.update_progress(job.id, 100, JobStatus.DONE)
    logger.info("[%s] Transcription complete: %d utterances", recording_id, len(result.utterances or []))


async def _transcribe_direct(
    client: AssemblyAIClient,
    file_path: str,
    recording_id: str,
    job: Job,
    queue: JobQueue,
) -> TranscriptionResult:
    """Direct transcription for short audio (< 2h)."""
    logger.info("[%s] Direct transcription (no chunking)", recording_id)
    queue.update_progress(job.id, 20)

    # Upload
    upload_url = await client.upload_file(file_path)
    queue.update_progress(job.id, 40)

    # Transcribe
    settings = _get_settings()
    language = settings.get("language_code", "auto")
    result = await client.transcribe(upload_url, speaker_labels=True, language_code=language)
    queue.update_progress(job.id, 85)

    return result


async def _transcribe_chunked(
    client: AssemblyAIClient,
    file_path: str,
    recording_id: str,
    recommendation,
    job: Job,
    queue: JobQueue,
) -> TranscriptionResult:
    """Chunked transcription for long audio (2-30h)."""
    chunk_duration_sec = recommendation.chunk_duration_min * 60
    concurrency = recommendation.concurrency

    logger.info(
        "[%s] Chunked transcription: %d chunks × %dmin, concurrency=%d",
        recording_id, recommendation.total_chunks, recommendation.chunk_duration_min, concurrency,
    )

    # Split audio
    queue.update_progress(job.id, 15)
    chunk_dir = CHUNKS_DIR / recording_id
    chunks = split_audio(file_path, chunk_dir, chunk_duration_sec, recording_id)
    total_chunks = len(chunks)

    # Save chunk records to database
    _save_chunks_to_db(recording_id, chunks)
    queue.update_progress(job.id, 20)

    # Process chunks with concurrency control
    semaphore = asyncio.Semaphore(concurrency)
    results: list[TranscriptionResult | None] = [None] * total_chunks
    settings = _get_settings()
    language = settings.get("language_code", "auto")

    async def process_chunk(idx: int, chunk: dict):
        async with semaphore:
            for attempt in range(MAX_RETRIES):
                try:
                    _update_chunk_status(recording_id, idx, "processing")

                    # Rate limit between uploads
                    if idx > 0:
                        await asyncio.sleep(RATE_LIMIT_DELAY_SEC)

                    result = await client.transcribe_file(
                        chunk["file_path"],
                        speaker_labels=True,
                        language_code=language,
                    )

                    if result.ok:
                        results[idx] = result
                        _update_chunk_status(recording_id, idx, "done")

                        # Update progress
                        done_count = sum(1 for r in results if r is not None)
                        progress = 20 + int((done_count / total_chunks) * 65)
                        queue.update_progress(job.id, progress)
                        return
                    else:
                        logger.warning(
                            "[%s] Chunk %d attempt %d failed: %s",
                            recording_id, idx, attempt + 1, result.error,
                        )
                except Exception as e:
                    logger.warning(
                        "[%s] Chunk %d attempt %d error: %s",
                        recording_id, idx, attempt + 1, e,
                    )

                _update_chunk_status(recording_id, idx, "retrying", attempt + 1)
                await asyncio.sleep(2 ** attempt)  # Exponential backoff

            # All retries exhausted
            _update_chunk_status(recording_id, idx, "failed")
            logger.error("[%s] Chunk %d permanently failed after %d retries", recording_id, idx, MAX_RETRIES)

    # Run all chunks
    tasks = [process_chunk(i, chunk) for i, chunk in enumerate(chunks)]
    await asyncio.gather(*tasks)

    # Streaming merge
    queue.update_progress(job.id, 87)
    merged = _streaming_merge(results, chunks)

    return merged


def _streaming_merge(
    results: list[TranscriptionResult | None],
    chunks: list[dict],
) -> TranscriptionResult:
    """Merge chunk results into a single transcript (streaming — one chunk at a time in memory)."""
    all_utterances: list[Utterance] = []
    full_text_parts: list[str] = []
    language_code = "auto"

    for idx, result in enumerate(results):
        if result is None or not result.ok:
            continue  # Skip failed chunks

        if result.language_code and result.language_code != "auto":
            language_code = result.language_code

        chunk_offset_ms = int(chunks[idx]["start_time_sec"] * 1000)

        for u in (result.utterances or []):
            all_utterances.append(Utterance(
                speaker=u.speaker,
                text=u.text,
                start_ms=u.start_ms + chunk_offset_ms,
                end_ms=u.end_ms + chunk_offset_ms,
                confidence=u.confidence,
            ))

        if result.full_text:
            full_text_parts.append(result.full_text)

        # Free memory: clear the result after merging
        results[idx] = None

    # Sort by timestamp
    all_utterances.sort(key=lambda u: u.start_ms)

    return TranscriptionResult(
        ok=True,
        full_text="\n\n".join(full_text_parts),
        utterances=all_utterances,
        language_code=language_code,
    )


def _save_transcript(recording_id: str, result: TranscriptionResult, meta):
    """Save transcript utterances to database + FTS index."""
    with get_cursor() as cur:
        # Clear existing utterances (in case of re-processing)
        cur.execute("DELETE FROM utterances WHERE recording_id = ?", (recording_id,))

        for u in (result.utterances or []):
            word_count = len(u.text.split())
            duration_sec = max(0.1, (u.end_ms - u.start_ms) / 1000)
            wpm = int(word_count / (duration_sec / 60)) if duration_sec > 0 else 0
            speed_label = "slow" if wpm < 120 else ("fast" if wpm > 160 else "normal")

            cur.execute(
                """INSERT INTO utterances (recording_id, speaker, text, start_ms, end_ms,
                   confidence, word_count, wpm, speed_label)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (recording_id, u.speaker, u.text, u.start_ms, u.end_ms,
                 u.confidence, word_count, wpm, speed_label),
            )

            # FTS index
            cur.execute(
                "INSERT INTO search_index (recording_id, file_name, speaker, text) VALUES (?, ?, ?, ?)",
                (recording_id, "", u.speaker, u.text),
            )


def _save_chunks_to_db(recording_id: str, chunks: list[dict]):
    """Save chunk records to database."""
    with get_cursor() as cur:
        for chunk in chunks:
            cur.execute(
                """INSERT INTO chunks (recording_id, chunk_index, start_time_sec, end_time_sec, file_path, status)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (recording_id, chunk["chunk_index"], chunk["start_time_sec"],
                 chunk["end_time_sec"], chunk["file_path"], "pending"),
            )


def _update_chunk_status(recording_id: str, chunk_index: int, status: str, retry_count: int = 0):
    """Update chunk status in database."""
    with get_cursor() as cur:
        cur.execute(
            "UPDATE chunks SET status = ?, retry_count = ? WHERE recording_id = ? AND chunk_index = ?",
            (status, retry_count, recording_id, chunk_index),
        )


def _update_recording_status(recording_id: str, status: str, extra: dict | None = None):
    """Update recording status."""
    now = datetime.now(timezone.utc).isoformat()
    with get_cursor() as cur:
        if extra:
            sets = ", ".join(f"{k} = ?" for k in extra.keys())
            values = list(extra.values()) + [now, status, recording_id]
            cur.execute(
                f"UPDATE recordings SET {sets}, processed_at = ?, status = ? WHERE id = ?",
                values,
            )
        else:
            cur.execute(
                "UPDATE recordings SET status = ?, processed_at = ? WHERE id = ?",
                (status, now, recording_id),
            )


def _get_api_key(provider: str) -> str | None:
    """Get API key from settings."""
    with get_cursor() as cur:
        cur.execute("SELECT value FROM settings WHERE key = ?", ("api_keys",))
        row = cur.fetchone()
        if not row:
            return None
        try:
            keys = json.loads(row["value"])
            return keys.get(provider)
        except (json.JSONDecodeError, TypeError):
            return None


def _get_settings() -> dict:
    """Get processing settings."""
    with get_cursor() as cur:
        cur.execute("SELECT value FROM settings WHERE key = ?", ("preferences",))
        row = cur.fetchone()
        if not row:
            return {}
        try:
            return json.loads(row["value"])
        except (json.JSONDecodeError, TypeError):
            return {}
