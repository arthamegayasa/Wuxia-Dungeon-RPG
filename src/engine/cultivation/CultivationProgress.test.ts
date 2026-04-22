import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createCharacter } from '@/engine/character/Character';
import {
  advanceCultivation,
  isSubLayerFull,
  cultivationGainRate,
} from './CultivationProgress';

const ATTRS = { Body: 30, Mind: 20, Spirit: 20, Agility: 15, Charm: 10, Luck: 30 };

describe('cultivationGainRate', () => {
  it('zero when rootMultiplier is zero (no spirit root)', () => {
    expect(cultivationGainRate({
      baseRate: 1, rootMultiplier: 0, environmentDensity: 1,
      techniqueMultiplier: 1, openMeridianBonus: 0, anchorFocusBonus: 1, noticeMalice: 1,
    })).toBe(0);
  });

  it('baseline: base × root × env × tech × (1+bonus) × anchor × malice', () => {
    const rate = cultivationGainRate({
      baseRate: 2, rootMultiplier: 1.0, environmentDensity: 1.5,
      techniqueMultiplier: 1.0, openMeridianBonus: 0.2, anchorFocusBonus: 1.0, noticeMalice: 1.0,
    });
    // 2 * 1 * 1.5 * 1 * 1.2 * 1 * 1 = 3.6
    expect(rate).toBeCloseTo(3.6, 5);
  });

  it('noticeMalice < 1 reduces rate', () => {
    const rate = cultivationGainRate({
      baseRate: 2, rootMultiplier: 1.0, environmentDensity: 1.0,
      techniqueMultiplier: 1.0, openMeridianBonus: 0, anchorFocusBonus: 1.0, noticeMalice: 0.5,
    });
    expect(rate).toBe(1);
  });
});

describe('advanceCultivation', () => {
  it('adds to progress, clamping at 100 per sub-layer', () => {
    const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    const after = advanceCultivation(c, 30);
    expect(after.cultivationProgress).toBe(30);

    const overflowed = advanceCultivation(after, 200);
    expect(overflowed.cultivationProgress).toBe(100);
  });

  it('rejects negative amounts', () => {
    const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    expect(() => advanceCultivation(c, -1)).toThrow(/non-negative/i);
  });

  it('is pure — returns new character', () => {
    const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    const after = advanceCultivation(c, 10);
    expect(after).not.toBe(c);
    expect(c.cultivationProgress).toBe(0);
  });
});

describe('isSubLayerFull', () => {
  it('false at 0, false at 99, true at 100', () => {
    const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    expect(isSubLayerFull(c)).toBe(false);
    const near = advanceCultivation(c, 99);
    expect(isSubLayerFull(near)).toBe(false);
    const full = advanceCultivation(c, 100);
    expect(isSubLayerFull(full)).toBe(true);
  });
});
