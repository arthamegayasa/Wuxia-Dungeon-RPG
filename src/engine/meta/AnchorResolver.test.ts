import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { AnchorDef, DEFAULT_ANCHORS, getAnchorById } from './Anchor';
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

describe('resolveAnchor — region fallback', () => {
  it('uses targetRegion when it is in loadedRegions', () => {
    const anchor = getAnchorById('scholars_son')!;
    const resolved = resolveAnchor(anchor, createRng(1), ['yellow_plains', 'imperial_capital']);
    expect(resolved.region).toBe('imperial_capital');
  });

  it('falls back when targetRegion is not loaded', () => {
    const anchor = getAnchorById('scholars_son')!;
    const resolved = resolveAnchor(anchor, createRng(1), ['yellow_plains']);
    expect(resolved.region).toBe('yellow_plains');
  });

  it('throws when targetRegion missing AND fallback missing AND neither loaded', () => {
    const src = getAnchorById('scholars_son')!;
    const bad: AnchorDef = { ...src, spawn: { ...src.spawn, spawnRegionFallback: undefined } };
    expect(() => resolveAnchor(bad, createRng(1), ['azure_peaks'])).toThrow(
      /region .* not loaded and no fallback/i,
    );
  });

  it('resolves directly when targetRegion is already in loadedRegions (no fallback needed)', () => {
    // peasant_farmer has targetRegion='yellow_plains', which IS loaded.
    const anchor = getAnchorById('peasant_farmer')!;
    const resolved = resolveAnchor(anchor, createRng(1), ['yellow_plains']);
    expect(resolved.region).toBe('yellow_plains');
  });
});

describe('resolveAnchor — startingMeridians passthrough (Phase 2B-2 Task 7)', () => {
  it('threads startingMeridians from anchor to resolved', () => {
    const sectInitiate = DEFAULT_ANCHORS.find((a) => a.id === 'sect_initiate')!;
    const rng = createRng(42);
    const resolved = resolveAnchor(sectInitiate, rng, ['azure_peaks', 'yellow_plains']);
    expect(resolved.startingMeridians).toEqual([7]);
    expect(resolved.spiritRootTierBias).toBe(1);
  });

  it('returns undefined for anchors without startingMeridians', () => {
    const peasant = DEFAULT_ANCHORS.find((a) => a.id === 'peasant_farmer')!;
    const rng = createRng(42);
    const resolved = resolveAnchor(peasant, rng, ['yellow_plains']);
    expect(resolved.startingMeridians).toBeUndefined();
    expect(resolved.spiritRootTierBias).toBeUndefined();
  });
});
