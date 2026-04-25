import { describe, it, expect } from 'vitest';
import {
  TechniqueDef,
  TechniqueEffect,
  CoreAffinityToken,
  resolveTechniqueBonus,
  affinityMultiplier,
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

describe('TechniqueEffect expansion (Phase 2B-1 Task 2)', () => {
  it('accepts mood_modifier kind', () => {
    const e: TechniqueEffect = { kind: 'mood_modifier', mood: 'serenity', delta: 2 };
    expect(e.kind).toBe('mood_modifier');
  });

  it('accepts unlock_choice kind', () => {
    const e: TechniqueEffect = { kind: 'unlock_choice', choiceId: 'flee_pursuer' };
    expect(e.kind).toBe('unlock_choice');
  });

  it('accepts cultivation_multiplier_pct kind', () => {
    const e: TechniqueEffect = { kind: 'cultivation_multiplier_pct', pct: 20 };
    expect(e.kind).toBe('cultivation_multiplier_pct');
  });

  it('CoreAffinityToken allows "any"', () => {
    const t: CoreAffinityToken = 'any';
    expect(t).toBe('any');
  });

  it('CoreAffinityToken allows a CorePathId', () => {
    const t: CoreAffinityToken = 'iron_mountain';
    expect(t).toBe('iron_mountain');
  });
});

describe('affinityMultiplier (Phase 2B-1 Task 5)', () => {
  const ironT = {
    id: 'i', name: 'I', grade: 'mortal' as const, element: 'none' as const,
    coreAffinity: ['iron_mountain' as const], requires: {}, qiCost: 0, effects: [], description: '',
  };
  const anyT = { ...ironT, coreAffinity: ['any' as const] };
  const multiT = {
    ...ironT,
    coreAffinity: ['iron_mountain' as const, 'severing_edge' as const],
  };

  it('returns 1.0 for on-path match', () => {
    expect(affinityMultiplier(ironT, 'iron_mountain')).toBe(1.0);
  });

  it('returns 0.5 for off-path', () => {
    expect(affinityMultiplier(ironT, 'severing_edge')).toBe(0.5);
  });

  it('returns 1.0 for any-affinity universal', () => {
    expect(affinityMultiplier(anyT, 'severing_edge')).toBe(1.0);
    expect(affinityMultiplier(anyT, null)).toBe(1.0);
  });

  it('returns 1.0 when character corePath is null (pre-reveal)', () => {
    expect(affinityMultiplier(ironT, null)).toBe(1.0);
  });

  it('returns 1.0 if any coreAffinity element matches', () => {
    expect(affinityMultiplier(multiT, 'severing_edge')).toBe(1.0);
    expect(affinityMultiplier(multiT, 'blood_ember')).toBe(0.5);
  });
});
