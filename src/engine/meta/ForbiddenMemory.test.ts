import { describe, it, expect } from 'vitest';
import { ForbiddenMemory, memoryLevelOf, MemoryLevel } from './ForbiddenMemory';

describe('memoryLevelOf', () => {
  it('returns fragment for 1-2 witnesses', () => {
    expect(memoryLevelOf(1)).toBe<MemoryLevel>('fragment');
    expect(memoryLevelOf(2)).toBe<MemoryLevel>('fragment');
  });

  it('returns partial for 3-6 witnesses', () => {
    expect(memoryLevelOf(3)).toBe<MemoryLevel>('partial');
    expect(memoryLevelOf(6)).toBe<MemoryLevel>('partial');
  });

  it('returns complete for >= 7 witnesses', () => {
    expect(memoryLevelOf(7)).toBe<MemoryLevel>('complete');
    expect(memoryLevelOf(100)).toBe<MemoryLevel>('complete');
  });

  it('throws on zero or negative', () => {
    expect(() => memoryLevelOf(0)).toThrow();
    expect(() => memoryLevelOf(-1)).toThrow();
  });
});

describe('ForbiddenMemory type', () => {
  it('constructs a minimal memory value', () => {
    const m: ForbiddenMemory = {
      id: 'frost_palm_severing',
      name: 'Frost Palm Severing',
      description: 'A severing art.',
      element: 'water',
      witnessFlavour: {
        fragment: 'memory.witness.frost_palm_severing.fragment',
        partial:  'memory.witness.frost_palm_severing.partial',
        complete: 'memory.witness.frost_palm_severing.complete',
      },
      manifestFlavour: 'memory.manifest.frost_palm_severing',
      manifestInsightBonus: 10,
      manifestFlag: 'remembered_frost_palm_severing',
      requirements: { minMeridians: 3 },
    };
    expect(m.element).toBe('water');
  });
});
