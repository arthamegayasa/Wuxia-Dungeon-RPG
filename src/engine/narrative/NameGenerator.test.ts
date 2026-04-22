import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import {
  generatePersonalName,
  generateSectName,
  generatePlaceName,
  DEFAULT_NAME_POOLS,
  NamePools,
} from './NameGenerator';

describe('DEFAULT_NAME_POOLS', () => {
  it('has non-empty pools for every category', () => {
    expect(DEFAULT_NAME_POOLS.familyNames.length).toBeGreaterThan(0);
    expect(DEFAULT_NAME_POOLS.givenSyllables.length).toBeGreaterThan(0);
    expect(DEFAULT_NAME_POOLS.sectAdjectives.length).toBeGreaterThan(0);
    expect(DEFAULT_NAME_POOLS.sectObjects.length).toBeGreaterThan(0);
    expect(DEFAULT_NAME_POOLS.sectSuffixes.length).toBeGreaterThan(0);
    expect(DEFAULT_NAME_POOLS.placePrefixes.length).toBeGreaterThan(0);
    expect(DEFAULT_NAME_POOLS.placeFeatures.length).toBeGreaterThan(0);
  });
});

describe('generatePersonalName', () => {
  it('produces "Family Given" format with two-syllable given name by default', () => {
    const n = generatePersonalName(DEFAULT_NAME_POOLS, createRng(1));
    expect(n).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+[A-Za-z]*$/);
    expect(n.split(' ').length).toBe(2);
  });

  it('is deterministic', () => {
    expect(generatePersonalName(DEFAULT_NAME_POOLS, createRng(42)))
      .toBe(generatePersonalName(DEFAULT_NAME_POOLS, createRng(42)));
  });

  it('different seeds produce different names (most of the time)', () => {
    const names = new Set<string>();
    for (let s = 1; s <= 50; s++) {
      names.add(generatePersonalName(DEFAULT_NAME_POOLS, createRng(s)));
    }
    expect(names.size).toBeGreaterThan(20);
  });
});

describe('generateSectName', () => {
  it('produces "Adjective Object Suffix" format', () => {
    const n = generateSectName(DEFAULT_NAME_POOLS, createRng(1));
    expect(n.split(' ').length).toBeGreaterThanOrEqual(3);
  });

  it('is deterministic', () => {
    expect(generateSectName(DEFAULT_NAME_POOLS, createRng(42)))
      .toBe(generateSectName(DEFAULT_NAME_POOLS, createRng(42)));
  });
});

describe('generatePlaceName', () => {
  it('produces a multi-word name', () => {
    const n = generatePlaceName(DEFAULT_NAME_POOLS, createRng(1));
    expect(n.split(' ').length).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic', () => {
    expect(generatePlaceName(DEFAULT_NAME_POOLS, createRng(42)))
      .toBe(generatePlaceName(DEFAULT_NAME_POOLS, createRng(42)));
  });
});

describe('custom pools', () => {
  it('generatePersonalName uses the pools argument', () => {
    const pools: NamePools = {
      ...DEFAULT_NAME_POOLS,
      familyNames: ['Foo'],
      givenSyllables: ['Bar'],
    };
    // With only 1 family name and 1 given syllable, the name is deterministic.
    const n = generatePersonalName(pools, createRng(1));
    // Given name is single-syllable sometimes (50/50), two-syllable other times → "Foo Bar" or "Foo BarBar"
    expect(['Foo Bar', 'Foo BarBar']).toContain(n);
  });
});
