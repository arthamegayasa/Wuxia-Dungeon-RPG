import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';
import { createCharacter, refreshDerived, withFlag } from '@/engine/character/Character';
import { ConditionSet } from '@/content/schema';
import { evaluateConditions, EvalContext } from './ConditionEvaluator';

const ATTRS = { Body: 20, Mind: 15, Spirit: 10, Agility: 12, Charm: 8, Luck: 30 };

function ctx(overrides: Partial<EvalContext> = {}): EvalContext {
  const base = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
  return {
    character: base,
    worldFlags: [],
    region: 'yellow_plains',
    locale: 'unnamed',
    year: 1000,
    season: 'summer',
    heavenlyNotice: 0,
    ageYears: 0,
    ...overrides,
  };
}

describe('evaluateConditions', () => {
  it('empty conditions are always true', () => {
    expect(evaluateConditions({}, ctx())).toBe(true);
  });

  it('minAge / maxAge gate on ageYears', () => {
    expect(evaluateConditions({ minAge: 10 }, ctx({ ageYears: 5 }))).toBe(false);
    expect(evaluateConditions({ minAge: 10 }, ctx({ ageYears: 10 }))).toBe(true);
    expect(evaluateConditions({ maxAge: 20 }, ctx({ ageYears: 25 }))).toBe(false);
    expect(evaluateConditions({ maxAge: 20 }, ctx({ ageYears: 20 }))).toBe(true);
  });

  it('regions filter is OR: ctx.region must match one', () => {
    expect(evaluateConditions({ regions: ['yellow_plains'] }, ctx({ region: 'yellow_plains' }))).toBe(true);
    expect(evaluateConditions({ regions: ['azure_peaks'] }, ctx({ region: 'yellow_plains' }))).toBe(false);
    expect(evaluateConditions({ regions: ['yellow_plains', 'azure_peaks'] }, ctx({ region: 'yellow_plains' }))).toBe(true);
  });

  it('realms filter', () => {
    expect(evaluateConditions({ realms: ['mortal'] }, ctx())).toBe(true);
    const bt = refreshDerived({ ...ctx().character, realm: Realm.BODY_TEMPERING, bodyTemperingLayer: 1 });
    expect(evaluateConditions({ realms: ['mortal'] }, ctx({ character: bt }))).toBe(false);
    expect(evaluateConditions({ realms: ['mortal', 'body_tempering'] }, ctx({ character: bt }))).toBe(true);
  });

  it('seasons filter', () => {
    expect(evaluateConditions({ seasons: ['summer'] }, ctx({ season: 'summer' }))).toBe(true);
    expect(evaluateConditions({ seasons: ['winter'] }, ctx({ season: 'summer' }))).toBe(false);
  });

  it('worldFlags.require matches by intersection', () => {
    expect(evaluateConditions(
      { worldFlags: { require: ['drought_active'] } },
      ctx({ worldFlags: ['drought_active', 'war_in_south'] })
    )).toBe(true);

    expect(evaluateConditions(
      { worldFlags: { require: ['drought_active'] } },
      ctx({ worldFlags: ['war_in_south'] })
    )).toBe(false);
  });

  it('worldFlags.exclude rejects when any excluded flag is present', () => {
    expect(evaluateConditions(
      { worldFlags: { exclude: ['drought_active'] } },
      ctx({ worldFlags: ['drought_active'] })
    )).toBe(false);

    expect(evaluateConditions(
      { worldFlags: { exclude: ['drought_active'] } },
      ctx({ worldFlags: [] })
    )).toBe(true);
  });

  it('characterFlags.require and exclude use character.flags', () => {
    const c0 = ctx().character;
    const c1 = withFlag(c0, 'stole_from_monk');
    expect(evaluateConditions(
      { characterFlags: { exclude: ['stole_from_monk'] } },
      ctx({ character: c1 })
    )).toBe(false);

    expect(evaluateConditions(
      { characterFlags: { require: ['met_master'] } },
      ctx({ character: c1 })
    )).toBe(false);
  });

  it('minStat and maxStat gate on character attributes', () => {
    expect(evaluateConditions(
      { minStat: { Body: 30 } as any },
      ctx() // Body 20
    )).toBe(false);

    expect(evaluateConditions(
      { minStat: { Body: 10 } as any },
      ctx()
    )).toBe(true);

    expect(evaluateConditions(
      { maxStat: { Charm: 5 } as any },
      ctx() // Charm 8
    )).toBe(false);
  });

  it('notice thresholds', () => {
    expect(evaluateConditions({ minNotice: 20 }, ctx({ heavenlyNotice: 10 }))).toBe(false);
    expect(evaluateConditions({ minNotice: 20 }, ctx({ heavenlyNotice: 30 }))).toBe(true);
    expect(evaluateConditions({ maxNotice: 50 }, ctx({ heavenlyNotice: 60 }))).toBe(false);
  });

  it('era range', () => {
    expect(evaluateConditions({ era: { minYear: 500, maxYear: 900 } }, ctx({ year: 700 }))).toBe(true);
    expect(evaluateConditions({ era: { minYear: 500, maxYear: 900 } }, ctx({ year: 300 }))).toBe(false);
    expect(evaluateConditions({ era: { minYear: 500, maxYear: 900 } }, ctx({ year: 1000 }))).toBe(false);
  });

  it('combines multiple conditions with AND', () => {
    const cs: ConditionSet = {
      minAge: 10, maxAge: 50,
      regions: ['yellow_plains'],
      realms: ['mortal'],
    };
    expect(evaluateConditions(cs, ctx({ ageYears: 20 }))).toBe(true);
    expect(evaluateConditions(cs, ctx({ ageYears: 60 }))).toBe(false);
    expect(evaluateConditions(cs, ctx({ ageYears: 20, region: 'azure_peaks' }))).toBe(false);
  });

  it('unknown customPredicate returns false (fail-closed)', () => {
    // Phase 2B-2: registry now consulted, but unknown names still fail closed.
    expect(evaluateConditions({ customPredicate: 'some_unknown_predicate_xyz' }, ctx())).toBe(false);
  });

  it('known customPredicate is evaluated: bt9_cultivation_full returns false for mortal realm', () => {
    // mortal realm → bt9_cultivation_full should be false (realm mismatch)
    expect(evaluateConditions({ customPredicate: 'bt9_cultivation_full' }, ctx())).toBe(false);
  });

  it('ignores undefined values in minStat / maxStat records (zod v4 emits all enum keys)', () => {
    // Simulate zod v4 parsed output: all 6 stat keys present, only one defined.
    // Safety guard: undefined values must NOT falsely fail the condition.
    const minStat = { Body: 10, Mind: undefined, Spirit: undefined, Agility: undefined, Charm: undefined, Luck: undefined } as Record<string, number | undefined>;
    expect(evaluateConditions(
      { minStat: minStat as any },
      ctx() // Body 20 ≥ 10, all others should be skipped
    )).toBe(true);

    const maxStat = { Body: 5, Mind: undefined, Spirit: undefined, Agility: undefined, Charm: undefined, Luck: undefined } as Record<string, number | undefined>;
    expect(evaluateConditions(
      { maxStat: maxStat as any },
      ctx() // Body 20 > 5 → should reject
    )).toBe(false);
  });
});
