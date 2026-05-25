# RecLLM Python Backend

AI-powered audio transcription engine with long-audio support (up to 30 hours).

## Quick Start

```bash
# Setup
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Run tests
python -m pytest tests/ -v

# Start server (development)
python -m app.main

# Start desktop app (pywebview)
python -m app.desktop
```

Server runs at http://127.0.0.1:8765

## Architecture

```
app/
├── api/              # FastAPI routes (11 route groups)
│   ├── routes_recordings.py   # CRUD + upload + import
│   ├── routes_jobs.py         # Job queue management
│   ├── routes_search.py       # FTS5 full-text search
│   ├── routes_settings.py     # API keys + preferences
│   ├── routes_analytics.py    # Dashboard statistics
│   ├── routes_exports.py      # PDF/TXT/DOCX export
│   ├── routes_watcher.py      # Folder watcher control
│   ├── routes_ai.py           # Summarize/grammar/translate
│   ├── routes_speakers.py     # Speaker analysis
│   ├── routes_batch.py        # Batch import
│   └── routes_progress.py     # WebSocket progress
├── ai/               # AI processing
│   ├── clients/      # Gemini, OpenAI, AssemblyAI clients
│   ├── summarization.py       # Single + MapReduce summary
│   ├── grammar_correction.py  # Batch grammar fix
│   ├── translation.py         # Multi-language translation
│   └── speaker_analysis.py    # Voice classification + WPM
├── audio/            # Audio processing
│   ├── ffmpeg_runner.py       # FFmpeg subprocess wrapper
│   └── duration_detector.py   # Tier routing (Normal/Long/Enterprise)
├── core/             # Engine
│   ├── job_queue.py           # Async job queue + recovery
│   └── worker.py              # Transcription pipeline
├── database/         # SQLite + FTS5
│   └── db.py                  # Schema, WAL mode, migrations
├── exports/          # Document generation
│   ├── pdf_exporter.py        # HTML→PDF (WeasyPrint)
│   ├── docx_exporter.py       # python-docx
│   └── txt_exporter.py        # Plain text + metadata
├── watcher/          # Folder monitoring
│   └── folder_watcher.py      # Polling-based file detection
├── ui/static/        # Web UI (Alpine.js + Tailwind)
│   └── index.html             # SPA dashboard
├── config.py         # App configuration
├── settings_manager.py        # Obfuscated key storage
├── main.py           # CLI entry point (uvicorn)
└── desktop.py        # Desktop entry point (pywebview)
```

## API Endpoints

| Group | Prefix | Endpoints |
|-------|--------|-----------|
| Health | `/api/health` | GET |
| Recordings | `/api/recordings` | GET, POST, PUT, DELETE |
| Jobs | `/api/jobs` | GET, POST |
| Search | `/api/search` | POST |
| Settings | `/api/settings` | GET, PUT, POST, DELETE |
| Analytics | `/api/analytics` | GET |
| Exports | `/api/exports` | GET, POST |
| Watcher | `/api/watcher` | GET, POST |
| AI | `/api/ai` | GET, POST |
| Speakers | `/api/speakers` | GET, PUT |
| Batch | `/api/batch` | POST |
| Progress | `/ws/progress` | WebSocket |

## Audio Tier Routing

| Tier | Duration | Strategy |
|------|----------|----------|
| Normal | < 2h | Direct transcription |
| Long Audio | 2-10h | 45min chunks, parallel ×2 |
| Enterprise | 10-30h | 25min chunks, sequential |
| Blocked | > 30h | Rejected |

## Tests

```bash
python -m pytest tests/ -v          # All 118 tests
python -m pytest tests/test_core.py  # Core logic (23)
python -m pytest tests/test_pipeline.py  # Pipeline (17)
python -m pytest tests/test_ai_features.py  # AI features (29)
python -m pytest tests/test_api.py   # API integration (29)
python -m pytest tests/test_api_extended.py  # Extended API (20)
```

## Build (Windows EXE)

```bash
pip install pyinstaller
python build/build_windows.py
# Output: dist/RecLLM/RecLLM.exe
```

## Documentation

- [DESIGN.md](docs/DESIGN.md) — System architecture
- [API_SPEC.md](docs/API_SPEC.md) — Full API specification
- [DB_DESIGN.md](docs/DB_DESIGN.md) — Database schema
- [BUILD_MANUAL.md](docs/BUILD_MANUAL.md) — Build instructions
- [TEST_REPORT.md](docs/TEST_REPORT.md) — Test results
