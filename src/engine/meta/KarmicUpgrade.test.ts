import { describe, it, expect } from 'vitest';
import { DEFAULT_UPGRADES, getUpgradeById, KarmicUpgrade } from './KarmicUpgrade';

describe('DEFAULT_UPGRADES', () => {
  it('has exactly 5 entries', () => {
    expect(DEFAULT_UPGRADES).toHaveLength(5);
  });

  it('includes Awakened Soul L1, L2, L3', () => {
    expect(getUpgradeById('awakened_soul_1')).toBeDefined();
    expect(getUpgradeById('awakened_soul_2')).toBeDefined();
    expect(getUpgradeById('awakened_soul_3')).toBeDefined();
  });

  it('includes Heavenly Patience L1, L2', () => {
    expect(getUpgradeById('heavenly_patience_1')).toBeDefined();
    expect(getUpgradeById('heavenly_patience_2')).toBeDefined();
  });

  it('costs escalate per level', () => {
    const l1 = getUpgradeById('awakened_soul_1')!;
    const l2 = getUpgradeById('awakened_soul_2')!;
    const l3 = getUpgradeById('awakened_soul_3')!;
    expect(l2.cost).toBeGreaterThan(l1.cost);
    expect(l3.cost).toBeGreaterThan(l2.cost);
  });

  it('each upgrade has a requires chain (L2 requires L1, L3 requires L2)', () => {
    expect(getUpgradeById('awakened_soul_2')!.requires).toEqual(['awakened_soul_1']);
    expect(getUpgradeById('awakened_soul_3')!.requires).toEqual(['awakened_soul_2']);
    expect(getUpgradeById('awakened_soul_1')!.requires).toEqual([]);
  });

  it('Awakened Soul effect kinds are "spirit_root_reroll_boost"', () => {
    for (const id of ['awakened_soul_1', 'awakened_soul_2', 'awakened_soul_3']) {
      const u = getUpgradeById(id)!;
      expect(u.effect.kind).toBe('spirit_root_reroll_boost');
    }
  });

  it('Heavenly Patience effect is "insight_cap_boost"', () => {
    expect(getUpgradeById('heavenly_patience_1')!.effect.kind).toBe('insight_cap_boost');
  });

  it('getUpgradeById returns undefined for unknown id', () => {
    expect(getUpgradeById('not_a_real_upgrade')).toBeUndefined();
  });
});
