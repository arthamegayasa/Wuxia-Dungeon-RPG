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
