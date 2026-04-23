import { describe, it, expect } from 'vitest';
import { loadMemories } from './loader';
import valid from './__fixtures__/valid.json';
import invalidDup from './__fixtures__/invalid_duplicate.json';

describe('loadMemories', () => {
  it('parses a valid pack to MemoryDef[]', () => {
    const list = loadMemories(valid);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('test_mem');
  });

  it('throws on zod shape mismatch', () => {
    expect(() => loadMemories({ version: 1, memories: [{ wrong: true }] })).toThrow();
  });

  it('throws on duplicate ids', () => {
    expect(() => loadMemories(invalidDup)).toThrow(/duplicate memory id/i);
  });
});
