"""RecLLM — Overlap Detection Service"""

import logging
from pathlib import Path

from app.schemas.speaker_analysis import OverlapRegion

logger = logging.getLogger(__name__)

try:
    import numpy as np
    _NUMPY_AVAILABLE = True
except ImportError:
    np = None
    _NUMPY_AVAILABLE = False

MIN_OVERLAP_MS = 200  # Minimum overlap duration to report


def detect_overlaps(utterances: list[dict], tolerance_ms: int = 100) -> list[OverlapRegion]:
    """Detect overlapping speech regions from utterance timestamps.

    Compares all utterance pairs to find temporal overlaps.
    Does not require raw audio — works from diarization timestamps.
    """
    if not utterances or len(utterances) < 2:
        return []

    sorted_utts = sorted(utterances, key=lambda u: u.get("start_ms", 0))
    overlaps = []

    for i in range(len(sorted_utts)):
        utt_a = sorted_utts[i]
        a_start = utt_a.get("start_ms", 0)
        a_end = utt_a.get("end_ms", a_start)
        a_speaker = utt_a.get("speaker", "UNKNOWN")

        for j in range(i + 1, len(sorted_utts)):
            utt_b = sorted_utts[j]
            b_start = utt_b.get("start_ms", 0)
            b_end = utt_b.get("end_ms", b_start)
            b_speaker = utt_b.get("speaker", "UNKNOWN")

            # No point checking further if b starts after a ends
            if b_start >= a_end + tolerance_ms:
                break

            # Same speaker doesn't count as overlap
            if a_speaker == b_speaker:
                continue

            # Calculate overlap
            overlap_start = max(a_start, b_start)
            overlap_end = min(a_end, b_end)
            overlap_duration = overlap_end - overlap_start

            if overlap_duration >= MIN_OVERLAP_MS:
                confidence = _overlap_confidence(overlap_duration, a_end - a_start, b_end - b_start)
                overlaps.append(OverlapRegion(
                    start_ms=overlap_start,
                    end_ms=overlap_end,
                    involved_speakers=[a_speaker, b_speaker],
                    overlap_confidence=confidence,
                    transcript_confidence_warning=True,
                ))

    # Merge nearby overlaps
    merged = _merge_overlaps(overlaps)
    return merged


def detect_overlaps_from_audio(audio_path: str, utterances: list[dict]) -> list[OverlapRegion]:
    """Enhanced overlap detection using energy analysis on audio.

    Falls back to timestamp-based detection if audio analysis fails or deps missing.
    """
    if not _NUMPY_AVAILABLE:
        return detect_overlaps(utterances)

    try:
        import soundfile as sf
        data, sr = sf.read(audio_path, dtype="float32")
        if data.ndim > 1:
            data = data.mean(axis=1)
    except Exception as e:
        logger.warning("Cannot read audio for overlap detection: %s, falling back to timestamps", e)
        return detect_overlaps(utterances)

    # Start with timestamp-based overlaps
    timestamp_overlaps = detect_overlaps(utterances)

    # Validate each overlap by checking if energy is higher than expected
    validated = []
    for overlap in timestamp_overlaps:
        start_sample = int((overlap.start_ms / 1000.0) * sr)
        end_sample = int((overlap.end_ms / 1000.0) * sr)
        start_sample = max(0, min(start_sample, len(data)))
        end_sample = max(start_sample, min(end_sample, len(data)))

        if end_sample <= start_sample:
            validated.append(overlap)
            continue

        segment = data[start_sample:end_sample]
        rms = np.sqrt(np.mean(segment ** 2))

        # Higher energy in overlap region suggests actual simultaneous speech
        if rms > 0.015:
            overlap.overlap_confidence = min(1.0, overlap.overlap_confidence + 0.1)
        else:
            overlap.overlap_confidence = max(0.1, overlap.overlap_confidence - 0.2)

        validated.append(overlap)

    return validated


def _overlap_confidence(overlap_ms: int, dur_a_ms: int, dur_b_ms: int) -> float:
    """Estimate confidence based on overlap proportion."""
    if dur_a_ms == 0 or dur_b_ms == 0:
        return 0.3

    shorter = min(dur_a_ms, dur_b_ms)
    ratio = overlap_ms / shorter if shorter > 0 else 0

    if ratio > 0.5:
        return round(min(0.95, 0.6 + ratio * 0.3), 2)
    if ratio > 0.2:
        return round(0.4 + ratio * 0.4, 2)
    return round(max(0.2, ratio * 2), 2)


def _merge_overlaps(overlaps: list[OverlapRegion], gap_ms: int = 300) -> list[OverlapRegion]:
    """Merge overlaps that are very close together."""
    if not overlaps:
        return []

    sorted_ovs = sorted(overlaps, key=lambda o: o.start_ms)
    merged = [sorted_ovs[0]]

    for ov in sorted_ovs[1:]:
        last = merged[-1]
        if ov.start_ms <= last.end_ms + gap_ms:
            # Merge
            last.end_ms = max(last.end_ms, ov.end_ms)
            for sp in ov.involved_speakers:
                if sp not in last.involved_speakers:
                    last.involved_speakers.append(sp)
            last.overlap_confidence = max(last.overlap_confidence, ov.overlap_confidence)
        else:
            merged.append(ov)

    return merged
