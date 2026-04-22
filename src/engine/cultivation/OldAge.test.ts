import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';
import { createCharacter, refreshDerived } from '@/engine/character/Character';
import {
  isInOldAge,
  oldAgeDeathChance,
  rollOldAgeDeath,
} from './OldAge';

function mortalAged(days: number) {
  const c = createCharacter({ name: 't', attributes: { Body: 20, Mind: 20, Spirit: 10, Agility: 10, Charm: 10, Luck: 30 }, rng: createRng(1) });
  return refreshDerived({ ...c, ageDays: days });
}

describe('isInOldAge', () => {
  it('false below 85% of lifespan', () => {
    // Mortal lifespan = 60 years = 21,900 days. 85% = 18,615.
    expect(isInOldAge(mortalAged(18_000))).toBe(false);
    expect(isInOldAge(mortalAged(18_615))).toBe(false);
  });

  it('true above 85% of lifespan', () => {
    expect(isInOldAge(mortalAged(18_616))).toBe(true);
    expect(isInOldAge(mortalAged(21_900))).toBe(true);
    expect(isInOldAge(mortalAged(22_000))).toBe(true);
  });

  it('Immortal is never in old age', () => {
    const c = createCharacter({ name: 't', attributes: { Body: 20, Mind: 20, Spirit: 10, Agility: 10, Charm: 10, Luck: 30 }, rng: createRng(1) });
    const immortal = refreshDerived({ ...c, realm: Realm.IMMORTAL, ageDays: 1_000_000 });
    expect(isInOldAge(immortal)).toBe(false);
  });
});

describe('oldAgeDeathChance', () => {
  it('returns 0 when not in old age', () => {
    expect(oldAgeDeathChance(mortalAged(10_000))).toBe(0);
  });

  it('rises with years since old-age onset — 1 year ≈ 0.05', () => {
    // onset at 18,615 days. 1 year in = 18,615 + 365 = 18,980
    const c = mortalAged(18_980);
    const chance = oldAgeDeathChance(c);
    // 1 - 0.95^1 = 0.05
    expect(chance).toBeCloseTo(0.05, 2);
  });

  it('after 10 years ≈ 0.401', () => {
    // 18,615 + 3,650 = 22,265 (past the 60-year cap; still valid for formula)
    const c = mortalAged(22_265);
    const chance = oldAgeDeathChance(c);
    expect(chance).toBeCloseTo(0.4013, 3);
  });

  it('caps at 1.0', () => {
    expect(oldAgeDeathChance(mortalAged(1_000_000))).toBe(1);
  });
});

describe('rollOldAgeDeath', () => {
  it('never fires when not in old age', () => {
    const c = mortalAged(10_000);
    for (let seed = 1; seed < 100; seed++) {
      expect(rollOldAgeDeath(c, createRng(seed))).toBe(false);
    }
  });

  it('always fires at saturation (chance 1.0)', () => {
    const c = mortalAged(1_000_000);
    for (let seed = 1; seed < 20; seed++) {
      expect(rollOldAgeDeath(c, createRng(seed))).toBe(true);
    }
  });

  it('empirical distribution matches the chance around 1 year in', () => {
    const c = mortalAged(18_980); // ~5% chance
    let deaths = 0;
    const N = 5_000;
    for (let seed = 1; seed <= N; seed++) {
      if (rollOldAgeDeath(c, createRng(seed))) deaths++;
    }
    const p = deaths / N;
    expect(p).toBeGreaterThan(0.03);
    expect(p).toBeLessThan(0.07);
  });
});
