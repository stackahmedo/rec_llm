# RecLLM — Electron to Python Migration Plan

## 1. Current Architecture Analysis

### Codebase Metrics

| Layer | Files | Lines | Purpose |
|-------|-------|-------|---------|
| Electron Main (backend) | 13 .ts files | 3,811 | IPC handlers, FFmpeg, API calls, file I/O |
| React Renderer (UI) | 50+ .tsx files | 8,751 (components) | UI components, state, interactions |
| App Logic (stores/services) | 18 .ts/.tsx files | 3,898 | State management, business logic |
| UI Primitives (shadcn/ui) | 50+ .tsx files | ~5,000 | Reusable UI components |
| Tests | 3 files | ~200 | Unit tests |
| **Total** | **124 files** | **~23,300** | |

### IPC Surface (39 handlers)

These represent the complete API contract between frontend and backend:

```
assemblyai:transcribeFile, assemblyai:validateKey
audio:compress, audio:ffmpegCheck, audio:metadata, audio:split
dialog:openAudioFiles, dialog:openAudioFolder
document:exists, document:load, document:save
export:saveDocx, export:saveTxt, export:selectFolder
history:clear, history:delete, history:load, history:loadTranscript, history:save
longaudio:analyze, longaudio:cancel, longaudio:chunkDone, longaudio:chunkFailed,
  longaudio:cleanup, longaudio:getMerged, longaudio:listRecoverable,
  longaudio:nextChunk, longaudio:resume, longaudio:start, longaudio:status
pdf:exportReport, pdf:previewHtml, pdf:print
settings:delete, settings:get, settings:set
storage:stats
summarize:chat, summarize:generate, summarize:suggestSpeakers
```

### Key Dependencies (Node.js/Electron)

| Dependency | Role | Python Equivalent |
|------------|------|-------------------|
| Electron | Desktop shell, native dialogs, window management | PySide6 |
| React + Radix UI | Component UI framework | PySide6 QWidgets / QML |
| @tanstack/react-virtual | Virtualized lists | QListView with model |
| electron-store | Settings persistence | SQLite / JSON config |
| Vite | Build tooling | N/A (Python doesn't need bundler) |
| zod | Schema validation | Pydantic |
| sonner | Toast notifications | QSystemTrayIcon / custom widget |
| tailwindcss | Styling | QSS stylesheets |
| lucide-react | Icons | QtAwesome or bundled SVGs |
| electron-builder | Packaging | PyInstaller / Nuitka |

---

## 2. Feature-to-Python Mapping

### Backend Services (Direct Port — High Reuse)

| Current Module | Lines | Python Equivalent | Reuse Level |
|----------------|-------|-------------------|-------------|
| `assemblyai.ts` | 287 | `services/assemblyai.py` — httpx + streaming upload | Logic rewrite, same API calls |
| `audio-preprocess.ts` | 264 | `services/audio.py` — subprocess FFmpeg | Near-direct port |
| `long-audio-pipeline.ts` | 732 | `services/pipeline.py` — multiprocessing + SQLite state | Architecture port |
| `summarize.ts` | 479 | `services/summarize.py` — httpx to Gemini/OpenAI | Near-direct port |
| `history.ts` | 406 | `services/history.py` — SQLite instead of JSON files | Improved rewrite |
| `pdf-export.ts` | 674 | `services/pdf_export.py` — ReportLab or WeasyPrint | Full rewrite |
| `gender-detection.ts` | 106 | `services/voice_analysis.py` — numpy + scipy | Direct port |
| `credential-store.ts` | 153 | `services/credentials.py` — keyring library | Simpler in Python |
| `export.ts` | 192 | `services/export.py` — pathlib + python-docx | Direct port |
| `settings.ts` | 51 | Part of SQLite config table | Trivial |

### UI Components (Full Rewrite Required)

| React Component | Lines | PySide6 Equivalent | Complexity |
|-----------------|-------|-------------------|------------|
| `transcript-workspace.tsx` | 660 | `views/transcript_workspace.py` — QSplitter + panels | High |
| `pdf-editor.tsx` | 1,745 | `views/pdf_editor.py` — QWebEngineView for preview | Very High |
| `settings-panel.tsx` | 1,052 | `views/settings.py` — QTabWidget + forms | Medium |
| `transcript-editor.tsx` | 485 | `views/transcript_editor.py` — QTableView | Medium |
| `processing-queue.tsx` | 220 | `views/queue.py` — QListView + QAbstractItemModel | Medium |
| `upload-toolbar.tsx` | 188 | `views/toolbar.py` — QToolBar | Low |
| `session-list.tsx` | 143 | `views/session_list.py` — QListWidget | Low |
| `speaker-panel.tsx` | 466 | `views/speaker_panel.py` — QTreeWidget | Medium |
| `analytics-panel.tsx` | 208 | `views/analytics.py` — matplotlib or pyqtgraph | Medium |
| `dashboard-status.tsx` | 543 | `views/dashboard.py` — QGridLayout + cards | Medium |

### State Management (Architecture Change)

| Current (React Context) | Python Equivalent |
|------------------------|-------------------|
| `transcript-store.tsx` | SQLite + QAbstractItemModel + signals |
| `upload-job-store.tsx` | SQLite `jobs` table + QThread worker |
| `speaker-memory.tsx` | SQLite `speakers` table |
| `notification-store.ts` | QSystemTrayIcon + in-memory deque |
| `pdf-template-store.ts` | SQLite `templates` table |
| `i18n.tsx` | QTranslator + .ts/.qm files or dict-based |

---

## 3. Proposed Python Architecture

### Project Structure

```
recllm/
├── main.py                     # Entry point
├── app.py                      # QApplication setup, main window
├── config.py                   # Constants, paths, version
│
├── models/                     # Data models (Pydantic + SQLAlchemy)
│   ├── __init__.py
│   ├── database.py             # SQLite engine, session factory
│   ├── job.py                  # UploadJob model
│   ├── transcript.py           # Transcript, Utterance models
│   ├── history.py              # HistoryEntry model
│   ├── speaker.py              # SpeakerProfile model
│   └── settings.py             # AppSettings model
│
├── services/                   # Backend logic (no UI imports)
│   ├── __init__.py
│   ├── assemblyai.py           # AssemblyAI upload + transcription
│   ├── audio.py                # FFmpeg metadata, compress, split
│   ├── pipeline.py             # Long audio chunked pipeline
│   ├── summarize.py            # LLM summarization (Gemini/OpenAI)
│   ├── chat.py                 # AI chat with transcript
│   ├── pdf_export.py           # PDF generation (ReportLab)
│   ├── export.py               # TXT, DOCX, JSON export
│   ├── credentials.py          # keyring-based secret storage
│   ├── voice_analysis.py       # Pitch/gender heuristic
│   └── processing_log.py      # File-based processing log
│
├── workers/                    # Background threads/processes
│   ├── __init__.py
│   ├── queue_worker.py         # Sequential job processor
│   ├── chunk_worker.py         # Long audio chunk processor
│   └── signals.py              # Custom Qt signals for worker→UI
│
├── views/                      # UI (PySide6 widgets)
│   ├── __init__.py
│   ├── main_window.py          # QMainWindow + navigation
│   ├── toolbar.py              # Upload toolbar + batch actions
│   ├── queue_view.py           # Processing queue (QListView)
│   ├── transcript_workspace.py # Transcript + AI panel
│   ├── transcript_editor.py    # Utterance table editor
│   ├── session_list.py         # Left sidebar session list
│   ├── pdf_editor.py           # PDF preview + settings
│   ├── settings_view.py        # Settings tabs
│   ├── speaker_panel.py        # Speaker management
│   ├── dashboard.py            # Status dashboard
│   └── dialogs/                # Modal dialogs
│       ├── folder_picker.py
│       └── confirm.py
│
├── widgets/                    # Reusable custom widgets
│   ├── __init__.py
│   ├── badge.py                # Status badge
│   ├── progress_card.py        # Job progress card
│   ├── toast.py                # Toast notification overlay
│   ├── search_bar.py           # Search input
│   └── virtual_list.py         # Virtualized list widget
│
├── i18n/                       # Internationalization
│   ├── __init__.py
│   ├── en.json
│   └── ja.json
│
├── resources/                  # Static assets
│   ├── icons/                  # SVG icons
│   ├── styles/                 # QSS stylesheets
│   │   ├── dark.qss
│   │   └── light.qss
│   └── ffmpeg/                 # Bundled FFmpeg binaries
│
├── tests/
│   ├── test_pipeline.py
│   ├── test_assemblyai.py
│   └── test_models.py
│
├── pyproject.toml              # Dependencies + build config
├── build.spec                  # PyInstaller spec
└── README.md
```

### Key Architecture Decisions

#### 1. Database: SQLite (via SQLAlchemy)

Replace JSON files + localStorage with a single SQLite database:

```python
# models/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from pathlib import Path

DB_PATH = Path.home() / "AppData" / "Local" / "RecLLM" / "recllm.db"

class Base(DeclarativeBase):
    pass

engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)
Session = sessionmaker(bind=engine)
```

**Advantages over current JSON approach:**
- Concurrent access safe
- No 5-10MB localStorage limit
- Proper indexing for search
- Transaction support for crash safety
- Single file backup

#### 2. Threading Model

```
Main Thread (UI)
  ├── QueueWorker (QThread) — processes jobs sequentially
  │     └── emits: progress_updated, job_completed, job_failed
  ├── ChunkWorker (QThread) — handles long audio pipeline
  │     └── emits: chunk_completed, pipeline_done
  └── SummaryWorker (QThread) — non-blocking AI calls
        └── emits: summary_ready, chat_reply
```

**Rules:**
- UI thread NEVER does I/O, network, or FFmpeg calls
- Workers communicate via Qt signals (thread-safe)
- SQLite accessed from any thread (WAL mode enabled)
- Large data passed by reference (file paths), not by value

#### 3. State Management

Replace React Context with Qt's Model/View pattern:

```python
# models/job.py
class JobModel(QAbstractTableModel):
    """Backed by SQLite, emits dataChanged when jobs update."""
    
    def __init__(self):
        super().__init__()
        self._jobs = []  # Cache of current jobs
        self.refresh()
    
    def refresh(self):
        with Session() as session:
            self._jobs = session.query(Job).order_by(Job.created_at.desc()).all()
        self.layoutChanged.emit()
    
    def add_job(self, job: Job):
        with Session() as session:
            session.add(job)
            session.commit()
        self.refresh()
```

#### 4. UI Responsiveness Strategy

PySide6 is inherently less fluid than React/CSS. Mitigations:

| Problem | Solution |
|---------|----------|
| List scrolling with 100+ items | QListView + QAbstractItemModel (native virtualization) |
| UI freeze during processing | All I/O in QThread workers |
| Slow widget creation | Lazy-load tabs (create on first show) |
| Complex layouts | QSS stylesheets for visual polish |
| Animations | QPropertyAnimation for subtle transitions |
| Modern look | Custom QSS theme (dark mode, rounded corners) |

---

## 4. Module-by-Module Migration Guide

### Phase 1: Core Infrastructure (Week 1-2)

**Files to create:**
- `main.py`, `app.py`, `config.py`
- `models/database.py` — SQLite schema
- `models/job.py`, `models/transcript.py`, `models/history.py`
- `services/credentials.py` — keyring wrapper
- `services/audio.py` — FFmpeg subprocess calls
- `views/main_window.py` — skeleton with navigation

**What to port from:**
- `electron/main.ts` → `app.py` (window creation, app lifecycle)
- `electron/settings.ts` → `models/settings.py`
- `electron/credential-store.ts` → `services/credentials.py`
- `electron/audio-preprocess.ts` → `services/audio.py`

**Reuse level:** ~60% logic reuse (same FFmpeg commands, same API patterns)

### Phase 2: AssemblyAI + Queue (Week 2-3)

**Files to create:**
- `services/assemblyai.py` — httpx streaming upload + polling
- `workers/queue_worker.py` — sequential job processor
- `workers/signals.py` — progress/completion signals
- `views/queue_view.py` — job list with progress
- `views/toolbar.py` — add files/folder buttons

**What to port from:**
- `electron/assemblyai.ts` → `services/assemblyai.py`
- `src/app/hooks/use-processing-engine.ts` → `workers/queue_worker.py`
- `src/app/upload-job-store.tsx` → `models/job.py`
- `src/app/components/processing-queue.tsx` → `views/queue_view.py`

**Reuse level:** ~50% (same HTTP calls, different async model)

### Phase 3: Long Audio Pipeline (Week 3-4)

**Files to create:**
- `services/pipeline.py` — chunk splitting, state management
- `workers/chunk_worker.py` — sequential chunk processor

**What to port from:**
- `electron/long-audio-pipeline.ts` (732 lines) → `services/pipeline.py`

**Reuse level:** ~70% (same FFmpeg commands, same state machine logic)

### Phase 4: Transcript UI (Week 4-5)

**Files to create:**
- `views/transcript_workspace.py` — main transcript view
- `views/transcript_editor.py` — utterance table
- `views/session_list.py` — sidebar
- `views/speaker_panel.py` — speaker management

**What to port from:**
- `src/app/components/transcript-workspace.tsx` (660 lines)
- `src/app/components/transcript-editor.tsx` (485 lines)
- `src/app/components/session-list.tsx` (143 lines)

**Reuse level:** ~20% (logic reusable, UI completely different)

### Phase 5: AI Features (Week 5-6)

**Files to create:**
- `services/summarize.py` — LLM API calls
- `services/chat.py` — transcript Q&A
- `workers/summary_worker.py`

**What to port from:**
- `electron/summarize.ts` (479 lines) → `services/summarize.py`

**Reuse level:** ~80% (same prompts, same API calls, just different HTTP library)

### Phase 6: PDF Export (Week 6-7)

**Files to create:**
- `services/pdf_export.py` — ReportLab or WeasyPrint
- `views/pdf_editor.py` — preview + settings

**What to port from:**
- `electron/pdf-export.ts` (674 lines) — HTML template approach

**Reuse level:** ~30% (HTML→PDF approach can be kept with WeasyPrint, or full rewrite with ReportLab)

### Phase 7: Settings + Polish (Week 7-8)

**Files to create:**
- `views/settings_view.py`
- `i18n/en.json`, `i18n/ja.json`
- `resources/styles/dark.qss`
- Packaging with PyInstaller

**What to port from:**
- `src/app/components/settings-panel.tsx` (1,052 lines)
- `src/app/i18n.tsx` (708 lines)

---

## 5. Tradeoffs: Electron vs Python Desktop

### Where Python is WEAKER

| Area | Electron Advantage | Python Mitigation |
|------|-------------------|-------------------|
| UI polish | CSS/HTML is infinitely flexible | QSS is limited; use QWebEngineView for complex views |
| Animations | CSS transitions are trivial | QPropertyAnimation works but more code |
| Component ecosystem | npm has thousands of UI components | PySide6 has fewer; build custom widgets |
| Hot reload | Vite HMR is instant | No equivalent; restart app for UI changes |
| Bundle size | ~280MB (acceptable) | PyInstaller: ~150-200MB (better) |
| Startup time | 2-3 seconds | 1-2 seconds (better) |
| Memory usage | ~200-400MB (Chromium overhead) | ~80-150MB (much better) |
| Cross-platform UI consistency | Identical everywhere | Native look varies by OS |

### Where Python is STRONGER

| Area | Python Advantage |
|------|-----------------|
| Audio processing | numpy, scipy, librosa — native speed |
| Memory efficiency | No Chromium overhead, direct memory control |
| Packaging | Single EXE, no Node.js runtime needed |
| Long-running processes | multiprocessing is more robust than Node workers |
| SQLite | First-class support, no ORM overhead |
| FFmpeg integration | subprocess is simpler than child_process |
| Startup time | Faster cold start |
| Crash recovery | Process isolation via multiprocessing |
| Scientific computing | numpy for audio analysis, no WASM needed |
| API clients | httpx/aiohttp are excellent |

### Critical Risk: UI Responsiveness

The #1 risk in Python desktop apps is UI freezing. Electron's architecture (separate renderer process) naturally prevents this. In PySide6, you must be disciplined:

**Rule: NEVER call these from the main thread:**
- `subprocess.run()` (FFmpeg)
- `httpx.post()` (API calls)
- `open().read()` (large files)
- `sqlite3.execute()` (complex queries)
- Any operation that takes >50ms

**Solution:** Every I/O operation goes through a QThread worker with signal-based callbacks.

---

## 6. Recommended Libraries

### Core

| Library | Version | Purpose |
|---------|---------|---------|
| PySide6 | 6.7+ | UI framework (LGPL, commercial-friendly) |
| SQLAlchemy | 2.0+ | ORM for SQLite |
| Pydantic | 2.0+ | Data validation (replaces zod) |
| httpx | 0.27+ | HTTP client (async + sync) |
| keyring | 25+ | OS credential storage |

### Audio/Processing

| Library | Purpose |
|---------|---------|
| ffmpeg-python | FFmpeg command builder (or raw subprocess) |
| numpy | Audio signal processing |
| scipy | Pitch detection |

### Export

| Library | Purpose |
|---------|---------|
| WeasyPrint | HTML→PDF (reuse existing HTML templates) |
| python-docx | DOCX export |
| ReportLab | Alternative PDF (more control, no HTML) |

### Packaging

| Library | Purpose |
|---------|---------|
| PyInstaller | EXE packaging (proven, widely used) |
| Nuitka | Alternative (compiles to C, faster startup) |

### Development

| Library | Purpose |
|---------|---------|
| pytest | Testing |
| ruff | Linting + formatting |
| loguru | Structured logging |

---

## 7. Performance Optimizations

### Memory-Efficient Large Audio Pipeline

```python
# services/pipeline.py — streaming merge
def merge_transcripts_streaming(chunks_dir: Path, output_path: Path):
    """Write merged transcript to disk incrementally — never hold all in RAM."""
    with open(output_path, 'w', encoding='utf-8') as out:
        out.write('{"utterances": [\n')
        first = True
        for chunk_file in sorted(chunks_dir.glob("chunk_*.json")):
            chunk_data = json.loads(chunk_file.read_text())
            offset_ms = chunk_data["start_time_ms"]
            for utt in chunk_data["utterances"]:
                if not first:
                    out.write(',\n')
                utt["startMs"] += offset_ms
                utt["endMs"] += offset_ms
                out.write(json.dumps(utt))
                first = False
        out.write('\n]}')
```

### Virtualized Transcript Display

```python
# views/transcript_editor.py
class TranscriptModel(QAbstractTableModel):
    """Only loads visible rows from SQLite — handles 500K+ utterances."""
    
    PAGE_SIZE = 200
    
    def __init__(self, file_id: str):
        super().__init__()
        self.file_id = file_id
        self._cache = {}
        self._total = self._count_rows()
    
    def rowCount(self, parent=None):
        return self._total
    
    def data(self, index, role=Qt.DisplayRole):
        row = index.row()
        page = row // self.PAGE_SIZE
        if page not in self._cache:
            self._load_page(page)
        return self._cache[page][row % self.PAGE_SIZE][index.column()]
    
    def _load_page(self, page: int):
        offset = page * self.PAGE_SIZE
        with Session() as session:
            rows = session.query(Utterance)\
                .filter_by(file_id=self.file_id)\
                .offset(offset).limit(self.PAGE_SIZE).all()
            self._cache[page] = rows
```

---

## 8. Migration Risks and Bottlenecks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| PDF editor complexity (1,745 lines) | Weeks of work | High | Use QWebEngineView + existing HTML templates |
| UI doesn't feel "modern" | User perception | Medium | Invest in QSS theme, custom widgets |
| PySide6 learning curve | Slower development | Medium | Start with simple views, iterate |
| FFmpeg bundling on Windows | Packaging issues | Low | Same approach as current (extraResources) |
| Large file handling | Memory issues | Low | Python is actually better here (generators) |
| Async complexity | Deadlocks, race conditions | Medium | Use QThread + signals, avoid raw threading |
| i18n migration | Tedious but straightforward | Low | JSON-based, same keys |

---

## 9. Estimated Development Time

### Solo Developer with Claude Code

| Phase | Effort | Cumulative |
|-------|--------|-----------|
| Phase 1: Core infrastructure + DB | 5-7 days | Week 1 |
| Phase 2: AssemblyAI + Queue | 5-7 days | Week 2 |
| Phase 3: Long audio pipeline | 4-5 days | Week 3 |
| Phase 4: Transcript UI | 7-10 days | Week 4-5 |
| Phase 5: AI features | 3-4 days | Week 5 |
| Phase 6: PDF export | 5-7 days | Week 6 |
| Phase 7: Settings + i18n + polish | 5-7 days | Week 7 |
| Phase 8: Packaging + testing | 3-5 days | Week 8 |
| **Total** | **37-52 days** | **8-10 weeks** |

### What Can Be Reused (Copy-Paste Level)

- FFmpeg command arguments (same CLI flags)
- AssemblyAI API request/response handling (same endpoints)
- LLM prompts (identical strings)
- i18n translation strings (same keys/values)
- Pipeline state machine logic (same flow)
- File naming/sanitization logic
- Audio tier routing constants

### What Must Be Completely Rewritten

- All UI components (React → PySide6 widgets)
- State management (Context → Model/View + SQLite)
- IPC layer (eliminated — direct function calls)
- CSS styling (Tailwind → QSS)
- Build/packaging (Vite+electron-builder → PyInstaller)
- Async patterns (useEffect/useCallback → QThread+signals)

---

## 10. Step-by-Step Migration Strategy for Solo Developer

### Strategy: Parallel Development (Recommended)

Don't try to convert file-by-file. Build the Python app from scratch using the Electron app as a living specification.

```
Week 1: Skeleton + DB + Audio
  - Create project structure
  - Set up SQLite with SQLAlchemy models
  - Port FFmpeg audio analysis/splitting
  - Create main window with empty navigation
  - Verify: can analyze an audio file from CLI

Week 2: AssemblyAI + Processing Queue
  - Port AssemblyAI upload + transcription
  - Build QThread-based queue worker
  - Create queue view (QListView)
  - Create upload toolbar with file/folder picker
  - Verify: can transcribe a short file end-to-end

Week 3: Long Audio Pipeline
  - Port chunking logic
  - Port checkpoint/resume
  - Add enterprise tier routing
  - Verify: can process a 3h file with chunking

Week 4: Transcript Display
  - Build session list (sidebar)
  - Build transcript editor (QTableView)
  - Build transcript workspace layout
  - Connect to SQLite for lazy loading
  - Verify: can view completed transcripts

Week 5: AI Features
  - Port summarization (same prompts)
  - Port AI chat
  - Port translation
  - Port speaker suggestion
  - Auto-summarize after transcription
  - Verify: summary generates correctly

Week 6: PDF Export
  - Choose approach: WeasyPrint (reuse HTML) or ReportLab
  - Port PDF template system
  - Build PDF preview (QWebEngineView)
  - Verify: can export professional PDF

Week 7: Settings + i18n + Polish
  - Build settings panel
  - Port all i18n strings
  - Create dark/light QSS themes
  - Add toast notifications
  - Add keyboard shortcuts
  - Verify: full workflow works in Japanese

Week 8: Packaging + Testing
  - PyInstaller spec with FFmpeg bundled
  - Test on clean Windows machine
  - Fix path issues, missing DLLs
  - Write integration tests
  - Create installer (NSIS or Inno Setup wrapper)
  - Verify: installs and runs on fresh Windows 10/11
```

### Claude Code Workflow Tips

1. **Start each module with a test** — write `test_assemblyai.py` before `assemblyai.py`
2. **Port prompts verbatim** — copy LLM prompt strings directly from TypeScript
3. **Use the Electron app as reference** — run it side-by-side while building Python version
4. **Don't over-engineer early** — get it working, then optimize
5. **QSS last** — make it functional first, pretty second
6. **One view at a time** — don't try to build all UI at once

---

## 11. Decision: Should You Migrate?

### Migrate to Python IF:

- You want lower memory usage (80MB vs 300MB)
- You want faster startup
- You want simpler packaging (no Chromium)
- You plan to add heavy audio processing (numpy/scipy)
- You want a single-language codebase
- You're more productive in Python than TypeScript
- Client specifically requests Python

### Stay with Electron IF:

- Current UI is acceptable
- You need rapid UI iteration (CSS is faster than QSS)
- You want to reuse existing 23K lines of working code
- Timeline is tight (8-10 weeks is significant)
- You might need web deployment later
- The 280MB installer size is acceptable

### Hybrid Option: Python Backend + Electron Frontend

Keep the React UI, replace Node.js backend with Python:
- Python runs as a local HTTP server (FastAPI)
- Electron renderer calls Python API instead of IPC
- Best of both worlds: modern UI + Python processing
- Migration effort: ~3-4 weeks (backend only)
- Risk: two processes to manage, slightly more complex packaging

---

## 12. Conclusion

The migration is feasible for a solo developer in 8-10 weeks. The backend logic (3,811 lines) ports cleanly to Python with ~60% logic reuse. The UI (8,751+ lines) requires complete rewrite but PySide6's Model/View architecture is well-suited to this data-heavy application.

**Biggest wins from migration:**
- 60% less memory usage
- SQLite replaces fragile JSON + localStorage
- No Chromium dependency
- Better large-file handling (Python generators)
- Simpler deployment

**Biggest costs:**
- 8-10 weeks of development
- UI will be less visually polished initially
- Loss of hot-reload development speed
- Smaller widget ecosystem

**Recommendation:** If the current Electron app meets client needs, ship it now and plan Python migration as a v2.0 effort. If Python is a hard requirement, start with the hybrid approach (Python backend + Electron frontend) to de-risk the migration incrementally.
