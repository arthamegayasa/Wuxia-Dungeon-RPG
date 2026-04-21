import { describe, it, expect } from 'vitest';
import { fnv1a32, hashSeed } from './hash';

describe('fnv1a32', () => {
  it('is deterministic for the same input', () => {
    expect(fnv1a32('lin wei')).toBe(fnv1a32('lin wei'));
  });

  it('differs across different inputs', () => {
    expect(fnv1a32('a')).not.toBe(fnv1a32('b'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = fnv1a32('anything');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(h)).toBe(true);
  });

  it('matches known vector for empty string', () => {
    // FNV-1a offset basis
    expect(fnv1a32('')).toBe(0x811c9dc5);
  });

  it('produces different hashes for single-character inputs', () => {
    const seen = new Set<number>();
    for (const c of 'abcdefghij') seen.add(fnv1a32(c));
    expect(seen.size).toBe(10);
  });
});

describe('hashSeed', () => {
  it('combines seed + parts deterministically', () => {
    expect(hashSeed(42, 'turn', 7)).toBe(hashSeed(42, 'turn', 7));
  });

  it('order matters', () => {
    expect(hashSeed(1, 'a', 'b')).not.toBe(hashSeed(1, 'b', 'a'));
  });

  it('seed change produces different output', () => {
    expect(hashSeed(1, 'x')).not.toBe(hashSeed(2, 'x'));
  });
});
