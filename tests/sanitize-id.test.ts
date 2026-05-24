import { describe, it, expect } from 'vitest';

// Replicate the sanitizeId function from electron/history.ts for testing
function sanitizeId(id: string): string {
  const sanitized = id.replace(/[^a-zA-Z0-9_\-\.]/g, '');
  if (!sanitized || sanitized.startsWith('.')) {
    throw new Error(`Invalid ID: "${id}"`);
  }
  return sanitized;
}

describe('sanitizeId — path traversal prevention', () => {
  it('allows valid alphanumeric IDs', () => {
    expect(sanitizeId('native-1234567890-0')).toBe('native-1234567890-0');
    expect(sanitizeId('abc_def')).toBe('abc_def');
    expect(sanitizeId('file123')).toBe('file123');
  });

  it('allows dots in IDs (but not leading)', () => {
    expect(sanitizeId('file.v2')).toBe('file.v2');
  });

  it('rejects path traversal attempts', () => {
    // These all result in strings starting with '.' or empty, so they throw
    expect(() => sanitizeId('../../etc/passwd')).toThrow('Invalid ID');
    expect(() => sanitizeId('../../../secret')).toThrow('Invalid ID');
    // Forward slashes stripped — result is safe
    expect(sanitizeId('foo/bar/baz')).toBe('foobarbaz');
    expect(sanitizeId('foo\\bar')).toBe('foobar');
  });

  it('strips special characters', () => {
    expect(sanitizeId('file<script>')).toBe('filescript');
    expect(sanitizeId('id with spaces')).toBe('idwithspaces');
    expect(sanitizeId('id;rm -rf /')).toBe('idrm-rf');
  });

  it('rejects empty result after sanitization', () => {
    expect(() => sanitizeId('')).toThrow('Invalid ID');
    expect(() => sanitizeId('///')).toThrow('Invalid ID');
    expect(() => sanitizeId('...')).toThrow('Invalid ID');
  });

  it('rejects IDs that start with dot after sanitization', () => {
    expect(() => sanitizeId('.hidden')).toThrow('Invalid ID');
    expect(() => sanitizeId('/.hidden')).toThrow('Invalid ID');
  });

  it('handles typical RecLLM job IDs', () => {
    expect(sanitizeId('native-1716000000000-0')).toBe('native-1716000000000-0');
    expect(sanitizeId('pipeline_1716000000000')).toBe('pipeline_1716000000000');
    expect(sanitizeId('chunk_0')).toBe('chunk_0');
  });
});
