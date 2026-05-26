"""RecLLM Python Core — FFmpeg Runner"""

import subprocess
import json
from pathlib import Path
from dataclasses import dataclass

from app.runtime import get_ffmpeg_path, get_ffprobe_path


@dataclass
class AudioMetadata:
    duration_seconds: float
    codec: str
    bitrate: int
    sample_rate: int
    channels: int
    format_name: str
    file_size_bytes: int


def find_ffmpeg() -> str:
    """Find FFmpeg binary path using the runtime resolver."""
    return get_ffmpeg_path()


def find_ffprobe() -> str:
    """Find FFprobe binary path using the runtime resolver."""
    return get_ffprobe_path()


def get_audio_metadata(file_path: str | Path) -> AudioMetadata:
    """Extract audio metadata using FFprobe."""
    ffprobe = find_ffprobe()
    cmd = [
        ffprobe, "-v", "quiet",
        "-print_format", "json",
        "-show_format", "-show_streams",
        str(file_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"FFprobe failed: {result.stderr[:200]}")

    data = json.loads(result.stdout)
    fmt = data.get("format", {})
    streams = data.get("streams", [])

    # Find audio stream
    audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), {})

    return AudioMetadata(
        duration_seconds=float(fmt.get("duration", 0)),
        codec=audio_stream.get("codec_name", "unknown"),
        bitrate=int(fmt.get("bit_rate", 0)),
        sample_rate=int(audio_stream.get("sample_rate", 0)),
        channels=int(audio_stream.get("channels", 0)),
        format_name=fmt.get("format_name", "unknown"),
        file_size_bytes=int(fmt.get("size", 0)),
    )


def split_audio(
    input_path: str | Path,
    output_dir: str | Path,
    chunk_duration_sec: int,
    recording_id: str,
) -> list[dict]:
    """Split audio file into chunks of specified duration.

    Returns list of chunk info dicts: {chunk_index, file_path, start_time_sec, end_time_sec}
    """
    ffmpeg = find_ffmpeg()
    meta = get_audio_metadata(input_path)
    total_duration = meta.duration_seconds

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    chunks = []
    chunk_index = 0
    start = 0.0

    while start < total_duration:
        end = min(start + chunk_duration_sec, total_duration)
        chunk_filename = f"{recording_id}_chunk_{chunk_index:03d}.wav"
        chunk_path = output_dir / chunk_filename

        cmd = [
            ffmpeg, "-y",
            "-i", str(input_path),
            "-ss", str(start),
            "-t", str(end - start),
            "-ar", "16000",
            "-ac", "1",
            "-c:a", "pcm_s16le",
            str(chunk_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg split failed at chunk {chunk_index}: {result.stderr[:200]}")

        chunks.append({
            "chunk_index": chunk_index,
            "file_path": str(chunk_path),
            "start_time_sec": start,
            "end_time_sec": end,
        })

        start = end
        chunk_index += 1

    return chunks


def apply_noise_reduction(input_path: str | Path, output_path: str | Path) -> str:
    """Apply FFmpeg noise reduction filter (afftdn).

    Returns path to cleaned audio file.
    """
    ffmpeg = find_ffmpeg()
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        ffmpeg, "-y",
        "-i", str(input_path),
        "-af", "afftdn=nf=-25",
        "-c:a", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise RuntimeError(f"Noise reduction failed: {result.stderr[:200]}")

    return str(output_path)
