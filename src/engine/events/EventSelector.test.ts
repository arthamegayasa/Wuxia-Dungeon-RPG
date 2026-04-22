import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createCharacter } from '@/engine/character/Character';
import { EventDef } from '@/content/schema';
import { EvalContext } from './ConditionEvaluator';
import {
  selectEvent,
  buildSelectionPool,
  REPETITION_WINDOW_TURNS,
} from './EventSelector';

const ATTRS = { Body: 20, Mind: 15, Spirit: 10, Agility: 12, Charm: 8, Luck: 30 };

function makeEvent(id: string, weight: number, overrides: Partial<EventDef> = {}): EventDef {
  return {
    id,
    category: 'test',
    version: 1,
    weight,
    conditions: {},
    timeCost: 'SHORT',
    text: {},
    choices: [{
      id: 'ch_x',
      label: 'x',
      timeCost: 'INSTANT',
      outcomes: { SUCCESS: { narrativeKey: 'a' }, FAILURE: { narrativeKey: 'b' } },
    }],
    repeat: 'unlimited',
    ...overrides,
  };
}

function ctx(overrides: Partial<EvalContext> = {}): EvalContext {
  return {
    character: createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) }),
    worldFlags: [],
    region: 'yellow_plains',
    locale: 'unnamed',
    year: 1000,
    season: 'summer',
    heavenlyNotice: 0,
    ageYears: 20,
    ...overrides,
  };
}

describe('buildSelectionPool', () => {
  it('includes events whose conditions match', () => {
    const pool = [
      makeEvent('A', 100),
      makeEvent('B', 100, { conditions: { regions: ['azure_peaks'] } }),
    ];
    const result = buildSelectionPool(pool, ctx(), [], []);
    expect(result.map(x => x.event.id)).toEqual(['A']);
  });

  it('excludes once_per_life events already seen this life', () => {
    const pool = [
      makeEvent('OP', 100, { repeat: 'once_per_life' }),
    ];
    const result = buildSelectionPool(pool, ctx(), [], ['OP']);
    expect(result).toHaveLength(0);
  });

  it('excludes once_ever events already seen lifetime-wide (via lifetimeSeen)', () => {
    const pool = [makeEvent('OE', 100, { repeat: 'once_ever' })];
    const result = buildSelectionPool(pool, ctx(), ['OE'], []);
    expect(result).toHaveLength(0);
  });

  it('applies 0.1× repetition penalty within REPETITION_WINDOW_TURNS', () => {
    const pool = [
      makeEvent('X', 100),
      makeEvent('Y', 100),
    ];
    // X was seen 2 turns ago, within the 5-turn window
    const recent: ReadonlyArray<string> = ['Y', 'X', 'Y', 'X', 'Y']; // last 5 turns, X appears
    const r = buildSelectionPool(pool, ctx(), [], recent);
    const xEntry = r.find(e => e.event.id === 'X')!;
    const yEntry = r.find(e => e.event.id === 'Y')!;
    expect(xEntry.effectiveWeight).toBeLessThan(yEntry.effectiveWeight);
    expect(xEntry.effectiveWeight).toBeCloseTo(100 * 0.1, 5);
  });
});

describe('selectEvent', () => {
  it('returns null when pool is empty', () => {
    expect(selectEvent([], ctx(), [], [], createRng(1))).toBeNull();
  });

  it('is deterministic for the same inputs and seed', () => {
    const pool = [makeEvent('A', 100), makeEvent('B', 100), makeEvent('C', 100)];
    const a = selectEvent(pool, ctx(), [], [], createRng(42));
    const b = selectEvent(pool, ctx(), [], [], createRng(42));
    expect(a?.id).toBe(b?.id);
  });

  it('respects weight distribution approximately', () => {
    const pool = [
      makeEvent('rare',  10),
      makeEvent('common', 90),
    ];
    const rng = createRng(123);
    const counts: Record<string, number> = { rare: 0, common: 0 };
    for (let i = 0; i < 1000; i++) {
      const pick = selectEvent(pool, ctx(), [], [], rng);
      if (pick) counts[pick.id]++;
    }
    expect(counts.common).toBeGreaterThan(counts.rare * 5);
  });

  it('never picks a filtered-out event', () => {
    const pool = [
      makeEvent('A', 100, { conditions: { regions: ['azure_peaks'] } }),
      makeEvent('B', 100),
    ];
    const rng = createRng(9);
    for (let i = 0; i < 200; i++) {
      const pick = selectEvent(pool, ctx(), [], [], rng);
      if (pick) expect(pick.id).toBe('B');
    }
  });

  it('returns null when every event fails conditions', () => {
    const pool = [
      makeEvent('A', 100, { conditions: { regions: ['azure_peaks'] } }),
    ];
    expect(selectEvent(pool, ctx(), [], [], createRng(1))).toBeNull();
  });
});
