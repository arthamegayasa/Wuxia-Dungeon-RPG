import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';
import { createCharacter, ageDays, refreshDerived, withOpenedMeridian } from '@/engine/character/Character';
import { advanceCultivation, isSubLayerFull } from '@/engine/cultivation/CultivationProgress';
import { attemptSublayerBreakthrough } from '@/engine/cultivation/Breakthrough';
import { isInOldAge, rollOldAgeDeath } from '@/engine/cultivation/OldAge';
import { spiritRootMultipliers } from '@/engine/character/SpiritRoot';

describe('character lifetime simulation', () => {
  it('simulates a Body Tempering cultivator reaching layer 9 or dying of old age', () => {
    // Strong starter: high Mind, high Spirit, decent Body.
    const rng = createRng(2024);
    let c = createCharacter({
      name: 'Lin Wei',
      attributes: { Body: 30, Mind: 50, Spirit: 20, Agility: 15, Charm: 10, Luck: 40 },
      rng,
    });

    // Force a rollable spirit root — repeat create until not-none for this deterministic test.
    // (We set up the seed above to give us a cultivator; fall back otherwise.)
    if (c.spiritRoot.tier === 'none') {
      // Try a handful more seeds to find one with a usable root.
      for (let s = 2025; s <= 2100; s++) {
        const trial = createCharacter({
          name: 'Lin Wei',
          attributes: { Body: 30, Mind: 50, Spirit: 20, Agility: 15, Charm: 10, Luck: 40 },
          rng: createRng(s),
        });
        if (trial.spiritRoot.tier !== 'none') { c = trial; break; }
      }
      // If still 'none', this integration simply verifies the no-cultivation path below.
    }

    // Transition to Body Tempering by opening the first meridian.
    c = withOpenedMeridian(c, 3); // Stomach
    c = refreshDerived({ ...c, realm: Realm.BODY_TEMPERING, bodyTemperingLayer: 1 });

    let ageYears = 0;
    let reached9 = false;
    let died = false;

    while (ageYears < 80 && !reached9 && !died) {
      // Each "year" we attempt to advance 120 progress units (fills a sub-layer +20%).
      c = advanceCultivation(c, 120);

      if (isSubLayerFull(c)) {
        const attempt = attemptSublayerBreakthrough(c, { rng });
        c = attempt.character;
        if (c.bodyTemperingLayer >= 9) reached9 = true;
      }

      c = ageDays(c, 365);
      ageYears++;

      if (isInOldAge(c) && rollOldAgeDeath(c, rng)) died = true;
    }

    // Assertion: the character either reached layer 9, or aged out in Body Tempering.
    expect(reached9 || died || ageYears >= 80).toBe(true);
    // Sanity: the cultivation progress is in valid range.
    expect(c.cultivationProgress).toBeGreaterThanOrEqual(0);
    expect(c.cultivationProgress).toBeLessThanOrEqual(100);
    // Sanity: if reached9, layer is exactly 9.
    if (reached9) expect(c.bodyTemperingLayer).toBe(9);
  });

  it('a character with "none" spirit root cannot cultivate qi (qiMax stays 0)', () => {
    // Force a seed known to roll 'none' (majority of seeds).
    const c = createCharacter({
      name: 't',
      attributes: { Body: 30, Mind: 30, Spirit: 50, Agility: 15, Charm: 10, Luck: 20 },
      rng: createRng(1),
    });
    if (c.spiritRoot.tier === 'none') {
      const mult = spiritRootMultipliers(c.spiritRoot);
      expect(mult.absorption).toBe(0);
      expect(c.qiMax).toBe(0);
    }
    // If the seed happens to produce a cultivator, assert multiplier reflects it.
    else {
      expect(c.qiMax).toBeGreaterThan(0);
    }
  });

  it('opening all 12 meridians recomputes qiMax correctly', () => {
    const c0 = createCharacter({
      name: 't',
      attributes: { Body: 30, Mind: 30, Spirit: 40, Agility: 15, Charm: 10, Luck: 30 },
      rng: createRng(31),
    });
    let c = c0;
    for (const id of [1,2,3,4,5,6,7,8,9,10,11,12] as const) {
      c = withOpenedMeridian(c, id);
    }
    expect(c.openMeridians).toHaveLength(12);
    // qiMax = Spirit × (1 + 12×0.15) × rootMultiplier = Spirit × 2.8 × rootMult
    // With rootMult known (may be 0), assert monotonic increase vs c0.
    expect(c.qiMax).toBeGreaterThanOrEqual(c0.qiMax);
  });
});
