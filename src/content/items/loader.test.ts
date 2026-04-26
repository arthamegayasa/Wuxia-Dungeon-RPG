import { describe, it, expect } from 'vitest';
import { loadItems } from './loader';
import valid from './__fixtures__/valid.json';
import invalidDuplicate from './__fixtures__/invalid_duplicate.json';
import invalidManual from './__fixtures__/invalid_manual_missing_teaches.json';

describe('loadItems', () => {
  it('loads a valid item pack', () => {
    const items = loadItems(valid);
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('test_pill');
    expect(items[1].id).toBe('test_manual');
  });

  it('rejects duplicate item ids', () => {
    expect(() => loadItems(invalidDuplicate)).toThrow(/duplicate item id/);
  });

  it('rejects a manual missing teaches', () => {
    expect(() => loadItems(invalidManual)).toThrow(/manual requires teaches/);
  });

  it('rejects malformed input (missing version)', () => {
    expect(() => loadItems({ items: [] })).toThrow(/invalid item pack/);
  });
});
