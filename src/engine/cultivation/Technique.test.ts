import { describe, it, expect } from 'vitest';
import {
  TechniqueDef,
  TechniqueEffect,
  CoreAffinityToken,
  affinityMultiplier,
  resolveTechniqueBonusWithAffinity,
  computeCultivationMultiplier,
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

describe('resolveTechniqueBonusWithAffinity (Phase 2B-1 Task 6)', () => {
  const ironT: TechniqueDef = {
    id: 'i', name: 'I', grade: 'mortal', element: 'none',
    coreAffinity: ['iron_mountain'], requires: {}, qiCost: 0,
    effects: [{ kind: 'choice_bonus', category: 'strike', bonus: 20 }],
    description: '',
  };

  const anyT: TechniqueDef = {
    ...ironT, id: 'a', coreAffinity: ['any'],
    effects: [{ kind: 'choice_bonus', category: 'strike', bonus: 10 }],
  };

  const irrelevant: TechniqueDef = {
    ...ironT, id: 'x', coreAffinity: ['any'],
    effects: [{ kind: 'choice_bonus', category: 'evade', bonus: 30 }],
  };

  it('sums only matching-category bonuses', () => {
    const b = resolveTechniqueBonusWithAffinity({
      techniques: [ironT, irrelevant],
      corePath: 'iron_mountain',
      category: 'strike',
    });
    expect(b).toBe(20);
  });

  it('applies on-path 1.0 multiplier', () => {
    const b = resolveTechniqueBonusWithAffinity({
      techniques: [ironT],
      corePath: 'iron_mountain',
      category: 'strike',
    });
    expect(b).toBe(20);
  });

  it('applies off-path 0.5 multiplier (rounded)', () => {
    const b = resolveTechniqueBonusWithAffinity({
      techniques: [ironT],
      corePath: 'severing_edge',
      category: 'strike',
    });
    expect(b).toBe(10);
  });

  it("'any' affinity gives full bonus regardless of path", () => {
    const b = resolveTechniqueBonusWithAffinity({
      techniques: [anyT],
      corePath: 'severing_edge',
      category: 'strike',
    });
    expect(b).toBe(10);
  });

  it('null corePath gives full bonus (pre-reveal)', () => {
    const b = resolveTechniqueBonusWithAffinity({
      techniques: [ironT],
      corePath: null,
      category: 'strike',
    });
    expect(b).toBe(20);
  });

  it('mixed roster: on-path 20 + off-path 10 = 30', () => {
    const ironAndSev = [
      ironT,
      { ...ironT, id: 's', coreAffinity: ['severing_edge' as const],
        effects: [{ kind: 'choice_bonus' as const, category: 'strike', bonus: 20 }] },
    ];
    const b = resolveTechniqueBonusWithAffinity({
      techniques: ironAndSev,
      corePath: 'iron_mountain',
      category: 'strike',
    });
    expect(b).toBe(30);
  });
});

describe('computeCultivationMultiplier (Phase 2B-1 Task 10)', () => {
  it('empty → 1.0', () => {
    expect(computeCultivationMultiplier([])).toBe(1.0);
  });

  it('single +20% → 1.2', () => {
    const t: TechniqueDef = {
      id: 't', name: 'T', grade: 'mortal', element: 'none',
      coreAffinity: ['any'], requires: {}, qiCost: 0,
      effects: [{ kind: 'cultivation_multiplier_pct', pct: 20 }],
      description: '',
    };
    expect(computeCultivationMultiplier([t])).toBeCloseTo(1.2, 3);
  });

  it('multiple sum additively: 15% + 25% = 1.4', () => {
    const mkT = (pct: number): TechniqueDef => ({
      id: `t${pct}`, name: 'T', grade: 'mortal', element: 'none',
      coreAffinity: ['any'], requires: {}, qiCost: 0,
      effects: [{ kind: 'cultivation_multiplier_pct', pct }],
      description: '',
    });
    expect(computeCultivationMultiplier([mkT(15), mkT(25)])).toBeCloseTo(1.4, 3);
  });

  it('ignores non-cultivation effects', () => {
    const t: TechniqueDef = {
      id: 't', name: 'T', grade: 'mortal', element: 'none',
      coreAffinity: ['any'], requires: {}, qiCost: 0,
      effects: [
        { kind: 'choice_bonus', category: 'strike', bonus: 50 },
        { kind: 'cultivation_multiplier_pct', pct: 10 },
      ],
      description: '',
    };
    expect(computeCultivationMultiplier([t])).toBeCloseTo(1.1, 3);
  });
});
