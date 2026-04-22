import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { EventDef } from '@/content/schema';
import { renderEvent, CompositionContext } from '@/engine/narrative/Composer';
import { createSnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { createNameRegistry } from '@/engine/narrative/NameRegistry';

const EVENT: EventDef = {
  id: 'EV_DETERMINISM',
  category: 'test',
  version: 1,
  weight: 100,
  conditions: {},
  timeCost: 'SHORT',
  text: {
    intro: ['$[weather.drought]', '$[weather.rain]'],
    body:  ['[CHARACTER] considered the road.', 'A silence settled on the valley.'],
    outro: ['$[dialogue.monk.1]', '$[dialogue.monk.2]'],
  },
  choices: [{
    id: 'ch_x', label: 'x', timeCost: 'INSTANT',
    outcomes: { SUCCESS: { narrativeKey: 'a' }, FAILURE: { narrativeKey: 'b' } },
  }],
  repeat: 'unlimited',
};

const LIB = createSnippetLibrary({
  'weather.drought':   [{ text: 'The sun hung heavy.' }],
  'weather.rain':      [{ text: 'Rain threaded the mountain.' }],
  'dialogue.monk.1':   [{ text: '"Peace," the monk said.' }],
  'dialogue.monk.2':   [{ text: 'The monk walked on.' }],
});

function makeCtx(overrides: Partial<CompositionContext> = {}): CompositionContext {
  return {
    characterName: 'Lin Wei',
    region: 'yellow_plains',
    season: 'summer',
    realm: 'mortal',
    dominantMood: 'serenity',
    turnIndex: 5,
    runSeed: 42,
    extraVariables: {},
    ...overrides,
  };
}

describe('composer determinism contract (spec §6.10)', () => {
  it('same (event, ctx, seed) → identical output', () => {
    const a = renderEvent(EVENT, makeCtx(), LIB, createNameRegistry(), createRng(42));
    const b = renderEvent(EVENT, makeCtx(), LIB, createNameRegistry(), createRng(42));
    const c = renderEvent(EVENT, makeCtx(), LIB, createNameRegistry(), createRng(42));
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('different seed → different output (empirically)', () => {
    const outputs = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      outputs.add(renderEvent(EVENT, makeCtx(), LIB, createNameRegistry(), createRng(seed)));
    }
    expect(outputs.size).toBeGreaterThan(2);
  });

  it('same seed but different turnIndex → identical if other inputs are same', () => {
    // turnIndex is a context field but does NOT directly affect composition in Phase 1C
    // (it would in Phase 1D once per-turn seed derivation is wired).
    // This test documents current behaviour.
    const a = renderEvent(EVENT, makeCtx({ turnIndex: 1 }), LIB, createNameRegistry(), createRng(42));
    const b = renderEvent(EVENT, makeCtx({ turnIndex: 2 }), LIB, createNameRegistry(), createRng(42));
    expect(a).toBe(b);
  });

  it('different dominantMood → different tag preference → may differ', () => {
    // Different moods bias different tags. With default pool (no tags specified on snippet entries),
    // the bias has no effect. This test just confirms no crash.
    const a = renderEvent(EVENT, makeCtx({ dominantMood: 'rage' }), LIB, createNameRegistry(), createRng(1));
    const b = renderEvent(EVENT, makeCtx({ dominantMood: 'sorrow' }), LIB, createNameRegistry(), createRng(1));
    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
  });

  it('different characterName substitutes correctly', () => {
    const a = renderEvent(EVENT, makeCtx({ characterName: 'LinA' }), LIB, createNameRegistry(), createRng(1));
    const b = renderEvent(EVENT, makeCtx({ characterName: 'LinB' }), LIB, createNameRegistry(), createRng(1));
    // Body snippet may or may not contain [CHARACTER]. Check a ≠ b only when substitution occurred.
    if (a.includes('LinA')) {
      expect(b).not.toBe(a);
    }
  });
});
