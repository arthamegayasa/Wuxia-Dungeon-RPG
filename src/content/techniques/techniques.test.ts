import { describe, it, expect } from 'vitest';
import { loadTechniques } from './loader';
import corpus from './techniques.json';
import { TechniqueRegistry } from '@/engine/cultivation/TechniqueRegistry';
import { affinityMultiplier } from '@/engine/cultivation/Technique';

describe('canonical techniques corpus', () => {
  const techniques = loadTechniques(corpus);

  it('has exactly 10 canonical techniques', () => {
    expect(techniques).toHaveLength(10);
  });

  it('has the 10 expected ids in the spec §4.2 order', () => {
    expect(techniques.map((t) => t.id)).toEqual([
      'iron_mountain_body_seal',
      'severing_edge_swordform',
      'still_water_heart_sutra',
      'howling_storm_step',
      'blood_ember_sigil',
      'thousand_mirrors_mnemonic',
      'common_qi_circulation',
      'novice_fireball',
      'golden_bell_defense',
      'wind_walking_steps',
    ]);
  });

  it('hydrates a TechniqueRegistry without duplicate errors', () => {
    expect(() => TechniqueRegistry.fromList(techniques as any)).not.toThrow();
  });

  it('common_qi_circulation has any-affinity (universal)', () => {
    const t = techniques.find((x) => x.id === 'common_qi_circulation')!;
    expect(t.coreAffinity).toContain('any');
    expect(affinityMultiplier(t as any, null)).toBe(1.0);
    expect(affinityMultiplier(t as any, 'iron_mountain')).toBe(1.0);
  });

  it('iron_mountain_body_seal is on-path for iron_mountain, off-path otherwise', () => {
    const t = techniques.find((x) => x.id === 'iron_mountain_body_seal')!;
    expect(affinityMultiplier(t as any, 'iron_mountain')).toBe(1.0);
    expect(affinityMultiplier(t as any, 'severing_edge')).toBe(0.5);
    expect(affinityMultiplier(t as any, null)).toBe(1.0);
  });

  it('all yellow-grade techniques require Qi Sensing realm minimum', () => {
    for (const t of techniques) {
      if (t.grade === 'yellow') {
        expect(t.requires.realm).toBe('qi_sensing');
      }
    }
  });

  it('still_water_heart_sutra carries cultivation_multiplier_pct effect', () => {
    const t = techniques.find((x) => x.id === 'still_water_heart_sutra')!;
    const cm = t.effects.find((e) => e.kind === 'cultivation_multiplier_pct');
    expect(cm).toBeDefined();
  });

  it('howling_storm_step grants the flee_mounted_pursuer choice unlock', () => {
    const t = techniques.find((x) => x.id === 'howling_storm_step')!;
    const ul = t.effects.find((e) => e.kind === 'unlock_choice');
    expect(ul).toEqual({ kind: 'unlock_choice', choiceId: 'flee_mounted_pursuer' });
  });
});
