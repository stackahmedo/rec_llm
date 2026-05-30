"""RecLLM — Speaker Analysis Schemas"""

from dataclasses import dataclass, field
from enum import Enum


class VoiceType(str, Enum):
    MASCULINE = "masculine"
    FEMININE = "feminine"
    UNKNOWN = "unknown"


class PitchRange(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class VoiceTexture(str, Enum):
    CLEAR = "clear"
    HUSKY = "husky"
    ROUGH = "rough"
    UNKNOWN = "unknown"


class LoudnessLevel(str, Enum):
    SOFT = "soft"
    MEDIUM = "medium"
    LOUD = "loud"


class SpeakingSpeed(str, Enum):
    SLOW = "slow"
    NORMAL = "normal"
    FAST = "fast"


@dataclass
class SpeakerVoiceProfile:
    speaker_id: str
    estimated_voice_type: VoiceType = VoiceType.UNKNOWN
    confidence: float = 0.0
    avg_pitch_hz: float = 0.0
    median_pitch_hz: float = 0.0
    pitch_range: PitchRange = PitchRange.MEDIUM
    voice_texture: VoiceTexture = VoiceTexture.UNKNOWN
    loudness_level: LoudnessLevel = LoudnessLevel.MEDIUM
    clarity_score: float = 0.0
    sample_duration_sec: float = 0.0


@dataclass
class SpeakerSpeedProfile:
    speaker_id: str
    speaking_speed: SpeakingSpeed = SpeakingSpeed.NORMAL
    words_per_minute: float = 0.0
    characters_per_minute: float = 0.0
    pause_ratio: float = 0.0
    total_speaking_time_sec: float = 0.0
    talk_percentage: float = 0.0


@dataclass
class OverlapRegion:
    start_ms: int = 0
    end_ms: int = 0
    involved_speakers: list[str] = field(default_factory=list)
    overlap_confidence: float = 0.0
    transcript_confidence_warning: bool = True


@dataclass
class SpeakerAnalysisResult:
    recording_id: str
    voice_profiles: list[SpeakerVoiceProfile] = field(default_factory=list)
    speed_profiles: list[SpeakerSpeedProfile] = field(default_factory=list)
    overlaps: list[OverlapRegion] = field(default_factory=list)
    total_speakers: int = 0
    analysis_duration_sec: float = 0.0
    error: str | None = None
