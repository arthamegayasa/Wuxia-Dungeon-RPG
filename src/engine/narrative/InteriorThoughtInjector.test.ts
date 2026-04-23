import { describe, it, expect } from 'vitest';
import { maybeInjectInteriorThought, reflectionSnippetKey } from './InteriorThoughtInjector';
import { createSnippetLibrary } from './SnippetLibrary';

const lib = createSnippetLibrary({
  'reflection.melancholy.mortal': [{ text: 'The moment passed like the others.' }],
  'reflection.melancholy.body_tempering': [{ text: 'His body remembered what his mouth forgot.' }],
  'reflection.resolve.mortal': [{ text: 'He knew, then, what he would do.' }],
});

describe('reflectionSnippetKey', () => {
  it('builds the dotted key', () => {
    expect(reflectionSnippetKey('melancholy', 'mortal')).toBe('reflection.melancholy.mortal');
  });
});

describe('maybeInjectInteriorThought', () => {
  it('returns unchanged text when rate rolls miss', () => {
    const out = maybeInjectInteriorThought({
      text: 'A day passed.',
      mood: 'melancholy',
      realm: 'mortal',
      mindStat: 0,              // rate = 0 -> always miss
      runSeed: 1, turnIndex: 1,
      library: lib,
    });
    expect(out).toBe('A day passed.');
  });

  it('appends the reflection when Mind extremely high + melancholy (for some seed)', () => {
    let anyHit = false;
    for (let seed = 1; seed <= 50; seed += 1) {
      const out = maybeInjectInteriorThought({
        text: 'A day passed.',
        mood: 'melancholy',
        realm: 'mortal',
        mindStat: 60,
        runSeed: seed, turnIndex: 1,
        library: lib,
      });
      if (out.length > 'A day passed.'.length) {
        anyHit = true;
        expect(out).toContain('The moment passed like the others.');
        break;
      }
    }
    expect(anyHit).toBe(true);
  });

  it('falls back to mortal-realm snippet if exact realm missing', () => {
    let anyHit = false;
    for (let seed = 1; seed <= 50; seed += 1) {
      const out = maybeInjectInteriorThought({
        text: 'A day passed.',
        mood: 'resolve',
        realm: 'core',
        mindStat: 100,
        runSeed: seed, turnIndex: 1,
        library: lib,
      });
      if (out.length > 'A day passed.'.length) {
        anyHit = true;
        expect(out).toContain('He knew, then, what he would do.');
        break;
      }
    }
    expect(anyHit).toBe(true);
  });

  it('is deterministic for fixed (runSeed, turn)', () => {
    const args = {
      text: 'A day passed.',
      mood: 'melancholy' as const,
      realm: 'mortal',
      mindStat: 60,
      runSeed: 1234, turnIndex: 7,
      library: lib,
    };
    expect(maybeInjectInteriorThought(args)).toBe(maybeInjectInteriorThought(args));
  });

  it('returns unchanged text when library has no matching snippet', () => {
    const emptyLib = createSnippetLibrary({});
    const out = maybeInjectInteriorThought({
      text: 'A day passed.',
      mood: 'melancholy',
      realm: 'mortal',
      mindStat: 100,
      runSeed: 1, turnIndex: 1,
      library: emptyLib,
    });
    expect(out).toBe('A day passed.');
  });
});
