import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createSnippetLibrary } from './SnippetLibrary';
import { expandTemplate } from './TemplateExpander';

const LIB = createSnippetLibrary({
  'weather.summer.heavy': [{ text: 'The sun burned overhead.' }],
  'weather.winter.heavy': [{ text: 'Ice bit every breath.' }],
  'sensory.oppressive.1': [{ text: 'The air felt burned.' }],
  'greeting': [
    { text: 'Peace, stranger.', tags: ['serious'] },
    { text: 'Eh, you again.', tags: ['terse'] },
  ],
});

describe('expandTemplate', () => {
  it('returns input unchanged when no tokens present', () => {
    const r = expandTemplate('just a plain sentence.', { library: LIB, variables: {}, preferredTags: [], rng: createRng(1) });
    expect(r).toBe('just a plain sentence.');
  });

  it('substitutes [VAR] tokens from variables', () => {
    const r = expandTemplate('Hello, [NAME]!', { library: LIB, variables: { NAME: 'Lin Wei' }, preferredTags: [], rng: createRng(1) });
    expect(r).toBe('Hello, Lin Wei!');
  });

  it('leaves [VAR] intact when the variable is missing', () => {
    const r = expandTemplate('Hello, [NAME]!', { library: LIB, variables: {}, preferredTags: [], rng: createRng(1) });
    expect(r).toBe('Hello, [NAME]!');
  });

  it('resolves $[key] via snippet library', () => {
    const r = expandTemplate('$[sensory.oppressive.1]', { library: LIB, variables: {}, preferredTags: [], rng: createRng(1) });
    expect(r).toBe('The air felt burned.');
  });

  it('resolves nested $[…$[…]…] recursively', () => {
    const r = expandTemplate('$[weather.$[SEASON].heavy]', {
      library: LIB, variables: { SEASON: 'summer' }, preferredTags: [], rng: createRng(1),
    });
    expect(r).toBe('The sun burned overhead.');
  });

  it('different SEASON yields different resolution', () => {
    const r = expandTemplate('$[weather.$[SEASON].heavy]', {
      library: LIB, variables: { SEASON: 'winter' }, preferredTags: [], rng: createRng(1),
    });
    expect(r).toBe('Ice bit every breath.');
  });

  it('unknown $[key] is replaced with an empty string', () => {
    const r = expandTemplate('before$[no.such.key]after', {
      library: LIB, variables: {}, preferredTags: [], rng: createRng(1),
    });
    expect(r).toBe('beforeafter');
  });

  it('propagates preferredTags into snippet pick', () => {
    // With preferredTags=['terse'], "Eh, you again." should dominate.
    const rng = createRng(99);
    let terse = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      const r = expandTemplate('$[greeting]', {
        library: LIB, variables: {}, preferredTags: ['terse'], rng,
      });
      if (r === 'Eh, you again.') terse++;
    }
    expect(terse / N).toBeGreaterThan(0.7);
  });

  it('handles multiple tokens in one string', () => {
    const r = expandTemplate('$[sensory.oppressive.1] [CHARACTER] walked on.', {
      library: LIB, variables: { CHARACTER: 'Lin Wei' }, preferredTags: [], rng: createRng(1),
    });
    expect(r).toBe('The air felt burned. Lin Wei walked on.');
  });

  it('is deterministic for the same seed and inputs', () => {
    const ctx = { library: LIB, variables: {}, preferredTags: [] as string[], rng: createRng(42) };
    const ctxB = { library: LIB, variables: {}, preferredTags: [] as string[], rng: createRng(42) };
    const a = expandTemplate('$[greeting]', ctx);
    const b = expandTemplate('$[greeting]', ctxB);
    expect(a).toBe(b);
  });

  it('terminates on infinite-recursion edge case (key that contains itself) — guards via max depth', () => {
    // Construct a library where a key resolves to itself. Expander must cap depth, not loop forever.
    const bad = createSnippetLibrary({
      'loop.x': [{ text: '$[loop.x]' }],
    });
    // The guard returns the literal unresolved token or empty string — either is acceptable, just don't stall.
    const r = expandTemplate('$[loop.x]', {
      library: bad, variables: {}, preferredTags: [], rng: createRng(1),
    });
    expect(typeof r).toBe('string');
  });
});
