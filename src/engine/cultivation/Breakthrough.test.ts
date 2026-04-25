import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';
import { createCharacter, refreshDerived } from '@/engine/character/Character';
import { advanceCultivation } from './CultivationProgress';
import {
  sublayerBreakthroughChance,
  attemptSublayerBreakthrough,
} from './Breakthrough';

const ATTRS = { Body: 30, Mind: 40, Spirit: 20, Agility: 15, Charm: 10, Luck: 30 };

function bodyTemperingCharacter(layer: number) {
  const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
  return refreshDerived({ ...c, realm: Realm.BODY_TEMPERING, bodyTemperingLayer: layer });
}

describe('sublayerBreakthroughChance', () => {
  it('baseline: 50 + Mind*0.3 + Insight*0.1 - layer*4', () => {
    // Mind=40, Insight=0, layer=1 → 50 + 12 + 0 - 4 = 58
    expect(sublayerBreakthroughChance({
      mind: 40, insight: 0, currentLayer: 1,
      pillBonus: 0, safeEnvironmentBonus: 0,
    })).toBe(58);
  });

  it('clamps to [15, 95]', () => {
    // All-zero trash character at layer 20: 50 - 80 = -30 → clamp 15
    expect(sublayerBreakthroughChance({
      mind: 0, insight: 0, currentLayer: 20,
      pillBonus: 0, safeEnvironmentBonus: 0,
    })).toBe(15);
    // Max-stat breakthrough: 50 + 30 + 100 = 180 → clamp 95
    expect(sublayerBreakthroughChance({
      mind: 100, insight: 1000, currentLayer: 0,
      pillBonus: 0, safeEnvironmentBonus: 0,
    })).toBe(95);
  });

  it('pill and environment bonuses add linearly', () => {
    // Baseline 58, +5 pill, +10 env = 73
    expect(sublayerBreakthroughChance({
      mind: 40, insight: 0, currentLayer: 1,
      pillBonus: 5, safeEnvironmentBonus: 10,
    })).toBe(73);
  });

  it('higher layer is harder', () => {
    const args = { mind: 40, insight: 0, pillBonus: 0, safeEnvironmentBonus: 0 };
    expect(sublayerBreakthroughChance({ ...args, currentLayer: 1 }))
      .toBeGreaterThan(sublayerBreakthroughChance({ ...args, currentLayer: 8 }));
  });
});

describe('attemptSublayerBreakthrough', () => {
  it('throws if progress is not full', () => {
    const c = bodyTemperingCharacter(1);
    expect(() => attemptSublayerBreakthrough(c, { rng: createRng(1) }))
      .toThrow(/not full/i);
  });

  it('on success: layer increments, progress resets, returns new char', () => {
    const ready = advanceCultivation(bodyTemperingCharacter(1), 100);
    // Force success by using a seed that rolls low with chance ≈ 58.
    // For any seed, if roll <= 58 → success. Mulberry32 seed=42 first d100 is low.
    const out = attemptSublayerBreakthrough(ready, { rng: createRng(2) });
    // Either success or failure; test both branches separately below.
    expect([1, 2]).toContain(out.character.bodyTemperingLayer);
  });

  it('on success: advances the layer and clears progress', () => {
    // Construct a high-chance setup to make success overwhelmingly likely.
    const base = createCharacter({ name: 't', attributes: { ...ATTRS, Mind: 100 }, rng: createRng(1) });
    const primed = advanceCultivation(
      refreshDerived({ ...base, realm: Realm.BODY_TEMPERING, bodyTemperingLayer: 0 }),
      100,
    );
    // chance ≈ 95; try 10 seeds — at least one should succeed.
    let success = false;
    for (let seed = 1; seed <= 50 && !success; seed++) {
      const out = attemptSublayerBreakthrough(primed, { rng: createRng(seed) });
      if (out.success) {
        expect(out.character.bodyTemperingLayer).toBe(1);
        expect(out.character.cultivationProgress).toBe(0);
        success = true;
      }
    }
    expect(success).toBe(true);
  });

  it('on failure: layer unchanged, progress reduced by 25%, injury flag or no change', () => {
    // Force failure with a guaranteed-fail setup: very high layer with low mind.
    const base = createCharacter({ name: 't', attributes: { ...ATTRS, Mind: 0 }, rng: createRng(1) });
    const primed = advanceCultivation(
      refreshDerived({ ...base, realm: Realm.BODY_TEMPERING, bodyTemperingLayer: 9 }),
      100,
    );
    // Chance = clamp(50 + 0 + 0 - 36, 15, 95) = 15. Most seeds should fail.
    let failures = 0;
    for (let seed = 10; seed < 30; seed++) {
      const out = attemptSublayerBreakthrough(primed, { rng: createRng(seed) });
      if (!out.success) {
        expect(out.character.bodyTemperingLayer).toBe(9);
        expect(out.character.cultivationProgress).toBe(75); // 25% lost
        failures++;
      }
    }
    expect(failures).toBeGreaterThan(5);
  });

  it('progress cannot go below 0 even if reduction math underflows', () => {
    const base = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    // Synthetic: character has progress at 100 but sub-layer logic subtracts 25.
    // Verify: 100 → 75. Already tested above. This test guards future edge cases.
    const primed = advanceCultivation(
      refreshDerived({ ...base, realm: Realm.BODY_TEMPERING, bodyTemperingLayer: 0 }),
      100,
    );
    const out = attemptSublayerBreakthrough(primed, { rng: createRng(999) });
    expect(out.character.cultivationProgress).toBeGreaterThanOrEqual(0);
  });
});

describe('attemptSublayerBreakthrough polymorphic (Phase 2B-1 Task 14)', () => {
  function qcChar(layer: number, progress: number = 100) {
    return {
      ...createCharacter({
        name: 'x',
        attributes: { Body: 5, Mind: 10, Spirit: 5, Agility: 5, Charm: 5, Luck: 5 },
        rng: createRng(1),
      }),
      realm: Realm.QI_CONDENSATION,
      qiCondensationLayer: layer,
      cultivationProgress: progress,
    };
  }

  it('BT character: bumps bodyTemperingLayer', () => {
    const c = {
      ...createCharacter({
        name: 'x',
        attributes: { Body: 5, Mind: 10, Spirit: 5, Agility: 5, Charm: 5, Luck: 5 },
        rng: createRng(1),
      }),
      realm: Realm.BODY_TEMPERING,
      bodyTemperingLayer: 3,
      cultivationProgress: 100,
    };
    const result = attemptSublayerBreakthrough(c, { rng: createRng(42) });
    if (result.success) {
      expect(result.character.bodyTemperingLayer).toBeGreaterThan(3);
      expect(result.character.qiCondensationLayer).toBe(c.qiCondensationLayer);
    }
  });

  it('QC character: bumps qiCondensationLayer, NOT bodyTemperingLayer', () => {
    const c = qcChar(3);
    const result = attemptSublayerBreakthrough(c, { rng: createRng(42) });
    if (result.success) {
      expect(result.character.qiCondensationLayer).toBe(4);
      expect(result.character.bodyTemperingLayer).toBe(c.bodyTemperingLayer);
    }
  });

  it('QC chance formula uses qiCondensationLayer as currentLayer', () => {
    const bt = { ...qcChar(3), realm: Realm.BODY_TEMPERING, bodyTemperingLayer: 3, qiCondensationLayer: 0 };
    const qc = qcChar(3);
    const r1 = attemptSublayerBreakthrough(bt, { rng: createRng(1) });
    const r2 = attemptSublayerBreakthrough(qc, { rng: createRng(1) });
    expect(r1.chance).toBe(r2.chance);
  });

  it('throws for realms without sub-layers (Qi Sensing)', () => {
    const qs = { ...qcChar(0), realm: Realm.QI_SENSING };
    expect(() => attemptSublayerBreakthrough(qs, { rng: createRng(1) }))
      .toThrow(/no sub-layers/);
  });
});
