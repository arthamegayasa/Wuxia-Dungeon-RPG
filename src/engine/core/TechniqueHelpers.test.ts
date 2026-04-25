import { describe, it, expect } from 'vitest';
import { resolveLearnedTechniqueBonus } from './TechniqueHelpers';
import { TechniqueRegistry } from '@/engine/cultivation/TechniqueRegistry';
import { TechniqueDef } from '@/engine/cultivation/Technique';

const ironT: TechniqueDef = {
  id: 'iron', name: 'Iron', grade: 'mortal', element: 'none',
  coreAffinity: ['iron_mountain'], requires: {}, qiCost: 0,
  effects: [{ kind: 'choice_bonus', category: 'strike', bonus: 20 }],
  description: '',
};

describe('resolveLearnedTechniqueBonus (Phase 2B-1 Task 7)', () => {
  it('empty registry → 0', () => {
    expect(resolveLearnedTechniqueBonus({
      registry: TechniqueRegistry.empty(),
      learnedIds: ['iron'], corePath: 'iron_mountain', category: 'strike',
    })).toBe(0);
  });

  it('empty learnedIds → 0', () => {
    const r = TechniqueRegistry.fromList([ironT]);
    expect(resolveLearnedTechniqueBonus({
      registry: r, learnedIds: [], corePath: 'iron_mountain', category: 'strike',
    })).toBe(0);
  });

  it('on-path matching category → full bonus', () => {
    const r = TechniqueRegistry.fromList([ironT]);
    expect(resolveLearnedTechniqueBonus({
      registry: r, learnedIds: ['iron'], corePath: 'iron_mountain', category: 'strike',
    })).toBe(20);
  });

  it('off-path → halved', () => {
    const r = TechniqueRegistry.fromList([ironT]);
    expect(resolveLearnedTechniqueBonus({
      registry: r, learnedIds: ['iron'], corePath: 'severing_edge', category: 'strike',
    })).toBe(10);
  });

  it('learned id not in registry is ignored', () => {
    const r = TechniqueRegistry.fromList([ironT]);
    expect(resolveLearnedTechniqueBonus({
      registry: r, learnedIds: ['iron', 'ghost'], corePath: 'iron_mountain', category: 'strike',
    })).toBe(20);
  });
});
