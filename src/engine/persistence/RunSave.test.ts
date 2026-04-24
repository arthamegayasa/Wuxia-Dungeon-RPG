import { describe, it, expect, beforeEach } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createCharacter } from '@/engine/character/Character';
import { createRunState } from '@/engine/events/RunState';
import { createSaveManager } from './SaveManager';
import { saveRun, loadRun, clearRun, RUN_SCHEMA_VERSION } from './RunSave';

describe('RunSave', () => {
  const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
  beforeEach(() => { localStorage.clear(); });

  it('round-trips RunState through SaveManager', () => {
    const c = createCharacter({ name: 't', attributes: { Body: 20, Mind: 10, Spirit: 5, Agility: 10, Charm: 5, Luck: 20 }, rng: createRng(1) });
    const rs = createRunState({ character: c, runSeed: 42, region: 'yellow_plains', year: 1000, birthYear: 1000, season: 'summer' });
    saveRun(sm, rs);
    const loaded = loadRun(sm);
    expect(loaded).toEqual(rs);
  });

  it('loadRun returns null when no save exists', () => {
    expect(loadRun(sm)).toBeNull();
  });

  it('clearRun removes the save', () => {
    const c = createCharacter({ name: 't', attributes: { Body: 20, Mind: 10, Spirit: 5, Agility: 10, Charm: 5, Luck: 20 }, rng: createRng(1) });
    const rs = createRunState({ character: c, runSeed: 42, region: 'yellow_plains', year: 1000, birthYear: 1000, season: 'summer' });
    saveRun(sm, rs);
    clearRun(sm);
    expect(loadRun(sm)).toBeNull();
  });

  it('RUN_SCHEMA_VERSION is exported as a positive integer', () => {
    expect(Number.isInteger(RUN_SCHEMA_VERSION)).toBe(true);
    expect(RUN_SCHEMA_VERSION).toBeGreaterThan(0);
  });
});
