import { describe, it, expect } from 'vitest';
import { rollManifest, MANIFEST_ATTEMPTS_PER_LIFE } from './MemoryManifestResolver';
import { MemoryRegistry } from './MemoryRegistry';
import { ForbiddenMemory } from './ForbiddenMemory';
import { createRunState } from '@/engine/events/RunState';
import { createCharacter } from '@/engine/character/Character';
import { createRng } from '@/engine/core/RNG';
import { createEmptyMetaState } from './MetaState';

function memory(id: string, insightBonus = 10): ForbiddenMemory {
  return {
    id, name: id, description: '', element: 'water',
    witnessFlavour: { fragment: 'a', partial: 'b', complete: 'c' },
    manifestFlavour: 'm',
    manifestInsightBonus: insightBonus,
    manifestFlag: `remembered_${id}`,
    requirements: {},
  };
}

function runStateWithMind(mind: number) {
  const rng = createRng(42);
  const character = createCharacter({
    name: 'T',
    attributes: { Body: 1, Mind: mind, Spirit: 1, Agility: 1, Charm: 1, Luck: 1 },
    rng,
  });
  return createRunState({ character, runSeed: 42, region: 'yellow_plains', year: 900, season: 'spring' });
}

describe('rollManifest', () => {
  it('returns unchanged when attempts exhausted', () => {
    const reg = MemoryRegistry.fromList([memory('a')]);
    const meta = { ...createEmptyMetaState(), memoriesWitnessed: { a: 1 } };
    const rs = { ...runStateWithMind(50), manifestAttemptsThisLife: MANIFEST_ATTEMPTS_PER_LIFE };
    const { runState, manifested } = rollManifest({ runState: rs, meta, registry: reg });
    expect(runState).toEqual(rs);
    expect(manifested).toEqual([]);
  });

  it('returns no manifest when no lifetime-witnessed memories in registry (but attempt still used)', () => {
    const reg = MemoryRegistry.fromList([memory('a')]);
    const meta = createEmptyMetaState();
    const rs = runStateWithMind(50);
    const { runState, manifested } = rollManifest({ runState: rs, meta, registry: reg });
    expect(runState.manifestAttemptsThisLife).toBe(1);
    expect(manifested).toEqual([]);
  });

  it('with extreme boost, manifests a witnessed memory and sets flag + insight', () => {
    const reg = MemoryRegistry.fromList([memory('a', 15)]);
    const meta = {
      ...createEmptyMetaState(),
      memoriesWitnessed: { a: 10 },
      ownedUpgrades: ['student_of_the_wheel_1', 'student_of_the_wheel_2'],
    };
    let anyManifest = false;
    for (let seed = 1; seed <= 10; seed += 1) {
      const rsSeed = { ...runStateWithMind(50), runSeed: seed, rngState: { seed, cursor: seed } };
      const { manifested, runState } = rollManifest({ runState: rsSeed, meta, registry: reg });
      if (manifested.length > 0) {
        anyManifest = true;
        expect(runState.character.insight).toBeGreaterThan(rsSeed.character.insight);
        expect(runState.memoriesManifestedThisLife).toContain('a');
      }
    }
    expect(anyManifest).toBe(true);
  });

  it('always increments manifestAttemptsThisLife', () => {
    const reg = MemoryRegistry.fromList([memory('a')]);
    const meta = { ...createEmptyMetaState(), memoriesWitnessed: { a: 1 } };
    const rs = runStateWithMind(50);
    const { runState } = rollManifest({ runState: rs, meta, registry: reg });
    expect(runState.manifestAttemptsThisLife).toBe(1);
  });

  it('is deterministic for fixed runSeed + turn', () => {
    const reg = MemoryRegistry.fromList([memory('a', 5)]);
    const meta = { ...createEmptyMetaState(), memoriesWitnessed: { a: 1 } };
    const rsBase = { ...runStateWithMind(50), runSeed: 100, turn: 3 };
    const r1 = rollManifest({ runState: rsBase, meta, registry: reg });
    const r2 = rollManifest({ runState: rsBase, meta, registry: reg });
    expect(r1.manifested).toEqual(r2.manifested);
    expect(r1.runState.character.insight).toBe(r2.runState.character.insight);
  });
});
