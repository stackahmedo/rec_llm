# RecLLM v0.2.0 — Changelog

## Release Date: 2025-01-XX

## Major Features

### Enterprise Audio Pipeline
- **30-hour audio support** — Enterprise mode with 25-minute chunks, sequential processing
- **Streaming merge** — Incremental disk writes, no RAM accumulation for large recordings
- **Parallel chunk processing** — Configurable concurrency (1-5 workers) with rate-limit protection
- **Crash recovery** — Orphaned jobs automatically reset to queued on restart

### AI Intelligence
- **AI Chat** — Real LLM-powered Q&A about transcript content
- **Translation** — Full, bilingual, and by-speaker translation modes
- **Grammar correction** — `/grammar` slash command for post-transcription cleanup
- **MapReduce summarization** — Hierarchical multi-level summary for 100+ file batches
- **Auto-summarize** — Triggers automatically after transcription completes
- **Speaker suggestion** — AI-powered speaker name identification

### Audio Processing
- **Noise reduction** — Optional FFmpeg afftdn preprocessing (Settings toggle)
- **Speaking speed detection** — WPM calculation per utterance (slow/normal/fast)
- **Recording date extraction** — From filename patterns, file metadata, audio tags
- **Voice gender estimation** — Pitch-based heuristic classification

### Workflow Automation
- **Folder watcher** — Monitor a folder for new audio files, auto-queue for processing
- **Batch processing** — One-click processing for entire folders (100+ files)
- **Processing log** — Timestamped events written to disk for debugging

### Analytics
- **Real data analytics** — Processing stats, speed distribution, job status from actual history
- **Replaced all mock/demo data** with live transcript statistics

### UI/UX
- **Report inspector** — File metadata panel (original name, size, duration, date)
- **Multi-file upload redesign** — Improved batch upload experience
- **Preview badges** — Mock features clearly labeled as "Preview" or "Coming Soon"

## Technical Improvements
- 55 automated tests (stress tests for 100-file scale, streaming merge, MapReduce)
- TypeScript strict compilation for both renderer and electron main
- Processing log file with rotation (5MB max)
- Pipeline state persistence with checkpoint/resume
- Tier-based routing: normal → long_audio → enterprise → blocked

## Architecture
- Electron 34 + React 19 + Vite 6
- AssemblyAI for speech-to-text
- Gemini/OpenAI/Groq for AI features
- FFmpeg bundled (no external install needed)
- Self-contained Windows NSIS installer

## Requirements
- Windows 10/11 (64-bit)
- No external dependencies (Node.js, Python, FFmpeg all bundled)
- AssemblyAI API key required for transcription
- Gemini or OpenAI API key required for AI features
