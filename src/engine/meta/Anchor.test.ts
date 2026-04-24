import { describe, it, expect } from 'vitest';
import { AnchorSchema, AnchorDef, DEFAULT_ANCHORS, getAnchorById } from './Anchor';

describe('AnchorSchema', () => {
  it('accepts a minimal valid anchor', () => {
    const a = {
      id: 'test_anchor',
      name: 'Test',
      description: 'A test anchor.',
      unlock: 'default',
      spawn: {
        regions: [{ id: 'yellow_plains', weight: 1 }],
        era: { minYear: 900, maxYear: 1100 },
        age: { min: 10, max: 14 },
        familyTier: 'poor',
        attributeModifiers: {},
        startingItems: [],
        startingFlags: [],
        targetRegion: 'yellow_plains',
      },
      karmaMultiplier: 1.0,
    };
    expect(AnchorSchema.safeParse(a).success).toBe(true);
  });

  it('rejects an invalid familyTier', () => {
    const a = {
      id: 'x', name: 'X', description: '.',
      unlock: 'default',
      spawn: {
        regions: [{ id: 'r', weight: 1 }],
        era: { minYear: 0, maxYear: 100 },
        age: { min: 10, max: 14 },
        familyTier: 'demigod',
        attributeModifiers: {},
        startingItems: [],
        startingFlags: [],
        targetRegion: 'r',
      },
      karmaMultiplier: 1.0,
    };
    expect(AnchorSchema.safeParse(a).success).toBe(false);
  });

  it('rejects karmaMultiplier <= 0', () => {
    const a = {
      id: 'x', name: 'X', description: '.',
      unlock: 'default',
      spawn: {
        regions: [{ id: 'r', weight: 1 }],
        era: { minYear: 0, maxYear: 100 },
        age: { min: 10, max: 14 },
        familyTier: 'poor',
        attributeModifiers: {},
        startingItems: [],
        startingFlags: [],
        targetRegion: 'r',
      },
      karmaMultiplier: -1,
    };
    expect(AnchorSchema.safeParse(a).success).toBe(false);
  });
});

describe('DEFAULT_ANCHORS', () => {
  it('has at least true_random and peasant_farmer', () => {
    expect(getAnchorById('true_random')).toBeDefined();
    expect(getAnchorById('peasant_farmer')).toBeDefined();
  });

  it('true_random has unlock === "default" and karmaMultiplier 1.5', () => {
    const a = getAnchorById('true_random')!;
    expect(a.unlock).toBe('default');
    expect(a.karmaMultiplier).toBe(1.5);
  });

  it('peasant_farmer has unlock === "default" and karmaMultiplier 1.0', () => {
    const a = getAnchorById('peasant_farmer')!;
    expect(a.unlock).toBe('default');
    expect(a.karmaMultiplier).toBe(1.0);
    expect(a.spawn.regions[0]!.id).toBe('yellow_plains');
  });

  it('every default anchor passes AnchorSchema validation', () => {
    for (const a of DEFAULT_ANCHORS) {
      expect(AnchorSchema.safeParse(a).success).toBe(true);
    }
  });

  it('getAnchorById returns undefined for unknown id', () => {
    expect(getAnchorById('not_a_real_anchor')).toBeUndefined();
  });
});

describe('new 2A anchors', () => {
  it('includes martial_family, scholars_son, outer_disciple', () => {
    const ids = DEFAULT_ANCHORS.map((a) => a.id);
    expect(ids).toContain('martial_family');
    expect(ids).toContain('scholars_son');
    expect(ids).toContain('outer_disciple');
  });

  it('martial_family targets yellow_plains directly (no fallback needed)', () => {
    const a = getAnchorById('martial_family')!;
    expect(a.spawn.targetRegion).toBe('yellow_plains');
    expect(a.spawn.spawnRegionFallback).toBeUndefined();
  });

  it('scholars_son targets imperial_capital but falls back to yellow_plains', () => {
    const a = getAnchorById('scholars_son')!;
    expect(a.spawn.targetRegion).toBe('imperial_capital');
    expect(a.spawn.spawnRegionFallback).toBe('yellow_plains');
  });

  it('outer_disciple targets azure_peaks but falls back to yellow_plains', () => {
    const a = getAnchorById('outer_disciple')!;
    expect(a.spawn.targetRegion).toBe('azure_peaks');
    expect(a.spawn.spawnRegionFallback).toBe('yellow_plains');
  });

  it('new anchors have distinct attribute adjustments and starting flags', () => {
    const m = getAnchorById('martial_family')!;
    const s = getAnchorById('scholars_son')!;
    const o = getAnchorById('outer_disciple')!;
    expect(m.spawn.startingFlags).toContain('from_martial_family');
    expect(s.spawn.startingFlags).toContain('literate');
    expect(o.spawn.startingFlags).toContain('outer_sect_member');
  });
});
