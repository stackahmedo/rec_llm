"""RecLLM Python Core — Speaker Voice Analysis"""

import logging
from dataclasses import dataclass

from app.database.db import get_cursor

logger = logging.getLogger(__name__)

# Confidence threshold: below this, classify as "unknown"
CONFIDENCE_THRESHOLD = 0.5

# Pitch zones (Hz)
MALE_TYPICAL = 110
FEMALE_TYPICAL = 220
AMBIGUOUS_LOW = 130
AMBIGUOUS_HIGH = 170


@dataclass
class VoiceAnalysis:
    estimated_voice_type: str  # "male" | "female" | "unknown"
    confidence: float  # 0.0 - 1.0
    pitch_hz: float
    wpm: int
    speed_label: str  # "slow" | "normal" | "fast"


def classify_voice_type(pitch_hz: float) -> tuple[str, float]:
    """Classify voice type from pitch with confidence scoring.

    Returns (voice_type, confidence) tuple.
    Uses cautious classification — ambiguous zone returns "unknown".
    """
    if pitch_hz <= 0:
        return "unknown", 0.0

    if pitch_hz > AMBIGUOUS_HIGH:
        # Likely female
        dist = pitch_hz - AMBIGUOUS_HIGH
        confidence = min(1.0, 0.5 + dist / 100)
        voice_type = "female" if confidence >= CONFIDENCE_THRESHOLD else "unknown"
        return voice_type, round(confidence, 2)

    elif pitch_hz < AMBIGUOUS_LOW:
        # Likely male
        dist = AMBIGUOUS_LOW - pitch_hz
        confidence = min(1.0, 0.5 + dist / 60)
        voice_type = "male" if confidence >= CONFIDENCE_THRESHOLD else "unknown"
        return voice_type, round(confidence, 2)

    else:
        # Ambiguous zone (130-170 Hz)
        return "unknown", 0.3


def calculate_speaking_speed(word_count: int, duration_ms: int) -> tuple[int, str]:
    """Calculate WPM and speed label.

    Returns (wpm, speed_label) tuple.
    """
    if duration_ms <= 0 or word_count <= 0:
        return 0, "normal"

    duration_min = duration_ms / 60_000
    wpm = int(word_count / duration_min)

    if wpm < 120:
        return wpm, "slow"
    elif wpm > 160:
        return wpm, "fast"
    else:
        return wpm, "normal"


def analyze_speakers(recording_id: str) -> list[dict]:
    """Analyze all speakers in a recording.

    Returns per-speaker statistics.
    """
    with get_cursor() as cur:
        cur.execute("""
            SELECT speaker,
                   COUNT(*) as utterance_count,
                   SUM(word_count) as total_words,
                   SUM(end_ms - start_ms) as total_duration_ms,
                   AVG(wpm) as avg_wpm,
                   AVG(pitch_hz) as avg_pitch
            FROM utterances
            WHERE recording_id = ? AND word_count > 0
            GROUP BY speaker
        """, (recording_id,))
        rows = cur.fetchall()

    results = []
    for row in rows:
        avg_pitch = row["avg_pitch"] or 0
        voice_type, confidence = classify_voice_type(avg_pitch)
        avg_wpm = int(row["avg_wpm"] or 0)
        _, speed_label = calculate_speaking_speed(avg_wpm, 60_000)  # normalize to per-minute

        results.append({
            "speaker": row["speaker"],
            "utterance_count": row["utterance_count"],
            "total_words": row["total_words"] or 0,
            "total_duration_ms": row["total_duration_ms"] or 0,
            "avg_wpm": avg_wpm,
            "speed_label": speed_label,
            "estimated_voice_type": voice_type,
            "voice_confidence": confidence,
            "avg_pitch_hz": round(avg_pitch, 1),
        })

    # Update speakers table
    _update_speaker_profiles(recording_id, results)

    return results


def _update_speaker_profiles(recording_id: str, analyses: list[dict]):
    """Update or create speaker profiles in the database."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    with get_cursor() as cur:
        for analysis in analyses:
            # Check if speaker exists
            cur.execute("SELECT id FROM speakers WHERE name = ?", (analysis["speaker"],))
            existing = cur.fetchone()

            if existing:
                cur.execute("""
                    UPDATE speakers SET
                        recording_count = recording_count + 1,
                        total_utterances = total_utterances + ?,
                        avg_wpm = ?,
                        estimated_voice_type = ?,
                        voice_confidence = ?,
                        last_seen = ?
                    WHERE id = ?
                """, (
                    analysis["utterance_count"],
                    analysis["avg_wpm"],
                    analysis["estimated_voice_type"],
                    analysis["voice_confidence"],
                    now,
                    existing["id"],
                ))
            else:
                cur.execute("""
                    INSERT INTO speakers (name, display_name, recording_count, total_utterances,
                        avg_wpm, estimated_voice_type, voice_confidence, first_seen, last_seen)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    analysis["speaker"],
                    analysis["speaker"],
                    1,
                    analysis["utterance_count"],
                    analysis["avg_wpm"],
                    analysis["estimated_voice_type"],
                    analysis["voice_confidence"],
                    now,
                    now,
                ))
