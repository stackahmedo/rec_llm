# 34 Client Requirements — Realistic Development Analysis

## A. Requirement Coverage Table

| # | Requirement | Status | Category | Target |
|---|-------------|--------|----------|--------|
| 1 | Long-duration recording: 19–20h | ✅ Implemented | Foundation | MVP |
| 2 | Auto folder/file splitting after recording | ✅ Implemented | Foundation | MVP |
| 3 | Massive storage: 100–1000+ files | ✅ Implemented | Foundation | MVP |
| 4 | One-click batch processing | ✅ Implemented | Foundation | MVP |
| 5 | Overcoming AI processing size limits | ✅ Implemented | Foundation | MVP |
| 6 | Handling larger audio than existing AI | ✅ Implemented | Foundation | MVP |
| 7 | 1TB-level storage capacity | 🟡 Partial | Enterprise | V1 |
| 8 | Male/female voice recognition | 🟡 Partial | Speaker Intel | V1 |
| 9 | Voice characteristic detection | 🟡 Partial | Speaker Intel | V2 |
| 10 | Speaking speed detection | 🔴 Not implemented | Speaker Intel | V1 |
| 11 | Instrument-style voice differentiation | 🔴 Not implemented | Research | Future |
| 12 | Multi-speaker ID (~10 people) | ✅ Implemented | Speaker Intel | MVP |
| 13 | Overlapping voice separation | 🔴 Not implemented | Research | Future |
| 14 | Auto date recognition from recordings | 🔴 Not implemented | Metadata | V1 |
| 15 | Detailed timestamps in documents | ✅ Implemented | Foundation | MVP |
| 16 | Processing beyond AI text-length limits | ✅ Implemented | Foundation | MVP |
| 17 | Large-scale text: 1M–2M+ chars | 🟡 Partial | Transcript Intel | V1 |
| 18 | Auto grammar correction + organization | 🔴 Not implemented | Transcript Intel | V1 |
| 19 | Minimizing dev mistakes/delays | ✅ Process | Process | Ongoing |
| 20 | Fast development speed | ✅ Process | Process | Ongoing |
| 21 | Auto noise reduction | 🔴 Not implemented | Audio Intel | V1 |
| 22 | Noisy environment support | 🟡 Partial | Audio Intel | V1 |
| 23 | AI speaker habit learning | 🔴 Not implemented | Research | Future |
| 24 | Personalized voice profile training | 🔴 Not implemented | Research | Future |
| 25 | Auto transcript organization/formatting | ✅ Implemented | Transcript Intel | MVP |
| 26 | Continuous workflow without manual intervention | 🟡 Partial | Enterprise | V1 |
| 27 | Transcripts as reusable base data | ✅ Implemented | Foundation | MVP |
| 28 | High-accuracy with overlapping audio | 🔴 Not implemented | Research | Future |
| 29 | Sync recording metadata with documents | 🟡 Partial | Metadata | V1 |
| 30 | Auto recognition of recording dates from tape | 🔴 Not implemented | Metadata | V2 |
| 31 | Scalable enterprise architecture | 🟡 Partial | Enterprise | V1 |
| 32 | Process historical recording archives | 🟡 Partial | Enterprise | V1 |
| 33 | Reduce manual file management | ✅ Implemented | Foundation | MVP |
| 34 | Custom-built AI transcription ecosystem | 🟡 Partial | Architecture | V1 |

### Summary

| Category | Count |
|----------|-------|
| ✅ Already Implemented | 14 |
| 🟡 Partially Implemented | 10 |
| 🔴 Not Implemented | 10 |

---

## B. Detailed Requirement Analysis

### ✅ ALREADY IMPLEMENTED (14 requirements)

#### R1: Long-duration recording support (19–20h)
- **Evidence:** Enterprise mode routes 10–30h files, 25-min chunks, sequential processing
- **File:** `electron/long-audio-pipeline.ts` — `getAudioTier()`, `ENTERPRISE_THRESHOLD_HOURS = 10`
- **Limitation:** Merge at 25h+ is RAM-risky (see IMPLEMENTATION_ANALYSIS.md)

#### R2: Auto folder/file splitting
- **Evidence:** FFmpeg silence-aware splitting, automatic chunk creation
- **File:** `electron/long-audio-pipeline.ts` — `splitIntoChunks()`, `detectSilencePoints()`

#### R3: Massive storage (100–1000+ files)
- **Evidence:** Virtualized queue renders 100+ items, folder scan is recursive
- **File:** `src/app/components/processing-queue.tsx` — `@tanstack/react-virtual`

#### R4: One-click batch processing
- **Evidence:** Folder picker → all files queued → auto-process sequentially
- **File:** `src/app/components/upload-toolbar.tsx` — `openFolderPicker()`

#### R5 & R6: Overcoming AI size limits / Handling larger audio
- **Evidence:** Chunked pipeline bypasses AssemblyAI's per-file limits
- **File:** `electron/long-audio-pipeline.ts` — splits any duration into API-safe chunks

#### R12: Multi-speaker identification (~10 people)
- **Evidence:** AssemblyAI `speaker_labels: true` supports up to 10+ speakers
- **File:** `electron/assemblyai.ts:144`

#### R15: Detailed timestamps in documents
- **Evidence:** Every utterance has `startMs`/`endMs`, exported in TXT/PDF
- **File:** `electron/history.ts` — `writeTranscriptTxt()`

#### R16: Processing beyond AI text-length limits
- **Evidence:** Chunked summarization for long transcripts
- **File:** `electron/summarize.ts` — `chunkByUtterances()`, multi-chunk merge

#### R25: Auto transcript organization/formatting
- **Evidence:** Utterances organized by speaker + timestamp, formatted in PDF/TXT
- **File:** `electron/pdf-export.ts` — structured sections

#### R27: Transcripts as reusable base data
- **Evidence:** Stored as JSON, searchable, exportable to PDF/TXT/DOCX
- **File:** `electron/history.ts` — persistent transcript storage

#### R33: Reduce manual file management
- **Evidence:** Auto file rename, metadata generation, batch queue, auto-summarize
- **File:** `electron/history.ts` — `generateFileName()`

---

### 🟡 PARTIALLY IMPLEMENTED (10 requirements)

#### R7: 1TB-level storage capacity
- **Current:** Files stored on disk (no limit), metadata in JSON (fragile at scale)
- **Gap:** JSON history file will degrade with 10,000+ entries. No database indexing.
- **Fix:** Migrate to SQLite for metadata. Keep audio/transcript files on disk.
- **Difficulty:** Medium | **Risk:** Low | **Target:** V1

#### R8: Male/female voice recognition
- **Current:** Pitch-based heuristic in `gender-detection.ts` (~60-70% accuracy)
- **Gap:** Not ML-based, fails on edge cases, no confidence reporting
- **Fix:** Add confidence threshold, label as "estimated", consider AssemblyAI attributes
- **Difficulty:** Low (improve) / Very High (real ML) | **Risk:** Medium | **Target:** V1

#### R9: Voice characteristic detection
- **Current:** Pitch frequency extracted, basic age range heuristic
- **Gap:** No "husky", "nasal", "breathy" classification. No spectral analysis.
- **Fix:** Add spectral centroid + formant analysis for basic voice quality labels
- **Difficulty:** High | **Risk:** Medium | **Target:** V2

#### R17: Large-scale text (1M–2M+ chars)
- **Current:** Chunked summarization exists, but merge holds all in RAM
- **Gap:** 2M chars = ~500K tokens. Single-pass summary impossible. MapReduce needed.
- **Fix:** Implement hierarchical MapReduce summarization
- **Difficulty:** Medium | **Risk:** Medium | **Target:** V1

#### R22: Noisy environment support
- **Current:** AssemblyAI handles moderate noise. No preprocessing.
- **Gap:** No FFmpeg noise reduction before upload. No SNR estimation.
- **Fix:** Add FFmpeg `afftdn` filter as preprocessing step
- **Difficulty:** Medium | **Risk:** Low | **Target:** V1

#### R26: Continuous workflow without manual intervention
- **Current:** Queue processes sequentially, auto-summarize after transcription
- **Gap:** No folder watcher, no auto-start on new files, no overnight monitoring
- **Fix:** Add chokidar/fs.watch folder monitoring + processing log
- **Difficulty:** Medium | **Risk:** Low | **Target:** V1

#### R29: Sync recording metadata with documents
- **Current:** Metadata stored (originalFileName, dates, size, duration)
- **Gap:** Not all metadata flows into PDF/TXT exports automatically
- **Fix:** Include full metadata block in export templates
- **Difficulty:** Low | **Risk:** Low | **Target:** V1

#### R31: Scalable enterprise architecture
- **Current:** Checkpoint/resume, sequential processing, disk persistence
- **Gap:** JSON-based storage, no database, no concurrent processing
- **Fix:** SQLite migration, configurable concurrency, processing log
- **Difficulty:** Medium | **Risk:** Medium | **Target:** V1

#### R32: Process historical recording archives
- **Current:** Folder scan + batch queue handles any folder of audio files
- **Gap:** No special handling for old formats, no date extraction from filenames
- **Fix:** Add filename date parsing, support more formats via FFmpeg
- **Difficulty:** Low | **Risk:** Low | **Target:** V1

#### R34: Custom-built AI transcription ecosystem
- **Current:** AssemblyAI for STT, Gemini/OpenAI for summarization, custom pipeline
- **Gap:** Still dependent on external APIs. No local/offline STT option.
- **Fix:** Architecture already supports swapping STT provider. Could add Whisper local.
- **Difficulty:** Medium (Whisper) / Very High (custom model) | **Risk:** High | **Target:** V2

---

### 🔴 NOT IMPLEMENTED (10 requirements)

#### R10: Speaking speed detection
- **Technical approach:** Calculate words-per-minute from utterance duration + word count
- **Formula:** `wpm = word_count / (duration_ms / 60000)`
- **Classify:** <120 wpm = slow, 120-160 = normal, >160 = fast
- **Difficulty:** Low | **Risk:** Low | **Target:** V1
- **Effort:** 2-3 hours

#### R11: Instrument-style voice differentiation
- **What client means:** Classify voices like musical instruments (warm, bright, resonant)
- **Technical reality:** Requires spectral analysis + trained classifier. No off-the-shelf API.
- **Approach:** Extract MFCCs + spectral features, map to descriptive labels
- **Difficulty:** Very High | **Risk:** High | **Target:** Future research
- **Effort:** 40+ hours for basic version

#### R13: Overlapping voice separation
- **Technical reality:** This is "source separation" — an active research problem
- **Current state of art:** Requires specialized models (SepFormer, Conv-TasNet)
- **AssemblyAI limitation:** Does NOT separate overlapping speech. Picks dominant speaker.
- **Honest assessment:** Not achievable with current API stack. Would need:
  - Local ML model (pyannote.audio or similar)
  - Significant compute resources
  - Still imperfect (~70-80% accuracy in research papers)
- **Difficulty:** Very High | **Risk:** Very High | **Target:** Future research
- **Recommendation:** Tell client this is a research-level feature, not MVP

#### R14: Auto date recognition from recordings
- **Technical approach:** Parse filename patterns (YYYYMMDD, dates in path), check file creation date, check audio metadata (ID3 tags)
- **Difficulty:** Low-Medium | **Risk:** Low | **Target:** V1
- **Effort:** 4-6 hours

#### R18: Auto grammar correction + sentence organization
- **Technical approach:** Post-process transcript through LLM with grammar correction prompt
- **Constraint:** Must preserve speaker labels and timestamps
- **Approach:** Per-utterance correction via Gemini/OpenAI, batch processing
- **Difficulty:** Medium | **Risk:** Low | **Target:** V1
- **Effort:** 8-12 hours

#### R21: Auto noise reduction
- **Technical approach:** FFmpeg `afftdn` (adaptive frequency-domain temporal noise filter)
- **Command:** `ffmpeg -i input.wav -af "afftdn=nf=-25" output.wav`
- **When to apply:** Before upload, as preprocessing step
- **Difficulty:** Low | **Risk:** Low | **Target:** V1
- **Effort:** 3-4 hours

#### R23: AI speaker habit learning
- **What client means:** System learns how each speaker talks and improves over time
- **Technical reality:** Requires persistent speaker embeddings + fine-tuning
- **Honest assessment:** Not possible with API-based STT. Would need:
  - Local speaker embedding model
  - Per-speaker adaptation data
  - Custom language model fine-tuning
- **Difficulty:** Very High | **Risk:** Very High | **Target:** Future research
- **Recommendation:** Explain this requires custom ML infrastructure

#### R24: Personalized voice profile training
- **What client means:** Train the system to recognize specific individuals by voice
- **Technical reality:** Speaker verification/identification requires:
  - Voice enrollment (sample recordings per person)
  - Speaker embedding model (d-vector or x-vector)
  - Matching against enrolled profiles
- **Partial solution:** AssemblyAI doesn't support this. Could use pyannote.audio locally.
- **Difficulty:** Very High | **Risk:** High | **Target:** Future research
- **Effort:** 60+ hours for basic version

#### R28: High-accuracy with overlapping audio
- **Same as R13** — requires source separation, which is research-level
- **Difficulty:** Very High | **Risk:** Very High | **Target:** Future research

#### R30: Auto recognition of recording dates from tape recorder data
- **Technical approach:** 
  1. Parse filename for date patterns
  2. Read audio file metadata (ID3, RIFF INFO)
  3. Check file system creation/modification date
  4. Optionally: detect spoken dates in first 60 seconds via LLM
- **Difficulty:** Medium | **Risk:** Low | **Target:** V2
- **Effort:** 6-8 hours

---

## C. Risk Analysis

### High-Risk Requirements (Client Needs Clarification)

| # | Requirement | Risk | Why |
|---|-------------|------|-----|
| R11 | Instrument-style voice differentiation | Very High | No standard definition, no API support, research-level |
| R13 | Overlapping voice separation | Very High | Active research problem, 70-80% accuracy at best |
| R23 | Speaker habit learning | Very High | Requires custom ML infrastructure |
| R24 | Personalized voice profiles | Very High | Requires speaker enrollment + embedding model |
| R28 | High-accuracy overlapping audio | Very High | Same as R13 |
| R34 | Custom AI ecosystem | High | Scope is unbounded without clear definition |

### Recommended Client Communication

```
Requirements 11, 13, 23, 24, 28 are research-level features that:
- Do not exist in any commercial transcription product today
- Require custom ML model training (not API calls)
- Would take 6-12 months of dedicated ML engineering
- Should be classified as "Future Research" not "MVP"

We recommend:
- MVP: Focus on R1-R7, R12, R15-R16, R25-R27, R31-R33
- V1: Add R8-R10, R14, R17-R18, R21-R22, R26, R29-R30
- V2: Add R34 (local Whisper), R9 (advanced voice features)
- Future: R11, R13, R23, R24, R28 (requires ML research team)
```

---

## D. Phased Roadmap

### Phase 1: Critical Foundation ✅ COMPLETE

| Feature | Status | Evidence |
|---------|--------|----------|
| Long audio support (20h+) | ✅ Done | Enterprise mode, 25-min chunks |
| Auto chunking | ✅ Done | FFmpeg silence-aware splitting |
| Batch queue | ✅ Done | Virtualized queue, 100+ files |
| Metadata storage | ✅ Done | History with extended metadata |
| Timestamp handling | ✅ Done | Per-utterance ms timestamps |
| Stable processing pipeline | ✅ Done | Checkpoint/resume, crash recovery |

### Phase 2: Transcript Intelligence (Next Priority)

| Feature | Status | Effort |
|---------|--------|--------|
| Grammar correction | 🔴 Not done | 8-12h |
| Sentence organization | 🔴 Not done | Part of grammar correction |
| Summary | ✅ Done | Auto-summarize implemented |
| Key points | ✅ Done | Part of summary output |
| Large text chunking | ✅ Done | Chunked summarization |
| Searchable transcript data | 🟡 Partial | Search exists, no full-text index |

### Phase 3: Speaker and Audio Intelligence

| Feature | Status | Effort |
|---------|--------|--------|
| Speaker diarization | ✅ Done | AssemblyAI speaker_labels |
| Speaker naming | ✅ Done | AI suggestion + manual |
| Voice gender estimation | 🟡 Partial | Pitch heuristic exists |
| Speaking speed detection | 🔴 Not done | 2-3h |
| Basic voice labels | 🟡 Partial | Gender/age only |
| Noise reduction preprocessing | 🔴 Not done | 3-4h |

### Phase 4: Enterprise Archive Support

| Feature | Status | Effort |
|---------|--------|--------|
| 100–1000+ file handling | ✅ Done | Virtualized queue |
| 1TB storage planning | 🟡 Partial | Need SQLite migration |
| Historical archive import | 🟡 Partial | Folder scan works |
| Folder watcher | 🔴 Not done | 6-8h |
| Reusable transcript database | ✅ Done | History + search |

### Phase 5: Advanced / Research-Level

| Feature | Status | Feasibility |
|---------|--------|-------------|
| Personalized voice profiles | 🔴 Not done | Requires local ML |
| Speaker habit learning | 🔴 Not done | Requires custom training |
| Overlapping speech separation | 🔴 Not done | Research problem |
| High accuracy overlapping | 🔴 Not done | Research problem |
| Custom AI ecosystem | 🟡 Partial | Architecture supports it |

---

## E. Next 5 Concrete Coding Tasks

Based on the gap analysis, these are the highest-impact tasks that move the most requirements forward:

### Task 1: Speaking Speed Detection (R10)
**Effort:** 2-3 hours | **Moves:** R10 from 🔴 to ✅

Add WPM calculation to each utterance after transcription:
```typescript
// In processing engine, after transcription completes:
const utterancesWithSpeed = result.utterances.map(u => ({
  ...u,
  wordCount: u.text.split(/\s+/).length,
  durationSec: (u.endMs - u.startMs) / 1000,
  wpm: Math.round(u.text.split(/\s+/).length / ((u.endMs - u.startMs) / 60000)),
  speedLabel: getSpeedLabel(wpm), // slow | normal | fast
}));
```

### Task 2: FFmpeg Noise Reduction Preprocessing (R21, R22)
**Effort:** 3-4 hours | **Moves:** R21, R22 from 🔴 to ✅

Add optional noise reduction step before AssemblyAI upload:
```typescript
// In audio-preprocess.ts:
async function denoiseAudio(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace(/\.\w+$/, '_denoised.wav');
  await execPromise(ffmpeg, [
    '-i', inputPath,
    '-af', 'afftdn=nf=-25:tn=1',
    '-ar', '16000', '-ac', '1',
    '-y', outputPath
  ]);
  return outputPath;
}
```

### Task 3: Auto Grammar Correction (R18)
**Effort:** 8-12 hours | **Moves:** R18 from 🔴 to ✅

Add post-transcription grammar correction via LLM:
- Process utterances in batches of 20
- Prompt: "Correct grammar and punctuation. Keep speaker labels and meaning unchanged."
- Save corrected version alongside original
- User can toggle between raw and corrected view

### Task 4: Recording Date Detection (R14, R30)
**Effort:** 4-6 hours | **Moves:** R14, R30 from 🔴 to ✅

Extract recording date from multiple sources:
1. Filename patterns: `YYYYMMDD`, `YYYY-MM-DD`, `DD_MM_YYYY`
2. File metadata: creation date, modification date
3. Audio metadata: ID3 tags (for MP3), RIFF INFO (for WAV)
4. Store as `recordingDate` in history metadata

### Task 5: Folder Watcher for Continuous Processing (R26)
**Effort:** 6-8 hours | **Moves:** R26 from 🟡 to ✅

Add file system watcher on a configured folder:
- Use `fs.watch` (Node built-in) or `chokidar`
- When new audio file detected → auto-add to queue
- Toggle in Settings: "Watch folder for new files"
- Show indicator in status bar when active

---

## F. Architecture Recommendations

### For Immediate Implementation (V1)

```
Current Architecture (keep):
  Electron Main → IPC → React Renderer
  
Add:
  1. SQLite for metadata (replace history.json at scale)
  2. Processing log file (already added)
  3. Folder watcher service (new)
  4. Grammar correction pipeline (new LLM step)
  5. Audio preprocessing pipeline (FFmpeg denoise)
```

### Processing Pipeline (Enhanced)

```
File Selected
  → Audio Analysis (duration, format, SNR)
  → [Optional] Noise Reduction (FFmpeg afftdn)
  → Tier Routing (normal / long / enterprise)
  → Chunking (if needed)
  → AssemblyAI Upload + Transcription
  → [New] Speaking Speed Calculation
  → [New] Grammar Correction (LLM)
  → Transcript Merge (if chunked)
  → Auto-Summarize (LLM)
  → Save to History + Disk
  → [New] Date Detection from metadata
```

### What NOT to Build Now

| Feature | Reason |
|---------|--------|
| Overlapping speech separation (R13, R28) | Research-level, no API support |
| Voice profile training (R24) | Requires local ML infrastructure |
| Speaker habit learning (R23) | Requires custom model training |
| Instrument-style voice classification (R11) | No standard definition or API |
| Local STT (Whisper) | Large scope, current API approach works |

These should be explicitly communicated to the client as "Future Research" items that require dedicated ML engineering resources beyond the current product scope.

---

## G. Honest Assessment for Client

### What RecLLM Can Deliver Now (MVP)
- 20+ hour audio processing ✅
- 100+ file batch processing ✅
- Automatic chunking and merging ✅
- Speaker identification (up to 10+) ✅
- Japanese AI summaries ✅
- PDF/TXT export ✅
- Crash recovery ✅
- Windows EXE installer ✅

### What RecLLM Can Deliver in V1 (2-4 weeks)
- Noise reduction preprocessing
- Speaking speed detection
- Grammar correction
- Recording date detection
- Folder watcher (continuous processing)
- Improved gender/voice classification

### What Requires Research Investment (3-12 months)
- Overlapping speech separation
- Personalized voice profiles
- Speaker habit learning
- Custom AI transcription model
- "Better than existing AI" accuracy

### What Is Physically Impossible with Current Technology
- Perfect overlapping speech separation (no system achieves this)
- 100% accuracy in noisy environments (fundamental physics limit)
- "Instrument-style" voice classification (no standard taxonomy exists)
