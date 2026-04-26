import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { DeathCause, Realm } from '@/engine/core/Types';
import { createCharacter } from '@/engine/character/Character';
import { createRunState, RunState } from '@/engine/events/RunState';
import { createEmptyMetaState } from '@/engine/meta/MetaState';
import { EchoRegistry } from '@/engine/meta/EchoRegistry';
import { SoulEcho } from '@/engine/meta/SoulEcho';
import { runBardoFlow } from './BardoFlow';

const EMPTY_REG = EchoRegistry.fromList([]);

function buildTestRunState(overrides = {}) {
  const c = createCharacter({
    name: 'Lin Wei',
    attributes: { Body: 20, Mind: 10, Spirit: 10, Agility: 10, Charm: 10, Luck: 20 },
    rng: createRng(1),
    startingAgeDays: 30 * 365,
  });
  return {
    ...createRunState({ character: c, runSeed: 1, region: 'yellow_plains', year: 1000, birthYear: 1000, season: 'summer' }),
    deathCause: 'old_age' as const,
    ...overrides,
  };
}

describe('runBardoFlow', () => {
  it('requires a deathCause', () => {
    const c = createCharacter({ name: 't', attributes: { Body: 20, Mind: 10, Spirit: 10, Agility: 10, Charm: 10, Luck: 20 }, rng: createRng(1) });
    const rs = createRunState({ character: c, runSeed: 1, region: 'yellow_plains', year: 1000, birthYear: 1000, season: 'summer' });
    // deathCause: null in fresh RunState
    expect(() => runBardoFlow(rs, createEmptyMetaState(), 1.0, EMPTY_REG))
      .toThrow(/no death cause/i);
  });

  it('returns a summary with the character\'s years, realm, cause', () => {
    const rs = buildTestRunState();
    const r = runBardoFlow(rs, createEmptyMetaState(), 1.0, EMPTY_REG);
    expect(r.summary.yearsLived).toBe(30);
    expect(r.summary.realmReached).toBe(Realm.MORTAL);
    expect(r.summary.deathCause).toBe('old_age');
  });

  it('commits karma to the new MetaState', () => {
    const rs = buildTestRunState();
    const m0 = createEmptyMetaState();
    const r = runBardoFlow(rs, m0, 1.0, EMPTY_REG);
    expect(r.meta.karmaBalance).toBeGreaterThan(0);
    expect(r.meta.karmaBalance).toBe(r.karmaEarned);
  });

  it('increments lifeCount on the new MetaState', () => {
    const rs = buildTestRunState();
    const m0 = createEmptyMetaState();
    const r = runBardoFlow(rs, m0, 1.0, EMPTY_REG);
    expect(r.meta.lifeCount).toBe(1);
    const r2 = runBardoFlow(rs, r.meta, 1.0, EMPTY_REG);
    expect(r2.meta.lifeCount).toBe(2);
  });

  it('appends a lineage entry to the new MetaState', () => {
    const rs = buildTestRunState();
    const m0 = createEmptyMetaState();
    const r = runBardoFlow(rs, m0, 1.0, EMPTY_REG);
    expect(r.meta.lineage).toHaveLength(1);
    const entry = r.meta.lineage[0]!;
    expect(entry.name).toBe('Lin Wei');
    expect(entry.deathCause).toBe('old_age');
    expect(entry.karmaEarned).toBe(r.karmaEarned);
  });

  it('anchorMultiplier flows through to karma computation', () => {
    const rs = buildTestRunState();
    const m0 = createEmptyMetaState();
    const mult1 = runBardoFlow(rs, m0, 1.0, EMPTY_REG);
    const mult2 = runBardoFlow(rs, m0, 2.0, EMPTY_REG);
    expect(mult2.karmaEarned).toBeGreaterThan(mult1.karmaEarned);
  });

  it('inLifeKarmaDelta from RunState.karmaEarnedBuffer is applied', () => {
    const rsBase = buildTestRunState({ karmaEarnedBuffer: 5 });
    const m0 = createEmptyMetaState();
    const r = runBardoFlow(rsBase, m0, 1.0, EMPTY_REG);
    // With yearsLived=30 → yearsKarma=3; old_age=5; total=8 × 1.0 = 8; + 5 buffer = 13.
    expect(r.karmaEarned).toBe(13);
  });

  it('summary.maxRealm reflects the character realm at death (Phase 2B-2 Task 8)', () => {
    const c = createCharacter({
      name: 'Qi Seeker',
      attributes: { Body: 20, Mind: 10, Spirit: 10, Agility: 10, Charm: 10, Luck: 20 },
      rng: createRng(1),
      startingAgeDays: 30 * 365,
    });
    const charAtQiSensing = { ...c, realm: Realm.QI_SENSING };
    const rs = {
      ...createRunState({ character: charAtQiSensing, runSeed: 1, region: 'yellow_plains', year: 1000, birthYear: 1000, season: 'summer' }),
      deathCause: 'old_age' as const,
    };
    const result = runBardoFlow(rs, createEmptyMetaState(), 1.0, EMPTY_REG);
    expect(result.summary.maxRealm).toBe(Realm.QI_SENSING);
  });

  it('emits birthYear and deathYear on the new lineage entry', () => {
    const c = createCharacter({
      name: 'Ancient One',
      attributes: { Body: 20, Mind: 10, Spirit: 10, Agility: 10, Charm: 10, Luck: 20 },
      rng: createRng(1),
      startingAgeDays: 30 * 365,
    });
    const rs = {
      ...createRunState({
        character: c, runSeed: 1, region: 'yellow_plains',
        year: 980, birthYear: 950, season: 'summer',
      }),
      deathCause: 'old_age' as const,
    };
    const meta = createEmptyMetaState();
    const result = runBardoFlow(rs, meta, 1.0, EMPTY_REG);
    const entry = result.meta.lineage[result.meta.lineage.length - 1]!;
    expect(entry.birthYear).toBe(950);
    expect(entry.deathYear).toBe(980);
    expect(entry.yearsLived).toBe(30);
  });
});

describe('Phase 2B-3: lineage entry captures corePath + techniquesLearned', () => {
  it('writes character.corePath and runState.learnedTechniques into the new lineage entry', () => {
    const c = createCharacter({
      name: 'Iron Seeker',
      attributes: { Body: 20, Mind: 10, Spirit: 10, Agility: 10, Charm: 10, Luck: 20 },
      rng: createRng(1),
      startingAgeDays: 30 * 365,
    });
    const charWithCorePath = { ...c, corePath: 'iron_mountain' as const };
    const rs = {
      ...createRunState({ character: charWithCorePath, runSeed: 1, region: 'yellow_plains', year: 1000, birthYear: 1000, season: 'summer' }),
      deathCause: 'old_age' as const,
      learnedTechniques: ['iron_mountain_body_seal'],
    };
    const meta = createEmptyMetaState();
    const result = runBardoFlow(rs, meta, 1.0, EMPTY_REG);
    const entry = result.meta.lineage[result.meta.lineage.length - 1]!;
    expect(entry.corePath).toBe('iron_mountain');
    expect(entry.techniquesLearned).toEqual(['iron_mountain_body_seal']);
  });
});

function makeRunStateDyingAt(opts: {
  bodyTemperingLayer?: number;
  deathCause: DeathCause;
}): RunState {
  const character = createCharacter({
    name: 'Test',
    attributes: { Body: 10, Mind: 10, Spirit: 10, Agility: 10, Charm: 10, Luck: 10 },
    rng: createRng(1),
  });
  const withLayer = {
    ...character,
    bodyTemperingLayer: opts.bodyTemperingLayer ?? 0,
    flags: [...character.flags, 'anchor:peasant_farmer'],
  };
  const rs = createRunState({
    character: withLayer, runSeed: 1, region: 'yellow_plains',
    year: 1000, birthYear: 1000, season: 'spring',
  });
  return { ...rs, deathCause: opts.deathCause };
}

describe('runBardoFlow — Phase 2A-2 integration', () => {
  const ironBody: SoulEcho = {
    id: 'iron_body', name: 'Iron Body', description: '',
    tier: 'fragment',
    unlockCondition: { kind: 'reach_realm', realm: 'body_tempering', sublayer: 5 },
    effects: [], conflicts: [], reveal: 'birth',
  };

  it('unlocks iron_body and writes it into meta.echoesUnlocked on death at BT5+', () => {
    const reg = EchoRegistry.fromList([ironBody]);
    const meta = createEmptyMetaState();
    const rs = makeRunStateDyingAt({ bodyTemperingLayer: 5, deathCause: 'starvation' });
    const result = runBardoFlow(rs, meta, 1.0, reg);
    expect(result.meta.echoesUnlocked).toContain('iron_body');
  });

  it('annotates the lineage entry with echoesUnlockedThisLife', () => {
    const reg = EchoRegistry.fromList([ironBody]);
    const meta = createEmptyMetaState();
    const rs = makeRunStateDyingAt({ bodyTemperingLayer: 5, deathCause: 'starvation' });
    const result = runBardoFlow(rs, meta, 1.0, reg);
    const lastEntry = result.meta.lineage[result.meta.lineage.length - 1]!;
    expect(lastEntry.echoesUnlockedThisLife).toContain('iron_body');
  });

  it('commits witnessed memories to meta.memoriesWitnessed', () => {
    const reg = EchoRegistry.fromList([]);
    const meta = createEmptyMetaState();
    const rs = {
      ...makeRunStateDyingAt({ deathCause: 'starvation' }),
      memoriesWitnessedThisLife: ['frost_palm_severing', 'silent_waters_scripture'],
    };
    const result = runBardoFlow(rs, meta, 1.0, reg);
    expect(result.meta.memoriesWitnessed.frost_palm_severing).toBe(1);
    expect(result.meta.memoriesWitnessed.silent_waters_scripture).toBe(1);
  });

  it('does not re-unlock echoes already in meta.echoesUnlocked', () => {
    const reg = EchoRegistry.fromList([ironBody]);
    const meta = { ...createEmptyMetaState(), echoesUnlocked: ['iron_body'] };
    const rs = makeRunStateDyingAt({ bodyTemperingLayer: 5, deathCause: 'starvation' });
    const result = runBardoFlow(rs, meta, 1.0, reg);
    expect(result.meta.echoesUnlocked.filter((id) => id === 'iron_body')).toHaveLength(1);
    const lastEntry = result.meta.lineage[result.meta.lineage.length - 1]!;
    expect(lastEntry.echoesUnlockedThisLife).not.toContain('iron_body');
  });

  it('appends martial_family to meta.unlockedAnchors when BT layer 5+', () => {
    const rs = makeRunStateDyingAt({ bodyTemperingLayer: 5, deathCause: 'starvation' });
    const meta = createEmptyMetaState();
    const result = runBardoFlow(rs, meta, 1.0, EMPTY_REG);
    expect(result.meta.unlockedAnchors).toContain('martial_family');
  });

  it('exposes freshlyUnlockedAnchors on the bardo result', () => {
    const rs = makeRunStateDyingAt({ bodyTemperingLayer: 5, deathCause: 'starvation' });
    const meta = createEmptyMetaState();
    const result = runBardoFlow(rs, meta, 1.0, EMPTY_REG);
    expect(result.freshlyUnlockedAnchors).toContain('martial_family');
  });
});
