import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import {
  rollSpiritRoot,
  spiritRootMultipliers,
  SpiritRoot,
} from './SpiritRoot';
import { ELEMENTS_ELEMENTAL } from './SpiritRoot'; // five cultivation elements, no 'none'

describe('rollSpiritRoot', () => {
  it('is deterministic for the same seed', () => {
    const a = rollSpiritRoot(createRng(42));
    const b = rollSpiritRoot(createRng(42));
    expect(a).toEqual(b);
  });

  it('matches the distribution over 50_000 rolls (within tolerance)', () => {
    const rng = createRng(999);
    const counts: Record<string, number> = {
      none: 0, mottled: 0, single_element: 0, dual_element: 0, heavenly: 0,
    };
    const N = 50_000;
    for (let i = 0; i < N; i++) counts[rollSpiritRoot(rng).tier]++;
    // Expected: 95% / 4% / 0.9% / 0.09% / 0.01%
    expect(counts.none / N).toBeGreaterThan(0.93);
    expect(counts.none / N).toBeLessThan(0.97);
    expect(counts.mottled / N).toBeGreaterThan(0.03);
    expect(counts.mottled / N).toBeLessThan(0.05);
    // Rare tiers: very small N, wide tolerance
    expect(counts.single_element / N).toBeGreaterThan(0.004);
    expect(counts.single_element / N).toBeLessThan(0.015);
    // dual_element and heavenly may be 0 in 50_000 rolls — don't assert lower bound.
    expect(counts.dual_element / N).toBeLessThan(0.005);
    expect(counts.heavenly / N).toBeLessThan(0.003);
  });

  it('single-element root carries one cultivation element', () => {
    // Force a single-element result by scanning.
    const rng = createRng(1);
    for (let i = 0; i < 10_000; i++) {
      const r = rollSpiritRoot(rng);
      if (r.tier === 'single_element') {
        expect(r.elements).toHaveLength(1);
        expect(ELEMENTS_ELEMENTAL).toContain(r.elements[0]);
        return;
      }
    }
    throw new Error('Did not observe a single_element in 10_000 rolls — distribution broken');
  });

  it('dual-element root carries two distinct cultivation elements', () => {
    const rng = createRng(7);
    for (let i = 0; i < 100_000; i++) {
      const r = rollSpiritRoot(rng);
      if (r.tier === 'dual_element') {
        expect(r.elements).toHaveLength(2);
        expect(r.elements[0]).not.toBe(r.elements[1]);
        for (const el of r.elements) expect(ELEMENTS_ELEMENTAL).toContain(el);
        return;
      }
    }
    // dual_element has expected rate ~0.09%; 100k should give ~90 instances.
    throw new Error('Did not observe a dual_element in 100k rolls');
  });

  it('heavenly root names one of three variants', () => {
    const rng = createRng(13);
    for (let i = 0; i < 200_000; i++) {
      const r = rollSpiritRoot(rng);
      if (r.tier === 'heavenly') {
        expect(['frostfire', 'severed_dao', 'hollow']).toContain(r.heavenlyKind);
        return;
      }
    }
    throw new Error('Did not observe a heavenly root in 200k rolls');
  });
});

describe('spiritRootMultipliers', () => {
  it('returns tier-specific absorption and breakthrough multipliers', () => {
    expect(spiritRootMultipliers({ tier: 'none', elements: [] }))
      .toEqual({ absorption: 0, breakthrough: 0 });
    expect(spiritRootMultipliers({ tier: 'mottled', elements: [] }))
      .toEqual({ absorption: 0.3, breakthrough: 0.5 });
    expect(spiritRootMultipliers({ tier: 'single_element', elements: ['fire'] }))
      .toEqual({ absorption: 1.0, breakthrough: 1.0 });
    expect(spiritRootMultipliers({ tier: 'dual_element', elements: ['fire', 'water'] }))
      .toEqual({ absorption: 1.3, breakthrough: 1.1 });
    expect(spiritRootMultipliers({ tier: 'heavenly', elements: [], heavenlyKind: 'frostfire' }))
      .toEqual({ absorption: 2.0, breakthrough: 1.3 });
  });
});
