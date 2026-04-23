import { describe, it, expect } from 'vitest';
import { EchoTracker, emptyEchoProgress, mergeEchoProgress } from './EchoTracker';

describe('EchoTracker', () => {
  it('starts empty', () => {
    const t = EchoTracker.empty();
    expect(t.get('sword_choice')).toBe(0);
  });

  it('increments counters', () => {
    const t = EchoTracker.empty();
    const t1 = t.increment('sword_choice');
    const t2 = t1.increment('sword_choice', 3);
    expect(t2.get('sword_choice')).toBe(4);
    // original unchanged
    expect(t.get('sword_choice')).toBe(0);
  });

  it('snapshots as plain object', () => {
    const t = EchoTracker.empty().increment('a').increment('b', 2);
    expect(t.snapshot()).toEqual({ a: 1, b: 2 });
  });
});

describe('emptyEchoProgress', () => {
  it('returns frozen empty object', () => {
    expect(emptyEchoProgress()).toEqual({});
  });
});

describe('mergeEchoProgress', () => {
  it('sums numeric keys preserving metastate immutability', () => {
    const base = { a: 5, b: 2 };
    const delta = { a: 3, c: 10 };
    const merged = mergeEchoProgress(base, delta);
    expect(merged).toEqual({ a: 8, b: 2, c: 10 });
    expect(base).toEqual({ a: 5, b: 2 });
  });
});
