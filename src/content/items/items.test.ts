import { describe, it, expect } from 'vitest';
import { loadItems } from './loader';
import corpus from './items.json';
import { ItemRegistry, isManual, ItemDef } from '@/engine/cultivation/ItemRegistry';

describe('canonical item corpus (Phase 2B-2 Task 5)', () => {
  const items = loadItems(corpus);

  it('has exactly 20 items', () => {
    expect(items).toHaveLength(20);
  });

  it('type breakdown: 6 pills + 6 manuals + 1 weapon + 1 armor + 3 talismans + 3 misc', () => {
    const byType = new Map<string, number>();
    for (const i of items) {
      byType.set(i.type, (byType.get(i.type) ?? 0) + 1);
    }
    expect(byType.get('pill')).toBe(6);
    expect(byType.get('manual')).toBe(6);
    expect(byType.get('weapon')).toBe(1);
    expect(byType.get('armor')).toBe(1);
    expect(byType.get('talisman')).toBe(3);
    expect(byType.get('misc')).toBe(3);
  });

  it('hydrates an ItemRegistry without errors', () => {
    expect(() => ItemRegistry.fromList(items as ReadonlyArray<ItemDef>)).not.toThrow();
  });

  it('all manuals carry teaches + completeness ∈ {0.25, 0.5, 0.75, 1.0}', () => {
    const manuals = items.filter((i) => isManual(i as ItemDef));
    expect(manuals).toHaveLength(6);
    for (const m of manuals) {
      expect(typeof m.teaches).toBe('string');
      expect([0.25, 0.5, 0.75, 1.0]).toContain(m.completeness!);
    }
  });

  it('manuals span all four completeness tiers', () => {
    const completenessSet = new Set(
      items.filter((i) => i.type === 'manual').map((m) => m.completeness),
    );
    expect(completenessSet).toEqual(new Set([0.25, 0.5, 0.75, 1.0]));
  });

  it('contains the three Phase 1 backfill items', () => {
    const ids = new Set(items.map((i) => i.id));
    expect(ids.has('spiritual_stone')).toBe(true);
    expect(ids.has('minor_healing_pill')).toBe(true);
    expect(ids.has('silver_pouch')).toBe(true);
  });

  it('every manual.teaches references a real technique id from techniques.json', () => {
    const TECHNIQUE_IDS = new Set([
      'iron_mountain_body_seal', 'severing_edge_swordform', 'still_water_heart_sutra',
      'howling_storm_step', 'blood_ember_sigil', 'thousand_mirrors_mnemonic',
      'common_qi_circulation', 'novice_fireball', 'golden_bell_defense', 'wind_walking_steps',
    ]);
    for (const i of items) {
      if (i.type === 'manual') {
        expect(TECHNIQUE_IDS.has(i.teaches!)).toBe(true);
      }
    }
  });

  it('blood_ember_sigil_fragment has the strictest reader requirements', () => {
    const m = items.find((x) => x.id === 'manual_blood_ember_sigil_fragment')!;
    expect(m.readerRequires?.minMind).toBe(12);
    expect(m.readerRequires?.minInsight).toBe(5);
  });
});
