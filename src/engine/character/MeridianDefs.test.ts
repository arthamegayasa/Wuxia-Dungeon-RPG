import { describe, it, expect } from 'vitest';
import { MERIDIAN_IDS } from '@/engine/core/Types';
import { MERIDIAN_DEFS, meridianDef, meridianRiskTier } from './MeridianDefs';

describe('MERIDIAN_DEFS', () => {
  it('defines exactly 12 meridians, ids 1..12', () => {
    expect(MERIDIAN_DEFS).toHaveLength(12);
    expect(MERIDIAN_DEFS.map(d => d.id).sort((a,b) => a-b)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12]);
  });

  it('each MERIDIAN_ID has a def', () => {
    for (const id of MERIDIAN_IDS) {
      expect(meridianDef(id).id).toBe(id);
    }
  });

  it('names match spec', () => {
    expect(meridianDef(1).name).toBe('Lung');
    expect(meridianDef(5).name).toBe('Heart');
    expect(meridianDef(10).name).toBe('Triple Burner');
    expect(meridianDef(12).name).toBe('Liver');
  });

  it('elements per spec', () => {
    expect(meridianDef(1).element).toBe('metal');   // Lung
    expect(meridianDef(3).element).toBe('earth');   // Stomach
    expect(meridianDef(5).element).toBe('fire');    // Heart
    expect(meridianDef(8).element).toBe('water');   // Kidney
    expect(meridianDef(11).element).toBe('wood');   // Gallbladder
  });

  it('risk tiers match spec', () => {
    // low, low, low, medium, high, medium, low, high, high, very_high, medium, medium
    expect(meridianDef(1).baseRisk).toBe(meridianRiskTier('low'));
    expect(meridianDef(4).baseRisk).toBe(meridianRiskTier('medium'));
    expect(meridianDef(5).baseRisk).toBe(meridianRiskTier('high'));
    expect(meridianDef(10).baseRisk).toBe(meridianRiskTier('very_high'));
  });

  it('meridianRiskTier returns ascending deviation chances', () => {
    expect(meridianRiskTier('low')).toBeLessThan(meridianRiskTier('medium'));
    expect(meridianRiskTier('medium')).toBeLessThan(meridianRiskTier('high'));
    expect(meridianRiskTier('high')).toBeLessThan(meridianRiskTier('very_high'));
    expect(meridianRiskTier('very_high')).toBeLessThanOrEqual(50);
  });

  it('throws on unknown id', () => {
    // @ts-expect-error — deliberately bad input
    expect(() => meridianDef(99)).toThrow(/unknown meridian/i);
  });
});
