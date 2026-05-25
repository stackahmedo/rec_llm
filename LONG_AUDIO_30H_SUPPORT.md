# 30-Hour Audio Support — Enterprise Long Audio Mode

## Root Cause of 25h Failure

1. **Chunk size too large** — 45-minute chunks at 25h = ~33 chunks. Each chunk's utterances array stays in memory until merge. At 25h with diarization, this can exceed 2GB heap.
2. **All chunks in RAM** — `mergeTranscripts()` builds a single `allUtterances` array from all chunks simultaneously. At 25h this array can have 500K+ entries.
3. **No tier differentiation** — 2h and 25h files use the same pipeline parameters (same chunk size, same concurrency, same merge strategy).
4. **No pre-flight validation** — No disk space check, no duration cap, no estimated resource warning.
5. **Concurrency on Windows** — `MAX_CONCURRENT_CHUNKS = 2` can cause disk thrashing on HDD systems with very large files.

## Target Architecture

### Routing Tiers

| Duration | Mode | Chunk Size | Concurrency | Notes |
|----------|------|-----------|-------------|-------|
| < 2h | Normal | N/A (single upload) | 1 | Direct AssemblyAI upload |
| 2–10h | Long Audio | 30–45 min | 2 | Standard chunked pipeline |
| 10–30h | Enterprise Long Audio | 20–30 min | 1 | Smaller chunks, sequential, disk checkpoints |
| > 30h | Blocked | N/A | N/A | Error: "File exceeds 30h maximum" |

### Enterprise Mode Differences (10–30h)

- Chunk size: 25 minutes (vs 45 for standard long audio)
- Concurrency: 1 (sequential only)
- Each chunk result saved to disk immediately after completion
- Chunk utterances freed from RAM after disk save
- Incremental merge at end (stream to disk, not build in RAM)
- Pre-start validation: disk space, duration, estimated time
- Resume: checkpoint file tracks completed/failed chunks

### Safe Limits

| Metric | Standard Long Audio | Enterprise Mode |
|--------|-------------------|-----------------|
| Max duration | 10h | 30h |
| Chunk size | 45 min | 25 min |
| Max chunks | ~14 | ~72 |
| Concurrency | 2 | 1 |
| RAM per chunk | ~50MB | ~50MB |
| Peak RAM | ~100MB | ~50MB |
| Disk workspace | ~2GB | ~8GB |

## Implementation Phases

### Phase 1 (Current) — Force Enterprise Mode for 10–30h
- Add duration tier routing constants
- Block >30h with clear error
- Force enterprise chunk size (25 min) for 10–30h
- Force concurrency=1 for enterprise mode
- Add pre-start validation (disk space, duration)
- Checkpoint saves after each chunk completion (already exists)
- Resume validation on pipeline recovery

### Phase 2 (Future) — Incremental Merge
- Stream merged transcript to disk file instead of building in RAM
- Use line-by-line JSON append for utterances
- Avoid `Math.max(...largeArray)` patterns
- Paginated transcript loading in renderer

### Phase 3 (Future) — Renderer Safety
- Virtualized transcript display (already using @tanstack/react-virtual)
- Load transcript by page/window from disk
- Never hold full 30h transcript in React state

### Phase 4 (Future) — Summary Safety
- Summarize each chunk individually
- Save chunk summaries to disk
- Merge summaries at end using existing merge prompt
- Japanese output by default

## Verification Checklist

- [ ] 2h file → normal mode (no chunking)
- [ ] 5h file → standard long audio mode (45 min chunks, concurrency 2)
- [ ] 12h file → enterprise mode (25 min chunks, concurrency 1)
- [ ] 25h file → enterprise mode (25 min chunks, ~60 chunks)
- [ ] 30h file → enterprise mode (edge case, ~72 chunks)
- [ ] 31h file → blocked with error message
- [ ] Resume after restart works for enterprise mode
- [ ] Failed chunk retries without restarting pipeline
- [ ] Disk space check prevents start if insufficient
- [ ] Windows paths stay under 260 chars
- [ ] Chunk files cleaned up after successful merge
