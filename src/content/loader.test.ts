import { describe, it, expect } from 'vitest';
import { loadContentPack } from './loader';

describe('content loader', () => {
  it('accepts a minimal valid pack', () => {
    const pack = {
      version: 1,
      snippets: {},
      events: [],
    };
    const loaded = loadContentPack(pack);
    expect(loaded.version).toBe(1);
    expect(loaded.events).toEqual([]);
  });

  it('rejects a pack missing version', () => {
    expect(() => loadContentPack({ snippets: {}, events: [] }))
      .toThrow(/version/i);
  });

  it('rejects a pack with wrong types', () => {
    expect(() => loadContentPack({ version: 'one', snippets: {}, events: [] }))
      .toThrow();
  });

  it('accepts snippet entries with text + optional tags', () => {
    const pack = {
      version: 1,
      snippets: {
        'weather.drought.heavy': [
          { text: 'The sun hung heavy.', tags: ['lyrical'] },
          { text: 'It was hot.' },
        ],
      },
      events: [],
    };
    const loaded = loadContentPack(pack);
    expect(loaded.snippets['weather.drought.heavy']).toHaveLength(2);
  });
});
