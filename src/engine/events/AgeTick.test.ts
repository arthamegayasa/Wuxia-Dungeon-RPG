import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { rollTimeCostDays, advanceTurn } from './AgeTick';
import { createCharacter } from '@/engine/character/Character';
import { createRunState } from './RunState';

const ATTRS = { Body: 20, Mind: 15, Spirit: 10, Agility: 12, Charm: 8, Luck: 30 };

function baseState() {
  const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
  return createRunState({ character: c, runSeed: 1, region: 'yellow_plains', year: 1000, season: 'summer' });
}

describe('rollTimeCostDays', () => {
  it('INSTANT is always 0', () => {
    const rng = createRng(1);
    for (let i = 0; i < 100; i++) expect(rollTimeCostDays('INSTANT', rng)).toBe(0);
  });

  it('SHORT produces 1..7 inclusive', () => {
    const rng = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const d = rollTimeCostDays('SHORT', rng);
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(7);
      seen.add(d);
    }
    expect(seen.size).toBeGreaterThan(4); // should see multiple values
  });

  it('MEDIUM produces 30..90', () => {
    const rng = createRng(1);
    for (let i = 0; i < 500; i++) {
      const d = rollTimeCostDays('MEDIUM', rng);
      expect(d).toBeGreaterThanOrEqual(30);
      expect(d).toBeLessThanOrEqual(90);
    }
  });

  it('LONG produces 180..540', () => {
    const rng = createRng(1);
    for (let i = 0; i < 500; i++) {
      const d = rollTimeCostDays('LONG', rng);
      expect(d).toBeGreaterThanOrEqual(180);
      expect(d).toBeLessThanOrEqual(540);
    }
  });

  it('EPOCH produces 1095..3650', () => {
    const rng = createRng(1);
    for (let i = 0; i < 500; i++) {
      const d = rollTimeCostDays('EPOCH', rng);
      expect(d).toBeGreaterThanOrEqual(1095);
      expect(d).toBeLessThanOrEqual(3650);
    }
  });
});

describe('advanceTurn', () => {
  it('increments turn by 1 and rolls a TimeCost-sized age delta', () => {
    const rs = baseState();
    const rng = createRng(42);
    const next = advanceTurn(rs, 'SHORT', rng);
    expect(next.turn).toBe(rs.turn + 1);
    expect(next.character.ageDays).toBeGreaterThanOrEqual(rs.character.ageDays + 1);
    expect(next.character.ageDays).toBeLessThanOrEqual(rs.character.ageDays + 7);
  });

  it('INSTANT advances turn but not age', () => {
    const rs = baseState();
    const next = advanceTurn(rs, 'INSTANT', createRng(1));
    expect(next.turn).toBe(1);
    expect(next.character.ageDays).toBe(rs.character.ageDays);
  });

  it('is deterministic for the same seed', () => {
    const rs = baseState();
    const a = advanceTurn(rs, 'MEDIUM', createRng(99));
    const b = advanceTurn(rs, 'MEDIUM', createRng(99));
    expect(a.character.ageDays).toBe(b.character.ageDays);
  });
});
