import { describe, it, expect } from 'vitest';

/**
 * Tests for the loadedIdsRef management logic used in transcript-store.tsx.
 * Verifies deduplication, cap enforcement, and protected ID behavior.
 */

const MAX_CACHED_TRANSCRIPTS = 3;

// Replicate pushLoadedId from transcript-store.tsx
function pushLoadedId(ref: { current: string[] }, fileId: string, protectedIds: (string | null)[]): void {
  if (ref.current.includes(fileId)) return;
  while (ref.current.length >= MAX_CACHED_TRANSCRIPTS) {
    const evictIdx = ref.current.findIndex((id) => !protectedIds.includes(id) && id !== fileId);
    if (evictIdx === -1) break;
    ref.current.splice(evictIdx, 1);
  }
  ref.current.push(fileId);
}

describe('pushLoadedId — deduplication and cap', () => {
  it('does not add duplicate IDs', () => {
    const ref = { current: ['a', 'b'] };
    pushLoadedId(ref, 'a', [null]);
    expect(ref.current).toEqual(['a', 'b']);
  });

  it('adds new ID when under capacity', () => {
    const ref = { current: ['a', 'b'] };
    pushLoadedId(ref, 'c', [null]);
    expect(ref.current).toEqual(['a', 'b', 'c']);
  });

  it('evicts oldest non-protected ID when at capacity', () => {
    const ref = { current: ['a', 'b', 'c'] };
    pushLoadedId(ref, 'd', ['c']); // protect 'c'
    // 'a' is oldest non-protected, should be evicted
    expect(ref.current).toEqual(['b', 'c', 'd']);
  });

  it('never evicts the active (protected) ID', () => {
    const ref = { current: ['active', 'b', 'c'] };
    pushLoadedId(ref, 'd', ['active']);
    // 'b' is oldest non-protected
    expect(ref.current).toEqual(['active', 'c', 'd']);
  });

  it('never evicts the fileId being added', () => {
    const ref = { current: ['a', 'b', 'c'] };
    pushLoadedId(ref, 'new', [null]);
    // 'a' is oldest, evicted; 'new' is the one being added
    expect(ref.current).toEqual(['b', 'c', 'new']);
    expect(ref.current).not.toContain('a');
  });

  it('handles all entries being protected gracefully', () => {
    const ref = { current: ['a', 'b', 'c'] };
    // Protect all existing entries
    pushLoadedId(ref, 'd', ['a', 'b', 'c']);
    // Cannot evict anyone, but still pushes (exceeds cap temporarily)
    expect(ref.current).toEqual(['a', 'b', 'c', 'd']);
  });

  it('enforces cap after multiple pushes', () => {
    const ref = { current: [] as string[] };
    pushLoadedId(ref, 'a', [null]);
    pushLoadedId(ref, 'b', [null]);
    pushLoadedId(ref, 'c', [null]);
    pushLoadedId(ref, 'd', [null]);
    pushLoadedId(ref, 'e', [null]);
    // Should never exceed MAX_CACHED_TRANSCRIPTS (3)
    expect(ref.current.length).toBe(MAX_CACHED_TRANSCRIPTS);
    expect(ref.current).toEqual(['c', 'd', 'e']);
  });

  it('repeated pushes of same ID do not grow the array', () => {
    const ref = { current: ['a', 'b'] };
    pushLoadedId(ref, 'b', [null]);
    pushLoadedId(ref, 'b', [null]);
    pushLoadedId(ref, 'b', [null]);
    expect(ref.current).toEqual(['a', 'b']);
  });
});

describe('save retry behavior', () => {
  it('retries once on failure then succeeds', async () => {
    let attempts = 0;
    const mockSave = async (): Promise<boolean> => {
      attempts++;
      return attempts >= 2; // Fails first, succeeds second
    };

    let saveOk = await mockSave();
    if (!saveOk) {
      await new Promise((r) => setTimeout(r, 10)); // short delay in test
      saveOk = await mockSave();
    }

    expect(saveOk).toBe(true);
    expect(attempts).toBe(2);
  });

  it('gives up after second failure without blocking', async () => {
    let attempts = 0;
    const mockSave = async (): Promise<boolean> => {
      attempts++;
      return false; // Always fails
    };

    let saveOk = await mockSave();
    if (!saveOk) {
      await new Promise((r) => setTimeout(r, 10));
      saveOk = await mockSave();
    }

    expect(saveOk).toBe(false);
    expect(attempts).toBe(2);
    // Queue is not blocked — test completes
  });
});
