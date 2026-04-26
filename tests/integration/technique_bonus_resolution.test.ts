import { describe, it, expect, beforeAll } from 'vitest';
import { TechniqueRegistry } from '@/engine/cultivation/TechniqueRegistry';
import { TechniqueDef } from '@/engine/cultivation/Technique';
import { resolveLearnedTechniqueBonus } from '@/engine/core/TechniqueHelpers';
import { TECHNIQUE_REGISTRY, __loadGameplayContent } from '@/services/engineBridge';

describe('Integration: technique bonus resolution respects corePath (Phase 2B-1 exit #3)', () => {
  const sevEdgeStrike: TechniqueDef = {
    id: 'severing_edge_swordform',
    name: 'Severing Edge Swordform',
    grade: 'mortal',
    element: 'metal',
    coreAffinity: ['severing_edge'],
    requires: {},
    qiCost: 8,
    effects: [{ kind: 'choice_bonus', category: 'strike', bonus: 18 }],
    description: 'A sharp offensive form.',
  };

  const registry = TechniqueRegistry.fromList([sevEdgeStrike]);

  it('severing_edge character (on-path) gets full 18 bonus', () => {
    const bonus = resolveLearnedTechniqueBonus({
      registry,
      learnedIds: ['severing_edge_swordform'],
      corePath: 'severing_edge',
      category: 'strike',
    });
    expect(bonus).toBe(18);
  });

  it('iron_mountain character (off-path) gets halved bonus (9)', () => {
    const bonus = resolveLearnedTechniqueBonus({
      registry,
      learnedIds: ['severing_edge_swordform'],
      corePath: 'iron_mountain',
      category: 'strike',
    });
    expect(bonus).toBe(9);
  });

  it('null corePath (pre-reveal) gets full bonus', () => {
    const bonus = resolveLearnedTechniqueBonus({
      registry,
      learnedIds: ['severing_edge_swordform'],
      corePath: null,
      category: 'strike',
    });
    expect(bonus).toBe(18);
  });

  it('different category → 0 bonus', () => {
    const bonus = resolveLearnedTechniqueBonus({
      registry,
      learnedIds: ['severing_edge_swordform'],
      corePath: 'severing_edge',
      category: 'evade',
    });
    expect(bonus).toBe(0);
  });

  it('mixed roster: on-path + off-path both contribute with proper multiplier', () => {
    const ironStrike: TechniqueDef = {
      ...sevEdgeStrike, id: 'iron_mountain_seal',
      coreAffinity: ['iron_mountain'],
      effects: [{ kind: 'choice_bonus', category: 'strike', bonus: 10 }],
    };
    const reg = TechniqueRegistry.fromList([sevEdgeStrike, ironStrike]);

    const ironChar = resolveLearnedTechniqueBonus({
      registry: reg,
      learnedIds: ['severing_edge_swordform', 'iron_mountain_seal'],
      corePath: 'iron_mountain',
      category: 'strike',
    });
    expect(ironChar).toBe(19);
  });
});

describe('canonical corpus technique bonus resolution (Phase 2B-2 Task 9)', () => {
  // Phase 2B-2 Task 24: TECHNIQUE_REGISTRY is lazy-loaded; populate before running.
  beforeAll(async () => { await __loadGameplayContent(); });

  it('iron_mountain_body_seal applies +15 to body_check on-path', () => {
    const bonus = resolveLearnedTechniqueBonus({
      registry: TECHNIQUE_REGISTRY,
      learnedIds: ['iron_mountain_body_seal'],
      corePath: 'iron_mountain',
      category: 'body_check',
    });
    expect(bonus).toBe(15);
  });

  it('iron_mountain_body_seal halved off-path', () => {
    const bonus = resolveLearnedTechniqueBonus({
      registry: TECHNIQUE_REGISTRY,
      learnedIds: ['iron_mountain_body_seal'],
      corePath: 'severing_edge',
      category: 'body_check',
    });
    expect(bonus).toBe(8); // Math.round(15 * 0.5) = 8
  });

  it('common_qi_circulation has any-affinity', () => {
    const t = TECHNIQUE_REGISTRY.byId('common_qi_circulation')!;
    expect(t.coreAffinity).toContain('any');
  });

  it('exit criterion #2: ≥5 distinct choice_bonus categories across corpus', () => {
    const categories = new Set<string>();
    for (const t of TECHNIQUE_REGISTRY.all()) {
      for (const eff of t.effects) {
        if (eff.kind === 'choice_bonus') categories.add(eff.category);
      }
    }
    expect(categories.size).toBeGreaterThanOrEqual(5);
  });
});
