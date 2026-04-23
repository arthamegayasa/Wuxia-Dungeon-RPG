import { describe, it, expect } from 'vitest';
import { MemoryRegistry, EMPTY_MEMORY_REGISTRY } from './MemoryRegistry';
import { ForbiddenMemory } from './ForbiddenMemory';

const fake: ForbiddenMemory = {
  id: 'fake_mem', name: 'Fake', description: '', element: 'water',
  witnessFlavour: { fragment: 'a', partial: 'b', complete: 'c' },
  manifestFlavour: 'm', manifestInsightBonus: 5,
  manifestFlag: 'f', requirements: {},
};

describe('MemoryRegistry', () => {
  it('empty registry returns empty list', () => {
    expect(EMPTY_MEMORY_REGISTRY.all()).toEqual([]);
    expect(EMPTY_MEMORY_REGISTRY.get('x')).toBeUndefined();
  });

  it('fromList registers memories by id', () => {
    const r = MemoryRegistry.fromList([fake]);
    expect(r.get('fake_mem')).toBe(fake);
    expect(r.all()).toEqual([fake]);
  });

  it('rejects duplicate ids', () => {
    expect(() => MemoryRegistry.fromList([fake, fake])).toThrow(/duplicate memory id/i);
  });
});
