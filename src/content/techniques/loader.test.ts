import { describe, it, expect } from 'vitest';
import { loadTechniques } from './loader';
import valid from './__fixtures__/valid.json';
import invalidDuplicate from './__fixtures__/invalid_duplicate.json';

describe('loadTechniques', () => {
  it('loads a valid technique pack', () => {
    const techniques = loadTechniques(valid);
    expect(techniques).toHaveLength(1);
    expect(techniques[0].id).toBe('test_technique');
  });

  it('rejects duplicate technique ids', () => {
    expect(() => loadTechniques(invalidDuplicate)).toThrow(/duplicate technique id/);
  });

  it('rejects malformed input (missing version)', () => {
    expect(() => loadTechniques({ techniques: [] })).toThrow(/invalid technique pack/);
  });
});
