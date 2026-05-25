"""RecLLM Python — End-to-End Pipeline Integration Tests

Tests the real audio processing pipeline:
1. Audio metadata extraction (WAV, MP3)
2. Tier routing (normal, long, enterprise, blocked)
3. Audio splitting into chunks
4. Streaming merge of transcription results
5. Batch processing (100 files)
"""

import sys
import subprocess
import tempfile
import shutil
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest

from app.audio.ffmpeg_runner import get_audio_metadata, split_audio
from app.audio.duration_detector import get_tier_recommendation, AudioTier
from app.ai.clients.assemblyai_client import TranscriptionResult, Utterance
from app.core.worker import _streaming_merge


@pytest.fixture(scope="module")
def audio_fixtures():
    """Generate test audio files using FFmpeg."""
    tmp_dir = tempfile.mkdtemp()
    fixtures = Path(tmp_dir)

    # 30s WAV
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=30",
        "-ar", "16000", "-ac", "1", str(fixtures / "short_30s.wav")
    ], capture_output=True, check=True)

    # 5min WAV
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=300",
        "-ar", "16000", "-ac", "1", str(fixtures / "medium_5min.wav")
    ], capture_output=True, check=True)

    # 30s MP3
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=30",
        "-ar", "16000", "-ac", "1", "-codec:a", "libmp3lame",
        str(fixtures / "short_30s.mp3")
    ], capture_output=True, check=True)

    yield fixtures
    shutil.rmtree(tmp_dir)


class TestAudioMetadata:
    def test_wav_metadata(self, audio_fixtures):
        meta = get_audio_metadata(str(audio_fixtures / "short_30s.wav"))
        assert abs(meta.duration_seconds - 30.0) < 0.5
        assert meta.codec == "pcm_s16le"
        assert meta.channels == 1
        assert meta.sample_rate == 16000

    def test_mp3_metadata(self, audio_fixtures):
        meta = get_audio_metadata(str(audio_fixtures / "short_30s.mp3"))
        assert abs(meta.duration_seconds - 30.0) < 0.5
        assert meta.codec == "mp3"
        assert meta.channels == 1

    def test_5min_metadata(self, audio_fixtures):
        meta = get_audio_metadata(str(audio_fixtures / "medium_5min.wav"))
        assert abs(meta.duration_seconds - 300.0) < 0.5


class TestTierRouting:
    def test_short_audio_normal(self):
        rec = get_tier_recommendation(30)
        assert rec.tier == AudioTier.NORMAL
        assert rec.total_chunks == 1

    def test_5min_normal(self):
        rec = get_tier_recommendation(300)
        assert rec.tier == AudioTier.NORMAL

    def test_2h_long(self):
        rec = get_tier_recommendation(7200)
        assert rec.tier == AudioTier.LONG_AUDIO
        assert rec.total_chunks > 1

    def test_10h_enterprise(self):
        rec = get_tier_recommendation(36000)
        assert rec.tier == AudioTier.ENTERPRISE
        assert rec.total_chunks > 1

    def test_30h_plus_blocked(self):
        rec = get_tier_recommendation(108001)
        assert rec.tier == AudioTier.BLOCKED


class TestAudioSplitting:
    def test_split_5min_into_60s_chunks(self, audio_fixtures):
        tmp_dir = tempfile.mkdtemp()
        try:
            chunks = split_audio(
                str(audio_fixtures / "medium_5min.wav"),
                tmp_dir, chunk_duration_sec=60, recording_id="split_test"
            )
            assert len(chunks) == 5
            for chunk in chunks:
                assert Path(chunk["file_path"]).exists()
                meta = get_audio_metadata(chunk["file_path"])
                assert 59 <= meta.duration_seconds <= 61
        finally:
            shutil.rmtree(tmp_dir)

    def test_chunk_offsets_correct(self, audio_fixtures):
        tmp_dir = tempfile.mkdtemp()
        try:
            chunks = split_audio(
                str(audio_fixtures / "medium_5min.wav"),
                tmp_dir, chunk_duration_sec=60, recording_id="offset_test"
            )
            for i, chunk in enumerate(chunks):
                assert chunk["start_time_sec"] == i * 60.0
                assert chunk["end_time_sec"] == (i + 1) * 60.0
        finally:
            shutil.rmtree(tmp_dir)


class TestStreamingMerge:
    def test_merge_preserves_order(self):
        chunks = [
            {"chunk_index": i, "file_path": f"/tmp/c{i}.wav",
             "start_time_sec": i * 60.0, "end_time_sec": (i + 1) * 60.0}
            for i in range(5)
        ]
        results = [
            TranscriptionResult(ok=True, full_text=f"Chunk {i}", utterances=[
                Utterance(speaker="A", text=f"U{i}", start_ms=j * 10000, end_ms=(j + 1) * 10000)
                for j in range(3)
            ])
            for i in range(5)
        ]
        merged = _streaming_merge(results, chunks)
        assert merged.ok
        assert len(merged.utterances) == 15
        # Verify chronological order
        for i in range(1, len(merged.utterances)):
            assert merged.utterances[i].start_ms >= merged.utterances[i - 1].start_ms

    def test_merge_applies_offset(self):
        chunks = [
            {"chunk_index": 0, "file_path": "/tmp/c0.wav", "start_time_sec": 0.0, "end_time_sec": 60.0},
            {"chunk_index": 1, "file_path": "/tmp/c1.wav", "start_time_sec": 60.0, "end_time_sec": 120.0},
        ]
        results = [
            TranscriptionResult(ok=True, full_text="First", utterances=[
                Utterance(speaker="A", text="Hello", start_ms=5000, end_ms=10000),
            ]),
            TranscriptionResult(ok=True, full_text="Second", utterances=[
                Utterance(speaker="B", text="World", start_ms=5000, end_ms=10000),
            ]),
        ]
        merged = _streaming_merge(results, chunks)
        assert merged.utterances[0].start_ms == 5000
        assert merged.utterances[1].start_ms == 65000  # 60000 + 5000


class TestBatchProcessing:
    def test_batch_100_files(self):
        """Verify metadata extraction scales to 100 files."""
        tmp_dir = tempfile.mkdtemp()
        try:
            # Generate 100 small audio files
            for i in range(100):
                out = Path(tmp_dir) / f"file_{i:03d}.wav"
                subprocess.run([
                    "ffmpeg", "-y", "-f", "lavfi", "-i", f"sine=frequency={200 + i * 5}:duration=5",
                    "-ar", "16000", "-ac", "1", str(out)
                ], capture_output=True, check=True)

            # Extract metadata from all
            start = time.time()
            results = []
            for f in sorted(Path(tmp_dir).glob("*.wav")):
                meta = get_audio_metadata(str(f))
                results.append(meta)
            elapsed = time.time() - start

            assert len(results) == 100
            assert all(abs(m.duration_seconds - 5.0) < 0.5 for m in results)
            assert elapsed < 30  # Should complete in under 30s
        finally:
            shutil.rmtree(tmp_dir)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
