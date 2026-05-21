# How VoiceLens AI Works

VoiceLens turns multi-hour audio recordings into searchable, structured knowledge. Each file flows through a six-stage pipeline; every stage is handled by a swappable AI engine.

## The Pipeline

1. **Ingest** — Files are pulled from the recorder (USB, SD card, or drag-and-drop). Capture year and timestamp are preserved as metadata.
2. **Preprocess** — Noise reduction, loudness normalization, and channel splitting are applied so downstream models see clean audio.
3. **Diarize** — Overlapping voices are separated into channels. Each speaker turn gets a stable speaker ID.
4. **Transcribe** — AssemblyAI (default) converts each channel into time-stamped text with per-segment confidence scores.
5. **Classify** — Every segment is tagged across six voice attributes: gender (male/female), pace (fast/slow), and age band (young/adult/older).
6. **Summarize** — The chosen summary engine (Gemini, ChatGPT, or Gemma) produces a structured 30-item digest: topics, decisions, action items, named entities, quotes.

## Upload & Processing Queue

The Upload panel shows a live queue with per-file detail:

- **Color-coded status** — each row is tinted by stage: green = complete, yellow = paused, red = failed, blue = uploading, cyan/violet/indigo/amber/fuchsia for in-flight pipeline stages, slate = queued.
- A pulsing status dot, left accent bar, and matching progress-bar fill make the active stage instantly recognizable.
- Metadata per file: size, duration, format, sample rate, channels, bitrate, speakers, language.
- Live upload speed + ETA, plus an overall percent bar.
- Per-file actions: pause / resume / retry / restart / remove.

## Per-file Observation (Analytics)

After processing completes, the **Analytics** view opens any file in a six-tab deep-dive:

- **Speakers** — talk-time timeline, per-speaker turns / words / confidence, gender/pace/age tags.
- **Sentiment** — stacked positive/neutral/negative over time + emotion distribution (joy, neutral, sad, anger, surprise).
- **Topics** — proportional topic bar with mention counts.
- **Keywords** — sentiment-colored tag cloud sized by frequency.
- **Audio Quality** — silence ratio, overlap ratio, noise floor, integrated LUFS.
- **Needs Review** — low-confidence segments listed with timestamp jumps.

## Human-in-the-loop Learning

Reviewers correct low-confidence segments in the **Transcripts** view. Every accepted correction feeds back as supervised training data — the **Model Accuracy Trend** chart shows the resulting learning curve week over week.

## Speaker Profiles

Ten speaker slots ship by default. Once a profile has ~3 minutes of clean speech assigned to it, the diarizer auto-labels future appearances. Profiles can be retrained from the **Speakers** view.

## File Library

Every artifact — original audio, transcript, summary, exported PDF — is stored with full metadata (year, duration, size, speakers, owner, tags, version, checksum, language, encryption flag). Export targets: ZIP, CSV, JSON, PDF, S3, Google Drive.

## PDF Editor

Annotations, signatures, redaction, OCR, password protection, custom headers/footers, 1/2/3-column transcript layout, page numbering, print preview.

## Roles & Engines

The pipeline is vendor-agnostic. Under **Settings → Roles & AI Engines** you can assign a different engine to each role (transcription, diarization, summary, classification, translation, chat assistant) and register your own OpenAI-compatible endpoint — hosted or self-hosted.

## Language

The interface ships with three modes, switchable from **Settings → Language**:

- **English** — full English UI.
- **日本語** — full Japanese UI.
- **Dual (English + 日本語)** — every label renders as `English / 日本語` side-by-side, useful for bilingual teams or onboarding Japanese reviewers.

The choice persists per-browser in `localStorage`.
