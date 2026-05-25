# Changelog

All notable changes to RecLLM are documented here.

## [0.3.1] - 2026-05-26

### Added
- AI processing API — summarize, grammar correction, translate endpoints
- Speaker analysis API — per-recording analysis, global speaker list, rename
- Batch import API — multi-file import with validation and tier routing
- Folder watcher API — start/stop/status for auto-import
- OpenAI client (GPT-4o / GPT-4o-mini) with JSON mode
- Gemini client (gemini-1.5-flash) for summarization
- AssemblyAI client — upload, transcribe, poll with speaker diarization
- Web UI transcript detail viewer — utterance list, WPM badges, export buttons
- Web UI WebSocket progress — real-time job status updates
- Web UI file upload wired to API — drag-and-drop + upload
- Web UI recording list — status badges, duration, speaker count, delete with confirm
- CORS middleware + global error handler
- Request logging middleware + rate limiter module
- Database migration system — forward-only numbered migrations
- System health check — DB status, disk space, FFmpeg, API keys
- GitHub Actions CI workflow — TypeScript build+test, Python pytest
- OpenAPI schema export — 35 endpoints auto-documented
- Startup script with CLI flags (--port, --host, --reload, --desktop)
- Python backend README with architecture docs
- Extended API integration tests (118 total)

### Fixed
- Search route `completed_at` → `processed_at` column reference
- Database singleton isolation for test parallelism
- FastAPI version string consistency

## [0.3.0] - 2026-05-26

### Added
- Complete Python FastAPI backend (dual-stack delivery)
- File upload API + transcript editing + speaker rename
- Settings manager — obfuscated API key storage
- Exports API — PDF/TXT/DOCX endpoints + export history
- Analytics API — overview, today stats, speaker stats
- Search API — FTS5 full-text search with filters
- Job queue with crash recovery + orphan detection
- Transcription worker — chunked pipeline for long audio
- Audio tier routing (Normal < 2h, Long 2-10h, Enterprise 10-30h)
- Web UI SPA — Alpine.js + Tailwind CSS dashboard
- pywebview desktop wrapper
- Windows build support (PyInstaller)

## [0.2.0] - 2026-05-25

### Added
- TypeScript/Electron desktop application
- AssemblyAI transcription integration
- Gemini AI summarization + grammar correction
- Speaker diarization + WPM analysis
- SQLite database with FTS5 search
- PDF/TXT/DOCX export
- Folder watcher for auto-import
- Settings UI with API key management

## [0.1.0] - 2026-05-24

### Added
- Initial project structure
- Audio file import + metadata extraction
- FFmpeg integration for format conversion
- Basic transcription pipeline
