# Python Architecture Recommendation — RecLLM

## Context

The client requires RecLLM to be delivered as a Python-based system. The current implementation is TypeScript/Electron. This document analyzes the best Python architecture for the 34 contract requirements.

---

## 1. Architecture Comparison

| Architecture | UI Quality | Dev Speed | Packaging | Maintenance | Client Perception |
|---|---|---|---|---|---|
| Full PySide6/PyQt6 | Medium | Slow | Easy (single EXE) | Hard (Qt layouts) | "Desktop app" |
| FastAPI + local web UI | High | Fast | Medium (EXE + browser) | Easy (HTML/CSS) | "Opens in browser" |
| pywebview + FastAPI | High | Fast | Easy (single window) | Easy | "Desktop app" |
| Keep Electron + Python backend | High | Fastest | Medium | Split stack | "Same as before" |

### Recommendation: **pywebview + FastAPI**

Reasons:
- Looks and feels like a native desktop app (no browser tab)
- Python handles all processing, storage, and AI
- HTML/CSS/JS is only the presentation layer (not the system)
- Single window, taskbar icon, native file dialogs
- PyInstaller packages everything into one EXE
- Client sees "Python application" — satisfies contract
- Modern UI without PyQt layout pain

### Why not full PyQt6?

- Building a transcript editor, PDF preview, batch queue, dashboard, search, and settings in PyQt takes 3-4x longer
- PyQt styling is limited compared to CSS
- PyQt table/list performance at 1000+ items requires manual optimization
- The 34 requirements include complex UI screens that are faster to build in HTML

### Why not plain FastAPI + browser?

- Client may perceive "opens in Chrome" as unprofessional
- pywebview wraps it in a native window — same tech, better perception
- Desktop integration (file dialogs, tray icon) works natively

---

## 2. Recommended Stack

```
Python 3.12
FastAPI 0.115+
Uvicorn (ASGI server)
SQLite 3 (via sqlite3 stdlib + FTS5)
pywebview 5.x (desktop window)
watchdog (folder monitoring)
ffmpeg-python or subprocess (audio processing)
httpx (async API clients)
ReportLab or WeasyPrint (PDF generation)
python-docx (DOCX export)
PyInstaller or Nuitka (Windows packaging)
```

---

## 3. Python Folder Structure

```
rec_llm_python/
├── app/
│   ├── __init__.py
│   ├── main.py                    # Entry point: start FastAPI + pywebview
│   ├── config.py                  # App configuration, paths, constants
│   ├── settings_manager.py        # User settings persistence
│   │
│   ├── api/                       # FastAPI route modules
│   │   ├── __init__.py
│   │   ├── routes_recordings.py   # Upload, list, delete recordings
│   │   ├── routes_jobs.py         # Queue status, retry, cancel
│   │   ├── routes_transcripts.py  # Get/search transcripts
│   │   ├── routes_exports.py      # PDF/TXT/DOCX export
│   │   ├── routes_settings.py     # API keys, preferences
│   │   ├── routes_search.py       # Full-text search
│   │   └── routes_analytics.py    # Dashboard stats
│   │
│   ├── core/                      # Processing engine
│   │   ├── __init__.py
│   │   ├── job_queue.py           # Background job queue (asyncio)
│   │   ├── worker.py              # Job worker (process one recording)
│   │   ├── recovery.py            # Crash recovery, orphan detection
│   │   ├── progress.py            # Progress tracking + WebSocket push
│   │   └── events.py              # Event bus (SSE or WebSocket)
│   │
│   ├── audio/                     # Audio processing
│   │   ├── __init__.py
│   │   ├── splitter.py            # Chunk long audio (25/45 min)
│   │   ├── metadata.py            # Duration, codec, sample rate
│   │   ├── noise_reduction.py     # FFmpeg afftdn filter
│   │   ├── ffmpeg_runner.py       # FFmpeg subprocess wrapper
│   │   ├── duration_detector.py   # Tier routing (normal/long/enterprise)
│   │   └── speed_detector.py      # Speaking speed (WPM)
│   │
│   ├── ai/                        # AI service layer
│   │   ├── __init__.py
│   │   ├── transcription.py       # AssemblyAI transcription
│   │   ├── diarization.py         # Speaker separation
│   │   ├── summarization.py       # Single-file summary
│   │   ├── mapreduce_summary.py   # Multi-file hierarchical summary
│   │   ├── grammar_correction.py  # Post-transcription cleanup
│   │   ├── speaker_analysis.py    # Voice type estimation
│   │   ├── translation.py         # Transcript translation
│   │   └── clients/
│   │       ├── __init__.py
│   │       ├── assemblyai_client.py
│   │       ├── openai_client.py
│   │       └── gemini_client.py
│   │
│   ├── database/                  # Data layer
│   │   ├── __init__.py
│   │   ├── db.py                  # SQLite connection, WAL mode
│   │   ├── models.py              # Table definitions
│   │   ├── migrations.py          # Schema versioning
│   │   └── search_index.py        # FTS5 helpers
│   │
│   ├── exports/                   # Document generation
│   │   ├── __init__.py
│   │   ├── pdf_exporter.py        # PDF with metadata block
│   │   ├── txt_exporter.py        # TXT with header
│   │   ├── docx_exporter.py       # DOCX export
│   │   └── templates/             # HTML templates for PDF
│   │
│   ├── watcher/                   # Folder monitoring
│   │   ├── __init__.py
│   │   └── folder_watcher.py      # watchdog-based auto-import
│   │
│   └── ui/                        # Frontend assets
│       ├── static/
│       │   ├── css/
│       │   ├── js/
│       │   └── assets/
│       ├── templates/
│       │   ├── index.html
│       │   ├── dashboard.html
│       │   ├── upload.html
│       │   ├── transcripts.html
│       │   ├── settings.html
│       │   └── search.html
│       └── components/            # Reusable UI components
│
├── data/                          # Runtime data (user's machine)
│   ├── recordings/
│   ├── chunks/
│   ├── transcripts/
│   ├── exports/
│   └── rec_llm.sqlite
│
├── tests/
│   ├── test_audio_splitter.py
│   ├── test_job_queue.py
│   ├── test_transcription.py
│   ├── test_search.py
│   ├── test_exports.py
│   └── test_stress.py
│
├── build/
│   ├── build_windows.py           # PyInstaller build script
│   ├── rec_llm.spec               # PyInstaller spec
│   └── installer/                 # NSIS or Inno Setup config
│
├── docs/
│   ├── DESIGN.md                  # System design document
│   ├── API_SPEC.md                # API specification
│   ├── DB_DESIGN.md               # Database schema document
│   ├── BUILD_MANUAL.md            # How to build from source
│   └── TEST_REPORT.md             # Test results
│
├── requirements.txt
├── pyproject.toml
└── README.md
```

---

## 4. SQLite Schema Design

```sql
-- Core recordings table
CREATE TABLE recordings (
    id TEXT PRIMARY KEY,
    original_file_name TEXT NOT NULL,
    generated_file_name TEXT,
    display_name TEXT,
    file_path TEXT,
    file_extension TEXT,
    size_bytes INTEGER DEFAULT 0,
    duration_seconds REAL,
    recording_date TEXT,
    language_code TEXT DEFAULT 'auto',
    speaker_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'processing', 'done', 'failed')),
    noise_reduction INTEGER DEFAULT 0,
    model_provider TEXT,
    model_name TEXT,
    imported_at TEXT NOT NULL,
    processed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audio chunks for long recordings
CREATE TABLE chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    start_time_sec REAL NOT NULL,
    end_time_sec REAL NOT NULL,
    file_path TEXT,
    status TEXT DEFAULT 'pending'
        CHECK(status IN ('pending', 'processing', 'done', 'failed', 'retrying')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Transcript utterances
CREATE TABLE utterances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    chunk_id INTEGER REFERENCES chunks(id),
    speaker TEXT NOT NULL DEFAULT 'Speaker',
    text TEXT NOT NULL,
    corrected_text TEXT,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    confidence REAL DEFAULT 1.0,
    word_count INTEGER,
    wpm INTEGER,
    speed_label TEXT CHECK(speed_label IN ('slow', 'normal', 'fast')),
    estimated_voice_type TEXT,
    voice_confidence REAL,
    pitch_hz REAL
);

-- Speaker profiles (cross-recording)
CREATE TABLE speakers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    display_name TEXT,
    recording_count INTEGER DEFAULT 1,
    total_utterances INTEGER DEFAULT 0,
    avg_wpm REAL,
    estimated_voice_type TEXT,
    voice_confidence REAL,
    first_seen TEXT,
    last_seen TEXT
);

-- AI summaries
CREATE TABLE summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    summary_type TEXT DEFAULT 'executive'
        CHECK(summary_type IN ('executive', 'mapreduce', 'minutes')),
    language TEXT NOT NULL DEFAULT 'ja',
    summary TEXT,
    point_notes TEXT,       -- JSON array
    action_items TEXT,      -- JSON array
    decisions TEXT,         -- JSON array
    risks TEXT,             -- JSON array
    generated_at TEXT NOT NULL
);

-- Processing jobs
CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id TEXT REFERENCES recordings(id) ON DELETE SET NULL,
    job_type TEXT NOT NULL
        CHECK(job_type IN ('transcribe', 'summarize', 'export', 'grammar', 'translate')),
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK(status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
    progress REAL DEFAULT 0,
    error_message TEXT,
    metadata TEXT,          -- JSON for job-specific params
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
);

-- Export history
CREATE TABLE exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    export_type TEXT NOT NULL CHECK(export_type IN ('pdf', 'txt', 'docx')),
    file_path TEXT NOT NULL,
    include_metadata INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Key-value metadata
CREATE TABLE metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT,
    UNIQUE(recording_id, key)
);

-- Settings
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- FTS5 full-text search
CREATE VIRTUAL TABLE search_index USING fts5(
    recording_id,
    file_name,
    speaker,
    text,
    tokenize='unicode61'
);

-- Indexes
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_recordings_date ON recordings(created_at);
CREATE INDEX idx_chunks_recording ON chunks(recording_id);
CREATE INDEX idx_utterances_recording ON utterances(recording_id);
CREATE INDEX idx_utterances_speaker ON utterances(speaker);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_recording ON jobs(recording_id);
CREATE INDEX idx_summaries_recording ON summaries(recording_id);
```

---

## 5. Packaging Strategy for Windows EXE

### Option A: PyInstaller (Recommended)

```
PyInstaller --onedir mode
├── RecLLM/
│   ├── RecLLM.exe              # Main executable
│   ├── python312.dll
│   ├── _internal/              # Python packages
│   ├── ffmpeg.exe              # Bundled
│   ├── ffprobe.exe             # Bundled
│   └── ui/                     # Static web assets
```

Wrap with Inno Setup or NSIS for professional installer.

### Option B: Nuitka (Alternative)

- Compiles Python to C → native EXE
- Faster startup, smaller size
- More complex build process
- Better obfuscation

### Bundled Dependencies

| Dependency | Size | Included In |
|---|---|---|
| Python 3.12 runtime | ~35MB | PyInstaller bundle |
| FFmpeg | ~90MB | extraResources |
| FFprobe | ~90MB | extraResources |
| SQLite | ~2MB | Python stdlib |
| UI assets | ~5MB | Static files |
| Python packages | ~50MB | _internal/ |
| **Total** | **~270MB** | |

### Client Requirements Met

- No Python install needed
- No Node.js/npm needed
- No FFmpeg install needed
- No developer tools needed
- Double-click EXE to run
- Uninstall via Windows Add/Remove Programs

---

## 6. Migration Plan from TypeScript/Electron to Python

### Phase 1: Python Core Engine (Week 1-2)

Build the processing backbone:
- Audio import + FFmpeg metadata
- Duration detection + tier routing
- Chunk splitting (25/45 min)
- SQLite database + schema
- Job queue (asyncio background tasks)
- AssemblyAI transcription client
- Transcript merge (streaming for 30h)
- TXT export
- Basic stress tests

**Deliverable:** Python CLI that can process a 30h audio file end-to-end.

### Phase 2: Long Audio Safety (Week 2-3)

- 19-30 hour processing pipeline
- Resume after crash (checkpoint/recovery)
- Retry failed chunks (max 3)
- Streaming merge (no RAM overflow)
- Progress tracking
- Processing log with rotation
- Parallel chunk processing (configurable concurrency)

**Deliverable:** Stable pipeline that handles 100 files without failure.

### Phase 3: AI Features (Week 3-4)

- Summary generation (single + MapReduce)
- Grammar correction (chunked for long transcripts)
- Speaker analysis (voice type estimation with confidence)
- Speaking speed detection (WPM)
- Noise reduction (FFmpeg afftdn)
- Translation
- Recording date extraction

**Deliverable:** All 34 AI requirements functional.

### Phase 4: Web UI (Week 4-6)

- FastAPI routes for all features
- WebSocket for real-time progress
- Dashboard (stats from SQLite)
- Upload + batch queue screen
- Transcript viewer/editor
- Search (FTS5)
- Settings (API keys, preferences)
- PDF export editor
- Analytics page
- Full Japanese i18n

**Deliverable:** Complete UI matching current Electron app.

### Phase 5: Packaging + Delivery (Week 6-7)

- PyInstaller build
- Windows installer (Inno Setup)
- Test on clean Windows 10/11
- Write documentation:
  - Design document
  - API specification
  - DB design document
  - Build manual
  - Test report
- Prepare test data
- Final client delivery

**Deliverable:** Windows EXE + all contract documents.

---

## 7. Feature Mapping: 34 Requirements → Python Modules

| # | Requirement | Python Module |
|---|---|---|
| R1 | 19-30h audio processing | `audio/splitter.py` + `core/worker.py` |
| R2 | Auto chunking | `audio/splitter.py` |
| R3 | Batch queue (100+ files) | `core/job_queue.py` |
| R4 | Folder watcher | `watcher/folder_watcher.py` |
| R5 | Speaker diarization | `ai/diarization.py` (AssemblyAI) |
| R6 | Timestamps | `ai/transcription.py` |
| R7 | Noise reduction | `audio/noise_reduction.py` |
| R8 | Speaking speed | `audio/speed_detector.py` |
| R9 | Voice type estimation | `ai/speaker_analysis.py` |
| R10 | Recording date detection | `audio/metadata.py` |
| R11 | AI summary | `ai/summarization.py` |
| R12 | MapReduce summary (100+ files) | `ai/mapreduce_summary.py` |
| R13 | Grammar correction | `ai/grammar_correction.py` |
| R14 | Translation | `ai/translation.py` |
| R15 | PDF export | `exports/pdf_exporter.py` |
| R16 | TXT export | `exports/txt_exporter.py` |
| R17 | DOCX export | `exports/docx_exporter.py` |
| R18 | Export metadata block | `exports/pdf_exporter.py` |
| R19 | Full-text search | `database/search_index.py` |
| R20 | SQLite storage | `database/db.py` |
| R21 | Crash recovery | `core/recovery.py` |
| R22 | Retry failed chunks | `core/worker.py` |
| R23 | Progress tracking | `core/progress.py` |
| R24 | Processing log | `core/worker.py` (logging) |
| R25 | Settings persistence | `settings_manager.py` |
| R26 | API key management | `api/routes_settings.py` |
| R27 | Dashboard analytics | `api/routes_analytics.py` |
| R28 | Japanese i18n | `ui/` (frontend i18n) |
| R29 | Windows standalone EXE | `build/build_windows.py` |
| R30 | No external dependencies | PyInstaller bundle |
| R31 | Parallel processing | `core/job_queue.py` |
| R32 | Streaming merge | `ai/transcription.py` |
| R33 | Speaker profiles | `database/models.py` (speakers table) |
| R34 | Confidence thresholds | `ai/speaker_analysis.py` |

---

## 8. Risk Analysis

| Risk | Severity | Mitigation |
|---|---|---|
| PyInstaller EXE size (~300MB) | Low | Acceptable for desktop app |
| PyInstaller startup time (~3-5s) | Medium | Splash screen, lazy imports |
| SQLite concurrent write limits | Low | WAL mode, single writer pattern |
| FFmpeg subprocess on Windows | Low | Bundled binary, tested paths |
| pywebview rendering differences | Medium | Test on Windows 10/11 WebView2 |
| WebView2 not installed on old Windows | Medium | Bundle WebView2 runtime or fallback |
| Large transcript memory usage | Low | Streaming merge pattern (proven) |
| AssemblyAI rate limits | Medium | Configurable concurrency + backoff |
| Client rejects "web UI" perception | Medium | pywebview makes it look native |
| Migration breaks existing features | High | Keep TypeScript version as reference |
| Build reproducibility on Windows | Medium | Document exact Python + pip versions |
| Anti-virus false positives on EXE | Medium | Code signing certificate |

---

## 9. Estimated Development Time

| Phase | Duration | Cumulative |
|---|---|---|
| Phase 1: Core Engine | 1.5 weeks | 1.5 weeks |
| Phase 2: Long Audio Safety | 1 week | 2.5 weeks |
| Phase 3: AI Features | 1.5 weeks | 4 weeks |
| Phase 4: Web UI | 2 weeks | 6 weeks |
| Phase 5: Packaging + Docs | 1 week | 7 weeks |
| Buffer + Testing | 1 week | **8 weeks** |

**Total: ~8 weeks** for full Python rewrite with all 34 requirements.

If keeping the current Electron UI temporarily and only rewriting the backend to Python: **~4 weeks**.

---

## 10. Immediate Next Steps

1. **Do not delete TypeScript code.** Keep it as working reference.
2. **Create `rec_llm_python/` directory** alongside current project.
3. **Start Phase 1:** Core engine (audio import, FFmpeg, SQLite, job queue, AssemblyAI client).
4. **Validate early:** Process one 30-minute file end-to-end in Python before building UI.
5. **Test PyInstaller packaging** early (Week 1) to catch bundling issues before they compound.
6. **Decide UI approach:** Confirm pywebview is acceptable to client before investing in frontend.

---

## Summary

| Decision | Choice | Reason |
|---|---|---|
| Architecture | pywebview + FastAPI | Native feel, fast UI dev, Python core |
| Database | SQLite + FTS5 | No server needed, proven at 1000+ files |
| Audio | FFmpeg subprocess | Reliable, bundled, no Python audio libs needed |
| AI clients | httpx async | Non-blocking, timeout control |
| PDF | WeasyPrint or ReportLab | Professional output, no browser needed |
| Packaging | PyInstaller + Inno Setup | Single installer, no dependencies |
| UI framework | Vanilla JS + CSS (or Alpine.js) | Lightweight, no npm build step |

This architecture satisfies all 34 contract requirements while being maintainable, testable, and deliverable as a standalone Windows application.
