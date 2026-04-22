import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';
import { createCharacter } from '@/engine/character/Character';
import { createRunState } from '@/engine/events/RunState';
import { createEmptyMetaState } from '@/engine/meta/MetaState';
import { runBardoFlow } from './BardoFlow';

function buildTestRunState(overrides = {}) {
  const c = createCharacter({
    name: 'Lin Wei',
    attributes: { Body: 20, Mind: 10, Spirit: 10, Agility: 10, Charm: 10, Luck: 20 },
    rng: createRng(1),
    startingAgeDays: 30 * 365,
  });
  return {
    ...createRunState({ character: c, runSeed: 1, region: 'yellow_plains', year: 1000, season: 'summer' }),
    deathCause: 'old_age' as const,
    ...overrides,
  };
}

describe('runBardoFlow', () => {
  it('requires a deathCause', () => {
    const c = createCharacter({ name: 't', attributes: { Body: 20, Mind: 10, Spirit: 10, Agility: 10, Charm: 10, Luck: 20 }, rng: createRng(1) });
    const rs = createRunState({ character: c, runSeed: 1, region: 'yellow_plains', year: 1000, season: 'summer' });
    // deathCause: null in fresh RunState
    expect(() => runBardoFlow(rs, createEmptyMetaState(), 1.0))
      .toThrow(/no death cause/i);
  });

  it('returns a summary with the character\'s years, realm, cause', () => {
    const rs = buildTestRunState();
    const r = runBardoFlow(rs, createEmptyMetaState(), 1.0);
    expect(r.summary.yearsLived).toBe(30);
    expect(r.summary.realmReached).toBe(Realm.MORTAL);
    expect(r.summary.deathCause).toBe('old_age');
  });

  it('commits karma to the new MetaState', () => {
    const rs = buildTestRunState();
    const m0 = createEmptyMetaState();
    const r = runBardoFlow(rs, m0, 1.0);
    expect(r.meta.karmaBalance).toBeGreaterThan(0);
    expect(r.meta.karmaBalance).toBe(r.karmaEarned);
  });

  it('increments lifeCount on the new MetaState', () => {
    const rs = buildTestRunState();
    const m0 = createEmptyMetaState();
    const r = runBardoFlow(rs, m0, 1.0);
    expect(r.meta.lifeCount).toBe(1);
    const r2 = runBardoFlow(rs, r.meta, 1.0);
    expect(r2.meta.lifeCount).toBe(2);
  });

  it('appends a lineage entry to the new MetaState', () => {
    const rs = buildTestRunState();
    const m0 = createEmptyMetaState();
    const r = runBardoFlow(rs, m0, 1.0);
    expect(r.meta.lineage).toHaveLength(1);
    const entry = r.meta.lineage[0]!;
    expect(entry.name).toBe('Lin Wei');
    expect(entry.deathCause).toBe('old_age');
    expect(entry.karmaEarned).toBe(r.karmaEarned);
  });

  it('anchorMultiplier flows through to karma computation', () => {
    const rs = buildTestRunState();
    const m0 = createEmptyMetaState();
    const mult1 = runBardoFlow(rs, m0, 1.0);
    const mult2 = runBardoFlow(rs, m0, 2.0);
    expect(mult2.karmaEarned).toBeGreaterThan(mult1.karmaEarned);
  });

  it('inLifeKarmaDelta from RunState.karmaEarnedBuffer is applied', () => {
    const rsBase = buildTestRunState({ karmaEarnedBuffer: 5 });
    const m0 = createEmptyMetaState();
    const r = runBardoFlow(rsBase, m0, 1.0);
    // With yearsLived=30 → yearsKarma=3; old_age=5; total=8 × 1.0 = 8; + 5 buffer = 13.
    expect(r.karmaEarned).toBe(13);
  });
});
