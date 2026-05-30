"""RecLLM — Voice Feature Extraction (pitch, loudness, texture)"""

import logging
from pathlib import Path

from app.schemas.speaker_analysis import (
    SpeakerVoiceProfile, VoiceType, PitchRange, VoiceTexture, LoudnessLevel,
)

logger = logging.getLogger(__name__)

# Check availability of audio analysis libraries
_NUMPY_AVAILABLE = False
_SCIPY_AVAILABLE = False
_SOUNDFILE_AVAILABLE = False

try:
    import numpy as np
    _NUMPY_AVAILABLE = True
except ImportError:
    np = None
    logger.warning("numpy not available — Speaker Intelligence disabled")

try:
    import scipy.signal  # noqa: F401
    _SCIPY_AVAILABLE = True
except ImportError:
    logger.warning("scipy not available — Speaker Intelligence limited")

try:
    import soundfile  # noqa: F401
    _SOUNDFILE_AVAILABLE = True
except ImportError:
    logger.warning("soundfile not available — Speaker Intelligence disabled")


def is_available() -> bool:
    """Check if voice feature extraction is available."""
    return _NUMPY_AVAILABLE and _SOUNDFILE_AVAILABLE


def get_availability() -> dict:
    """Return availability status of all dependencies."""
    return {
        "numpy": _NUMPY_AVAILABLE,
        "scipy": _SCIPY_AVAILABLE,
        "soundfile": _SOUNDFILE_AVAILABLE,
        "speaker_intelligence": is_available(),
    }

# Pitch thresholds (Hz) for voice type estimation
PITCH_MASCULINE_MAX = 165
PITCH_FEMININE_MIN = 180
PITCH_LOW_MAX = 150
PITCH_HIGH_MIN = 220


def extract_voice_profile(audio_path: str, speaker_id: str, segments: list[dict]) -> SpeakerVoiceProfile:
    """Extract voice features for a single speaker from their segments."""
    profile = SpeakerVoiceProfile(speaker_id=speaker_id)

    if not is_available():
        logger.warning("Speaker Intelligence dependencies not available, skipping voice profile")
        return profile

    try:
        import soundfile as sf
        data, sr = sf.read(audio_path, dtype="float32")
        if data.ndim > 1:
            data = data.mean(axis=1)
    except Exception as e:
        logger.error("Cannot read audio %s: %s", audio_path, e)
        return profile

    speaker_audio = _extract_speaker_audio(data, sr, segments)
    if len(speaker_audio) < sr * 0.5:
        logger.warning("Speaker %s has less than 0.5s of audio", speaker_id)
        return profile

    profile.sample_duration_sec = len(speaker_audio) / sr

    # Pitch analysis
    pitches = _estimate_pitches(speaker_audio, sr)
    if len(pitches) > 0:
        profile.avg_pitch_hz = round(float(np.mean(pitches)), 1)
        profile.median_pitch_hz = round(float(np.median(pitches)), 1)
        profile.pitch_range = _classify_pitch_range(profile.median_pitch_hz)
        profile.estimated_voice_type = _classify_voice_type(profile.median_pitch_hz)
        profile.confidence = _pitch_confidence(pitches)

    # Loudness
    profile.loudness_level = _classify_loudness(speaker_audio)

    # Clarity / texture
    profile.clarity_score = _estimate_clarity(speaker_audio, sr)
    profile.voice_texture = _classify_texture(profile.clarity_score, pitches)

    return profile


def _extract_speaker_audio(data: np.ndarray, sr: int, segments: list[dict]) -> np.ndarray:
    """Concatenate audio samples belonging to a speaker's segments."""
    chunks = []
    for seg in segments:
        start_sample = int((seg.get("start_ms", 0) / 1000.0) * sr)
        end_sample = int((seg.get("end_ms", seg.get("start_ms", 0)) / 1000.0) * sr)
        start_sample = max(0, min(start_sample, len(data)))
        end_sample = max(start_sample, min(end_sample, len(data)))
        if end_sample > start_sample:
            chunks.append(data[start_sample:end_sample])
    if chunks:
        return np.concatenate(chunks)
    return np.array([], dtype=np.float32)


def _estimate_pitches(audio: np.ndarray, sr: int) -> np.ndarray:
    """Estimate fundamental frequency using autocorrelation method."""
    from scipy.signal import correlate

    frame_len = int(0.03 * sr)  # 30ms frames
    hop = int(0.01 * sr)  # 10ms hop
    pitches = []

    min_lag = int(sr / 500)  # 500 Hz max
    max_lag = int(sr / 60)   # 60 Hz min

    for start in range(0, len(audio) - frame_len, hop):
        frame = audio[start:start + frame_len]
        if np.max(np.abs(frame)) < 0.01:
            continue

        frame = frame - np.mean(frame)
        corr = correlate(frame, frame, mode="full")
        corr = corr[len(corr) // 2:]

        if max_lag >= len(corr):
            continue

        search_region = corr[min_lag:max_lag]
        if len(search_region) == 0:
            continue

        peak_idx = np.argmax(search_region) + min_lag
        if corr[peak_idx] > 0.3 * corr[0]:
            pitch = sr / peak_idx
            if 60 <= pitch <= 500:
                pitches.append(pitch)

    return np.array(pitches)


def _classify_voice_type(median_pitch: float) -> VoiceType:
    if median_pitch <= 0:
        return VoiceType.UNKNOWN
    if median_pitch <= PITCH_MASCULINE_MAX:
        return VoiceType.MASCULINE
    if median_pitch >= PITCH_FEMININE_MIN:
        return VoiceType.FEMININE
    return VoiceType.UNKNOWN


def _classify_pitch_range(median_pitch: float) -> PitchRange:
    if median_pitch <= PITCH_LOW_MAX:
        return PitchRange.LOW
    if median_pitch >= PITCH_HIGH_MIN:
        return PitchRange.HIGH
    return PitchRange.MEDIUM


def _pitch_confidence(pitches: np.ndarray) -> float:
    """Higher confidence when pitch estimates are consistent."""
    if len(pitches) < 5:
        return 0.2
    std = np.std(pitches)
    mean = np.mean(pitches)
    if mean == 0:
        return 0.1
    cv = std / mean  # coefficient of variation
    confidence = max(0.1, min(1.0, 1.0 - cv))
    return round(confidence, 2)


def _classify_loudness(audio: np.ndarray) -> LoudnessLevel:
    rms = np.sqrt(np.mean(audio ** 2))
    if rms < 0.02:
        return LoudnessLevel.SOFT
    if rms > 0.08:
        return LoudnessLevel.LOUD
    return LoudnessLevel.MEDIUM


def _estimate_clarity(audio: np.ndarray, sr: int) -> float:
    """Estimate clarity based on spectral flatness (lower = more tonal/clear)."""
    from scipy.signal import welch

    if len(audio) < sr * 0.1:
        return 0.5

    freqs, psd = welch(audio, fs=sr, nperseg=min(1024, len(audio)))
    psd = psd + 1e-10
    geo_mean = np.exp(np.mean(np.log(psd)))
    arith_mean = np.mean(psd)
    flatness = geo_mean / arith_mean if arith_mean > 0 else 1.0

    # Lower flatness = more tonal = clearer voice
    clarity = round(max(0.0, min(1.0, 1.0 - flatness)), 2)
    return clarity


def _classify_texture(clarity: float, pitches: np.ndarray) -> VoiceTexture:
    if clarity >= 0.7:
        return VoiceTexture.CLEAR
    if clarity <= 0.35:
        return VoiceTexture.ROUGH
    if len(pitches) > 0 and np.std(pitches) > 40:
        return VoiceTexture.HUSKY
    return VoiceTexture.UNKNOWN
