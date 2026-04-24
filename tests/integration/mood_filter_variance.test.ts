// Integration test — Phase 2A exit criterion #3.
// Same template + same seed under two different moods must render different text,
// driven by MoodAdjectiveDict substitution (+ InteriorThoughtInjector, also mood-scoped).
// Source: docs/spec/design.md §6.4.

import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { EventDef } from '@/content/schema';
import { renderEvent, CompositionContext } from '@/engine/narrative/Composer';
import { createNameRegistry } from '@/engine/narrative/NameRegistry';
import { createSnippetLibrary } from '@/engine/narrative/SnippetLibrary';

const EVENT: EventDef = {
  id: 'mood_variance_probe',
  category: 'daily',
  version: 1,
  weight: 1,
  timeCost: 'SHORT',
  conditions: {},
  repeat: 'once_per_life',
  text: {
    intro: ['The warm, quiet village held its breath.'],
    body: [],
    outro: [],
  },
  choices: [{
    id: 'c',
    label: 'watch',
    timeCost: 'SHORT',
    outcomes: {
      SUCCESS: { narrativeKey: 'x' },
      FAILURE: { narrativeKey: 'x' },
    },
  }],
};

function render(mood: 'melancholy' | 'rage'): string {
  const lib = createSnippetLibrary({});
  const reg = createNameRegistry();
  const ctx: CompositionContext = {
    characterName: 'Lin Wei',
    region: 'yellow_plains',
    season: 'autumn',
    realm: 'mortal',
    dominantMood: mood,
    turnIndex: 1,
    runSeed: 42,
    extraVariables: {},
  };
  return renderEvent(EVENT, ctx, lib, reg, createRng(42));
}

describe('mood filter variance (exit criterion #3)', () => {
  it('adjective substitution produces different text under melancholy vs rage', () => {
    const mel = render('melancholy');
    const rag = render('rage');

    // Exit criterion: same template + same seed, different mood → different text.
    expect(mel).not.toBe(rag);

    // Specific adjective substitutions from DEFAULT_ADJECTIVE_DICT:
    //   warm  → 'lonely' under melancholy, 'stifling' under rage
    expect(mel).toContain('lonely');
    expect(rag).toContain('stifling');

    // And the source adjective is gone in both outputs.
    expect(mel.toLowerCase()).not.toContain('warm');
    expect(rag.toLowerCase()).not.toContain('warm');
  });
});
