import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createSnippetLibrary, pickSnippet, SnippetLibrary } from './SnippetLibrary';

const RAW = {
  'weather.drought.heavy': [
    { text: 'The sun hung like a bronze coin nailed to the sky.', tags: ['lyrical'] },
    { text: 'Three moons without rain.', tags: ['terse'] },
    { text: 'The land was parched.', tags: ['serious'] },
  ],
  'weather.storm.soft': [
    { text: 'A hush of rain across the thatch.' },
  ],
};

describe('createSnippetLibrary', () => {
  it('accepts valid zod-shaped raw data and returns a library', () => {
    const lib = createSnippetLibrary(RAW);
    expect(lib.has('weather.drought.heavy')).toBe(true);
    expect(lib.has('weather.storm.soft')).toBe(true);
    expect(lib.has('unknown.key')).toBe(false);
  });

  it('rejects malformed raw data', () => {
    expect(() => createSnippetLibrary({ 'x.y': [{ text: '' }] })).toThrow();
  });
});

describe('pickSnippet', () => {
  it('returns null for unknown keys', () => {
    const lib = createSnippetLibrary(RAW);
    expect(pickSnippet(lib, 'does.not.exist', [], createRng(1))).toBeNull();
  });

  it('returns a text from the matching key', () => {
    const lib = createSnippetLibrary(RAW);
    const text = pickSnippet(lib, 'weather.storm.soft', [], createRng(1));
    expect(text).toBe('A hush of rain across the thatch.');
  });

  it('is deterministic for the same seed', () => {
    const lib = createSnippetLibrary(RAW);
    const a = pickSnippet(lib, 'weather.drought.heavy', [], createRng(42));
    const b = pickSnippet(lib, 'weather.drought.heavy', [], createRng(42));
    expect(a).toBe(b);
  });

  it('preferred tags bias the selection toward matching entries', () => {
    const lib = createSnippetLibrary(RAW);
    // 'lyrical' entry: "The sun hung like a bronze coin..."
    // With preferredTags=['lyrical'] it should dominate > 70% over 1000 rolls.
    const rng = createRng(99);
    let lyricalCount = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const s = pickSnippet(lib, 'weather.drought.heavy', ['lyrical'], rng);
      if (s?.startsWith('The sun')) lyricalCount++;
    }
    expect(lyricalCount / N).toBeGreaterThan(0.70);
  });

  it('no preferred tags → uniform-ish distribution across entries', () => {
    const lib = createSnippetLibrary(RAW);
    const rng = createRng(50);
    const counts = new Map<string, number>();
    const N = 3000;
    for (let i = 0; i < N; i++) {
      const s = pickSnippet(lib, 'weather.drought.heavy', [], rng)!;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    // All three entries should appear roughly equally (within 20%–50% tolerance).
    for (const [, count] of counts) {
      expect(count / N).toBeGreaterThan(0.15);
      expect(count / N).toBeLessThan(0.55);
    }
  });

  it('respects explicit weight field', () => {
    const raw = {
      'x.y': [
        { text: 'rare', weight: 1 },
        { text: 'common', weight: 9 },
      ],
    };
    const lib = createSnippetLibrary(raw);
    const rng = createRng(123);
    let commonCount = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      if (pickSnippet(lib, 'x.y', [], rng) === 'common') commonCount++;
    }
    expect(commonCount / N).toBeGreaterThan(0.80);
  });
});
