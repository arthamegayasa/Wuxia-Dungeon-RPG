import { describe, it, expect } from 'vitest';
import { loadAnchors } from './loader';
import defaultsJson from './defaults.json';

describe('loadAnchors', () => {
  it('parses the committed defaults.json', () => {
    const anchors = loadAnchors(defaultsJson);
    expect(anchors.length).toBeGreaterThanOrEqual(2);
    expect(anchors.map((a) => a.id)).toContain('true_random');
    expect(anchors.map((a) => a.id)).toContain('peasant_farmer');
  });

  it('returns fully validated AnchorDef objects (zod-parsed)', () => {
    const anchors = loadAnchors(defaultsJson);
    for (const a of anchors) {
      expect(typeof a.id).toBe('string');
      expect(a.spawn.regions.length).toBeGreaterThan(0);
      expect(a.karmaMultiplier).toBeGreaterThan(0);
    }
  });

  it('throws on an envelope without an anchors array', () => {
    expect(() => loadAnchors({ version: 1 })).toThrow(/anchors/i);
  });

  it('throws on an anchor with an invalid familyTier', () => {
    const bad = {
      version: 1,
      anchors: [{
        id: 'x', name: 'X', description: '.', unlock: 'default',
        spawn: {
          regions: [{ id: 'r', weight: 1 }],
          era: { minYear: 0, maxYear: 100 },
          age: { min: 10, max: 14 },
          familyTier: 'god_emperor',
          attributeModifiers: {},
          startingItems: [],
          startingFlags: [],
          targetRegion: 'r',
        },
        karmaMultiplier: 1.0,
      }],
    };
    expect(() => loadAnchors(bad)).toThrow();
  });
});
