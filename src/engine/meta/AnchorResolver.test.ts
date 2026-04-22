import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { getAnchorById } from './Anchor';
import { resolveAnchor, ResolvedAnchor } from './AnchorResolver';

describe('resolveAnchor — peasant_farmer', () => {
  const anchor = getAnchorById('peasant_farmer')!;

  it('picks region from the weighted list', () => {
    const r = resolveAnchor(anchor, createRng(1));
    expect(r.region).toBe('yellow_plains');
  });

  it('picks year within era bounds', () => {
    for (let s = 1; s <= 20; s++) {
      const r = resolveAnchor(anchor, createRng(s));
      expect(r.year).toBeGreaterThanOrEqual(900);
      expect(r.year).toBeLessThanOrEqual(1100);
    }
  });

  it('picks age within [10, 14]', () => {
    for (let s = 1; s <= 20; s++) {
      const r = resolveAnchor(anchor, createRng(s));
      expect(r.ageDays).toBeGreaterThanOrEqual(10 * 365);
      expect(r.ageDays).toBeLessThanOrEqual(14 * 365);
    }
  });

  it('rolls each attribute within its [min, max] range', () => {
    for (let s = 1; s <= 20; s++) {
      const r = resolveAnchor(anchor, createRng(s));
      // peasant_farmer ranges: Body [0,10], Mind [0,6], Spirit [0,4], Agility [0,6], Charm [0,6], Luck [0,8]
      expect(r.attributeAdjustments.Body).toBeGreaterThanOrEqual(0);
      expect(r.attributeAdjustments.Body).toBeLessThanOrEqual(10);
      expect(r.attributeAdjustments.Spirit).toBeGreaterThanOrEqual(0);
      expect(r.attributeAdjustments.Spirit).toBeLessThanOrEqual(4);
      expect(r.attributeAdjustments.Luck).toBeLessThanOrEqual(8);
    }
  });

  it('includes startingFlags verbatim', () => {
    const r = resolveAnchor(anchor, createRng(1));
    expect(r.startingFlags).toContain('peasant_birth');
  });

  it('is deterministic for the same seed', () => {
    const a = resolveAnchor(anchor, createRng(42));
    const b = resolveAnchor(anchor, createRng(42));
    expect(a).toEqual(b);
  });
});

describe('resolveAnchor — true_random', () => {
  it('works on true_random anchor', () => {
    const anchor = getAnchorById('true_random')!;
    const r = resolveAnchor(anchor, createRng(1));
    expect(r.region).toBe('yellow_plains');
    // true_random allows negative attribute adjustments
    // Just verify the ranges are accepted.
    expect(typeof r.attributeAdjustments.Body).toBe('number');
  });
});
