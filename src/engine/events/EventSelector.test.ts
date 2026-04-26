import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createCharacter } from '@/engine/character/Character';
import { EventDef } from '@/content/schema';
import { EvalContext } from './ConditionEvaluator';
import {
  selectEvent,
  buildSelectionPool,
  pacingMultiplier,
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
    // X was seen 2 turns ago, within the 5-turn window.
    // Phase 2C note: ctx() defaults to tslc=0; both events default to kind=decision,
    // so both get the same 0.2× pacing multiplier on top of their weights/penalties.
    // The X-vs-Y ratio is preserved: X = 100 * 0.1 * 0.2 = 2, Y = 100 * 0.2 = 20.
    const recent: ReadonlyArray<string> = ['Y', 'X', 'Y', 'X', 'Y']; // last 5 turns, X appears
    const r = buildSelectionPool(pool, ctx(), [], recent);
    const xEntry = r.find(e => e.event.id === 'X')!;
    const yEntry = r.find(e => e.event.id === 'Y')!;
    expect(xEntry.effectiveWeight).toBeLessThan(yEntry.effectiveWeight);
    // The repetition penalty is the X/Y ratio = 0.1, irrespective of pacing.
    expect(xEntry.effectiveWeight / yEntry.effectiveWeight).toBeCloseTo(0.1, 5);
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

describe('Phase 2C: pacing multiplier', () => {
  it('tslc=0 favours beats 3x and suppresses decisions to 0.2x', () => {
    expect(pacingMultiplier('beat', 0)).toBe(3.0);
    expect(pacingMultiplier('decision', 0)).toBe(0.2);
  });

  it('tslc=5 (4-7 band) is neutral 1.0x for both', () => {
    expect(pacingMultiplier('beat', 5)).toBe(1.0);
    expect(pacingMultiplier('decision', 5)).toBe(1.0);
  });

  it('tslc=10 favours decisions 3x and suppresses beats to 0.2x', () => {
    expect(pacingMultiplier('beat', 10)).toBe(0.2);
    expect(pacingMultiplier('decision', 10)).toBe(3.0);
  });
});

describe('Phase 2C: selector applies pacing weight', () => {
  it('high-tslc heavily favours decisions even when their base weight is lower', () => {
    // tslc=10 → beat *0.2, decision *3.0
    // beat:     base 100 * 0.2 = 20
    // decision: base 10  * 3.0 = 30
    const pool = [
      makeEvent('B', 100, { kind: 'beat', choices: [{
        id: 'continue', label: 'Continue', timeCost: 'INSTANT',
        outcomes: { SUCCESS: { narrativeKey: 'a' }, FAILURE: { narrativeKey: 'b' } },
      }] }),
      makeEvent('D', 10,  { kind: 'decision' }),
    ];
    const rng = createRng(2026);
    const counts: Record<string, number> = { B: 0, D: 0 };
    for (let i = 0; i < 100; i++) {
      const pick = selectEvent(pool, ctx({ turnsSinceLastDecision: 10 }), [], [], rng);
      if (pick) counts[pick.id]++;
    }
    expect(counts.D).toBeGreaterThan(counts.B);
  });

  it('low-tslc heavily favours beats even when their base weight matches', () => {
    // tslc=0 → beat *3.0, decision *0.2
    // beat: 50 * 3.0 = 150; decision: 50 * 0.2 = 10
    const pool = [
      makeEvent('B', 50, { kind: 'beat', choices: [{
        id: 'continue', label: 'Continue', timeCost: 'INSTANT',
        outcomes: { SUCCESS: { narrativeKey: 'a' }, FAILURE: { narrativeKey: 'b' } },
      }] }),
      makeEvent('D', 50, { kind: 'decision' }),
    ];
    const rng = createRng(7);
    const counts: Record<string, number> = { B: 0, D: 0 };
    for (let i = 0; i < 100; i++) {
      const pick = selectEvent(pool, ctx({ turnsSinceLastDecision: 0 }), [], [], rng);
      if (pick) counts[pick.id]++;
    }
    expect(counts.B).toBeGreaterThan(counts.D * 5);
  });

  it('events without explicit kind are treated as decisions', () => {
    // tslc=10 → an unkind event is decision: weight × 3.0
    const pool = [
      makeEvent('U', 100, {}),  // kind not specified
    ];
    const result = buildSelectionPool(pool, ctx({ turnsSinceLastDecision: 10 }), [], []);
    expect(result).toHaveLength(1);
    expect(result[0]!.effectiveWeight).toBe(300);  // 100 * 3.0
  });
});
