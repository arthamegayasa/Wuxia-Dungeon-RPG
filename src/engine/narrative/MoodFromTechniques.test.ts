import { describe, it, expect } from 'vitest';
import { moodDeltasFromTechniques } from './MoodFromTechniques';
import { TechniqueDef } from '@/engine/cultivation/Technique';

const stillWater: TechniqueDef = {
  id: 'still_water_heart_sutra', name: 'Still Water Heart Sutra', grade: 'mortal', element: 'water',
  coreAffinity: ['still_water'], requires: {}, qiCost: 3,
  effects: [{ kind: 'mood_modifier', mood: 'serenity', delta: 1 }],
  description: 'Calm the mind like still water.',
};

const bloodEmber: TechniqueDef = {
  id: 'blood_ember', name: 'Blood Ember Fist', grade: 'yellow', element: 'fire',
  coreAffinity: ['blood_ember'], requires: {}, qiCost: 10,
  effects: [{ kind: 'mood_modifier', mood: 'rage', delta: 2 }],
  description: 'Fan the embers of battle-fury.',
};

describe('moodDeltasFromTechniques (Phase 2B-2 Task 10)', () => {
  it('empty list returns empty object', () => {
    expect(moodDeltasFromTechniques([])).toEqual({});
  });

  it('single mood_modifier returns single-key delta', () => {
    expect(moodDeltasFromTechniques([stillWater])).toEqual({ serenity: 1 });
  });

  it('two techniques with different moods accumulate independently', () => {
    expect(moodDeltasFromTechniques([stillWater, bloodEmber])).toEqual({ serenity: 1, rage: 2 });
  });

  it('two techniques with the SAME mood sum the delta', () => {
    const t2: TechniqueDef = {
      ...stillWater,
      id: 'other_serenity_tech',
      effects: [{ kind: 'mood_modifier', mood: 'serenity', delta: 3 }],
    };
    expect(moodDeltasFromTechniques([stillWater, t2])).toEqual({ serenity: 4 });
  });

  it('non-mood_modifier effects are ignored', () => {
    const t: TechniqueDef = {
      ...stillWater,
      effects: [{ kind: 'qi_regen', amount: 5 }],
    };
    expect(moodDeltasFromTechniques([t])).toEqual({});
  });
});
