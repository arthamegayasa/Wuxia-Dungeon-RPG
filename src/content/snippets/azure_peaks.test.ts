import { describe, it, expect } from 'vitest';
import { loadSnippets } from './loader';
import azurePeaksSnippets from './azure_peaks.json';

describe('Azure Peaks snippet pack (Phase 2B-2 Task 22)', () => {
  const lib = loadSnippets(azurePeaksSnippets);
  const rawLeaves = azurePeaksSnippets.leaves;
  const allLeaves = Object.values(rawLeaves).reduce((sum, arr) => sum + arr.length, 0);

  it('has at least 50 leaves', () => {
    expect(allLeaves).toBeGreaterThanOrEqual(50);
  });

  it('covers all six Azure Peaks locales', () => {
    expect(lib.has('sect.locales.outer_sect_courtyard')).toBe(true);
    expect(lib.has('sect.locales.scripture_hall')).toBe(true);
    expect(lib.has('sect.locales.meditation_cave')).toBe(true);
    expect(lib.has('sect.locales.beast_pass')).toBe(true);
    expect(lib.has('sect.locales.alchemy_pavilion')).toBe(true);
    expect(lib.has('sect.locales.elder_quarters')).toBe(true);
  });

  it('exposes the once-per-life QS awakening leaf', () => {
    expect(lib.has('realm.qi_sensing.awaken')).toBe(true);
    expect(lib.get('realm.qi_sensing.awaken')!.length).toBeGreaterThanOrEqual(2);
  });

  it('has technique manifestation leaves for at least 3 elements', () => {
    const elements = ['fire', 'sword', 'body', 'wind'].filter(
      (e) => lib.has(`technique.manifest.${e}`),
    );
    expect(elements.length).toBeGreaterThanOrEqual(3);
  });
});
