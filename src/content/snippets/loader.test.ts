import { describe, it, expect } from 'vitest';
import { loadSnippets } from './loader';
import smokeJson from './__smoke.json';

describe('loadSnippets', () => {
  it('parses the smoke snippet pack into a SnippetLibrary', () => {
    const lib = loadSnippets(smokeJson);
    expect(lib.has('weather.rain.spring')).toBe(true);
    const entries = lib.get('weather.rain.spring');
    expect(entries).toBeDefined();
    expect(entries!.length).toBeGreaterThan(0);
  });

  it('returns undefined for unknown keys', () => {
    const lib = loadSnippets(smokeJson);
    expect(lib.get('not.a.real.key')).toBeUndefined();
    expect(lib.has('not.a.real.key')).toBe(false);
  });

  it('validates SnippetEntry shape (text required, weight + tags optional)', () => {
    const bad = {
      version: 1,
      leaves: {
        'weather.rain.spring': [{ weight: 1 }],
      },
    };
    expect(() => loadSnippets(bad)).toThrow();
  });

  it('validates entry text is non-empty', () => {
    const bad = {
      version: 1,
      leaves: {
        'weather.rain.spring': [{ text: '' }],
      },
    };
    expect(() => loadSnippets(bad)).toThrow();
  });

  it('throws on missing leaves object', () => {
    expect(() => loadSnippets({ version: 1 })).toThrow(/leaves/i);
  });
});
