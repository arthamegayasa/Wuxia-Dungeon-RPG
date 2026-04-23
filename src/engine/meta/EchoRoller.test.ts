import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { EchoRegistry } from './EchoRegistry';
import { rollEchoes } from './EchoRoller';
import { SoulEcho } from './SoulEcho';

function echo(id: string, conflicts: string[] = []): SoulEcho {
  return {
    id, name: id, description: '',
    tier: 'fragment',
    unlockCondition: { kind: 'flag_set', flag: 'x' },
    effects: [], conflicts, reveal: 'birth',
  };
}

describe('rollEchoes', () => {
  it('returns empty when unlocked pool is empty', () => {
    const reg = EchoRegistry.fromList([]);
    const rng = createRng(42);
    expect(rollEchoes({ registry: reg, unlockedIds: [], slotCount: 3, rng })).toEqual([]);
  });

  it('returns empty when slotCount is 0', () => {
    const reg = EchoRegistry.fromList([echo('a'), echo('b')]);
    const rng = createRng(42);
    expect(rollEchoes({ registry: reg, unlockedIds: ['a', 'b'], slotCount: 0, rng })).toEqual([]);
  });

  it('picks up to slotCount echoes from the unlocked pool', () => {
    const reg = EchoRegistry.fromList([echo('a'), echo('b'), echo('c')]);
    const rng = createRng(42);
    const rolled = rollEchoes({ registry: reg, unlockedIds: ['a', 'b', 'c'], slotCount: 2, rng });
    expect(rolled.length).toBe(2);
    expect(new Set(rolled).size).toBe(2);
    for (const id of rolled) expect(['a', 'b', 'c']).toContain(id);
  });

  it('is deterministic for a fixed seed', () => {
    const reg = EchoRegistry.fromList([echo('a'), echo('b'), echo('c'), echo('d')]);
    const r1 = createRng(100);
    const r2 = createRng(100);
    const a = rollEchoes({ registry: reg, unlockedIds: ['a', 'b', 'c', 'd'], slotCount: 2, rng: r1 });
    const b = rollEchoes({ registry: reg, unlockedIds: ['a', 'b', 'c', 'd'], slotCount: 2, rng: r2 });
    expect(a).toEqual(b);
  });

  it('drops conflicting later-rolled echo and tries another', () => {
    const reg = EchoRegistry.fromList([echo('fire', ['ice']), echo('ice', ['fire']), echo('earth')]);
    for (let seed = 1; seed <= 50; seed += 1) {
      const rng = createRng(seed);
      const rolled = rollEchoes({
        registry: reg,
        unlockedIds: ['fire', 'ice', 'earth'],
        slotCount: 2,
        rng,
      });
      const set = new Set(rolled);
      expect(set.has('fire') && set.has('ice')).toBe(false);
    }
  });

  it('caps at pool size even if slotCount higher', () => {
    const reg = EchoRegistry.fromList([echo('a'), echo('b')]);
    const rng = createRng(42);
    const rolled = rollEchoes({ registry: reg, unlockedIds: ['a', 'b'], slotCount: 5, rng });
    expect(rolled.length).toBe(2);
  });
});
