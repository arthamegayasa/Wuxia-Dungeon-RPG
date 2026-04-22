// Old-age death probability. Source: docs/spec/design.md §4.8.

import { IRng } from '@/engine/core/RNG';
import { Character } from '@/engine/character/Character';
import { lifespanCapDays } from './RealmMeta';

const OLD_AGE_THRESHOLD = 0.85;    // % of lifespan cap
const PER_YEAR_HAZARD = 0.05;      // 5% cumulative hazard per year past onset

export function isInOldAge(c: Character): boolean {
  const cap = lifespanCapDays(c.realm);
  if (cap === Number.POSITIVE_INFINITY) return false;
  return c.ageDays > cap * OLD_AGE_THRESHOLD;
}

export function oldAgeDeathChance(c: Character): number {
  if (!isInOldAge(c)) return 0;
  const cap = lifespanCapDays(c.realm);
  const onset = cap * OLD_AGE_THRESHOLD;
  const yearsPastOnset = (c.ageDays - onset) / 365;
  // 1 - (1 - 0.05)^years
  const chance = 1 - Math.pow(1 - PER_YEAR_HAZARD, yearsPastOnset);
  return Math.min(1, Math.max(0, chance));
}

export function rollOldAgeDeath(c: Character, rng: IRng): boolean {
  const chance = oldAgeDeathChance(c);
  if (chance <= 0) return false;
  if (chance >= 1) return true;
  return rng.next() < chance;
}
