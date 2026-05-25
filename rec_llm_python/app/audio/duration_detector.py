"""RecLLM Python Core — Audio Duration Detection & Tier Routing"""

from dataclasses import dataclass
from enum import Enum

from app.config import (
    TIER_LONG_AUDIO, TIER_ENTERPRISE, TIER_BLOCKED,
    CHUNK_DURATION_NORMAL_MIN, CHUNK_DURATION_ENTERPRISE_MIN,
    CONCURRENCY_NORMAL, CONCURRENCY_ENTERPRISE,
)


class AudioTier(str, Enum):
    NORMAL = "normal"
    LONG_AUDIO = "long_audio"
    ENTERPRISE = "enterprise"
    BLOCKED = "blocked"


@dataclass
class TierRecommendation:
    tier: AudioTier
    chunk_duration_min: int
    concurrency: int
    total_chunks: int
    reason: str


def get_audio_tier(duration_hours: float) -> AudioTier:
    """Determine processing tier based on audio duration."""
    if duration_hours > TIER_BLOCKED:
        return AudioTier.BLOCKED
    if duration_hours >= TIER_ENTERPRISE:
        return AudioTier.ENTERPRISE
    if duration_hours >= TIER_LONG_AUDIO:
        return AudioTier.LONG_AUDIO
    return AudioTier.NORMAL


def get_tier_recommendation(duration_seconds: float) -> TierRecommendation:
    """Get full processing recommendation for an audio file."""
    duration_hours = duration_seconds / 3600
    tier = get_audio_tier(duration_hours)

    if tier == AudioTier.BLOCKED:
        return TierRecommendation(
            tier=tier,
            chunk_duration_min=0,
            concurrency=0,
            total_chunks=0,
            reason=f"Audio duration ({duration_hours:.1f}h) exceeds maximum ({TIER_BLOCKED}h).",
        )

    if tier == AudioTier.NORMAL:
        return TierRecommendation(
            tier=tier,
            chunk_duration_min=0,
            concurrency=CONCURRENCY_NORMAL,
            total_chunks=1,
            reason="Short audio — direct processing without chunking.",
        )

    if tier == AudioTier.ENTERPRISE:
        chunk_min = CHUNK_DURATION_ENTERPRISE_MIN
        total_chunks = max(1, int((duration_seconds / 60) / chunk_min) + 1)
        return TierRecommendation(
            tier=tier,
            chunk_duration_min=chunk_min,
            concurrency=CONCURRENCY_ENTERPRISE,
            total_chunks=total_chunks,
            reason=f"Enterprise mode: {total_chunks} chunks × {chunk_min}min, sequential processing.",
        )

    # LONG_AUDIO
    chunk_min = CHUNK_DURATION_NORMAL_MIN
    total_chunks = max(1, int((duration_seconds / 60) / chunk_min) + 1)
    return TierRecommendation(
        tier=tier,
        chunk_duration_min=chunk_min,
        concurrency=CONCURRENCY_NORMAL,
        total_chunks=total_chunks,
        reason=f"Long audio: {total_chunks} chunks × {chunk_min}min, parallel processing.",
    )
