"""Tests for Speaker Intelligence module."""

import pytest
import numpy as np
from unittest.mock import patch, MagicMock

from app.schemas.speaker_analysis import (
    VoiceType, PitchRange, VoiceTexture, LoudnessLevel, SpeakingSpeed,
    SpeakerVoiceProfile, SpeakerSpeedProfile, OverlapRegion, SpeakerAnalysisResult,
)
from app.services.overlap_detection import detect_overlaps, _merge_overlaps
from app.services.voice_features import (
    _classify_voice_type, _classify_pitch_range, _classify_loudness,
    _classify_texture, _pitch_confidence,
)


class TestVoiceTypeClassification:
    def test_masculine_low_pitch(self):
        assert _classify_voice_type(120) == VoiceType.MASCULINE

    def test_feminine_high_pitch(self):
        assert _classify_voice_type(220) == VoiceType.FEMININE

    def test_unknown_mid_pitch(self):
        assert _classify_voice_type(170) == VoiceType.UNKNOWN

    def test_unknown_zero_pitch(self):
        assert _classify_voice_type(0) == VoiceType.UNKNOWN


class TestPitchRangeClassification:
    def test_low(self):
        assert _classify_pitch_range(100) == PitchRange.LOW

    def test_medium(self):
        assert _classify_pitch_range(180) == PitchRange.MEDIUM

    def test_high(self):
        assert _classify_pitch_range(250) == PitchRange.HIGH


class TestLoudnessClassification:
    def test_soft(self):
        audio = np.ones(1000, dtype=np.float32) * 0.01
        assert _classify_loudness(audio) == LoudnessLevel.SOFT

    def test_medium(self):
        audio = np.ones(1000, dtype=np.float32) * 0.05
        assert _classify_loudness(audio) == LoudnessLevel.MEDIUM

    def test_loud(self):
        audio = np.ones(1000, dtype=np.float32) * 0.15
        assert _classify_loudness(audio) == LoudnessLevel.LOUD


class TestTextureClassification:
    def test_clear(self):
        pitches = np.array([150, 152, 148, 151])
        assert _classify_texture(0.8, pitches) == VoiceTexture.CLEAR

    def test_rough(self):
        pitches = np.array([150, 152, 148, 151])
        assert _classify_texture(0.2, pitches) == VoiceTexture.ROUGH

    def test_husky(self):
        pitches = np.array([100, 200, 80, 250, 120])
        assert _classify_texture(0.5, pitches) == VoiceTexture.HUSKY

    def test_unknown(self):
        pitches = np.array([150, 152, 148, 151])
        assert _classify_texture(0.5, pitches) == VoiceTexture.UNKNOWN


class TestPitchConfidence:
    def test_few_samples_low_confidence(self):
        pitches = np.array([150, 160])
        assert _pitch_confidence(pitches) == 0.2

    def test_consistent_pitches_high_confidence(self):
        pitches = np.array([150, 151, 149, 150, 152, 148, 150, 151])
        conf = _pitch_confidence(pitches)
        assert conf > 0.8

    def test_variable_pitches_lower_confidence(self):
        pitches = np.array([100, 200, 150, 300, 80, 250, 120, 180])
        conf = _pitch_confidence(pitches)
        assert conf < 0.6


class TestOverlapDetection:
    def test_no_utterances(self):
        assert detect_overlaps([]) == []

    def test_single_utterance(self):
        utts = [{"start_ms": 0, "end_ms": 1000, "speaker": "A"}]
        assert detect_overlaps(utts) == []

    def test_no_overlap(self):
        utts = [
            {"start_ms": 0, "end_ms": 1000, "speaker": "A"},
            {"start_ms": 1500, "end_ms": 2500, "speaker": "B"},
        ]
        assert detect_overlaps(utts) == []

    def test_same_speaker_no_overlap(self):
        utts = [
            {"start_ms": 0, "end_ms": 2000, "speaker": "A"},
            {"start_ms": 1000, "end_ms": 3000, "speaker": "A"},
        ]
        assert detect_overlaps(utts) == []

    def test_two_speakers_overlap(self):
        utts = [
            {"start_ms": 0, "end_ms": 2000, "speaker": "A"},
            {"start_ms": 1500, "end_ms": 3000, "speaker": "B"},
        ]
        overlaps = detect_overlaps(utts)
        assert len(overlaps) == 1
        assert overlaps[0].start_ms == 1500
        assert overlaps[0].end_ms == 2000
        assert "A" in overlaps[0].involved_speakers
        assert "B" in overlaps[0].involved_speakers

    def test_short_overlap_ignored(self):
        utts = [
            {"start_ms": 0, "end_ms": 1000, "speaker": "A"},
            {"start_ms": 900, "end_ms": 2000, "speaker": "B"},
        ]
        # 100ms overlap < MIN_OVERLAP_MS (200ms)
        overlaps = detect_overlaps(utts)
        assert len(overlaps) == 0

    def test_multiple_speakers_overlap(self):
        utts = [
            {"start_ms": 0, "end_ms": 3000, "speaker": "A"},
            {"start_ms": 1000, "end_ms": 4000, "speaker": "B"},
            {"start_ms": 2000, "end_ms": 5000, "speaker": "C"},
        ]
        overlaps = detect_overlaps(utts)
        assert len(overlaps) >= 1

    def test_ten_speakers(self):
        utts = []
        for i in range(10):
            utts.append({
                "start_ms": i * 5000,
                "end_ms": (i + 1) * 5000 + 500,
                "speaker": f"SPEAKER_{i+1:02d}",
            })
        overlaps = detect_overlaps(utts)
        # Adjacent speakers overlap by 500ms
        assert len(overlaps) == 9


class TestMergeOverlaps:
    def test_no_overlaps(self):
        assert _merge_overlaps([]) == []

    def test_non_adjacent(self):
        ovs = [
            OverlapRegion(start_ms=0, end_ms=500, involved_speakers=["A", "B"]),
            OverlapRegion(start_ms=2000, end_ms=2500, involved_speakers=["A", "C"]),
        ]
        merged = _merge_overlaps(ovs)
        assert len(merged) == 2

    def test_adjacent_merged(self):
        ovs = [
            OverlapRegion(start_ms=0, end_ms=500, involved_speakers=["A", "B"]),
            OverlapRegion(start_ms=600, end_ms=1000, involved_speakers=["A", "C"]),
        ]
        merged = _merge_overlaps(ovs)
        assert len(merged) == 1
        assert merged[0].end_ms == 1000
        assert "B" in merged[0].involved_speakers
        assert "C" in merged[0].involved_speakers


class TestSpeakerAnalysisAPI:
    """Test API endpoints via TestClient."""

    @pytest.fixture
    def client(self, tmp_path):
        import os
        os.environ["RECLLM_DATA_DIR"] = str(tmp_path)
        from app.core.job_queue import JobQueue
        from app.api import create_app
        from fastapi.testclient import TestClient

        queue = JobQueue(max_concurrency=1)
        app = create_app(queue)
        return TestClient(app)

    def test_get_analysis_not_found(self, client):
        resp = client.get("/api/recordings/nonexistent/speaker-analysis")
        assert resp.status_code == 200
        data = resp.json()
        assert data["analyzed"] is False

    def test_analyze_not_found(self, client):
        resp = client.post("/api/recordings/nonexistent/analyze-speakers")
        assert resp.status_code == 404

    def test_overlaps_not_found(self, client):
        resp = client.get("/api/recordings/nonexistent/overlaps")
        assert resp.status_code == 404
