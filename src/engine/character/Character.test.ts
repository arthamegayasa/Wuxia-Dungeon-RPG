import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';
import {
  createCharacter,
  applyHp,
  applyQi,
  applyInsight,
  ageDays,
  Character,
  refreshDerived,
} from './Character';

const BASELINE_ATTRS = {
  Body: 20, Mind: 15, Spirit: 10, Agility: 12, Charm: 8, Luck: 30,
};

describe('createCharacter', () => {
  it('produces a Mortal, age 0, empty meridians by default', () => {
    const c = createCharacter({ name: 'Lin Wei', attributes: BASELINE_ATTRS, rng: createRng(1) });
    expect(c.name).toBe('Lin Wei');
    expect(c.realm).toBe(Realm.MORTAL);
    expect(c.bodyTemperingLayer).toBe(0);
    expect(c.ageDays).toBe(0);
    expect(c.openMeridians).toEqual([]);
    expect(c.corePath).toBeNull();
    expect(c.attributes).toEqual(BASELINE_ATTRS);
    expect(c.cultivationProgress).toBe(0);
  });

  it('rolls a spirit root deterministically for the same seed', () => {
    const a = createCharacter({ name: 'a', attributes: BASELINE_ATTRS, rng: createRng(42) });
    const b = createCharacter({ name: 'b', attributes: BASELINE_ATTRS, rng: createRng(42) });
    expect(a.spiritRoot).toEqual(b.spiritRoot);
  });

  it('computes baseline HP = hpMax(body, 0) and qi = 0 initially', () => {
    const c = createCharacter({ name: 'x', attributes: BASELINE_ATTRS, rng: createRng(99) });
    // 30 + 20*2 + 0*10 = 70
    expect(c.hp).toBe(70);
    expect(c.qi).toBe(0);
    expect(c.insight).toBe(0);
  });

  it('accepts an optional starting age (days)', () => {
    const c = createCharacter({ name: 'x', attributes: BASELINE_ATTRS, rng: createRng(1), startingAgeDays: 3650 });
    expect(c.ageDays).toBe(3650);
  });
});

describe('mutation helpers', () => {
  const base = createCharacter({ name: 't', attributes: BASELINE_ATTRS, rng: createRng(5) });

  it('applyHp returns a new character with HP clamped to [0, hpMax]', () => {
    const low  = applyHp(base, -1000);
    expect(low.hp).toBe(0);
    expect(low).not.toBe(base); // new object

    const high = applyHp(base, +1000);
    expect(high.hp).toBe(base.hp); // clamped to max
  });

  it('applyQi clamps to [0, qiMax]', () => {
    // Base spirit 10, open 0, root varies. For the seed used, spirit root tier is likely 'none'.
    // If 'none' → qiMax = 0 → all qi clamps to 0.
    const bumped = applyQi(base, +50);
    expect(bumped.qi).toBeGreaterThanOrEqual(0);
    expect(bumped.qi).toBeLessThanOrEqual(bumped.qiMax);
  });

  it('applyInsight clamps to >= 0 and respects insight cap', () => {
    const bumped = applyInsight(base, 1_000_000);
    expect(bumped.insight).toBeLessThanOrEqual(bumped.insightCap);

    const drained = applyInsight(base, -500);
    expect(drained.insight).toBe(0);
  });

  it('ageDays increases ageDays and returns new character', () => {
    const older = ageDays(base, 30);
    expect(older.ageDays).toBe(base.ageDays + 30);
    expect(older).not.toBe(base);
  });

  it('ageDays rejects negative deltas', () => {
    expect(() => ageDays(base, -1)).toThrow(/non-negative/i);
  });
});

describe('Character type contracts', () => {
  it('hpMax and qiMax are derived (not stored separately from base)', () => {
    const c: Character = createCharacter({ name: 't', attributes: BASELINE_ATTRS, rng: createRng(5) });
    // hpMax must equal 30 + Body*2 + layer*10
    expect(c.hpMax).toBe(30 + c.attributes.Body * 2 + c.bodyTemperingLayer * 10);
  });
});

describe('Character.qiCondensationLayer (Phase 2B-1 Task 11)', () => {
  it('createCharacter defaults qiCondensationLayer to 0', () => {
    const c = createCharacter({
      name: 'x',
      attributes: { Body: 5, Mind: 5, Spirit: 5, Agility: 5, Charm: 5, Luck: 5 },
      rng: createRng(1),
    });
    expect(c.qiCondensationLayer).toBe(0);
  });

  it('refreshDerived preserves qiCondensationLayer', () => {
    const c = createCharacter({
      name: 'x',
      attributes: { Body: 5, Mind: 5, Spirit: 5, Agility: 5, Charm: 5, Luck: 5 },
      rng: createRng(1),
    });
    const withLayer = { ...c, qiCondensationLayer: 3 };
    const fresh = refreshDerived(withLayer);
    expect(fresh.qiCondensationLayer).toBe(3);
  });
});
