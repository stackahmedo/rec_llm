"""Tests for RecLLM Python — AI Features (Speaker Analysis, Grammar, Summarization)"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from app.ai.speaker_analysis import classify_voice_type, calculate_speaking_speed


class TestVoiceClassification:
    """Test voice type classification with confidence thresholds."""

    def test_clear_male(self):
        voice_type, confidence = classify_voice_type(90.0)
        assert voice_type == "male"
        assert confidence >= 0.5

    def test_clear_female(self):
        voice_type, confidence = classify_voice_type(220.0)
        assert voice_type == "female"
        assert confidence >= 0.5

    def test_ambiguous_zone_returns_unknown(self):
        voice_type, confidence = classify_voice_type(150.0)
        assert voice_type == "unknown"
        assert confidence < 0.5

    def test_boundary_low_ambiguous(self):
        voice_type, confidence = classify_voice_type(130.0)
        # Right at boundary — should be low confidence
        assert confidence <= 0.5

    def test_boundary_high_ambiguous(self):
        voice_type, confidence = classify_voice_type(170.0)
        assert confidence <= 0.5

    def test_very_low_pitch_high_confidence_male(self):
        voice_type, confidence = classify_voice_type(70.0)
        assert voice_type == "male"
        assert confidence >= 0.8

    def test_very_high_pitch_high_confidence_female(self):
        voice_type, confidence = classify_voice_type(280.0)
        assert voice_type == "female"
        assert confidence >= 0.8

    def test_zero_pitch(self):
        voice_type, confidence = classify_voice_type(0.0)
        assert voice_type == "unknown"
        assert confidence == 0.0

    def test_negative_pitch(self):
        voice_type, confidence = classify_voice_type(-10.0)
        assert voice_type == "unknown"
        assert confidence == 0.0

    def test_confidence_never_exceeds_1(self):
        voice_type, confidence = classify_voice_type(500.0)
        assert confidence <= 1.0

    def test_confidence_range(self):
        """All confidence values should be between 0 and 1."""
        for pitch in range(50, 350, 10):
            _, confidence = classify_voice_type(float(pitch))
            assert 0.0 <= confidence <= 1.0


class TestSpeakingSpeed:
    """Test WPM calculation and speed labels."""

    def test_slow_speed(self):
        wpm, label = calculate_speaking_speed(100, 60_000)  # 100 words/min
        assert wpm == 100
        assert label == "slow"

    def test_normal_speed(self):
        wpm, label = calculate_speaking_speed(140, 60_000)  # 140 words/min
        assert wpm == 140
        assert label == "normal"

    def test_fast_speed(self):
        wpm, label = calculate_speaking_speed(200, 60_000)  # 200 words/min
        assert wpm == 200
        assert label == "fast"

    def test_boundary_slow_normal(self):
        wpm, label = calculate_speaking_speed(119, 60_000)
        assert label == "slow"
        wpm, label = calculate_speaking_speed(120, 60_000)
        assert label == "normal"

    def test_boundary_normal_fast(self):
        wpm, label = calculate_speaking_speed(160, 60_000)
        assert label == "normal"
        wpm, label = calculate_speaking_speed(161, 60_000)
        assert label == "fast"

    def test_zero_duration(self):
        wpm, label = calculate_speaking_speed(100, 0)
        assert wpm == 0

    def test_zero_words(self):
        wpm, label = calculate_speaking_speed(0, 60_000)
        assert wpm == 0

    def test_short_utterance(self):
        # 5 words in 2 seconds = 150 WPM
        wpm, label = calculate_speaking_speed(5, 2000)
        assert wpm == 150
        assert label == "normal"


class TestGrammarParsing:
    """Test grammar correction response parsing."""

    def test_parse_numbered_response(self):
        from app.ai.grammar_correction import _parse_numbered_response

        response = "1. Hello world.\n2. How are you?\n3. I am fine."
        result = _parse_numbered_response(response, 3)
        assert result == ["Hello world.", "How are you?", "I am fine."]

    def test_parse_with_extra_lines(self):
        from app.ai.grammar_correction import _parse_numbered_response

        response = "1. First line.\n2. Second line.\n3. Third line.\n4. Extra line."
        result = _parse_numbered_response(response, 3)
        assert len(result) == 3

    def test_parse_with_fewer_lines(self):
        from app.ai.grammar_correction import _parse_numbered_response

        response = "1. Only one."
        result = _parse_numbered_response(response, 3)
        assert len(result) == 3
        assert result[0] == "Only one."
        assert result[1] == ""
        assert result[2] == ""

    def test_parse_empty_response(self):
        from app.ai.grammar_correction import _parse_numbered_response

        result = _parse_numbered_response("", 3)
        assert len(result) == 3

    def test_parse_unnumbered_response(self):
        from app.ai.grammar_correction import _parse_numbered_response

        response = "Hello world.\nHow are you?"
        result = _parse_numbered_response(response, 2)
        assert len(result) == 2


class TestFolderWatcher:
    """Test folder watcher logic."""

    def test_watcher_initial_state(self):
        from app.watcher.folder_watcher import FolderWatcher

        watcher = FolderWatcher()
        assert not watcher.active
        assert watcher.folder_path is None
        assert watcher.known_file_count == 0

    def test_watcher_status(self):
        from app.watcher.folder_watcher import FolderWatcher

        watcher = FolderWatcher()
        status = watcher.status()
        assert status["active"] is False
        assert status["folderPath"] is None
        assert status["knownFileCount"] == 0

    def test_watcher_start_nonexistent_folder(self):
        from app.watcher.folder_watcher import FolderWatcher

        watcher = FolderWatcher()
        result = watcher.start("/nonexistent/path/xyz")
        assert result["ok"] is False
        assert "not found" in result["error"].lower()

    def test_watcher_start_valid_folder(self):
        import tempfile
        from app.watcher.folder_watcher import FolderWatcher

        with tempfile.TemporaryDirectory() as tmp:
            watcher = FolderWatcher()
            result = watcher.start(tmp)
            assert result["ok"] is True
            assert watcher.active
            assert watcher.folder_path == tmp
            watcher.stop()
            assert not watcher.active

    def test_watcher_detects_existing_audio(self):
        import tempfile
        from app.watcher.folder_watcher import FolderWatcher

        with tempfile.TemporaryDirectory() as tmp:
            # Create fake audio files
            (Path(tmp) / "test1.mp3").write_text("fake")
            (Path(tmp) / "test2.wav").write_text("fake")
            (Path(tmp) / "readme.txt").write_text("not audio")

            watcher = FolderWatcher()
            result = watcher.start(tmp)
            assert result["ok"] is True
            assert result["fileCount"] == 2  # Only audio files
            watcher.stop()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
