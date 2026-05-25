# LONG_AUDIO_HARDENING.md — 19-Hour Audio Failure Audit

## Executive Summary

A 19-hour audio file (~100k+ utterances) will fail on a limited-RAM Windows PC. The failure is not a single point but a cascade across multiple layers. The **first layer to fail** depends on available RAM, but the most likely sequence is:

1. **Silence detection OOM** (FFmpeg scans entire file into memory)
2. **Polling timeout** (30-minute hard cap per chunk)
3. **IPC payload overflow** (merged transcript exceeds serialization limits)
4. **Renderer state explosion** (100k utterances held in React state)

---

## Architecture Trace for 19-Hour File

### Input assumptions
| Parameter | Value |
|-----------|-------|
| Duration | 19 hours = 68,400 seconds |
| Chunk size | 45 minutes = 2,700 seconds |
| Estimated chunks | ceil(68400 / 2700) = **26 chunks** |
| Utterances per chunk | ~4,000 (based on typical meeting density) |
| Total utterances | ~100,000–120,000 |
| Bytes per utterance (JSON) | ~200 bytes |
| Total transcript JSON | ~20–24 MB |
| Source file size (128kbps M4A) | ~1.1 GB |
| Source file size (WAV 44.1kHz) | ~4.5 GB |

---

## Bottleneck Map

### Layer 1: Audio Splitting (`long-audio-pipeline.ts`)

**Problem: Silence detection scans entire file**

```typescript
// line 252 — runs FFmpeg silencedetect on the FULL 19-hour file
async function detectSilencePoints(filePath: string, maxDuration: number): Promise<number[]> {
  const output = await execPromise(ffmpeg, [
    '-i', filePath,
    '-af', `silencedetect=noise=-30dB:d=0.5`,
    '-f', 'null', '-',
  ]);
```

- FFmpeg must decode the entire audio stream to detect silence
- For a 19-hour WAV: ~4.5 GB decoded PCM in FFmpeg's internal buffers
- `execPromise` has `maxBuffer: 50 * 1024 * 1024` (50 MB) for stdout/stderr — silence detection output for 19 hours could exceed this
- **Estimated time**: 15–45 minutes just for silence detection
- **RAM**: FFmpeg itself uses ~200–500 MB; Node buffer accumulates stderr

**Problem: All chunks created sequentially before any processing starts**

```typescript
// line 285 — splits ALL 26 chunks before returning
async function splitIntoChunks(filePath: string, analysis: AudioAnalysis): Promise<ChunkInfo[]> {
```

- 26 sequential FFmpeg invocations
- Each produces a ~45-minute M4A file (~40 MB at 128kbps)
- **Disk**: 26 × 40 MB = ~1 GB temp files in `os.tmpdir()`
- Windows `%TEMP%` is often on C: drive with limited space

### Layer 2: AssemblyAI Polling (`assemblyai.ts`)

**Problem: 30-minute hard timeout per chunk**

```typescript
// line 177
const MAX_POLL_DURATION_MS = 30 * 60 * 1000; // 30 minutes max
```

- A 45-minute audio chunk takes AssemblyAI ~15–25 minutes to transcribe
- On busy days or with speaker diarization, it can exceed 30 minutes
- **If even one chunk times out, the pipeline stalls** — no automatic retry at the pipeline level for timeout errors

**Problem: Upload timeout too short for large chunks**

```typescript
// line 8
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
```

- A 40 MB chunk on a slow connection (5 Mbps upload) takes ~64 seconds — fine
- But if the source file needs compression first and the compressed chunk is larger, or network is congested, 5 minutes may not suffice

### Layer 3: Pipeline State (`long-audio-pipeline.ts`)

**Problem: Entire pipeline state held in memory AND on disk**

```typescript
// line 93
const activePipelines = new Map<string, PipelineState>();
```

When all 26 chunks complete, `chunkDone` stores utterances on each chunk:

```typescript
// line 509
chunk.utterances = uv.data;  // ~4000 utterances per chunk, held in memory
```

Before merge, the pipeline holds **all 100k+ utterances across all chunks in memory simultaneously**:
- 26 chunks × 4000 utterances × ~200 bytes = **~20 MB in the Map**
- Plus the `savePipelineState()` writes the ENTIRE state (including all utterances) to disk as JSON on every chunk completion

**Problem: savePipelineState serializes everything**

```typescript
// line 111
async function savePipelineState(state: PipelineState) {
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
```

- With 100k utterances embedded, this JSON file is **20–30 MB**
- Written on EVERY chunk completion (26 times)
- `JSON.stringify` of 20 MB object blocks the event loop for 100–500ms
- Pretty-printed (`null, 2`) makes it even larger on disk

### Layer 4: Transcript Merge

**Problem: Merge creates a second copy of all utterances**

```typescript
// line 351
function mergeTranscripts(chunks: ChunkInfo[]): MergedTranscript {
  const allUtterances: MergedUtterance[] = [];
  // ... iterates all chunks, pushes to allUtterances
```

- At merge time: chunk utterances (20 MB) + merged array (20 MB) = **~40 MB peak**
- After merge, chunk utterances are released (line 520), but the merged transcript stays

### Layer 5: IPC Transfer

**Problem: Merged transcript sent as single IPC payload**

```typescript
// preload.ts line 127
getMerged: (pipelineId: string): Promise<{ ok: boolean; transcript?: MergedTranscript }>
  => ipcRenderer.invoke('longaudio:getMerged', pipelineId),
```

- Electron IPC serializes via structured clone
- A 20 MB object with 100k entries takes **500ms–2s to serialize**
- Chromium has a practical IPC message size limit (~256 MB), but V8 structured clone of deeply nested objects can OOM on low-RAM machines
- **No pagination or streaming** — it's all-or-nothing

### Layer 6: Renderer State (`transcript-store.tsx`)

**Problem: Full utterance array held in React state**

```typescript
// line 96
const [transcripts, setTranscripts] = useState<TranscriptResult[]>([]);
```

- Each `TranscriptResult` contains the full `utterances[]` array
- 100k utterances in React state = ~20 MB retained in the renderer process
- Every `setTranscripts` call creates a new array copy (immutable updates)
- **Peak renderer memory**: 40–60 MB just for transcript data

**Mitigation already present**: `MAX_CACHED_TRANSCRIPTS = 3` limits how many transcripts are held simultaneously. But even ONE 19-hour transcript is the problem.

### Layer 7: History Persistence (`history.ts`)

**Problem: Transcript saved as single JSON file**

```typescript
// line 104
async function writeTranscript(id: string, data: TranscriptData): Promise<void> {
  await fs.writeFile(transcriptPath(id), JSON.stringify(data), 'utf-8');
```

- 100k utterances → ~20 MB JSON file
- `JSON.stringify` blocks event loop
- Reading it back (`loadTranscript`) parses 20 MB in one shot
- On a slow HDD (common on budget Windows PCs): 500ms–2s write time

### Layer 8: Summarization (`summarize.ts`)

**Problem: Chunking by character count, not by utterance count**

```typescript
// line 54
const CHUNK_CHAR_LIMIT = 10000;
```

- 100k utterances × ~50 chars average = ~5 million characters
- 5,000,000 / 10,000 = **500 LLM API calls** for chunk summarization
- Plus 1 merge call
- At ~2 seconds per call = **~17 minutes** just for summarization
- API cost: 500 calls × ~1000 tokens each = 500k tokens input

### Layer 9: Windows-Specific Issues

| Issue | Impact |
|-------|--------|
| `os.tmpdir()` on C: drive | May have <2 GB free; 1 GB of chunks fills it |
| Windows path length (260 chars) | `recllm-chunks-{timestamp}/{long_filename}_part_026.m4a` can exceed limit |
| NTFS file locking | FFmpeg may fail if antivirus scans temp files |
| Windows Defender real-time scan | Slows every temp file write by 50–200ms |
| Electron renderer memory limit | Chromium caps renderer at ~4 GB; with 100k utterances + DOM, can hit limit |

---

## RAM Estimates (Windows PC with 8 GB RAM)

| Component | Steady State | Peak |
|-----------|-------------|------|
| Electron main process (base) | 150 MB | 200 MB |
| FFmpeg silence detection | 200 MB | 500 MB |
| Pipeline state (26 chunks, utterances) | 50 MB | 80 MB |
| Merge operation | 40 MB | 60 MB |
| IPC serialization | 20 MB | 40 MB |
| Renderer (React + transcript) | 200 MB | 400 MB |
| Renderer (DOM for 100k utterances) | 50 MB | 300 MB |
| **Total RecLLM** | **~700 MB** | **~1.6 GB** |
| Windows OS + other apps | ~4 GB | ~5 GB |
| **System total** | **~4.7 GB** | **~6.6 GB** |

On an 8 GB machine, peak usage approaches the limit. On a 4 GB machine, it will swap heavily or crash.

---

## Disk Estimates

| Item | Size |
|------|------|
| Source audio (19h WAV) | 4.5 GB |
| Source audio (19h M4A 128k) | 1.1 GB |
| Temp chunks (26 × 40 MB) | 1.04 GB |
| Pipeline recovery JSON (with utterances) | 20–30 MB |
| Final transcript JSON | 20 MB |
| Final transcript TXT | 8 MB |
| **Total temp disk** | **~1.1 GB** |
| **Total permanent disk** | **~50 MB** |

---

## API Request Count Estimates

| Phase | Requests | Duration |
|-------|----------|----------|
| Upload chunks (26) | 26 POST | ~5 min total |
| Create transcripts (26) | 26 POST | instant |
| Poll transcripts (26 × ~300 polls) | ~7,800 GET | ~20 min per chunk |
| Summarize chunks (500) | 500 POST | ~17 min |
| Merge summary (1) | 1 POST | ~3 sec |
| **Total API calls** | **~8,350** | |
| **Total wall-clock time** | | **~4–8 hours** |

---

## Maximum Safe Duration (Current Architecture)

| RAM | Safe Duration | Utterances | Reason |
|-----|--------------|------------|--------|
| 4 GB | ~3 hours | ~15,000 | Renderer OOM beyond this |
| 8 GB | ~6 hours | ~35,000 | IPC + merge peak exceeds headroom |
| 16 GB | ~12 hours | ~70,000 | Summarization timeout / API cost |
| 32 GB | ~15 hours | ~90,000 | Pipeline JSON serialization blocks event loop |

**Absolute ceiling regardless of RAM**: ~15 hours, due to:
- Summarization taking 500+ API calls
- Pipeline state JSON blocking event loop
- Polling timeout risk accumulating over 26+ chunks

---

## Which Layer Fails First (by scenario)

| Scenario | First Failure |
|----------|---------------|
| 4 GB RAM, HDD, 19h WAV | Silence detection OOM (Layer 1) |
| 8 GB RAM, SSD, 19h M4A | Polling timeout on chunk 15+ (Layer 2) |
| 16 GB RAM, SSD, 19h M4A | IPC payload freeze when loading merged transcript (Layer 5) |
| Any RAM, slow internet | Upload timeout (Layer 2) |
| Any RAM, C: drive <2 GB free | Temp chunk disk full (Layer 1) |

---

## Production-Safe Architecture for 10–24 Hour Files

### Target properties
- Constant memory regardless of duration
- Resumable after crash/reboot
- Progressive results (user sees partial transcript while processing)
- No event-loop blocking
- Works on 4 GB RAM Windows PCs

### Required changes (priority order)

#### P0 — Critical (enables 19-hour processing)

1. **Stream chunk persistence** — Write each chunk's utterances to its own file immediately on completion. Never hold more than 1 chunk's utterances in memory.

2. **Incremental transcript merge** — Replace in-memory `mergeTranscripts()` with a streaming file-append. Final transcript is built by reading chunk files sequentially, not by accumulating arrays.

3. **Paginated IPC** — `getMerged` returns utterances in pages (e.g., 1000 at a time). Renderer requests pages as user scrolls.

4. **Remove silence detection for files >4 hours** — Use fixed splits. The quality improvement from silence-aligned splits is not worth the OOM risk.

5. **Increase polling timeout** — 30 min → 90 min per chunk, with exponential backoff.

#### P1 — High (reliability + UX)

6. **SQLite or NDJSON storage** — Replace single-file JSON transcript storage with SQLite (via `better-sqlite3`) or newline-delimited JSON. Enables indexed queries, pagination, and partial reads.

7. **Renderer virtualization** — Transcript display must use windowed rendering (already have `@tanstack/react-virtual` in deps). Only render visible utterances.

8. **Bounded queue memory** — Process at most 2 chunks concurrently (already configured), but also cap the number of completed-but-unwritten chunks to 1.

9. **Resumable pipeline checkpoints** — Current recovery file approach is correct in concept but broken in practice (serializes all utterances). Fix: recovery file stores only metadata + pointers to chunk result files.

10. **Background worker process** — Move pipeline orchestration to a `utilityProcess` (Electron's worker). Prevents main process event-loop blocking from affecting the UI.

#### P2 — Important (production polish)

11. **Progressive export generation** — PDF/DOCX/TXT export should stream from chunk files, not load entire transcript into memory.

12. **Configurable temp directory** — Let user choose where chunks are stored (avoid C: drive space issues).

13. **Summarization batching** — Instead of 500 individual LLM calls, batch utterances into larger chunks (50k chars) and use fewer, longer prompts. Reduces to ~100 calls.

14. **Windows path safety** — Use short temp directory names. Validate total path length before writing.

15. **Disk space pre-check** — Before splitting, verify `os.tmpdir()` has at least `estimatedChunks × 50 MB` free.

---

## Implementation Roadmap

### Phase 1: Memory Safety (1–2 days)
- Chunk result files (write utterances to `{pipelineId}/chunk_{i}.json` on completion)
- Strip utterances from pipeline state after writing
- Recovery file stores metadata only
- Remove silence detection for files >4 hours

### Phase 2: IPC + Renderer (1–2 days)
- Paginated `getMerged` (offset/limit params)
- Renderer requests pages via `longaudio:getPage(pipelineId, offset, limit)`
- Wire up `@tanstack/react-virtual` for transcript list
- Lazy-load utterances as user scrolls

### Phase 3: Storage Migration (1 day)
- SQLite for transcript storage (or NDJSON with index)
- Migrate `history:loadTranscript` to paginated reads
- Streaming TXT/DOCX export from SQLite

### Phase 4: Reliability (1 day)
- Increase poll timeout to 90 min
- Exponential backoff on poll failures
- Disk space pre-check
- Configurable temp directory
- Windows path length validation

### Phase 5: Performance (1 day)
- Move pipeline to `utilityProcess`
- Summarization batching (reduce API calls 5×)
- Progressive PDF export

---

## Current Bottleneck Summary

```
┌─────────────────────────────────────────────────────────────┐
│  19-HOUR AUDIO FAILURE CASCADE                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [1] Silence detect ──OOM──→ CRASH                         │
│       (if survives)                                         │
│           ↓                                                 │
│  [2] 26 chunks split ──disk full──→ FAIL                   │
│       (if survives)                                         │
│           ↓                                                 │
│  [3] Poll timeout (30min) ──timeout──→ chunk marked failed  │
│       (if survives)                                         │
│           ↓                                                 │
│  [4] Pipeline state grows ──event loop block──→ UI freeze   │
│       (if survives)                                         │
│           ↓                                                 │
│  [5] Merge 100k utterances ──40MB peak──→ possible OOM      │
│       (if survives)                                         │
│           ↓                                                 │
│  [6] IPC transfer 20MB ──serialize──→ renderer freeze       │
│       (if survives)                                         │
│           ↓                                                 │
│  [7] React state 100k items ──re-render──→ UI unresponsive  │
│       (if survives)                                         │
│           ↓                                                 │
│  [8] 500 LLM calls ──17min+cost──→ timeout or budget        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**The single most impactful fix**: Stream chunk results to individual files and never accumulate all utterances in memory. This alone raises the safe ceiling from ~6 hours to ~15+ hours on 8 GB RAM.
