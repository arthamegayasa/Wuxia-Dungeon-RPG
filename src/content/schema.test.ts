import { describe, it, expect } from 'vitest';
import { TechniqueSchema, TechniquePackSchema, ItemSchema, ItemPackSchema } from './schema';

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

  it('rejects empty coreAffinity array', () => {
    expect(() => TechniqueSchema.parse({
      id: 't', name: 'T', grade: 'mortal', element: 'none',
      coreAffinity: [],
      requires: {}, qiCost: 0, effects: [], description: '',
    })).toThrow();
  });

  it('rejects unknown effect kind', () => {
    expect(() => TechniqueSchema.parse({
      id: 't', name: 'T', grade: 'mortal', element: 'none',
      coreAffinity: ['any'], requires: {}, qiCost: 0,
      effects: [{ kind: 'fly', amount: 1 } as any],
      description: '',
    })).toThrow();
  });

  it('rejects empty id string', () => {
    expect(() => TechniqueSchema.parse({
      id: '', name: 'T', grade: 'mortal', element: 'none',
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

describe('ItemSchema (Phase 2B-1 Task 8)', () => {
  it('accepts a pill', () => {
    const parsed = ItemSchema.parse({
      id: 'minor_healing_pill', name: 'Minor Healing Pill',
      type: 'pill', grade: 'mortal', stackable: true,
      effects: [{ kind: 'heal_hp', amount: 30 }],
      description: '',
    });
    expect(parsed.id).toBe('minor_healing_pill');
  });

  it('accepts a manual with completeness 0.25', () => {
    const parsed = ItemSchema.parse({
      id: 'manual_x_fragment', name: 'Fragment Manual',
      type: 'manual', grade: 'yellow', stackable: false,
      effects: [],
      description: '',
      teaches: 'technique_x',
      completeness: 0.25,
    });
    expect(parsed.completeness).toBe(0.25);
  });

  it('rejects manual with invalid completeness (e.g. 0.6)', () => {
    expect(() => ItemSchema.parse({
      id: 'm', name: 'M', type: 'manual', grade: 'mortal', stackable: false,
      effects: [], description: '', teaches: 't', completeness: 0.6,
    })).toThrow();
  });

  it('accepts a weapon with choice_bonus', () => {
    const parsed = ItemSchema.parse({
      id: 'sword', name: 'Sword', type: 'weapon', grade: 'mortal', stackable: false,
      effects: [{ kind: 'choice_bonus', category: 'strike', bonus: 3 }],
      description: '',
    });
    expect(parsed.type).toBe('weapon');
  });

  it('ItemPackSchema wraps a list', () => {
    const p = ItemPackSchema.parse({
      version: 1,
      items: [{ id: 'a', name: 'A', type: 'misc', grade: 'mortal', stackable: true, effects: [], description: '' }],
    });
    expect(p.items).toHaveLength(1);
  });
});
