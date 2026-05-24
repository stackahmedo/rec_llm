# RecLLM Engineering Audit Report

**Date:** 2026-05-24
**Auditor:** Automated deep-analysis (Claude Opus 4.7)
**Scope:** Full codebase — electron/, src/app/, build config, packaging
**Mode:** Read-only audit. No code modifications.

---

## Executive Summary

RecLLM is an Electron desktop app for audio transcription, AI summarization, and PDF report generation targeting Japanese enterprise users. The codebase demonstrates solid architectural decisions (contextIsolation, provider abstraction, lazy loading, LRU transcript cache) but has significant gaps in production readiness: a path traversal vulnerability in the history module, sync I/O blocking the main thread, unbounded memory growth in several stores, zero test coverage, and giant monolithic components that will resist maintenance.

**Overall Architecture Score: 6.2 / 10**

The app is a strong MVP with good security foundations (safeStorage, CSP, contextIsolation) but needs hardening before enterprise deployment.

---

## Section 1 — Architecture Review

### Folder Structure

```
electron/              # Main process (CommonJS, compiled to electron-dist/)
  providers/           # LLM adapter pattern
src/app/               # Renderer (ESM, Vite bundle)
  components/          # Feature components + ui/ primitives
  hooks/               # Custom hooks (only 1 file)
  styles/              # Tailwind tokens
```

### Strengths

| Area | Detail |
|------|--------|
| IPC boundary | Clean `contextBridge` with typed preload. No `nodeIntegration`. |
| Provider abstraction | `LLMProvider` interface with per-provider adapters. Adding a provider is 1 file + 1 registry entry. |
| Credential security | `safeStorage` with OS keychain, migration from legacy format, placeholder key detection. |
| CSP | Production CSP restricts `connect-src` to known API domains. Dev CSP is appropriately relaxed. |
| Lazy loading | Heavy views (`PdfEditor`, `TranscriptWorkspace`, `FileLibrary`) are `React.lazy` with Suspense. |
| Transcript LRU | `MAX_CACHED_TRANSCRIPTS = 3` with eviction — prevents OOM from loading many transcripts. |
| Long-audio recovery | Pipeline state persisted to disk; interrupted pipelines are resumable. |
| Path sanitization | `long-audio-pipeline.ts` sanitizes `pipelineId` before file path construction. |

### Weaknesses

| Area | Severity | Detail |
|------|----------|--------|
| Monolithic components | Medium | `pdf-editor.tsx` (1679 lines), `settings-panel.tsx` (1006 lines), `transcript-workspace.tsx` (577 lines). |
| No state management library | Low | Context + useState works for current scale but will fragment as features grow. |
| Duplicated FFmpeg resolution | Low | `getFfmpegPath()` / `getFfprobePath()` duplicated across `audio-preprocess.ts` and `long-audio-pipeline.ts`. |
| Tight coupling in settings | Medium | `SettingsPanel` owns all API key state and passes it down — any keystroke rerenders the entire tree. |
| No routing library | Low | View switching via string state. Acceptable for SPA but prevents deep linking and browser back/forward. |
| `any` proliferation in preload | Medium | ~15 `any` types in `preload.ts` bypass type safety at the IPC boundary. |

### Architecture Score: 6.5 / 10

---

## Section 2 — Performance + Memory

### Transcript Rendering

| Component | Virtualized? | Risk |
|-----------|-------------|------|
| `transcript-editor.tsx` | YES (`@tanstack/react-virtual`, overscan=20) | Low |
| `pdf-editor.tsx` (PdfPreview) | NO — renders all utterances in DOM | High for long transcripts |
| `document-editor.tsx` | Manual virtual scroll (absolute positioning) | Medium — fragile implementation |
| `session-list.tsx` | NO | Medium with many sessions |
| `processing-queue.tsx` | NO | Low (jobs are transient) |

### Memory Concerns

| Location | Issue | Impact |
|----------|-------|--------|
| `activePipelines` Map (`long-audio-pipeline.ts:92`) | Unbounded — never evicted unless explicitly cleaned | OOM risk if pipelines accumulate |
| `mergeTranscripts()` (`long-audio-pipeline.ts:351`) | Loads ALL utterances from ALL chunks into memory simultaneously | OOM for 20h+ files (potentially millions of utterances) |
| `summaries` array (`transcript-store.tsx:80`) | No eviction — every summary stays in memory | Slow growth OOM |
| `history` array (`transcript-store.tsx:81`) | Loads all history metadata into state | Grows with usage |
| `pdf-export.ts` HTML builder | Builds entire transcript as HTML string + PDF buffer | Large memory spike for long transcripts |
| `execFile` maxBuffer (`long-audio-pipeline.ts:201`) | 50 MB buffer for silence detection output | Single-allocation spike |
| `PdfPreview` component | Not memoized — full rerender on any parent state change | UI freeze on large transcripts |

### 20-Hour Transcript Safety Analysis

A 20-hour recording at typical speech density produces ~100,000+ utterances. Current behavior:

1. **Chunking**: Splits into ~27 chunks of 45 minutes each. Each chunk processed independently. ✓
2. **Merge**: `mergeTranscripts()` loads all chunk utterances into a single array. At ~4000 utterances/chunk × 27 chunks = ~108,000 objects in memory simultaneously. Each utterance is ~200 bytes → ~21 MB. Manageable but tight.
3. **PDF export**: Building HTML for 108,000 table rows creates a multi-MB string. `printToPDF` must render this in a hidden BrowserWindow. Risk of Chromium OOM or timeout.
4. **Renderer display**: If `PdfPreview` renders all 108,000 utterances without virtualization, the DOM will have 300,000+ nodes. **This will freeze the UI.**

### React Rerender Hotspots

| Component | Trigger | Impact |
|-----------|---------|--------|
| `SettingsPanel` | Any keystroke in any input | Full tree rerender (1006 lines) |
| `PdfEditor` | Any state change (25 useState hooks) | Full tree + unmemoized PdfPreview |
| `DashboardStatus` | Job status change | 544-line component rerenders |
| `StatusBar` | `jobs.length` change | Triggers ffmpegCheck + storage stats API calls |

### Performance Score: 5.5 / 10

---

## Section 3 — Security Audit

### High-Risk Vulnerabilities

| ID | Severity | Location | Issue |
|----|----------|----------|-------|
| SEC-1 | **CRITICAL** | `history.ts:67,70,192,203,213` | **Path traversal** — `id` and `fileId` from renderer used unsanitized in `path.join()`. A compromised renderer or XSS could read/write arbitrary files. |
| SEC-2 | Medium | `credential-store.ts:50` | Fallback to base64 encoding when `safeStorage` unavailable — not encryption. |
| SEC-3 | Medium | `credential-store.ts:38` | Credentials file written with default `0o644` permissions — readable by other users on shared systems. |
| SEC-4 | Low | `credential-store.ts:105` | Hardcoded encryption key `'recllm-local-encryption-key'` in source for legacy migration. |
| SEC-5 | Low | `gemini.ts:12` | API key in URL query parameter (Gemini's required auth method) — appears in network/proxy logs. |
| SEC-6 | Low | `openai-compatible.ts:12,26` | Custom base URL receives Bearer token — user-configured but could leak key to malicious endpoint. |

### Electron Security Posture

| Control | Status |
|---------|--------|
| `contextIsolation: true` | ✓ Enabled |
| `nodeIntegration: false` | ✓ Disabled |
| `sandbox` | ✗ Not explicitly enabled (defaults vary by Electron version) |
| CSP (production) | ✓ Restrictive — `script-src 'self'`, limited `connect-src` |
| CSP (dev) | ⚠ `'unsafe-inline' 'unsafe-eval'` — acceptable for dev |
| New window blocking | ✓ `setWindowOpenHandler` denies all |
| `webSecurity` | ✓ Not disabled (default true) |
| Remote module | ✓ Not imported |

### IPC Surface Analysis

The preload exposes 40+ IPC channels. Most accept string/object parameters without schema validation in the main process. The main process trusts renderer input for:
- File paths (`assemblyai:transcribeFile`, `audio:metadata`, `audio:compress`, `audio:split`)
- Object data (`history:save`, `document:save`, `settings:set`)
- IDs used in file paths (`history:loadTranscript`, `history:delete`, `document:load`, `document:save`)

### Logging Safety

- `settings.ts:21,36`: Logs API key lengths (not values) — acceptable.
- `assemblyai.ts:71`: Logs file size and extension — acceptable.
- `gemini.ts:15`: Redacts API key in dev console log — good.
- No PII logging detected.

### Security Score: 5.0 / 10

The path traversal in `history.ts` is the single most critical finding.

---

## Section 4 — AI Provider System

### Provider Architecture

```
electron/providers/
  types.ts          # LLMProvider interface, ProviderError class
  gemini.ts         # Google Gemini adapter
  openai-compatible.ts  # OpenAI / Groq / custom endpoint adapter
  index.ts          # Registry + factory
```

### Strengths

- Clean adapter pattern with `LLMProvider` interface
- Proper error classification (auth, rate_limit, timeout, network, model_not_found, blocked)
- HTML response detection (catches misconfigured proxies)
- AbortController timeouts (60s request, 10s test)
- `ProviderError` carries diagnostic metadata for user-facing messages

### Weaknesses

| Issue | Severity | Detail |
|-------|----------|--------|
| No retry logic in providers | Medium | Single attempt per request. If a transient 500 occurs, the entire summarization fails. |
| No streaming support | Low | Full response buffered. For very long summaries, user sees no progress. |
| Sequential chunk summarization | Medium | `summarize.ts:238-247` processes chunks one-by-one. A 20-chunk transcript makes 21 sequential API calls (20 chunks + 1 merge). |
| No token counting | Medium | Prompts can exceed model context window. No pre-flight check or truncation. |
| `response_format: { type: 'json_object' }` | Low | Hardcoded in OpenAI adapter. Not all compatible providers support this (Groq does, others may not). |
| No provider fallback | Medium | If the configured provider fails, no automatic fallback to the secondary provider despite the pipeline UI showing fallback configuration. |
| Prompt injection surface | Low | Transcript content embedded directly in prompts. A malicious transcript could attempt to override instructions. |

### AssemblyAI Integration

- Upload: streaming via `fs.createReadStream` — good for large files
- Retry: 1 retry on timeout/ECONNRESET with 2s delay
- Polling: 3s interval, 30-minute deadline
- Progress: Real-time IPC events to renderer

### Provider Score: 7.0 / 10

---

## Section 5 — UX Engineering Audit

### Desktop UX Quality

| Aspect | Assessment |
|--------|-----------|
| Navigation | Sidebar with icon + label, collapsible. Keyboard shortcuts (Cmd+1-4, Cmd+K). Good. |
| View transitions | Lazy-loaded with spinner fallback. No animation between views. |
| Settings | Tabbed layout with sticky save bar and dirty indicator. Professional. |
| Upload workflow | Drag-drop + file picker, confirmation dialog, queue visualization. Solid. |
| PDF editor | Feature-rich but overwhelming — 1679 lines of UI in one view. |

### Japanese Localization

- Inline dictionaries in `i18n.tsx` (~130 keys each for EN/JA)
- `Lang` type supports `"en" | "ja" | "both"` — "both" shows bilingual labels
- Font stack prioritizes Japanese fonts: `"Noto Sans JP", "Yu Gothic", "Meiryo", "Hiragino Sans"`
- PDF export uses CJK-first font stack with temp file approach for proper font embedding

**Gap**: Not all UI strings are in the i18n dictionary. Component-level hardcoded English strings exist (e.g., pipeline preset labels "cheapest", "balanced", "fastest", "quality" in `settings-panel.tsx:679`).

### Accessibility Issues

| Component | Issue |
|-----------|-------|
| `transcript-workspace.tsx` | Tab buttons lack `role="tab"`, `aria-selected`, `aria-controls` |
| `pdf-editor.tsx` | Toolbar buttons lack `aria-pressed`; inline editing inputs lack `aria-label` |
| `sidebar-nav.tsx` | No `aria-current="page"` on active item |
| `analytics-panel.tsx` | SVG charts completely inaccessible — no `role="img"`, no `aria-label`, no `<title>` |
| `transcript-editor.tsx` | Double-click to edit not keyboard-accessible |
| `notification-panel.tsx` | Notification items clickable but lack `role="button"` |

### UX Score: 6.5 / 10

---

## Section 6 — TypeScript + Code Quality

### `any` Usage Audit

| File | Count | Severity |
|------|-------|----------|
| `preload.ts` | ~15 | High — IPC boundary loses all type safety |
| `pdf-editor.tsx` | 6 | Medium — runtime data handling |
| `long-audio-pipeline.ts` | 7 | Medium — utterance data untyped |
| `settings.ts` | 2 | Low |
| `assemblyai.ts` | 4 | Low — error catches |
| `summarize.ts` | 3 | Low |
| `credential-store.ts` | 1 | Low |
| `status-bar.tsx` | 2 | Low |

### Unsafe Casts

Every `JSON.parse()` result across the codebase is cast without runtime validation:
- `notification-store.ts:35`
- `transcript-intelligence.ts:157,203,229`
- `pdf-speaker-store.ts:43`
- `pdf-template-store.ts:210`
- `report-composer.ts:187`
- `crash-log-store.ts:35`
- `api-status-service.ts:27`

No schema validation library (zod, io-ts, etc.) is used anywhere.

### Giant Components

| File | Lines | Recommendation |
|------|-------|----------------|
| `pdf-editor.tsx` | 1679 | Split into PdfToolbar, PdfSidebar, PdfPreview, PdfExportDialog |
| `settings-panel.tsx` | 1006 | Extract each tab into its own file; lift state to context |
| `transcript-workspace.tsx` | 577 | Extract AI chat, slash commands, tab content |
| `dashboard-status.tsx` | 544 | Extract StatusGrid, RecommendationList, QuickActions |
| `document-editor.tsx` | 392 | Extract VirtualizedTranscript, EditorToolbar |

### Stale Closure Bugs

| File | Line | Issue |
|------|------|-------|
| `document-editor.tsx` | 64 | `triggerAutoSave` has `[]` deps but references `doc` state — saves stale data |
| `transcript-editor.tsx` | 76 | `copySegment` has `[]` deps but uses `t` from `useT()` — stale if language changes |

### Code Quality Score: 5.5 / 10

---

## Section 7 — Build + Packaging

### Electron Builder Configuration

```json
{
  "appId": "com.recllm.desktop",
  "productName": "RecLLM",
  "mac": { "target": "dir" },
  "win": { "target": "nsis" },
  "linux": { "target": "AppImage" }
}
```

| Aspect | Status |
|--------|--------|
| App icons | Referenced (`build/icon.icns`, `build/icon.ico`, `build/icon.png`) — existence not verified |
| Code signing (macOS) | ✗ Not configured |
| Notarization | ✗ Not configured |
| Auto-updater | ✗ Not implemented |
| ASAR packaging | ✓ Default (with `asarUnpack` for ffmpeg binaries) |
| Extra resources | ✓ FFmpeg, FFprobe, logo bundled |
| Windows installer | ✓ NSIS with directory selection |

### Dependency Risks

| Package | Risk |
|---------|------|
| `electron: ^35.0.0` | Caret range — minor updates could break. Pin to exact. |
| `electron-builder: ^26.0.0` | Same — pin for reproducible builds. |
| `ffmpeg-static: ^5.3.0` | Large binary (~70 MB). Bundled correctly via `extraResources`. |
| `electron-store: ^10.1.0` | Used for settings. Legacy — consider replacing with direct JSON file since `safeStorage` handles secrets. |

### Binary Size Estimate

- Electron base: ~180 MB
- FFmpeg + FFprobe: ~140 MB
- App code + node_modules: ~50 MB
- **Total estimated: ~370 MB**

This is large for a desktop app. FFmpeg dominates.

### Build Score: 5.0 / 10

No signing, no notarization, no auto-updater = not shippable to enterprise customers on macOS.

---

## Section 8 — Testing + Reliability

### Test Coverage

**Zero.** No test framework configured. No test files exist. No `jest`, `vitest`, `playwright`, or `@testing-library` in dependencies.

### Error Boundaries

- `PageErrorBoundary` wraps each lazy-loaded view in `App.tsx` — good.
- Class component with recovery button and dev-mode stack trace.
- No error boundary around the sidebar or header (a crash there takes down the app).

### Crash Logging

- `crash-log-store.ts` captures `window.onerror` and `unhandledrejection` events.
- Stores last 100 entries in localStorage.
- **Gap**: No remote crash reporting. Crashes are only visible if the user checks dev tools.

### Recovery Systems

| System | Implementation | Gap |
|--------|---------------|-----|
| Long-audio pipeline | State persisted to JSON files in `userData`. Resumable after crash. | No automatic resume on app restart — user must manually trigger. |
| Processing queue | `processingRef` mutex prevents double-processing. | If `processNext` throws unhandled, mutex stays locked forever — queue permanently stalls. |
| Settings | Saved to `electron-store` on explicit "Save" click. | No auto-save — user can lose changes on crash. |
| Transcript data | Persisted to disk immediately after transcription completes. | Good — no data loss risk. |

### Reliability Score: 3.0 / 10

Zero tests is the dominant factor.

---

## Section 9 — Consolidated Findings

### Biggest Strengths

1. **Security foundations** — contextIsolation, safeStorage, CSP, placeholder key detection
2. **Provider abstraction** — clean adapter pattern, easy to add new LLM providers
3. **Long-audio pipeline** — chunked processing with recovery, silence-aware splitting
4. **Lazy loading + LRU cache** — transcript memory bounded, views code-split
5. **Bilingual support** — proper CJK font handling in PDF, inline i18n dictionaries

### Critical Problems (P0)

| # | Issue | Impact | Fix Effort |
|---|-------|--------|-----------|
| 1 | Path traversal in `history.ts` | Arbitrary file read/write from renderer | Low — add `sanitizeId()` like `long-audio-pipeline.ts` |
| 2 | Zero test coverage | No regression safety, no refactoring confidence | High — requires framework setup + test writing |
| 3 | Processing queue permanent stall | Unhandled throw in `processNext` locks queue forever | Low — add try/finally around `processingRef` |
| 4 | Sync I/O on main thread (`history.ts`) | UI freezes during file operations with large history | Medium — migrate to `fs/promises` |
| 5 | `PdfPreview` renders all utterances without virtualization | UI freeze on transcripts >1000 utterances | Medium — add virtualization or pagination |

### Scalability Risks

| Risk | Trigger | Mitigation |
|------|---------|-----------|
| Main thread blocking | >100 history entries with sync `readFileSync`/`writeFileSync` | Migrate `history.ts` to async I/O |
| Renderer OOM | Opening PDF editor with 10,000+ utterance transcript | Virtualize PdfPreview or paginate |
| Main process OOM | Multiple active long-audio pipelines | Add pipeline limit or eviction |
| IPC serialization cost | Sending 100k utterances over IPC in one message | Stream or paginate large results |
| localStorage limits | `transcript-intelligence.ts` embeddings stored in localStorage | Move to IndexedDB or electron-store |

### Performance Bottlenecks

1. **`SettingsPanel` full-tree rerender** on every keystroke (25 useState hooks in parent)
2. **`PdfEditor` unmemoized preview** — 1679-line component rerenders on any state change
3. **Sequential LLM calls** in `summarize.ts` — 20-chunk transcript = 21 serial API calls
4. **`StatusBar` triggers API calls** on every `jobs.length` change
5. **`DashboardStatus` recomputes** notifications/recommendations arrays on every render without memoization

### Security Issues (Ranked)

1. **CRITICAL**: Path traversal in `history.ts` (SEC-1)
2. **Medium**: Base64 fallback for credentials (SEC-2)
3. **Medium**: No file permission restriction on credentials file (SEC-3)
4. **Low**: Hardcoded legacy encryption key in source (SEC-4)
5. **Low**: Gemini API key in URL query parameter (SEC-5)
6. **Low**: Custom base URL receives Bearer token (SEC-6)

### UX Problems

1. PDF editor is overwhelming — too many controls visible simultaneously
2. Incomplete i18n — pipeline presets, some labels hardcoded in English
3. SVG charts completely inaccessible to screen readers
4. No keyboard navigation in transcript workspace tabs
5. Double-click-to-edit pattern not discoverable and not keyboard-accessible

### Technical Debt

| Category | Items |
|----------|-------|
| Type safety | 15+ `any` in preload, unsafe JSON.parse casts everywhere, no schema validation |
| Code organization | 5 giant components (>400 lines each), duplicated FFmpeg path resolution |
| Missing abstractions | No shared IPC result type, no centralized error handling for IPC calls |
| Dead/placeholder code | `security.md` references "VoiceLens" (old product name), roles system not implemented |
| Stale closures | 2 confirmed bugs in `document-editor.tsx` and `transcript-editor.tsx` |

---

## Section 10 — Recommendations

### Immediate P0 Fixes (Do This Week)

1. **Sanitize IDs in `history.ts`** — add the same `sanitizePipelineId` pattern used in `long-audio-pipeline.ts`
2. **Add try/finally to `processNext`** in `use-processing-engine.ts` to always reset `processingRef.current`
3. **Fix stale closure in `document-editor.tsx:64`** — add `doc` to dependency array or use ref
4. **Set file permissions on credentials file** — `fs.writeFileSync(path, data, { mode: 0o600 })`

### Refactor Priorities (Next Sprint)

1. **Migrate `history.ts` to async I/O** — replace all `readFileSync`/`writeFileSync` with `fs/promises`
2. **Split `pdf-editor.tsx`** into 4-5 focused components with proper memoization
3. **Add virtualization to PdfPreview** — use `@tanstack/react-virtual` (already a dependency)
4. **Type the IPC boundary** — replace `any` in `preload.ts` with shared interfaces from `electron.d.ts`
5. **Add schema validation** — introduce `zod` for all `JSON.parse` results and IPC inputs

### Long-Term Architecture Direction

1. **Testing**: Add Vitest for unit tests, Playwright for E2E. Target 60% coverage on electron/ modules first.
2. **State management**: Consider Zustand or Jotai if context prop-drilling becomes unmanageable.
3. **Auto-updater**: Implement `electron-updater` with differential updates for the 370 MB binary.
4. **Code signing + notarization**: Required for macOS distribution without Gatekeeper warnings.
5. **Streaming summarization**: Replace sequential chunk processing with parallel calls (respecting rate limits) and streaming responses for user feedback.
6. **IPC pagination**: For large transcript results, implement cursor-based pagination over IPC instead of sending entire arrays.

### Recommended Folder Structure (Future)

```
electron/
  main.ts
  preload.ts
  ipc/                    # One file per IPC domain
    settings.ipc.ts
    history.ipc.ts
    export.ipc.ts
    ...
  services/               # Business logic (no IPC awareness)
    credential-store.ts
    audio-preprocess.ts
    long-audio-pipeline.ts
    summarize.ts
  providers/              # LLM adapters (unchanged)
  shared/                 # Shared types, validators, utils

src/app/
  components/
    layout/               # Sidebar, header, status bar
    dashboard/            # Dashboard cards, status grid
    upload/               # Upload workstation, toolbar, confirm dialog
    transcript/           # Editor, workspace, session list
    pdf/                  # Editor, preview, toolbar, templates
    settings/             # One file per tab
    ui/                   # shadcn primitives (unchanged)
  stores/                 # Context providers
  services/               # Pure utility modules
  hooks/                  # Custom hooks
  i18n/                   # Dictionaries + provider
```

---

## Production Readiness Assessment

| Criterion | Ready? | Blocker |
|-----------|--------|---------|
| Security | ✗ | Path traversal vulnerability |
| Stability | ✗ | Queue stall bug, stale closures |
| Performance | ⚠ | PDF preview freezes on long transcripts |
| Testing | ✗ | Zero coverage |
| Packaging | ✗ | No code signing or notarization |
| Auto-update | ✗ | Not implemented |
| Crash reporting | ✗ | Local-only, no remote telemetry |
| Accessibility | ⚠ | Multiple WCAG violations |
| i18n completeness | ⚠ | Partial — some hardcoded English |
| Documentation | ⚠ | Architecture doc exists but references old product name |

**Verdict: Not production-ready.** Estimated effort to reach production: 3-4 weeks of focused engineering on P0 fixes, testing infrastructure, and packaging.

---

## Recommended Next Phases

### Phase 1: Security + Stability (1 week)
- Fix path traversal
- Fix queue stall bug
- Fix stale closures
- Set credential file permissions
- Migrate history.ts to async I/O

### Phase 2: Testing + Quality (2 weeks)
- Set up Vitest + testing-library
- Unit tests for all electron/ modules
- Integration tests for IPC handlers
- E2E test for upload → transcribe → export flow
- Add zod validation at IPC boundary

### Phase 3: Performance + UX (1 week)
- Virtualize PdfPreview
- Split giant components
- Memoize expensive renders
- Complete i18n coverage
- Fix accessibility violations

### Phase 4: Distribution (1 week)
- Code signing (macOS + Windows)
- Notarization
- Auto-updater implementation
- CI/CD pipeline for builds
- Crash reporting (Sentry or similar)

---

*End of audit report.*
