import { describe, it, expect } from 'vitest';
import { logWitness, commitWitnesses } from './MemoryWitnessLogger';
import { createRunState } from '@/engine/events/RunState';
import { createCharacter } from '@/engine/character/Character';
import { createRng } from '@/engine/core/RNG';
import { createEmptyMetaState } from './MetaState';

function baseRunState() {
  const rng = createRng(1);
  const character = createCharacter({
    name: 'T',
    attributes: { Body: 1, Mind: 1, Spirit: 1, Agility: 1, Charm: 1, Luck: 1 },
    rng,
  });
  return createRunState({
    character, runSeed: 1, region: 'yellow_plains', year: 900, birthYear: 900, season: 'spring',
  });
}

describe('logWitness', () => {
  it('adds techniqueId to memoriesWitnessedThisLife on first witness', () => {
    const rs = baseRunState();
    const next = logWitness(rs, 'frost_palm');
    expect(next.memoriesWitnessedThisLife).toContain('frost_palm');
  });

  it('is idempotent within a life', () => {
    const rs = baseRunState();
    const a = logWitness(rs, 'frost_palm');
    const b = logWitness(a, 'frost_palm');
    expect(b.memoriesWitnessedThisLife.filter((x) => x === 'frost_palm')).toHaveLength(1);
  });

  it('supports multiple distinct memories', () => {
    const rs = baseRunState();
    const a = logWitness(rs, 'a');
    const b = logWitness(a, 'b');
    expect(b.memoriesWitnessedThisLife).toEqual(['a', 'b']);
  });
});

describe('commitWitnesses', () => {
  it('increments lifetime witness counter for each id', () => {
    const meta = createEmptyMetaState();
    const next = commitWitnesses(meta, ['frost_palm', 'silent_waters']);
    expect(next.memoriesWitnessed).toEqual({ frost_palm: 1, silent_waters: 1 });
  });

  it('increments existing counters, not overwrite', () => {
    const meta = {
      ...createEmptyMetaState(),
      memoriesWitnessed: { frost_palm: 2 },
    };
    const next = commitWitnesses(meta, ['frost_palm', 'silent_waters']);
    expect(next.memoriesWitnessed.frost_palm).toBe(3);
    expect(next.memoriesWitnessed.silent_waters).toBe(1);
  });

  it('no-op when this-life list empty', () => {
    const meta = createEmptyMetaState();
    const next = commitWitnesses(meta, []);
    expect(next).toEqual(meta);
  });
});
