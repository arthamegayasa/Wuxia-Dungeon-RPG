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
    // Bai Jia Xing selective — top 50+
    'Lin', 'Wang', 'Zhao', 'Liu', 'Chen', 'Li', 'Zhang', 'Huang', 'Yang', 'Zhou',
    'Wu', 'Xu', 'Sun', 'Zhu', 'Ma', 'Hu', 'Guo', 'He', 'Gao', 'Luo',
    'Song', 'Zheng', 'Xie', 'Han', 'Tang', 'Feng', 'Yu', 'Dong', 'Xiao', 'Cao',
    'Cheng', 'Peng', 'Lu', 'Fan', 'Cui', 'Shen', 'Mo', 'Qian', 'Bai', 'Gu',
    'Jiao', 'Yue', 'Meng', 'Ren', 'Kong', 'Shi', 'Jia', 'Nie', 'Qiu', 'Duan',
    'Fu', 'Qu', 'Ding',
  ],
  givenSyllables: [
    // Classical virtues/nature (20)
    'Wei', 'Min', 'Shan', 'Yu', 'Ling', 'Xue', 'Fang', 'Ping', 'An', 'Jing',
    'Hua', 'Lan', 'Mei', 'Yan', 'Rui', 'Jun', 'Tai', 'Heng', 'Qing', 'De',
    // Wuxia flavors/elements (17)
    'Feng', 'Yun', 'Huo', 'Shui', 'Long', 'Hu', 'Niu', 'Hong',
    'Hei', 'Jin', 'Yin', 'Tie', 'Mu', 'Chun', 'Qiu', 'Bai', 'Shi',
    // Peasant names / countryside (17)
    'Lao', 'Xiao', 'Da', 'Er', 'San', 'Si', 'Liu', 'Qi', 'Ba',
    'Tian', 'Gou', 'Shu', 'Cao', 'Mai', 'Dou', 'Dao', 'He',
    // Seasons, moods, qualities (15)
    'Dong', 'Xia', 'Zhao', 'Chen', 'Shao', 'Yi', 'Yue', 'Zhi',
    'Ning', 'Xin', 'Cheng', 'Lian', 'Yao', 'Yong', 'Ren',
    // Extended — additional wuxia register (13)
    'Kai', 'Lie', 'Wan', 'Xiang', 'Zhen', 'Zhong', 'Gang', 'Kun', 'Lei', 'Hai',
    'Jian', 'Pang', 'Qian',
  ],
  sectAdjectives: [
    'Azure', 'Crimson', 'Jade', 'Obsidian', 'Silver', 'Golden', 'Thousand',
    'Black', 'White', 'Eternal', 'Forgotten', 'Hidden', 'Wandering', 'Still',
    'Nine', 'Endless', 'Heavenly', 'Broken', 'Righteous', 'Burning', 'Silent',
    'Moonlit', 'Ancient',
  ],
  sectObjects: [
    'Cloud', 'Sword', 'Lotus', 'Mountain', 'River', 'Moon', 'Sun', 'Phoenix',
    'Dragon', 'Tiger', 'Crane', 'Pine', 'Mirror', 'Scroll', 'Flame',
    'Blade', 'Fist', 'Heart', 'Bone', 'Shadow', 'Star', 'Ocean',
    'Bell',
  ],
  sectSuffixes: [
    'Sect', 'Valley', 'Pavilion', 'Mountain', 'Temple', 'Hall',
    'Palace', 'Peak', 'School', 'Way', 'Gate', 'Dao',
  ],
  placePrefixes: [
    'Cold', 'Iron', 'Old', 'New', 'Broken', 'Hidden', 'Crooked', 'Long',
    'Yellow', 'Black', 'Quiet', 'Whispering', 'Nine', 'Red', 'Lesser',
    'Upper', 'Lower',
  ],
  placeFeatures: [
    'Peak', 'Gorge', 'Village', 'Crossroads', 'Bridge', 'Hollow', 'Ford',
    'Well', 'Mound', 'Ridge', 'Pass', 'Plains', 'Market', 'Shrine', 'Temple',
    'Hill', 'Stream',
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
