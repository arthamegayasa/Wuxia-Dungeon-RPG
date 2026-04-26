import { describe, it, expect } from 'vitest';
import { RegionRegistry } from './RegionRegistry';
import { RegionDef } from '@/content/schema';

const fixtureRegion: RegionDef = {
  id: 'r1',
  name: 'Region One',
  qiDensity: 1.5,
  climate: {
    seasonWeights: { spring: 1, summer: 2, autumn: 1, winter: 0.5 },
    rainWeight: 0.4,
  },
  locales: [{ id: 'village', tagBias: ['pastoral'] }],
  factionSlots: [],
  eventPool: ['evt_001'],
  pillarPool: [],
  npcArchetypes: [],
  namePool: {
    placePrefix: ['North'],
    placeFeature: ['Peak'],
  },
};

describe('RegionRegistry', () => {
  it('empty() produces an empty registry', () => {
    const reg = RegionRegistry.empty();
    expect(reg.all()).toHaveLength(0);
    expect(reg.byId('anything')).toBeNull();
  });

  it('fromList registers and looks up by id', () => {
    const reg = RegionRegistry.fromList([fixtureRegion]);
    expect(reg.byId('r1')).toEqual(fixtureRegion);
    expect(reg.has('r1')).toBe(true);
    expect(reg.has('missing')).toBe(false);
    expect(reg.all()).toHaveLength(1);
  });

  it('throws on duplicate id', () => {
    expect(() => RegionRegistry.fromList([fixtureRegion, fixtureRegion])).toThrow(/duplicate id/i);
  });
});
