import { describe, it, expect } from 'vitest';
import { createRng, derivedRng, Rng } from './RNG';

describe('RNG', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('differs for different seeds', () => {
    const a = createRng(1).next();
    const b = createRng(2).next();
    expect(a).not.toBe(b);
  });

  it('returns values in [0, 1)', () => {
    const rng = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('d100 returns integers in [1, 100]', () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 10_000; i++) {
      const v = rng.d100();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
      seen.add(v);
    }
    expect(seen.size).toBe(100);
  });

  it('d100 mean is approximately 50.5 over many rolls', () => {
    const rng = createRng(12345);
    let sum = 0;
    const N = 50_000;
    for (let i = 0; i < N; i++) sum += rng.d100();
    const mean = sum / N;
    expect(mean).toBeGreaterThan(49);
    expect(mean).toBeLessThan(52);
  });

  it('intRange is inclusive on both ends', () => {
    const rng = createRng(9);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(rng.intRange(3, 7));
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it('pick selects from an array', () => {
    const rng = createRng(5);
    const arr = ['a', 'b', 'c', 'd'];
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(rng.pick(arr));
    expect(seen).toEqual(new Set(arr));
  });

  it('weightedPick respects weights (rough distribution)', () => {
    const rng = createRng(13);
    const items: Array<{ v: string; w: number }> = [
      { v: 'a', w: 1 },
      { v: 'b', w: 9 },
    ];
    const counts: Record<string, number> = { a: 0, b: 0 };
    const N = 10_000;
    for (let i = 0; i < N; i++) counts[rng.weightedPick(items, (x) => x.w).v]++;
    // b should dominate — accept >80% for b within tolerance
    expect(counts.b / N).toBeGreaterThan(0.85);
    expect(counts.a / N).toBeGreaterThan(0.05);
  });

  it('derive produces a stable child Rng from ordered parts', () => {
    const parent = createRng(100);
    const a = parent.derive('turn', 1);
    const b = parent.derive('turn', 1);
    expect(a.next()).toBe(b.next());
    const c = parent.derive('turn', 2);
    expect(c.next()).not.toBe(a.next()); // different part sequence
  });

  it('exposes current seed and resumes from it', () => {
    const rng = createRng(77);
    rng.next();
    rng.next();
    const frozen = rng.state();
    const resumed = Rng.fromState(frozen);
    expect(resumed.next()).toBe(createRng(77).next_nth(3));
  });
});

describe('derivedRng (Phase 2B-1 Task 18)', () => {
  it('same base seed + same label → same derivative stream', () => {
    const a = derivedRng(123, 'selector');
    const b = derivedRng(123, 'selector');
    expect(a.d100()).toBe(b.d100());
    expect(a.d100()).toBe(b.d100());
  });

  it('different labels produce different streams', () => {
    const s = derivedRng(123, 'selector');
    const n = derivedRng(123, 'narrative');
    const sample1 = Array.from({ length: 5 }, () => s.d100());
    const sample2 = Array.from({ length: 5 }, () => n.d100());
    expect(sample1).not.toEqual(sample2);
  });
});
