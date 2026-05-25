"""RecLLM Python Core — TXT Exporter"""

from pathlib import Path
from datetime import datetime

from app.database.db import get_cursor


def export_transcript_txt(
    recording_id: str,
    output_path: str | Path,
    include_metadata: bool = True,
) -> str:
    """Export a transcript to TXT format with optional metadata header.

    Returns the output file path.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with get_cursor() as cur:
        # Get recording info
        cur.execute("SELECT * FROM recordings WHERE id = ?", (recording_id,))
        recording = cur.fetchone()
        if not recording:
            raise ValueError(f"Recording not found: {recording_id}")

        # Get utterances
        cur.execute(
            "SELECT speaker, text, start_ms, end_ms FROM utterances WHERE recording_id = ? ORDER BY start_ms",
            (recording_id,),
        )
        utterances = cur.fetchall()

    lines: list[str] = []

    # Metadata header
    if include_metadata:
        lines.append(f"# {recording['original_file_name'] or recording['display_name'] or recording_id}")
        if recording["language_code"]:
            lines.append(f"# Language: {recording['language_code']}")
        if recording["processed_at"]:
            lines.append(f"# Processed: {recording['processed_at'][:10]}")
        if recording["duration_seconds"] and recording["duration_seconds"] > 0:
            h = int(recording["duration_seconds"] // 3600)
            m = int((recording["duration_seconds"] % 3600) // 60)
            dur_str = f"{h}h {m}m" if h > 0 else f"{m}m"
            lines.append(f"# Duration: {dur_str}")
        if recording["speaker_count"] and recording["speaker_count"] > 0:
            lines.append(f"# Speakers: {recording['speaker_count']}")
        if recording["noise_reduction"]:
            lines.append("# Noise Reduction: Applied")
        if recording["model_provider"]:
            provider = recording["model_provider"]
            model = recording["model_name"] or ""
            lines.append(f"# AI Provider: {provider}" + (f" / {model}" if model else ""))
        lines.append("")

    # Utterances
    for u in utterances:
        ts = _ms_to_timestamp(u["start_ms"])
        lines.append(f"[{ts}] {u['speaker']}: {u['text']}")

    content = "\n".join(lines)
    output_path.write_text(content, encoding="utf-8")

    # Record export in database
    with get_cursor() as cur:
        cur.execute(
            "INSERT INTO exports (recording_id, export_type, file_path, include_metadata) VALUES (?, ?, ?, ?)",
            (recording_id, "txt", str(output_path), int(include_metadata)),
        )

    return str(output_path)


def _ms_to_timestamp(ms: int) -> str:
    """Convert milliseconds to HH:MM:SS format."""
    total_sec = ms // 1000
    h = total_sec // 3600
    m = (total_sec % 3600) // 60
    s = total_sec % 60
    return f"{h:02d}:{m:02d}:{s:02d}"
