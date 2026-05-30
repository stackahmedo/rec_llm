"""RecLLM — Speaker Intelligence Service (orchestrator)"""

import logging
import time
from dataclasses import asdict

from app.schemas.speaker_analysis import (
    SpeakerAnalysisResult, SpeakerVoiceProfile, SpeakerSpeedProfile,
    SpeakingSpeed, OverlapRegion,
)
from app.services.voice_features import extract_voice_profile, is_available as _voice_available, get_availability
from app.services.overlap_detection import detect_overlaps, detect_overlaps_from_audio
from app.database.db import get_cursor

logger = logging.getLogger(__name__)


def is_available() -> bool:
    """Check if Speaker Intelligence is available."""
    return _voice_available()


def get_status() -> dict:
    """Get Speaker Intelligence status for diagnostics."""
    avail = get_availability()
    avail["last_error"] = _last_error
    return avail


_last_error: str | None = None

# Speaking speed thresholds
WPM_SLOW = 100
WPM_FAST = 160
CPM_SLOW = 200  # Japanese characters per minute
CPM_FAST = 400


def analyze_recording(recording_id: str) -> SpeakerAnalysisResult:
    """Run full speaker intelligence analysis on a recording."""
    global _last_error
    start_time = time.time()
    result = SpeakerAnalysisResult(recording_id=recording_id)

    if not is_available():
        result.error = "Speaker Intelligence is not available in this build (missing numpy/soundfile)"
        _last_error = result.error
        return result

    try:
        # Get recording info and utterances
        recording, utterances = _load_recording_data(recording_id)
        if not recording:
            result.error = "Recording not found"
            return result

        audio_path = recording.get("file_path", "")
        if not audio_path:
            result.error = "No audio file path"
            return result

        # Group utterances by speaker
        speaker_groups = _group_by_speaker(utterances)
        result.total_speakers = len(speaker_groups)

        # Voice profile analysis
        for speaker_id, segments in speaker_groups.items():
            try:
                voice_profile = extract_voice_profile(audio_path, speaker_id, segments)
                result.voice_profiles.append(voice_profile)
            except Exception as e:
                logger.error("Voice profile failed for %s: %s", speaker_id, e)
                result.voice_profiles.append(SpeakerVoiceProfile(speaker_id=speaker_id))

        # Speaking speed analysis
        total_duration = recording.get("duration_seconds", 0) or 0
        language = recording.get("language_code", "auto")
        for speaker_id, segments in speaker_groups.items():
            try:
                speed_profile = _analyze_speed(speaker_id, segments, total_duration, language)
                result.speed_profiles.append(speed_profile)
            except Exception as e:
                logger.error("Speed analysis failed for %s: %s", speaker_id, e)
                result.speed_profiles.append(SpeakerSpeedProfile(speaker_id=speaker_id))

        # Overlap detection
        try:
            result.overlaps = detect_overlaps_from_audio(audio_path, utterances)
        except Exception as e:
            logger.error("Overlap detection failed: %s", e)
            result.overlaps = detect_overlaps(utterances)

    except Exception as e:
        logger.exception("Speaker analysis failed for %s: %s", recording_id, e)
        result.error = str(e)[:200]

    result.analysis_duration_sec = round(time.time() - start_time, 2)

    # Persist results
    try:
        _save_analysis(result)
    except Exception as e:
        logger.error("Failed to save analysis: %s", e)

    return result


def get_analysis(recording_id: str) -> SpeakerAnalysisResult | None:
    """Load previously saved analysis from database."""
    import json
    with get_cursor() as cur:
        cur.execute(
            "SELECT analysis_json FROM speaker_analysis WHERE recording_id = ?",
            (recording_id,),
        )
        row = cur.fetchone()

    if not row:
        return None

    try:
        data = json.loads(row["analysis_json"])
        return _deserialize_result(data)
    except Exception as e:
        logger.error("Failed to deserialize analysis: %s", e)
        return None


def get_overlaps(recording_id: str) -> list[OverlapRegion]:
    """Get overlap regions for a recording."""
    analysis = get_analysis(recording_id)
    if analysis:
        return analysis.overlaps
    return []


def _load_recording_data(recording_id: str) -> tuple[dict | None, list[dict]]:
    """Load recording and its utterances from database."""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM recordings WHERE id = ?", (recording_id,))
        recording = cur.fetchone()
        if not recording:
            return None, []

        cur.execute(
            "SELECT * FROM utterances WHERE recording_id = ? ORDER BY start_ms",
            (recording_id,),
        )
        utterances = [dict(r) for r in cur.fetchall()]

    return dict(recording), utterances


def _group_by_speaker(utterances: list[dict]) -> dict[str, list[dict]]:
    """Group utterances by speaker ID."""
    groups: dict[str, list[dict]] = {}
    for utt in utterances:
        speaker = utt.get("speaker", "UNKNOWN")
        if speaker not in groups:
            groups[speaker] = []
        groups[speaker].append(utt)
    return groups


def _analyze_speed(
    speaker_id: str,
    segments: list[dict],
    total_duration: float,
    language: str,
) -> SpeakerSpeedProfile:
    """Analyze speaking speed for a speaker."""
    profile = SpeakerSpeedProfile(speaker_id=speaker_id)

    if not segments:
        return profile

    # Calculate total speaking time
    total_ms = sum(
        (seg.get("end_ms", seg.get("start_ms", 0)) - seg.get("start_ms", 0))
        for seg in segments
    )
    profile.total_speaking_time_sec = round(total_ms / 1000.0, 1)

    if total_duration > 0:
        profile.talk_percentage = round((profile.total_speaking_time_sec / total_duration) * 100, 1)

    # Count words/characters
    total_text = " ".join(seg.get("text", "") or seg.get("corrected_text", "") or "" for seg in segments)
    total_text = total_text.strip()

    if not total_text or profile.total_speaking_time_sec < 1:
        return profile

    minutes = profile.total_speaking_time_sec / 60.0

    is_japanese = language == "ja" or _is_japanese_text(total_text)

    if is_japanese:
        char_count = sum(1 for c in total_text if not c.isspace())
        profile.characters_per_minute = round(char_count / minutes, 1) if minutes > 0 else 0
        if profile.characters_per_minute < CPM_SLOW:
            profile.speaking_speed = SpeakingSpeed.SLOW
        elif profile.characters_per_minute > CPM_FAST:
            profile.speaking_speed = SpeakingSpeed.FAST
        else:
            profile.speaking_speed = SpeakingSpeed.NORMAL
    else:
        word_count = len(total_text.split())
        profile.words_per_minute = round(word_count / minutes, 1) if minutes > 0 else 0
        if profile.words_per_minute < WPM_SLOW:
            profile.speaking_speed = SpeakingSpeed.SLOW
        elif profile.words_per_minute > WPM_FAST:
            profile.speaking_speed = SpeakingSpeed.FAST
        else:
            profile.speaking_speed = SpeakingSpeed.NORMAL

    # Pause ratio: time not speaking within their segments
    total_segment_span = 0
    if len(segments) >= 2:
        first_start = segments[0].get("start_ms", 0)
        last_end = segments[-1].get("end_ms", segments[-1].get("start_ms", 0))
        total_segment_span = (last_end - first_start) / 1000.0

    if total_segment_span > 0:
        profile.pause_ratio = round(
            max(0, 1.0 - (profile.total_speaking_time_sec / total_segment_span)), 2
        )

    return profile


def _is_japanese_text(text: str) -> bool:
    """Heuristic: if >30% of characters are CJK, treat as Japanese."""
    if not text:
        return False
    cjk_count = sum(1 for c in text if '　' <= c <= '鿿' or '＀' <= c <= '￯')
    return cjk_count / max(len(text), 1) > 0.3


def _save_analysis(result: SpeakerAnalysisResult):
    """Persist analysis results to database."""
    import json

    data = {
        "recording_id": result.recording_id,
        "voice_profiles": [asdict(p) for p in result.voice_profiles],
        "speed_profiles": [asdict(p) for p in result.speed_profiles],
        "overlaps": [asdict(o) for o in result.overlaps],
        "total_speakers": result.total_speakers,
        "analysis_duration_sec": result.analysis_duration_sec,
        "error": result.error,
    }

    with get_cursor() as cur:
        cur.execute(
            """INSERT OR REPLACE INTO speaker_analysis (recording_id, analysis_json, created_at)
               VALUES (?, ?, datetime('now'))""",
            (result.recording_id, json.dumps(data)),
        )


def _deserialize_result(data: dict) -> SpeakerAnalysisResult:
    """Reconstruct SpeakerAnalysisResult from JSON dict."""
    from app.schemas.speaker_analysis import VoiceType, PitchRange, VoiceTexture, LoudnessLevel

    result = SpeakerAnalysisResult(
        recording_id=data.get("recording_id", ""),
        total_speakers=data.get("total_speakers", 0),
        analysis_duration_sec=data.get("analysis_duration_sec", 0),
        error=data.get("error"),
    )

    for vp in data.get("voice_profiles", []):
        result.voice_profiles.append(SpeakerVoiceProfile(
            speaker_id=vp.get("speaker_id", ""),
            estimated_voice_type=VoiceType(vp.get("estimated_voice_type", "unknown")),
            confidence=vp.get("confidence", 0),
            avg_pitch_hz=vp.get("avg_pitch_hz", 0),
            median_pitch_hz=vp.get("median_pitch_hz", 0),
            pitch_range=PitchRange(vp.get("pitch_range", "medium")),
            voice_texture=VoiceTexture(vp.get("voice_texture", "unknown")),
            loudness_level=LoudnessLevel(vp.get("loudness_level", "medium")),
            clarity_score=vp.get("clarity_score", 0),
            sample_duration_sec=vp.get("sample_duration_sec", 0),
        ))

    for sp in data.get("speed_profiles", []):
        result.speed_profiles.append(SpeakerSpeedProfile(
            speaker_id=sp.get("speaker_id", ""),
            speaking_speed=SpeakingSpeed(sp.get("speaking_speed", "normal")),
            words_per_minute=sp.get("words_per_minute", 0),
            characters_per_minute=sp.get("characters_per_minute", 0),
            pause_ratio=sp.get("pause_ratio", 0),
            total_speaking_time_sec=sp.get("total_speaking_time_sec", 0),
            talk_percentage=sp.get("talk_percentage", 0),
        ))

    for ov in data.get("overlaps", []):
        result.overlaps.append(OverlapRegion(
            start_ms=ov.get("start_ms", 0),
            end_ms=ov.get("end_ms", 0),
            involved_speakers=ov.get("involved_speakers", []),
            overlap_confidence=ov.get("overlap_confidence", 0),
            transcript_confidence_warning=ov.get("transcript_confidence_warning", True),
        ))

    return result
