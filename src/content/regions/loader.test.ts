import { describe, it, expect } from 'vitest';
import { loadRegions } from './loader';
import valid from './__fixtures__/valid.json';
import invalidDup from './__fixtures__/invalid_duplicate.json';

describe('loadRegions', () => {
  it('parses a valid pack to RegionDef[]', () => {
    const list = loadRegions(valid);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('test_region');
  });

  it('throws on duplicate ids', () => {
    expect(() => loadRegions(invalidDup)).toThrow(/duplicate region id/i);
  });

  it('throws on malformed input missing version', () => {
    expect(() => loadRegions({ regions: [] })).toThrow(/invalid region pack/i);
  });
});
