import { describe, it, expect } from 'vitest';
import {
  SPIRIT_ROOT_TIERS,
  MERIDIAN_IDS,
  CORE_PATH_IDS,
  DEVIATION_SEVERITIES,
  HEAVENLY_ROOT_KINDS,
} from './Types';

describe('character primitive type tables', () => {
  it('SPIRIT_ROOT_TIERS lists all 5 tiers in severity order', () => {
    expect(SPIRIT_ROOT_TIERS).toEqual([
      'none', 'mottled', 'single_element', 'dual_element', 'heavenly',
    ]);
  });

  it('MERIDIAN_IDS is exactly 12 contiguous ids', () => {
    expect(MERIDIAN_IDS).toEqual([1,2,3,4,5,6,7,8,9,10,11,12]);
  });

  it('CORE_PATH_IDS lists all 9 paths', () => {
    expect(CORE_PATH_IDS).toEqual([
      'iron_mountain', 'severing_edge', 'still_water', 'howling_storm',
      'blood_ember', 'root_and_bough', 'thousand_mirrors', 'hollow_vessel',
      'shattered_path',
    ]);
  });

  it('DEVIATION_SEVERITIES escalates from mild to lethal', () => {
    expect(DEVIATION_SEVERITIES).toEqual([
      'tremor', 'scar', 'cripple', 'rend', 'shatter',
    ]);
  });

  it('HEAVENLY_ROOT_KINDS lists the three named variants', () => {
    expect(HEAVENLY_ROOT_KINDS).toEqual([
      'frostfire', 'severed_dao', 'hollow',
    ]);
  });
});
