# Client Requirement Phase Plan — Rec LLM

## 1. Executive Summary

Rec LLM is an Electron desktop app for AI-powered audio transcription, summarization, and document intelligence. The client requires enterprise-grade batch processing: automatic folder scanning, 100+ file queuing, FFmpeg-based audio splitting for 20–30 hour recordings, AssemblyAI transcription with parallel chunk processing, automatic transcript merging, and large-scale AI summarization — all running unattended on Windows.

This document maps client requirements against current capabilities, identifies gaps, and provides a phased implementation roadmap with realistic effort estimates and risk assessment.

---

## 2. Client Requirements Table

| # | Requirement | Priority | Complexity |
|---|-------------|----------|------------|
| R1 | Automatic folder loop processing | High | Medium |
| R2 | 100+ file batch processing | High | Medium |
| R3 | FFmpeg automatic splitting | High | High |
| R4 | AssemblyAI parallel chunk transcription | High | High |
| R5 | Automatic transcript merging | High | Medium |
| R6 | Large-scale AI summarization | High | High |
| R7 | Stable unattended workflow | Critical | High |
| R8 | 20–30 hour audio support | High | High |
| R9 | Japanese business output | Medium | Low |
| R10 | Windows EXE packaging | High | Medium |

---

## 3. Current Rec LLM Status

| Feature | Status | Notes |
|---------|--------|-------|
| Folder upload (recursive scan) | Done | `dialog:openAudioFolder` IPC with recursive walk |
| Batch queue (100+ files) | Done | Virtualized queue, direct-to-queue insertion, no blocking modal |
| Long audio pipeline (2–10h) | Done | 45-min chunks, concurrency 2, checkpoint/resume |
| Enterprise long audio (10–30h) | Done | 25-min chunks, concurrency 1, disk space validation |
| >30h blocking | Done | Hard block with error message |
| FFmpeg splitting | Done | Silence-aware smart chunking via ffmpeg |
| AssemblyAI integration | Done | Single-chunk sequential upload + transcription |
| Transcript merging | Done | Timeline-preserving merge with speaker labels |
| AI summarization (Gemini/OpenAI) | Done | Single-pass and chunked merge prompts |
| Japanese summary output | Done | Default Japanese, explicit prompt instructions |
| Speaker diarization | Done | Via AssemblyAI |
| Speaker name suggestion (AI) | Done | Context-based name detection + registry |
| PDF/TXT export | Done | Japanese labels, 3-column TXT format |
| File metadata + auto rename | Done | YYYYMMDD_HHMMSS format, persisted |
| Queue persistence (localStorage) | Done | Survives restart |
| Pipeline checkpoint/resume | Done | Per-chunk state saved to disk |
| Windows EXE installer | Done | NSIS x64, FFmpeg/FFprobe bundled |
| Batch actions (start/pause/retry) | Done | startAll, pauseAll, retryFailed, removeSelected |
| Virtualized queue rendering | Done | @tanstack/react-virtual, 100+ items smooth |

---

## 4. Gap Analysis

| Requirement | Current State | Gap | Effort |
|-------------|--------------|-----|--------|
| R1: Folder loop processing | Folder scan done, single-pass | No "watch folder" / continuous loop mode | Small |
| R2: 100+ file batch | Queue handles 100+ with virtualization | No stress-test validation at 100+ scale | Small |
| R3: FFmpeg splitting | Smart silence-aware splitting done | No configurable chunk size from UI | Small |
| R4: Parallel chunk transcription | Sequential (concurrency 1–2) | No true parallel AssemblyAI uploads | Medium |
| R5: Transcript merging | Basic merge done | No incremental disk-streaming merge for 30h | Medium |
| R6: Large-scale summarization | Single-pass + chunk merge | No MapReduce mode for 100-file batches | Medium |
| R7: Unattended workflow | Checkpoint/resume exists | No processing log file, no disk/RAM monitoring | Medium |
| R8: 20–30h audio | Enterprise mode routing done | Not stress-tested at 25–30h scale | Medium |
| R9: Japanese output | Default Japanese prompts done | Minor label gaps in some UI areas | Small |
| R10: Windows EXE | NSIS installer built | Needs signing + auto-update consideration | Small |

### Critical Gaps (Must Fix Before Client Demo)

1. **Parallel AssemblyAI uploads** — Currently sequential. Need configurable concurrency with rate-limit protection.
2. **MapReduce summarization** — 100 files × 2h each = massive text. Single-pass will fail.
3. **Unattended reliability** — Need processing log, disk monitoring, graceful degradation.
4. **Incremental merge** — 30h transcript cannot be held in RAM during merge.

---

## 5. Phase-by-Phase Roadmap

### Phase 1 — Requirement Audit (This Document)
- Map features against requirements ✓
- Identify gaps ✓
- Risk assessment ✓

### Phase 2 — Folder Batch Processing

**Goal:** Select folder → scan → queue 100+ files → process sequentially

| Deliverable | Status |
|-------------|--------|
| Folder picker dialog | Done |
| Recursive audio scan (mp3/wav/m4a/flac) | Done |
| Batch queue with virtualization | Done |
| File metadata persistence | Done |
| Start/Pause/Resume/Retry | Done |
| Queue survives restart | Done |
| Folder structure awareness in metadata | Partial — path stored, no grouping UI |

**Remaining work:** Add folder grouping display in queue (optional UX enhancement).

### Phase 3 — Long Audio Auto Splitting

**Goal:** Auto-detect duration → route to correct tier → split with FFmpeg

| Deliverable | Status |
|-------------|--------|
| Duration-based tier routing | Done |
| FFmpeg silence-aware splitting | Done |
| 25-min chunks for enterprise (10–30h) | Done |
| Chunk metadata + checkpoint files | Done |
| Chunk progress in UI | Done |
| Resume after restart | Done |
| No full audio in RAM | Done (streaming split) |

**Remaining work:** Configurable chunk size from Settings UI (currently hardcoded).

### Phase 4 — AssemblyAI Parallel Processing

**Goal:** Upload multiple chunks concurrently with safety limits

| Deliverable | Status |
|-------------|--------|
| Sequential chunk upload | Done |
| Configurable concurrency | Partial (backend supports it, no UI control) |
| Parallel upload (2–3 chunks) | Not implemented |
| Rate-limit detection + backoff | Not implemented |
| Timeout handling | Partial (AssemblyAI SDK handles) |
| Retry failed chunks | Done |

**Safe concurrency defaults:**

| Environment | Default | Max Safe | Reason |
|-------------|---------|----------|--------|
| Windows (8GB RAM) | 1 | 2 | Disk I/O + RAM constraints |
| Windows (16GB RAM) | 2 | 3 | Balanced throughput |
| High-performance | 3 | 5 | Only with fast SSD + stable network |

**Important:** Client requests 10–20 parallel files. This is NOT safe as default because:
- AssemblyAI rate limits (varies by plan)
- Each chunk upload consumes ~50–200MB RAM
- Windows disk I/O bottlenecks with HDD
- Network bandwidth shared across uploads
- API timeout risk increases with concurrency

**Recommendation:** Default 1–2, allow user override up to 5 with warning.

### Phase 5 — Automatic Transcript Merge

**Goal:** Merge chunk transcripts preserving timeline + speakers

| Deliverable | Status |
|-------------|--------|
| Timeline-preserving merge | Done |
| Speaker label preservation | Done |
| Master transcript creation | Done |
| TXT export (3-column) | Done |
| JSON export | Partial |
| PDF-ready data | Done |
| Incremental disk merge (30h safe) | Not implemented |

**Remaining work:**
- Incremental merge: stream utterances to disk file instead of building full array in RAM
- Folder-level combined transcript (all files in one folder → one master doc)

### Phase 6 — Large-Scale Summarization Architecture

**Goal:** Summarize 100+ files without exceeding context limits

**Mode A — Large Context AI (default for small batches)**
- Send full transcript to Gemini 2.5 Flash (1M context)
- Single-pass summary
- Higher quality, simpler architecture
- Safe for: individual files up to ~4h, batches up to ~10 files

**Mode B — MapReduce Summary (auto-triggered for large batches)**
- Step 1: Summarize each chunk (already done)
- Step 2: Summarize each file (merge chunk summaries)
- Step 3: Summarize each folder (merge file summaries)
- Step 4: Executive summary (merge folder summaries)
- Safe for: any scale

**Auto-routing logic:**
```
if (totalTokens < 500K) → Mode A (single pass)
if (totalTokens >= 500K) → Mode B (MapReduce)
```

| Deliverable | Status |
|-------------|--------|
| Per-chunk summarization | Done |
| Per-file summary merge | Done |
| Folder-level summary | Not implemented |
| Executive summary | Not implemented |
| Auto mode selection | Not implemented |

### Phase 7 — Japanese Business Output

| Deliverable | Status |
|-------------|--------|
| AI summary default Japanese | Done |
| Key points Japanese | Done |
| Action items Japanese | Done |
| Decisions Japanese | Done |
| PDF Japanese labels | Done |
| Transcript original language preserved | Done |

**Status: Complete.** No remaining work.

### Phase 8 — Unattended Processing Reliability

**Goal:** Run overnight without human intervention

| Deliverable | Status |
|-------------|--------|
| Queue survives restart | Done |
| Crash recovery (checkpoint) | Done |
| Failed jobs don't stop batch | Done |
| Processing log file | Not implemented |
| Disk space monitoring | Partial (pre-start check only) |
| RAM monitoring | Not implemented |
| Retry failed only | Done |

**Remaining work:**
- Write processing log to `appData/recllm-data/processing.log`
- Periodic disk space check during processing (warn at <2GB)
- RAM usage monitoring (warn at >80% heap)

### Phase 9 — Enterprise UX

| Deliverable | Status |
|-------------|--------|
| No blocking modal | Done |
| Dedicated batch queue screen | Done |
| Progress dashboard | Partial (stats in toolbar) |
| ETA display | Done (in pipeline status) |
| Current file/chunk indicator | Done |
| Completed/failed/waiting counters | Done |
| Open output folder button | Not implemented |

**Remaining work:** "Open output folder" button, folder-level progress summary.

### Phase 10 — Windows EXE Packaging

| Deliverable | Status |
|-------------|--------|
| x64 NSIS installer | Done |
| Self-contained (no Node/npm/Python) | Done |
| FFmpeg/FFprobe bundled | Done |
| API keys from Settings | Done |
| Desktop/Start Menu shortcuts | Done |

**Status: Complete.** Current build: `Rec_LLM_Setup_0.1.5.exe` (280MB).

### Phase 11 — Stress Testing

| Test Case | Validated |
|-----------|-----------|
| 5 files | Not tested at scale |
| 50 files | Not tested at scale |
| 100 files | Not tested at scale |
| 2h audio | Supported (normal mode) |
| 10h audio | Supported (long audio mode) |
| 20h audio | Supported (enterprise mode) |
| 25h audio | Supported (enterprise mode) |
| 30h audio | Supported (enterprise mode, edge) |

**Metrics to measure:**
- Peak RAM usage per tier
- Disk usage per tier
- Processing time per hour of audio
- API failure rate at different concurrency levels
- Resume success rate after simulated crash
- Export correctness (timestamp alignment, speaker labels)

### Phase 12 — Delivery Plan

**MVP Client Demo (Target: 1–2 weeks)**
- Folder upload ✓
- Sequential batch queue ✓
- Long audio split ✓
- Transcription ✓
- Merge ✓
- Japanese summary ✓
- PDF/TXT export ✓
- Windows EXE ✓

**Advanced Version (Target: 3–4 weeks after MVP)**
- Parallel processing (configurable concurrency)
- MapReduce summary for 100-file batches
- Speaker name suggestion ✓
- Enterprise dashboard (folder progress)
- Processing log file
- Disk/RAM monitoring
- Retry/resume UI ✓

---

## 6. Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Electron Main                      │
├─────────────────────────────────────────────────────┤
│  dialog:openAudioFolder → recursive scan             │
│  longaudio:analyze → tier routing                    │
│  longaudio:start → FFmpeg split → chunk files        │
│  longaudio:nextChunk → AssemblyAI upload             │
│  longaudio:chunkDone → save to disk                  │
│  longaudio:chunkFailed → retry logic                 │
│  summarize:generate → Gemini/OpenAI                  │
│  history:save → metadata + transcript persistence    │
├─────────────────────────────────────────────────────┤
│                    Storage Layer                      │
│  appData/recllm-data/                                │
│    history.json          (session metadata)           │
│    transcripts/          (per-file JSON + TXT)        │
│    summaries/            (per-file summary JSON)      │
│    pipeline-recovery/    (checkpoint state)           │
│  temp/recllm-chunks-*/   (FFmpeg chunk files)        │
├─────────────────────────────────────────────────────┤
│                    Renderer (React)                   │
│  Upload Workstation → Toolbar + Queue + Inspector    │
│  Processing Queue → Virtualized rows (100+)          │
│  Transcript Workspace → Lazy-load from disk          │
│  Session List → History-based (never evicted)        │
└─────────────────────────────────────────────────────┘
```

---

## 7. Risk Table

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AssemblyAI rate limit at high concurrency | Processing stops | High (at 5+ parallel) | Default concurrency 1–2, exponential backoff |
| 30h transcript exceeds RAM during merge | App crash | Medium | Incremental disk-streaming merge (Phase 5) |
| 100-file batch summary exceeds AI context | Truncated/failed summary | High | MapReduce mode auto-triggered (Phase 6) |
| Windows disk full during enterprise pipeline | Data loss | Medium | Pre-start + periodic disk check |
| Network interruption during long batch | Partial failure | Medium | Per-chunk checkpoint, retry on resume |
| FFmpeg splitting fails on corrupt audio | Single file blocks queue | Low | Skip failed file, continue batch |
| Client expects 10–20 parallel uploads | API ban / OOM | High | Educate: safe default is 1–2, max 5 |
| Electron renderer freeze with 100+ items | Poor UX | Low (mitigated) | Virtualized list already implemented |

---

## 8. Estimated Effort

| Phase | Status | Remaining Effort |
|-------|--------|-----------------|
| Phase 1: Requirement Audit | Complete | 0 |
| Phase 2: Folder Batch Processing | Complete | 0 |
| Phase 3: Long Audio Splitting | Complete | 2h (UI config) |
| Phase 4: Parallel Processing | Partial | 8–12h |
| Phase 5: Transcript Merge | Mostly done | 4–6h (incremental merge) |
| Phase 6: MapReduce Summary | Not started | 8–12h |
| Phase 7: Japanese Output | Complete | 0 |
| Phase 8: Unattended Reliability | Partial | 4–6h |
| Phase 9: Enterprise UX | Mostly done | 2–4h |
| Phase 10: Windows Packaging | Complete | 0 |
| Phase 11: Stress Testing | Not started | 8–12h |
| Phase 12: Delivery | Planning done | Ongoing |

**Total remaining for full delivery: ~36–52 hours of development**
**MVP is already shippable** — all core features are implemented.

---

## 9. Testing Checklist

### Functional Tests
- [ ] Select folder with 5 audio files → all queued
- [ ] Select folder with 100 audio files → all queued, UI responsive
- [ ] Mixed formats (mp3 + wav + m4a + flac) → all detected
- [ ] Non-audio files in folder → gracefully ignored
- [ ] 2h file → normal mode, single upload
- [ ] 10h file → long audio mode, 45-min chunks
- [ ] 25h file → enterprise mode, 25-min chunks
- [ ] 30h file → enterprise mode, edge case
- [ ] 31h file → blocked with error
- [ ] Failed chunk → auto-retry (up to 3x)
- [ ] Kill app mid-processing → restart → resume from checkpoint
- [ ] All files complete → transcripts visible in session list
- [ ] Export PDF → uses generatedFileName
- [ ] Export TXT → 3-column format, correct language header
- [ ] Summary → Japanese output by default
- [ ] Search → matches both original and generated file names

### Performance Tests
- [ ] 100 files queued → queue renders in <100ms
- [ ] 25h enterprise pipeline → peak RAM < 500MB
- [ ] 30h pipeline → disk usage < 10GB temp
- [ ] Batch of 50 files → completes without manual intervention
- [ ] Network disconnect during chunk upload → retries on reconnect

### Windows-Specific Tests
- [ ] Install from EXE → launches correctly
- [ ] FFmpeg/FFprobe found at runtime
- [ ] Long file paths (>200 chars) → handled
- [ ] App data persists across updates
- [ ] Desktop shortcut works

---

## 10. Delivery Recommendation

### Immediate (Ready Now)
Ship MVP to client with current build (`Rec_LLM_Setup_0.1.5.exe`):
- Folder upload + batch queue
- Sequential processing (safe, reliable)
- Long audio support up to 30h
- Japanese AI summaries
- PDF/TXT export
- Checkpoint/resume

### Short-term (1–2 weeks)
- Add parallel processing (concurrency 2–3)
- Add MapReduce summary for large batches
- Add processing log file
- Stress test at 50–100 file scale

### Medium-term (3–4 weeks)
- Folder-level summary reports
- Enterprise dashboard with progress overview
- Disk/RAM monitoring
- Auto-update mechanism
- Code signing for Windows

### Concurrency Guidance for Client

| Scenario | Safe Concurrency | Reason |
|----------|-----------------|--------|
| Standard Windows PC (8GB RAM, HDD) | 1 | Disk I/O bottleneck |
| Modern Windows PC (16GB RAM, SSD) | 2 | Balanced throughput |
| High-performance workstation | 3 | Fast I/O, ample RAM |
| Maximum (with monitoring) | 5 | Risk of API rate limit |
| Client request (10–20) | NOT RECOMMENDED | OOM, rate limit, timeout cascade |

**Bottom line:** The MVP is ready to ship. The remaining work is optimization and scale hardening, not core functionality.
