// Per-life karma-earn rules. Source: docs/spec/design.md §7.1.

import { DeathCause, Realm, REALM_ORDER } from '@/engine/core/Types';

export interface LifeSummary {
  yearsLived: number;
  realmReached: Realm;
  maxBodyTemperingLayer: number;
  /** Highest realm reached this life (e.g., 'qi_sensing' if the character awakened, 'body_tempering' otherwise). */
  maxRealm: Realm;
  deathCause: DeathCause;
  vowsUnfulfilled: number;
  diedProtectingOther: boolean;
  firstTimeFlags: ReadonlyArray<string>;
  anchorMultiplier: number;
  /** Mid-life karma deltas from outcomes (can be negative). Applied AFTER anchor multiplier. */
  inLifeKarmaDelta: number;
}

export interface KarmaBreakdown {
  base: number;
  yearsLived: number;
  realm: number;
  deathCause: number;
  vows: number;
  diedProtecting: number;
  achievements: number;
  beforeMultiplier: number;
  multiplier: number;
  afterMultiplier: number;
  inLifeDelta: number;
  total: number;
}

export interface KarmaResult {
  total: number;
  breakdown: KarmaBreakdown;
}

const DEATH_CAUSE_KARMA: Partial<Record<DeathCause, number>> = {
  old_age: 5,
  starvation: 2,
  disease: 2,
  combat_melee: 10,
  combat_qi: 12,
  poison: 8,
  betrayal: 20,
  tribulation: 40,
  qi_deviation: 15,
  heavenly_intervention: 50,
  karmic_hunter: 30,
  self_sacrifice: 30,
  love_death: 25,
  madness: 10,
};

const DIED_PROTECTING_BONUS = 30;
const VOW_BONUS_EACH = 15;
const ACHIEVEMENT_BONUS_EACH = 5;

export function computeKarma(s: LifeSummary): KarmaResult {
  const yearsKarma = Math.floor(s.yearsLived / 10);

  const realmIndex = REALM_ORDER.indexOf(s.realmReached);
  // Spec §7.1: "+10 × realm index (per realm)" — cumulative over realms entered.
  // Closed form of sum(i × 10 for i in 1..N) where N = realmIndex.
  const realmKarma = realmIndex > 0 ? 5 * realmIndex * (realmIndex + 1) : 0;

  const deathKarma = s.diedProtectingOther
    ? DIED_PROTECTING_BONUS
    : (DEATH_CAUSE_KARMA[s.deathCause] ?? 0);

  const vowsKarma = s.vowsUnfulfilled * VOW_BONUS_EACH;

  const achievementKarma = s.firstTimeFlags.length * ACHIEVEMENT_BONUS_EACH;

  const diedProtectingKarma = s.diedProtectingOther ? DIED_PROTECTING_BONUS : 0;

  // `deathKarma` already includes DIED_PROTECTING_BONUS if active — avoid double-count.
  const beforeMult = yearsKarma + realmKarma + deathKarma + vowsKarma + achievementKarma;

  const afterMult = Math.floor(beforeMult * s.anchorMultiplier);
  const final = afterMult + s.inLifeKarmaDelta;
  const total = Math.max(0, final);

  return {
    total,
    breakdown: {
      base: 0,
      yearsLived: yearsKarma,
      realm: realmKarma,
      deathCause: s.diedProtectingOther ? 0 : (DEATH_CAUSE_KARMA[s.deathCause] ?? 0),
      vows: vowsKarma,
      diedProtecting: diedProtectingKarma,
      achievements: achievementKarma,
      beforeMultiplier: beforeMult,
      multiplier: s.anchorMultiplier,
      afterMultiplier: afterMult,
      inLifeDelta: s.inLifeKarmaDelta,
      total,
    },
  };
}
