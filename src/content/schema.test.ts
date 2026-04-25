import { describe, it, expect } from 'vitest';
import { TechniqueSchema, TechniquePackSchema } from './schema';

describe('TechniqueSchema (Phase 2B-1 Task 3)', () => {
  it('accepts a valid minimal mortal-grade technique', () => {
    const parsed = TechniqueSchema.parse({
      id: 'common_qi_circulation',
      name: 'Common Qi Circulation',
      grade: 'mortal',
      element: 'none',
      coreAffinity: ['any'],
      requires: {},
      qiCost: 0,
      effects: [{ kind: 'qi_regen', amount: 1 }],
      description: 'The most basic circulation drill.',
    });
    expect(parsed.id).toBe('common_qi_circulation');
  });

  it('accepts all 6 effect kinds', () => {
    const parsed = TechniqueSchema.parse({
      id: 't',
      name: 'T',
      grade: 'mortal',
      element: 'fire',
      coreAffinity: ['blood_ember'],
      requires: { realm: 'qi_sensing' },
      qiCost: 5,
      effects: [
        { kind: 'choice_bonus', category: 'strike', bonus: 10 },
        { kind: 'qi_regen', amount: 2 },
        { kind: 'insight_gain_per_meditation', amount: 1 },
        { kind: 'mood_modifier', mood: 'rage', delta: 1 },
        { kind: 'unlock_choice', choiceId: 'x' },
        { kind: 'cultivation_multiplier_pct', pct: 15 },
      ],
      description: 'All effect kinds.',
    });
    expect(parsed.effects.length).toBe(6);
  });

  it('rejects an unknown grade', () => {
    expect(() => TechniqueSchema.parse({
      id: 't', name: 'T', grade: 'cosmic' as any, element: 'none',
      coreAffinity: ['any'], requires: {}, qiCost: 0, effects: [], description: '',
    })).toThrow();
  });

  it('TechniquePackSchema wraps a list', () => {
    const pack = TechniquePackSchema.parse({
      version: 1,
      techniques: [{
        id: 't', name: 'T', grade: 'mortal', element: 'none',
        coreAffinity: ['any'], requires: {}, qiCost: 0,
        effects: [], description: '',
      }],
    });
    expect(pack.techniques).toHaveLength(1);
  });
});
