import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createCharacter } from '@/engine/character/Character';
import { createRunState, RunState } from './RunState';

const ATTRS = { Body: 20, Mind: 15, Spirit: 10, Agility: 12, Charm: 8, Luck: 30 };

describe('createRunState', () => {
  it('initialises turn=0, empty flags, empty seen lists', () => {
    const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    const rs: RunState = createRunState({
      character: c,
      runSeed: 42,
      region: 'yellow_plains',
      year: 1000,
      season: 'summer',
    });
    expect(rs.turn).toBe(0);
    expect(rs.worldFlags).toEqual([]);
    expect(rs.thisLifeSeenEvents).toEqual([]);
    expect(rs.learnedTechniques).toEqual([]);
    expect(rs.character.name).toBe('t');
    expect(rs.region).toBe('yellow_plains');
    expect(rs.heavenlyNotice).toBe(0);
    expect(rs.karmaEarnedBuffer).toBe(0);
  });

  it('preserves provided rngState', () => {
    const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    const rs = createRunState({
      character: c, runSeed: 77, region: 'yellow_plains',
      year: 1000, season: 'summer',
    });
    expect(rs.rngState.seed).toBe(77);
  });

  it('defaults Phase 2A-1 memory fields empty', () => {
    const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    const rs = createRunState({
      character: c, runSeed: 1, region: 'yellow_plains',
      year: 1000, season: 'spring',
    });
    expect(rs.memoriesWitnessedThisLife).toEqual([]);
    expect(rs.memoriesManifestedThisLife).toEqual([]);
    expect(rs.manifestAttemptsThisLife).toBe(0);
  });
});
