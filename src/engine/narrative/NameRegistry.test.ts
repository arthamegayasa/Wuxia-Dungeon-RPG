import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createNameRegistry, resolveName, NameRegistry } from './NameRegistry';
import { DEFAULT_NAME_POOLS, generatePersonalName } from './NameGenerator';

const genPersonal = (rng: ReturnType<typeof createRng>) => generatePersonalName(DEFAULT_NAME_POOLS, rng);

describe('createNameRegistry', () => {
  it('starts empty', () => {
    const r = createNameRegistry();
    expect(r.slots).toEqual({});
  });
});

describe('resolveName', () => {
  it('generates a new name on first access and caches it', () => {
    const r0 = createNameRegistry();
    const { name, registry: r1 } = resolveName(r0, 'character', 'self', genPersonal, createRng(42));
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
    expect(r1.slots).toHaveProperty('character:self', name);
  });

  it('returns cached name on subsequent access, regardless of rng', () => {
    const r0 = createNameRegistry();
    const { name: n1, registry: r1 } = resolveName(r0, 'master', 'elder1', genPersonal, createRng(1));
    const { name: n2, registry: r2 } = resolveName(r1, 'master', 'elder1', genPersonal, createRng(99_999));
    expect(n2).toBe(n1);
    expect(r2).toBe(r1); // cache hit → same registry reference
  });

  it('keys by (archetype, slotId) — different slots get different names even for same archetype', () => {
    const r0 = createNameRegistry();
    const { name: nA, registry: r1 } = resolveName(r0, 'bandit', 'A', genPersonal, createRng(1));
    const { name: nB, registry: r2 } = resolveName(r1, 'bandit', 'B', genPersonal, createRng(2));
    // different slots → different generator seeds → likely different names
    expect(nA).not.toBe(undefined);
    expect(nB).not.toBe(undefined);
    expect(r2.slots['bandit:A']).toBe(nA);
    expect(r2.slots['bandit:B']).toBe(nB);
  });

  it('preserves existing slots when adding a new one', () => {
    const r0 = createNameRegistry();
    const { registry: r1 } = resolveName(r0, 'merchant', 'old_tan', genPersonal, createRng(1));
    const { registry: r2 } = resolveName(r1, 'monk', 'wanderer', genPersonal, createRng(2));
    expect(r2.slots['merchant:old_tan']).toBeDefined();
    expect(r2.slots['monk:wanderer']).toBeDefined();
  });

  it('is pure: original registry reference unchanged after resolve adds a slot', () => {
    const r0 = createNameRegistry();
    const { registry: r1 } = resolveName(r0, 'character', 'self', genPersonal, createRng(1));
    expect(r0.slots).toEqual({}); // original untouched
    expect(Object.keys(r1.slots)).toHaveLength(1);
  });
});
