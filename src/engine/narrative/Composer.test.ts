import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { EventDef } from '@/content/schema';
import { createSnippetLibrary } from './SnippetLibrary';
import { createNameRegistry, NameRegistry } from './NameRegistry';
import { renderEvent, CompositionContext } from './Composer';

const ATTRS = { Body: 20, Mind: 15, Spirit: 10, Agility: 12, Charm: 8, Luck: 30 };

const LIB = createSnippetLibrary({
  'weather.drought': [{ text: 'The sun hung heavy.' }],
  'sensory.dust':    [{ text: 'Dust in the throat.' }],
  'dialogue.monk':   [
    { text: 'The monk offered water.', tags: ['lyrical'] },
    { text: 'A monk came by.', tags: ['terse'] },
  ],
});

function makeEvent(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'EV_TEST',
    category: 'test',
    version: 1,
    weight: 100,
    conditions: {},
    timeCost: 'SHORT',
    text: {
      intro: ['$[weather.drought]'],
      body:  ['[CHARACTER] coughed. $[sensory.dust]'],
      outro: ['$[dialogue.monk]'],
    },
    choices: [{
      id: 'ch_x', label: 'x', timeCost: 'INSTANT',
      outcomes: { SUCCESS: { narrativeKey: 'a' }, FAILURE: { narrativeKey: 'b' } },
    }],
    repeat: 'unlimited',
    ...overrides,
  };
}

function makeCtx(overrides: Partial<CompositionContext> = {}): CompositionContext {
  return {
    characterName: 'Lin Wei',
    region: 'yellow_plains',
    season: 'summer',
    realm: 'mortal',
    dominantMood: 'serenity',
    turnIndex: 1,
    runSeed: 42,
    extraVariables: {},
    ...overrides,
  };
}

describe('renderEvent', () => {
  it('composes intro + body + outro into a single paragraph separated by spaces or newlines', () => {
    const text = renderEvent(makeEvent(), makeCtx(), LIB, createNameRegistry(), createRng(1));
    expect(text.length).toBeGreaterThan(0);
    // Under serenity mood, 'heavy' → 'settled' via adjective substitution post-pass.
    expect(text).toContain('The sun hung settled');
    expect(text).toContain('Lin Wei');
    expect(text).toContain('Dust in the throat');
  });

  it('substitutes [CHARACTER] with characterName', () => {
    const text = renderEvent(makeEvent(), makeCtx({ characterName: 'Hua Min' }), LIB, createNameRegistry(), createRng(1));
    expect(text).toContain('Hua Min');
    expect(text).not.toContain('[CHARACTER]');
  });

  it('is deterministic for the same (event, ctx, seed)', () => {
    const a = renderEvent(makeEvent(), makeCtx(), LIB, createNameRegistry(), createRng(42));
    const b = renderEvent(makeEvent(), makeCtx(), LIB, createNameRegistry(), createRng(42));
    expect(a).toBe(b);
  });

  it('mood influences tag-biased snippet selection', () => {
    // With dominantMood = 'rage', we prefer 'terse' tags → "A monk came by." should appear more than "The monk offered water."
    const rng = createRng(99);
    let terseCount = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const t = renderEvent(
        makeEvent({ text: { intro: [], body: [], outro: ['$[dialogue.monk]'] } }),
        makeCtx({ dominantMood: 'rage' }),
        LIB,
        createNameRegistry(),
        rng,
      );
      if (t.includes('A monk came by')) terseCount++;
    }
    expect(terseCount / N).toBeGreaterThan(0.6);
  });

  it('handles events with empty intro / body / outro arrays gracefully', () => {
    const ev = makeEvent({ text: { intro: [], body: [], outro: [] } });
    const text = renderEvent(ev, makeCtx(), LIB, createNameRegistry(), createRng(1));
    expect(text).toBe('');
  });

  it('extraVariables flow into [VAR] substitutions', () => {
    const ev = makeEvent({ text: { intro: ['[LOCATION] was quiet.'], body: [], outro: [] } });
    const text = renderEvent(ev, makeCtx({ extraVariables: { LOCATION: 'Cold Iron Peak' } }), LIB, createNameRegistry(), createRng(1));
    // Under serenity mood adjective post-pass: 'quiet' → 'still' → 'calm' (chain), 'cold' → 'crisp'.
    expect(text).toBe('Crisp Iron Peak was calm.');
  });
});

describe('renderEvent — Phase 2A-1 post-passes', () => {
  it('applies adjective substitution under melancholy mood', () => {
    const event = {
      id: 'test_event', category: 'daily', version: 1, weight: 1, timeCost: 'SHORT',
      conditions: {}, repeat: 'once_per_life',
      text: { intro: ['A warm wind blew across the plains.'], body: [], outro: [] },
      choices: [{
        id: 'c', label: 'do it', timeCost: 'SHORT',
        outcomes: { SUCCESS: { narrativeKey: 'x' }, FAILURE: { narrativeKey: 'x' } },
      }],
    };
    const library = createSnippetLibrary({});
    const registry: NameRegistry = createNameRegistry();
    const rng = createRng(1);
    const ctx: CompositionContext = {
      characterName: 'Lin Wei', region: 'yellow_plains',
      season: 'autumn', realm: 'mortal', dominantMood: 'melancholy',
      turnIndex: 1, runSeed: 1, extraVariables: {},
    };
    const rendered = renderEvent(event as any, ctx, library, registry, rng);
    expect(rendered).toContain('lonely');
  });

  it('renders identically for same (runSeed, turn) + identical inputs (determinism)', () => {
    const event = {
      id: 'test_event', category: 'daily', version: 1, weight: 1, timeCost: 'SHORT',
      conditions: {}, repeat: 'once_per_life',
      text: { intro: ['A warm wind blew across the plains.'], body: [], outro: [] },
      choices: [{
        id: 'c', label: 'do it', timeCost: 'SHORT',
        outcomes: { SUCCESS: { narrativeKey: 'x' }, FAILURE: { narrativeKey: 'x' } },
      }],
    };
    const library = createSnippetLibrary({});
    const registry = createNameRegistry();
    const ctx: CompositionContext = {
      characterName: 'Lin Wei', region: 'yellow_plains',
      season: 'autumn', realm: 'mortal', dominantMood: 'melancholy',
      turnIndex: 1, runSeed: 1, extraVariables: {},
    };
    const first  = renderEvent(event as any, ctx, library, registry, createRng(42));
    const second = renderEvent(event as any, ctx, library, registry, createRng(42));
    expect(first).toBe(second);
  });
});
