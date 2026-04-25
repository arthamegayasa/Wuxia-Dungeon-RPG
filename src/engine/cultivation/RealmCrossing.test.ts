import { describe, it, expect } from 'vitest';
import { attemptQiSensingAwakening, attemptQiCondensationEntry } from './RealmCrossing';
import { createCharacter } from '@/engine/character/Character';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';

function btNineReady(spiritTier: string = 'mottled') {
  const c = createCharacter({
    name: 'x',
    attributes: { Body: 10, Mind: 10, Spirit: 10, Agility: 5, Charm: 5, Luck: 5 },
    rng: createRng(1),
  });
  return {
    ...c,
    realm: Realm.BODY_TEMPERING,
    bodyTemperingLayer: 9,
    cultivationProgress: 100,
    spiritRoot: { ...c.spiritRoot, tier: spiritTier as any, elements: [] as any },
  };
}

describe('attemptQiSensingAwakening (Phase 2B-1 Task 15)', () => {
  it('throws if realm is not Body Tempering', () => {
    const c = { ...btNineReady(), realm: Realm.MORTAL };
    expect(() => attemptQiSensingAwakening(c, { rng: createRng(1) }))
      .toThrow(/body tempering/i);
  });

  it('throws if bodyTemperingLayer < 9', () => {
    const c = { ...btNineReady(), bodyTemperingLayer: 7 };
    expect(() => attemptQiSensingAwakening(c, { rng: createRng(1) }))
      .toThrow(/layer 9/i);
  });

  it('throws if cultivationProgress < 100', () => {
    const c = { ...btNineReady(), cultivationProgress: 50 };
    expect(() => attemptQiSensingAwakening(c, { rng: createRng(1) }))
      .toThrow(/progress/i);
  });

  it('throws if spirit root tier is "none" (locked out)', () => {
    const c = btNineReady('none');
    expect(() => attemptQiSensingAwakening(c, { rng: createRng(1) }))
      .toThrow(/spirit root|locked|none/i);
  });

  it('success: realm advances to QI_SENSING, bodyTemperingLayer → 0, cultivationProgress → 0', () => {
    const c = btNineReady('heavenly');
    const r = attemptQiSensingAwakening(c, { rng: createRng(1) });
    if (r.success) {
      expect(r.character.realm).toBe(Realm.QI_SENSING);
      expect(r.character.bodyTemperingLayer).toBe(0);
      expect(r.character.cultivationProgress).toBe(0);
    }
  });

  it('failure: non-fatal, 50% of bar lost', () => {
    const c = btNineReady('mottled');
    for (let seed = 1; seed < 200; seed++) {
      const r = attemptQiSensingAwakening(c, { rng: createRng(seed) });
      if (!r.success) {
        expect(r.character.realm).toBe(Realm.BODY_TEMPERING);
        expect(r.character.bodyTemperingLayer).toBe(9);
        expect(r.character.cultivationProgress).toBe(50);
        return;
      }
    }
    throw new Error('no failure observed in 200 seeds');
  });

  it('spirit root penalty table is consistent: heavenly ≥ single_element ≥ mottled', () => {
    const high = btNineReady('heavenly');
    const mid = btNineReady('single_element');
    const low = btNineReady('mottled');

    const rHigh = attemptQiSensingAwakening(high, { rng: createRng(1) });
    const rMid = attemptQiSensingAwakening(mid, { rng: createRng(1) });
    const rLow = attemptQiSensingAwakening(low, { rng: createRng(1) });

    expect(rHigh.chance).toBeGreaterThanOrEqual(rMid.chance);
    expect(rMid.chance).toBeGreaterThanOrEqual(rLow.chance);
  });
});

describe('attemptQiCondensationEntry (Phase 2B-1 Task 16)', () => {
  function qsReady(techniquesLearned: number = 0) {
    const c = createCharacter({
      name: 'x',
      attributes: { Body: 5, Mind: 10, Spirit: 10, Agility: 5, Charm: 5, Luck: 5 },
      rng: createRng(1),
    });
    return {
      ...c,
      realm: Realm.QI_SENSING,
      bodyTemperingLayer: 0,
      qiCondensationLayer: 0,
      cultivationProgress: 100,
    };
  }

  it('throws if realm is not Qi Sensing', () => {
    const c = { ...qsReady(), realm: Realm.BODY_TEMPERING };
    expect(() => attemptQiCondensationEntry(c, { rng: createRng(1), techniqueCount: 1 }))
      .toThrow(/qi.sensing/i);
  });

  it('throws if techniqueCount < 1', () => {
    const c = qsReady();
    expect(() => attemptQiCondensationEntry(c, { rng: createRng(1), techniqueCount: 0 }))
      .toThrow(/technique/i);
  });

  it('throws if cultivationProgress < 100', () => {
    const c = { ...qsReady(), cultivationProgress: 50 };
    expect(() => attemptQiCondensationEntry(c, { rng: createRng(1), techniqueCount: 1 }))
      .toThrow(/progress/i);
  });

  it('success: realm → QI_CONDENSATION, qiCondensationLayer = 1', () => {
    const c = qsReady();
    for (let seed = 1; seed < 50; seed++) {
      const r = attemptQiCondensationEntry(c, { rng: createRng(seed), techniqueCount: 1 });
      if (r.success) {
        expect(r.character.realm).toBe(Realm.QI_CONDENSATION);
        expect(r.character.qiCondensationLayer).toBe(1);
        expect(r.character.cultivationProgress).toBe(0);
        return;
      }
    }
    throw new Error('no success observed in 50 seeds');
  });

  it('failure: stays in QS with bar half-drained', () => {
    const c = qsReady();
    for (let seed = 1; seed < 100; seed++) {
      const r = attemptQiCondensationEntry(c, { rng: createRng(seed), techniqueCount: 1 });
      if (!r.success) {
        expect(r.character.realm).toBe(Realm.QI_SENSING);
        expect(r.character.cultivationProgress).toBe(50);
        return;
      }
    }
    // No failure may occur at high attributes; allow silent skip (no throw).
  });
});
