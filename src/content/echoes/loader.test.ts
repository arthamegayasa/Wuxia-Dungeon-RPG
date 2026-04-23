import { describe, it, expect } from 'vitest';
import { loadEchoes } from './loader';
import valid from './__fixtures__/valid.json';
import invalidDup from './__fixtures__/invalid_duplicate.json';

describe('loadEchoes', () => {
  it('parses a valid pack to EchoDef[]', () => {
    const list = loadEchoes(valid);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('test_echo');
  });

  it('throws on zod shape mismatch', () => {
    expect(() => loadEchoes({ version: 1, echoes: [{ wrong: true }] })).toThrow();
  });

  it('throws on duplicate ids', () => {
    expect(() => loadEchoes(invalidDup)).toThrow(/duplicate echo id/i);
  });
});
