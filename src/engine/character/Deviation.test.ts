import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { rollDeviationSeverity, DEVIATION_WEIGHTS } from './Deviation';

describe('DEVIATION_WEIGHTS', () => {
  it('sums to 100', () => {
    const total = Object.values(DEVIATION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it('weights in expected ratios', () => {
    expect(DEVIATION_WEIGHTS.tremor).toBe(50);
    expect(DEVIATION_WEIGHTS.scar).toBe(25);
    expect(DEVIATION_WEIGHTS.cripple).toBe(15);
    expect(DEVIATION_WEIGHTS.rend).toBe(8);
    expect(DEVIATION_WEIGHTS.shatter).toBe(2);
  });
});

describe('rollDeviationSeverity', () => {
  it('is deterministic for the same seed', () => {
    expect(rollDeviationSeverity(createRng(42))).toBe(rollDeviationSeverity(createRng(42)));
  });

  it('produces empirical distribution matching weights', () => {
    const rng = createRng(7);
    const counts: Record<string, number> = { tremor: 0, scar: 0, cripple: 0, rend: 0, shatter: 0 };
    const N = 50_000;
    for (let i = 0; i < N; i++) counts[rollDeviationSeverity(rng)]++;
    // 50% / 25% / 15% / 8% / 2% — tolerant bounds
    expect(counts.tremor / N).toBeGreaterThan(0.47);
    expect(counts.tremor / N).toBeLessThan(0.53);
    expect(counts.scar / N).toBeGreaterThan(0.22);
    expect(counts.scar / N).toBeLessThan(0.28);
    expect(counts.cripple / N).toBeGreaterThan(0.12);
    expect(counts.cripple / N).toBeLessThan(0.18);
    expect(counts.rend / N).toBeGreaterThan(0.06);
    expect(counts.rend / N).toBeLessThan(0.10);
    expect(counts.shatter / N).toBeGreaterThan(0.01);
    expect(counts.shatter / N).toBeLessThan(0.03);
  });

  it('returns one of the five severities', () => {
    const rng = createRng(9);
    for (let i = 0; i < 500; i++) {
      expect(['tremor', 'scar', 'cripple', 'rend', 'shatter'])
        .toContain(rollDeviationSeverity(rng));
    }
  });
});
