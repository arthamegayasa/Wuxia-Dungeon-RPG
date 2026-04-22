import { describe, it, expect } from 'vitest';
import {
  TechniqueDef,
  resolveTechniqueBonus,
} from './Technique';

const IRON_SHIRT: TechniqueDef = {
  id: 'TECH_IRON_SHIRT_NOVICE',
  name: 'Iron Shirt',
  grade: 'mortal',
  element: 'none',
  coreAffinity: ['iron_mountain'],
  requires: { openMeridianCount: 1 },
  qiCost: 3,
  effects: [
    { kind: 'choice_bonus', category: 'resist_physical', bonus: 15 },
    { kind: 'choice_bonus', category: 'body_cultivation', bonus: 8 },
  ],
  description: '…',
};

const FLAME_PALM: TechniqueDef = {
  id: 'TECH_FLAME_PALM',
  name: 'Flame Palm',
  grade: 'yellow',
  element: 'fire',
  coreAffinity: ['severing_edge'],
  requires: {},
  qiCost: 5,
  effects: [
    { kind: 'choice_bonus', category: 'melee_skill', bonus: 20 },
    { kind: 'choice_bonus', category: 'brute_force', bonus: 10 },
  ],
  description: '…',
};

describe('resolveTechniqueBonus', () => {
  it('returns 0 for unknown category', () => {
    expect(resolveTechniqueBonus([], 'melee_skill')).toBe(0);
    expect(resolveTechniqueBonus([IRON_SHIRT], 'melee_skill')).toBe(0);
  });

  it('sums bonuses across learned techniques for the given category', () => {
    expect(resolveTechniqueBonus([IRON_SHIRT, FLAME_PALM], 'melee_skill')).toBe(20);
    expect(resolveTechniqueBonus([IRON_SHIRT, FLAME_PALM], 'brute_force')).toBe(10);
    expect(resolveTechniqueBonus([IRON_SHIRT, FLAME_PALM], 'resist_physical')).toBe(15);
  });

  it('ignores non-choice_bonus effects', () => {
    const t: TechniqueDef = {
      ...IRON_SHIRT,
      effects: [
        { kind: 'qi_regen', amount: 2 },
        { kind: 'choice_bonus', category: 'melee_skill', bonus: 5 },
      ],
    };
    expect(resolveTechniqueBonus([t], 'melee_skill')).toBe(5);
  });
});
