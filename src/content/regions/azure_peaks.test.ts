import { describe, it, expect } from 'vitest';
import { loadRegions } from './loader';
import azurePeaks from './azure_peaks.json';
import { RegionRegistry } from '@/engine/world/RegionRegistry';

describe('Azure Peaks region (Phase 2B-2 Task 6)', () => {
  const regions = loadRegions(azurePeaks);

  it('parses successfully', () => {
    expect(regions).toHaveLength(1);
    expect(regions[0].id).toBe('azure_peaks');
  });

  it('has qiDensity 1.5× (sect-region multiplier per spec §8.1)', () => {
    expect(regions[0].qiDensity).toBe(1.5);
  });

  it('has six locales with the spec-mandated ids', () => {
    expect(regions[0].locales.map((l) => l.id)).toEqual([
      'outer_sect_courtyard',
      'scripture_hall',
      'meditation_cave',
      'beast_pass',
      'alchemy_pavilion',
      'elder_quarters',
    ]);
  });

  it('has both era-locked factionSlots', () => {
    expect(regions[0].factionSlots.map((f) => f.id)).toEqual([
      'azure_cloud_sect',
      'broken_mountain_cult',
    ]);
  });

  it('hydrates a RegionRegistry', () => {
    const reg = RegionRegistry.fromList(regions);
    expect(reg.byId('azure_peaks')).toBeDefined();
    expect(reg.has('azure_peaks')).toBe(true);
  });

  it('namePool has 6 placePrefix and 6 placeFeature entries', () => {
    expect(regions[0].namePool.placePrefix).toHaveLength(6);
    expect(regions[0].namePool.placeFeature).toHaveLength(6);
  });
});
