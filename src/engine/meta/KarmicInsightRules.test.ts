import { describe, it, expect } from 'vitest';
import { Realm } from '@/engine/core/Types';
import { computeKarma, LifeSummary } from './KarmicInsightRules';

function baseSummary(overrides: Partial<LifeSummary> = {}): LifeSummary {
  return {
    yearsLived: 40,
    realmReached: Realm.MORTAL,
    maxBodyTemperingLayer: 0,
    maxRealm: Realm.MORTAL,
    deathCause: 'old_age',
    vowsUnfulfilled: 0,
    diedProtectingOther: false,
    firstTimeFlags: [],
    anchorMultiplier: 1.0,
    inLifeKarmaDelta: 0,
    ...overrides,
  };
}

describe('computeKarma', () => {
  it('gives +1 per 10 years lived', () => {
    expect(computeKarma(baseSummary({ yearsLived: 0 })).total).toBe(5);    // old_age base: 5
    expect(computeKarma(baseSummary({ yearsLived: 30 })).total).toBe(5 + 3);
    expect(computeKarma(baseSummary({ yearsLived: 100 })).total).toBe(5 + 10);
  });

  it('old_age death: +5 base', () => {
    expect(computeKarma(baseSummary({ yearsLived: 0, deathCause: 'old_age' })).total).toBe(5);
  });

  it('tribulation death: +40', () => {
    expect(computeKarma(baseSummary({ yearsLived: 0, deathCause: 'tribulation' })).total).toBe(40);
  });

  it('betrayal death: +20', () => {
    expect(computeKarma(baseSummary({ yearsLived: 0, deathCause: 'betrayal' })).total).toBe(20);
  });

  it('death protecting other: +30', () => {
    expect(computeKarma(baseSummary({
      yearsLived: 0, deathCause: 'combat_melee', diedProtectingOther: true,
    })).total).toBe(30);
  });

  it('reaching a realm adds 10 × realm-index per realm entered', () => {
    // realmReached = body_tempering → index 1 → +10
    expect(computeKarma(baseSummary({ yearsLived: 0, realmReached: Realm.BODY_TEMPERING })).total)
      .toBe(5 /* old_age */ + 10 /* realm 1 */);
  });

  it('realm karma is cumulative — sum of (index × 10) for each realm entered', () => {
    // realmIndex 2 (QI_SENSING) → 10 + 20 = 30
    const r2 = computeKarma(baseSummary({
      yearsLived: 0, deathCause: 'old_age',
      realmReached: Realm.QI_SENSING,
    }));
    expect(r2.breakdown.realm).toBe(30);
    expect(r2.total).toBe(5 /* old_age */ + 30 /* cumulative realm */);

    // realmIndex 3 (QI_CONDENSATION) → 10 + 20 + 30 = 60
    const r3 = computeKarma(baseSummary({
      yearsLived: 0, deathCause: 'old_age',
      realmReached: Realm.QI_CONDENSATION,
    }));
    expect(r3.breakdown.realm).toBe(60);

    // realmIndex 4 (FOUNDATION) → 10 + 20 + 30 + 40 = 100
    const r4 = computeKarma(baseSummary({
      yearsLived: 0, deathCause: 'old_age',
      realmReached: Realm.FOUNDATION,
    }));
    expect(r4.breakdown.realm).toBe(100);
  });

  it('unfulfilled vows: +15 each', () => {
    expect(computeKarma(baseSummary({ yearsLived: 0, vowsUnfulfilled: 2 })).total).toBe(5 + 30);
  });

  it('anchorMultiplier scales the TOTAL', () => {
    const base = computeKarma(baseSummary({ yearsLived: 40, deathCause: 'old_age' })).total;
    // yearsLived 40 → +4. old_age +5. total 9. × 1.5 = 13.5 → floor to 13.
    const mult = computeKarma(baseSummary({ yearsLived: 40, deathCause: 'old_age', anchorMultiplier: 1.5 })).total;
    expect(mult).toBe(Math.floor(base * 1.5));
  });

  it('inLifeKarmaDelta is added AFTER multiplication', () => {
    // Base: yearsLived=0, old_age=5, mult=2.0 → 10. Plus inLifeKarmaDelta=-3 → 7.
    const r = computeKarma(baseSummary({
      yearsLived: 0, deathCause: 'old_age', anchorMultiplier: 2.0, inLifeKarmaDelta: -3,
    }));
    expect(r.total).toBe(7);
  });

  it('never returns negative karma', () => {
    const r = computeKarma(baseSummary({
      yearsLived: 0, deathCause: 'old_age', anchorMultiplier: 1.0, inLifeKarmaDelta: -1000,
    }));
    expect(r.total).toBe(0);
  });

  it('firstTimeFlags add +5 each for "achievement" tagged ones', () => {
    const r = computeKarma(baseSummary({
      firstTimeFlags: ['first_body_tempering_5', 'first_bandit_defeated'],
    }));
    expect(r.breakdown.achievements).toBe(10);
  });
});

describe('LifeSummary.maxRealm field (Phase 2B-2 Task 8)', () => {
  it('LifeSummary type accepts maxRealm field', () => {
    const s: LifeSummary = baseSummary({ maxRealm: Realm.QI_SENSING });
    expect(s.maxRealm).toBe(Realm.QI_SENSING);
  });

  it('maxRealm defaults to mortal in baseSummary helper', () => {
    const s = baseSummary();
    expect(s.maxRealm).toBe(Realm.MORTAL);
  });
});
