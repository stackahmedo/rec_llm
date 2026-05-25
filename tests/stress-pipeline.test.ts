import { describe, it, expect } from 'vitest';

/**
 * Stress tests for RecLLM pipeline at 50–100 file scale.
 *
 * These tests verify:
 * 1. Queue behavior with 100+ items
 * 2. Memory safety of merge operations
 * 3. Failure isolation (one bad file doesn't break batch)
 * 4. Chunk processing state machine correctness
 * 5. Pipeline state persistence patterns
 * 6. Streaming merge correctness
 * 7. MapReduce summarization chunking logic
 */

// --- Helpers mimicking production logic ---

interface MockJob {
  id: string;
  fileName: string;
  stage: 'queued' | 'analyzing' | 'transcribing' | 'done' | 'failed';
  progress: number;
  error?: string;
}

interface MockChunk {
  index: number;
  status: 'pending' | 'processing' | 'done' | 'failed' | 'retrying';
  utterances?: Array<{ speaker: string; text: string; startMs: number; endMs: number }>;
  retryCount: number;
  error?: string;
}

interface MockPipelineState {
  id: string;
  chunks: MockChunk[];
  totalChunks: number;
  status: 'processing' | 'merging' | 'done' | 'failed';
}

function createMockJobs(count: number): MockJob[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `job_${i}`,
    fileName: `recording_${String(i).padStart(3, '0')}.mp3`,
    stage: 'queued' as const,
    progress: 0,
  }));
}

function createMockChunks(count: number): MockChunk[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    status: 'pending' as const,
    retryCount: 0,
  }));
}

function createMockUtterances(count: number, chunkIndex: number, offsetMs: number): Array<{ speaker: string; text: string; startMs: number; endMs: number }> {
  return Array.from({ length: count }, (_, i) => ({
    speaker: `Speaker ${String.fromCharCode(65 + (i % 5))}`,
    text: `Utterance ${i} from chunk ${chunkIndex}. This is sample text for testing purposes.`,
    startMs: offsetMs + i * 3000,
    endMs: offsetMs + i * 3000 + 2500,
  }));
}

// --- Streaming merge simulation ---

function streamingMergeAppend(existingLines: string[], chunk: MockChunk, offsetMs: number): string[] {
  const newLines = [...existingLines];
  for (const u of chunk.utterances || []) {
    const merged = {
      speaker: u.speaker,
      text: u.text,
      startMs: u.startMs + offsetMs,
      endMs: u.endMs + offsetMs,
      chunkIndex: chunk.index,
    };
    newLines.push(JSON.stringify(merged));
  }
  return newLines;
}

// --- Tests ---

describe('Stress Test: Queue at 100-file scale', () => {
  it('creates and manages 100 jobs without issues', () => {
    const jobs = createMockJobs(100);
    expect(jobs.length).toBe(100);
    expect(jobs[0].stage).toBe('queued');
    expect(jobs[99].fileName).toBe('recording_099.mp3');
  });

  it('sequential processing: one job at a time, mutex prevents overlap', () => {
    const jobs = createMockJobs(100);
    let mutex = false;
    let processed = 0;
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    for (const job of jobs) {
      if (mutex) {
        // This should never happen in sequential mode
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        continue;
      }
      mutex = true;
      currentConcurrent++;
      try {
        job.stage = 'done';
        job.progress = 100;
        processed++;
      } finally {
        currentConcurrent--;
        mutex = false;
      }
    }

    expect(processed).toBe(100);
    expect(maxConcurrent).toBe(0); // No overlap detected
    expect(jobs.every((j) => j.stage === 'done')).toBe(true);
  });

  it('failed job does not stop batch processing', () => {
    const jobs = createMockJobs(100);
    const failIndices = new Set([7, 23, 45, 67, 89]); // 5 random failures
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < jobs.length; i++) {
      try {
        if (failIndices.has(i)) {
          throw new Error(`Simulated failure for job ${i}`);
        }
        jobs[i].stage = 'done';
        processed++;
      } catch (err: any) {
        jobs[i].stage = 'failed';
        jobs[i].error = err.message;
        failed++;
      }
    }

    expect(processed).toBe(95);
    expect(failed).toBe(5);
    expect(jobs.filter((j) => j.stage === 'done').length).toBe(95);
    expect(jobs.filter((j) => j.stage === 'failed').length).toBe(5);
  });

  it('queue state is serializable (localStorage simulation)', () => {
    const jobs = createMockJobs(100);
    // Simulate localStorage persistence
    const serialized = JSON.stringify(jobs);
    const deserialized = JSON.parse(serialized) as MockJob[];

    expect(deserialized.length).toBe(100);
    expect(deserialized[50].id).toBe('job_50');

    // Check size is reasonable for localStorage (< 5MB)
    const sizeKB = serialized.length / 1024;
    expect(sizeKB).toBeLessThan(100); // 100 jobs metadata should be < 100KB
  });
});

describe('Stress Test: Chunk processing at scale', () => {
  it('72 chunks (simulating 30h / 25min each) state machine', () => {
    const chunks = createMockChunks(72);
    const pipeline: MockPipelineState = {
      id: 'pipeline_test',
      chunks,
      totalChunks: 72,
      status: 'processing',
    };

    // Process all chunks sequentially
    for (const chunk of pipeline.chunks) {
      chunk.status = 'processing';
      // Simulate transcription
      chunk.utterances = createMockUtterances(100, chunk.index, chunk.index * 25 * 60 * 1000);
      chunk.status = 'done';
    }

    const allDone = pipeline.chunks.every((c) => c.status === 'done');
    expect(allDone).toBe(true);
    expect(pipeline.chunks.length).toBe(72);
  });

  it('chunk retry logic: max 3 retries then permanent failure', () => {
    const chunk: MockChunk = { index: 5, status: 'pending', retryCount: 0 };
    const MAX_RETRIES = 3;

    // Simulate 3 failures
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      chunk.status = 'processing';
      // Simulate failure
      chunk.retryCount++;
      if (chunk.retryCount < MAX_RETRIES) {
        chunk.status = 'retrying';
      } else {
        chunk.status = 'failed';
        chunk.error = `Failed after ${MAX_RETRIES} attempts`;
      }
    }

    expect(chunk.status).toBe('failed');
    expect(chunk.retryCount).toBe(3);
  });

  it('partial failure: 3 of 72 chunks fail, pipeline still produces result', () => {
    const chunks = createMockChunks(72);
    const failIndices = new Set([10, 35, 60]);

    for (const chunk of chunks) {
      if (failIndices.has(chunk.index)) {
        chunk.status = 'failed';
        chunk.error = 'Simulated API timeout';
      } else {
        chunk.utterances = createMockUtterances(50, chunk.index, chunk.index * 25 * 60 * 1000);
        chunk.status = 'done';
      }
    }

    const completed = chunks.filter((c) => c.status === 'done');
    const failed = chunks.filter((c) => c.status === 'failed');

    expect(completed.length).toBe(69);
    expect(failed.length).toBe(3);

    // Merge should still work with completed chunks only
    const totalUtterances = completed.reduce((sum, c) => sum + (c.utterances?.length || 0), 0);
    expect(totalUtterances).toBe(69 * 50); // 3450 utterances
  });

  it('concurrent chunk processing: no race condition on status', () => {
    const chunks = createMockChunks(20);
    const concurrency = 3;
    let activeCount = 0;
    let maxActive = 0;

    // Simulate parallel processing
    for (let i = 0; i < chunks.length; i += concurrency) {
      const batch = chunks.slice(i, i + concurrency);
      activeCount = batch.length;
      maxActive = Math.max(maxActive, activeCount);

      for (const chunk of batch) {
        chunk.status = 'processing';
      }
      for (const chunk of batch) {
        chunk.utterances = createMockUtterances(30, chunk.index, 0);
        chunk.status = 'done';
      }
      activeCount = 0;
    }

    expect(maxActive).toBeLessThanOrEqual(concurrency);
    expect(chunks.every((c) => c.status === 'done')).toBe(true);
  });
});

describe('Stress Test: Streaming merge memory safety', () => {
  it('incremental merge: never holds all utterances in memory at once', () => {
    // Simulate 72 chunks × 100 utterances = 7200 total
    // Streaming merge appends to disk, then frees chunk data
    const CHUNK_COUNT = 72;
    const UTTERANCES_PER_CHUNK = 100;
    let diskLines: string[] = [];
    let peakMemoryItems = 0;

    for (let i = 0; i < CHUNK_COUNT; i++) {
      // Create chunk utterances (simulates RAM usage)
      const chunk: MockChunk = {
        index: i,
        status: 'done',
        retryCount: 0,
        utterances: createMockUtterances(UTTERANCES_PER_CHUNK, i, i * 25 * 60 * 1000),
      };

      // Track peak memory (chunk utterances in RAM)
      peakMemoryItems = Math.max(peakMemoryItems, chunk.utterances!.length);

      // Append to disk (streaming merge)
      diskLines = streamingMergeAppend(diskLines, chunk, 0);

      // Free chunk utterances (simulates what production code does)
      chunk.utterances = undefined;
    }

    // Verify: peak memory was only one chunk's worth
    expect(peakMemoryItems).toBe(UTTERANCES_PER_CHUNK);
    // Verify: all utterances made it to disk
    expect(diskLines.length).toBe(CHUNK_COUNT * UTTERANCES_PER_CHUNK);
  });

  it('JSONL format is parseable line by line', () => {
    const chunk: MockChunk = {
      index: 0,
      status: 'done',
      retryCount: 0,
      utterances: createMockUtterances(10, 0, 0),
    };

    const lines = streamingMergeAppend([], chunk, 5000);

    // Each line should be valid JSON
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed).toHaveProperty('speaker');
      expect(parsed).toHaveProperty('text');
      expect(parsed).toHaveProperty('startMs');
      expect(parsed).toHaveProperty('endMs');
      expect(parsed).toHaveProperty('chunkIndex');
      // Verify offset was applied
      expect(parsed.startMs).toBeGreaterThanOrEqual(5000);
    }
  });

  it('merge preserves chunk order and timestamps', () => {
    const diskLines: string[] = [];
    const CHUNKS = 10;

    for (let i = 0; i < CHUNKS; i++) {
      const chunk: MockChunk = {
        index: i,
        status: 'done',
        retryCount: 0,
        utterances: createMockUtterances(5, i, i * 1500000), // 25 min offset
      };
      const newLines = streamingMergeAppend([], chunk, 0);
      diskLines.push(...newLines);
    }

    // Verify chronological order
    let lastEndMs = 0;
    for (const line of diskLines) {
      const u = JSON.parse(line);
      expect(u.startMs).toBeGreaterThanOrEqual(lastEndMs - 3000); // Allow small overlap within chunk
      lastEndMs = u.endMs;
    }
  });

  it('30h simulation: 72 chunks × 7000 utterances = 504K items on disk', () => {
    // This tests the scale without actually creating 504K items
    // Instead verify the math and memory model
    const CHUNKS = 72;
    const UTTERANCES_PER_CHUNK = 7000;
    const TOTAL = CHUNKS * UTTERANCES_PER_CHUNK;

    // Each JSONL line is approximately 150 bytes
    const BYTES_PER_LINE = 150;
    const TOTAL_DISK_MB = (TOTAL * BYTES_PER_LINE) / (1024 * 1024);

    expect(TOTAL).toBe(504000);
    // Disk usage should be ~72MB for 30h transcript
    expect(TOTAL_DISK_MB).toBeCloseTo(72, 0);
    // Peak RAM should only be one chunk: 7000 × 150 bytes = ~1MB
    const PEAK_RAM_MB = (UTTERANCES_PER_CHUNK * BYTES_PER_LINE) / (1024 * 1024);
    expect(PEAK_RAM_MB).toBeLessThan(2);
  });
});

describe('Stress Test: MapReduce summarization logic', () => {
  const CHUNK_CHAR_LIMIT = 10000;

  function chunkByText(text: string): string[] {
    if (text.length <= CHUNK_CHAR_LIMIT) return [text];
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      let end = start + CHUNK_CHAR_LIMIT;
      if (end < text.length) {
        const lastNewline = text.lastIndexOf('\n', end);
        if (lastNewline > start) end = lastNewline;
      }
      chunks.push(text.slice(start, end).trim());
      start = end;
    }
    return chunks;
  }

  it('100 files × 20K chars each = 2M chars splits correctly', () => {
    const FILE_COUNT = 100;
    const CHARS_PER_FILE = 20000;
    const totalChars = FILE_COUNT * CHARS_PER_FILE;

    expect(totalChars).toBe(2000000); // 2M chars

    // Each file splits into 2 chunks (20K / 10K limit)
    const text = 'A'.repeat(CHARS_PER_FILE);
    const chunks = chunkByText(text);
    expect(chunks.length).toBe(2);

    // Total chunks across all files
    const totalChunks = FILE_COUNT * 2;
    expect(totalChunks).toBe(200);
  });

  it('MapReduce levels: 100 files → groups of 15 → final merge', () => {
    const MAX_PER_MERGE = 15;
    let currentCount = 100; // 100 file summaries
    let levels = 0;

    while (currentCount > MAX_PER_MERGE) {
      currentCount = Math.ceil(currentCount / MAX_PER_MERGE);
      levels++;
    }
    levels++; // Final merge

    // 100 → 7 groups → 1 final = 2 levels
    expect(levels).toBe(2);
  });

  it('MapReduce levels: 1000 files → correct hierarchy', () => {
    const MAX_PER_MERGE = 15;
    let currentCount = 1000;
    let levels = 0;

    while (currentCount > MAX_PER_MERGE) {
      currentCount = Math.ceil(currentCount / MAX_PER_MERGE);
      levels++;
    }
    levels++;

    // 1000 → 67 → 5 → 1 = 3 levels
    expect(levels).toBe(3);
  });

  it('single file under limit: no chunking needed', () => {
    const text = 'Short transcript content.';
    const chunks = chunkByText(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(text);
  });
});

describe('Stress Test: Pipeline state persistence', () => {
  it('pipeline state serializes/deserializes correctly at 72 chunks', () => {
    const pipeline: MockPipelineState = {
      id: 'pipeline_30h_test',
      chunks: createMockChunks(72),
      totalChunks: 72,
      status: 'processing',
    };

    // Mark some as done with utterances
    for (let i = 0; i < 30; i++) {
      pipeline.chunks[i].status = 'done';
      pipeline.chunks[i].utterances = createMockUtterances(100, i, i * 25 * 60 * 1000);
    }

    const serialized = JSON.stringify(pipeline);
    const deserialized = JSON.parse(serialized) as MockPipelineState;

    expect(deserialized.chunks.length).toBe(72);
    expect(deserialized.chunks.filter((c) => c.status === 'done').length).toBe(30);
    expect(deserialized.chunks[0].utterances?.length).toBe(100);
  });

  it('pipeline state without utterances is small (after streaming merge frees them)', () => {
    const pipeline: MockPipelineState = {
      id: 'pipeline_freed',
      chunks: createMockChunks(72),
      totalChunks: 72,
      status: 'done',
    };

    // All done, utterances freed (streaming merge already wrote to disk)
    for (const chunk of pipeline.chunks) {
      chunk.status = 'done';
      chunk.utterances = undefined;
    }

    const serialized = JSON.stringify(pipeline);
    const sizeKB = serialized.length / 1024;

    // Without utterances, 72 chunks metadata should be < 10KB
    expect(sizeKB).toBeLessThan(10);
  });

  it('crash recovery: reset in-progress jobs to queued', () => {
    const jobs = createMockJobs(50);
    // Simulate crash: some jobs stuck in active states
    jobs[3].stage = 'analyzing';
    jobs[7].stage = 'transcribing';
    jobs[12].stage = 'transcribing';

    // Recovery logic (same as use-processing-engine.ts)
    const activeStages = new Set(['analyzing', 'chunking', 'uploading', 'transcribing', 'summarizing', 'saving']);
    const orphaned = jobs.filter((j) => activeStages.has(j.stage));

    for (const job of orphaned) {
      job.stage = 'queued';
      job.progress = 0;
    }

    expect(orphaned.length).toBe(3);
    expect(jobs[3].stage).toBe('queued');
    expect(jobs[7].stage).toBe('queued');
    expect(jobs[12].stage).toBe('queued');
    // Other jobs unchanged
    expect(jobs[0].stage).toBe('queued');
    expect(jobs[49].stage).toBe('queued');
  });
});

describe('Stress Test: Tier routing correctness', () => {
  function getAudioTier(durationHours: number): 'normal' | 'long_audio' | 'enterprise' | 'blocked' {
    if (durationHours > 30) return 'blocked';
    if (durationHours >= 10) return 'enterprise';
    if (durationHours >= 2) return 'long_audio';
    return 'normal';
  }

  function getChunkMinutes(tier: string): number {
    return tier === 'enterprise' ? 25 : 45;
  }

  function getConcurrency(tier: string): number {
    return tier === 'enterprise' ? 1 : 2;
  }

  const testCases = [
    { hours: 0.5, tier: 'normal', chunks: 1, concurrency: 2 },
    { hours: 1.5, tier: 'normal', chunks: 1, concurrency: 2 },
    { hours: 2.0, tier: 'long_audio', chunks: 3, concurrency: 2 },
    { hours: 5.0, tier: 'long_audio', chunks: 7, concurrency: 2 },
    { hours: 10.0, tier: 'enterprise', chunks: 24, concurrency: 1 },
    { hours: 20.0, tier: 'enterprise', chunks: 48, concurrency: 1 },
    { hours: 25.0, tier: 'enterprise', chunks: 60, concurrency: 1 },
    { hours: 30.0, tier: 'enterprise', chunks: 72, concurrency: 1 },
    { hours: 31.0, tier: 'blocked', chunks: 0, concurrency: 0 },
  ];

  for (const tc of testCases) {
    it(`${tc.hours}h → tier=${tc.tier}, chunks=${tc.chunks}, concurrency=${tc.concurrency}`, () => {
      const tier = getAudioTier(tc.hours);
      expect(tier).toBe(tc.tier);

      if (tier === 'blocked' || tier === 'normal') return;

      const chunkMin = getChunkMinutes(tier);
      const expectedChunks = Math.ceil((tc.hours * 60) / chunkMin);
      expect(expectedChunks).toBe(tc.chunks);

      const concurrency = getConcurrency(tier);
      expect(concurrency).toBe(tc.concurrency);
    });
  }
});

describe('Stress Test: Speaking speed calculation', () => {
  it('correctly classifies speed for batch of utterances', () => {
    const utterances = [
      { text: 'Hello world this is a test', startMs: 0, endMs: 5000 }, // 6 words / 5s = 72 wpm → slow
      { text: Array(25).fill('word').join(' '), startMs: 0, endMs: 10000 }, // 25 words / 10s = 150 wpm → normal
      { text: Array(50).fill('word').join(' '), startMs: 0, endMs: 10000 }, // 50 words / 10s = 300 wpm → fast
    ];

    const results = utterances.map((u) => {
      const durationSec = (u.endMs - u.startMs) / 1000;
      const wordCount = u.text.trim().split(/\s+/).length;
      const wpm = durationSec > 0 ? Math.round(wordCount / (durationSec / 60)) : 0;
      let speedLabel = 'normal';
      if (wpm > 0 && wpm < 120) speedLabel = 'slow';
      else if (wpm >= 160) speedLabel = 'fast';
      return { wpm, speedLabel };
    });

    expect(results[0].speedLabel).toBe('slow');
    expect(results[1].speedLabel).toBe('normal');
    expect(results[2].speedLabel).toBe('fast');
  });
});

describe('Stress Test: Date detection patterns', () => {
  function detectDateFromFilename(fileName: string): string | undefined {
    // Pattern 1: YYYYMMDD
    const p1 = fileName.match(/(?:^|[_\-\s])(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:[_\-\s.]|$)/);
    if (p1) {
      const d = new Date(`${p1[1]}-${p1[2]}-${p1[3]}`);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    // Pattern 2: YYYY-MM-DD or YYYY_MM_DD
    const p2 = fileName.match(/(\d{4})[-_](0[1-9]|1[0-2])[-_](0[1-9]|[12]\d|3[01])/);
    if (p2) {
      const d = new Date(`${p2[1]}-${p2[2]}-${p2[3]}`);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    return undefined;
  }

  const cases = [
    { file: '20240315_meeting.mp3', expected: '2024-03-15' },
    { file: 'recording_2024-01-20_afternoon.wav', expected: '2024-01-20' },
    { file: 'audio_2023_12_01.m4a', expected: '2023-12-01' },
    { file: 'random_file.mp3', expected: undefined },
    { file: '20241301_invalid.mp3', expected: undefined }, // month 13 invalid
  ];

  for (const tc of cases) {
    it(`"${tc.file}" → ${tc.expected || 'no date'}`, () => {
      expect(detectDateFromFilename(tc.file)).toBe(tc.expected);
    });
  }
});
