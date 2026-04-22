// Chinese-inspired name generators.
// Source: docs/spec/design.md §6.7.
//
// Phase 1C ships with small hand-curated pools. Phase 1D content authoring can expand them.

import { IRng } from '@/engine/core/RNG';

export interface NamePools {
  familyNames: ReadonlyArray<string>;
  givenSyllables: ReadonlyArray<string>;
  sectAdjectives: ReadonlyArray<string>;
  sectObjects: ReadonlyArray<string>;
  sectSuffixes: ReadonlyArray<string>;
  placePrefixes: ReadonlyArray<string>;
  placeFeatures: ReadonlyArray<string>;
}

export const DEFAULT_NAME_POOLS: NamePools = {
  familyNames: [
    'Lin', 'Wang', 'Zhao', 'Hua', 'Mo', 'Qin', 'Bai', 'Xu', 'Yan', 'Shen',
    'Tao', 'Meng', 'Lu', 'Su', 'Jiang', 'Song', 'Feng', 'Luo', 'Fan', 'Cui',
  ],
  givenSyllables: [
    'Wei', 'Min', 'Shan', 'Qing', 'Yuan', 'Hao', 'Ling', 'Jie', 'Cheng', 'Zhi',
    'Ning', 'Bo', 'Yi', 'Ran', 'Xian', 'Ru', 'Tai', 'Yong', 'Mei', 'Xiao',
  ],
  sectAdjectives: [
    'Azure', 'Crimson', 'Jade', 'Iron', 'Nine', 'Silent', 'Thousand',
    'Void', 'Heaven', 'Moon', 'Frozen', 'Eternal',
  ],
  sectObjects: [
    'Cloud', 'Sword', 'Lotus', 'Mist', 'Peak', 'Blade', 'Flame', 'River',
    'Serpent', 'Tiger', 'Phoenix', 'Pavilion',
  ],
  sectSuffixes: [
    'Sect', 'Valley', 'Pavilion', 'Palace', 'Gate', 'Temple', 'Hall',
  ],
  placePrefixes: [
    'Cold', 'Iron', 'Old', 'Quiet', 'White', 'Nine-Hundred-Steps',
    'Forgotten', 'Withered', 'Southern', 'Jade',
  ],
  placeFeatures: [
    'Peak', 'Gorge', 'Village', 'Crossroad', 'Ford', 'Hollow',
    'Grove', 'Pass', 'Town', 'Hermitage',
  ],
};

export function generatePersonalName(pools: NamePools, rng: IRng): string {
  const family = rng.pick(pools.familyNames);
  const first = rng.pick(pools.givenSyllables);
  // 50% chance of two-syllable given name.
  const twoSyl = rng.next() < 0.5;
  const given = twoSyl ? first + rng.pick(pools.givenSyllables) : first;
  return `${family} ${given}`;
}

export function generateSectName(pools: NamePools, rng: IRng): string {
  const adj = rng.pick(pools.sectAdjectives);
  const obj = rng.pick(pools.sectObjects);
  const suf = rng.pick(pools.sectSuffixes);
  return `${adj} ${obj} ${suf}`;
}

export function generatePlaceName(pools: NamePools, rng: IRng): string {
  const pref = rng.pick(pools.placePrefixes);
  const feat = rng.pick(pools.placeFeatures);
  return `${pref} ${feat}`;
}
