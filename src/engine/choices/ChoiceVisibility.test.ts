import { describe, it, expect } from 'vitest';
import { unlockedChoiceIds, filterUnlockedChoices } from './ChoiceVisibility';
import { TechniqueDef } from '@/engine/cultivation/Technique';
import { Choice } from '@/content/schema';

const wsTechnique: TechniqueDef = {
  id: 'wind_walking_steps', name: 'X', grade: 'mortal', element: 'none',
  coreAffinity: ['howling_storm', 'any'], requires: {}, qiCost: 3,
  effects: [{ kind: 'unlock_choice', choiceId: 'traverse_difficult_terrain' }],
  description: '',
};

const choiceUnlocked: Choice = {
  id: 'ch_run', label: 'Run.', timeCost: 'SHORT',
  outcomes: { SUCCESS: { narrativeKey: 'a' }, FAILURE: { narrativeKey: 'a' } },
  unlockedBy: 'traverse_difficult_terrain',
};

const choiceLocked: Choice = {
  id: 'ch_climb', label: 'Climb.', timeCost: 'SHORT',
  outcomes: { SUCCESS: { narrativeKey: 'a' }, FAILURE: { narrativeKey: 'a' } },
  unlockedBy: 'climb_sheer_face',
};

const choiceFree: Choice = {
  id: 'ch_wait', label: 'Wait.', timeCost: 'SHORT',
  outcomes: { SUCCESS: { narrativeKey: 'a' }, FAILURE: { narrativeKey: 'a' } },
};

describe('unlockedChoiceIds (Phase 2B-2 Task 11)', () => {
  it('extracts unlock_choice ids from technique effects', () => {
    const ids = unlockedChoiceIds([wsTechnique]);
    expect(ids.has('traverse_difficult_terrain')).toBe(true);
  });

  it('returns empty set for techniques without unlock_choice effects', () => {
    const t: TechniqueDef = { ...wsTechnique, effects: [{ kind: 'qi_regen', amount: 1 }] };
    const ids = unlockedChoiceIds([t]);
    expect(ids.size).toBe(0);
  });

  it('multiple techniques produce union of unlocked ids', () => {
    const t2: TechniqueDef = {
      ...wsTechnique,
      id: 'other',
      effects: [{ kind: 'unlock_choice', choiceId: 'flee_mounted_pursuer' }],
    };
    const ids = unlockedChoiceIds([wsTechnique, t2]);
    expect(ids.size).toBe(2);
    expect(ids.has('traverse_difficult_terrain')).toBe(true);
    expect(ids.has('flee_mounted_pursuer')).toBe(true);
  });
});

describe('filterUnlockedChoices (Phase 2B-2 Task 11)', () => {
  it('preserves choices with no unlockedBy field', () => {
    const result = filterUnlockedChoices([choiceFree], new Set());
    expect(result).toHaveLength(1);
  });

  it('hides choices whose unlockedBy is not in the unlock set', () => {
    const result = filterUnlockedChoices([choiceLocked], new Set());
    expect(result).toHaveLength(0);
  });

  it('shows choices whose unlockedBy IS in the unlock set', () => {
    const result = filterUnlockedChoices(
      [choiceUnlocked, choiceLocked, choiceFree],
      new Set(['traverse_difficult_terrain']),
    );
    expect(result.map((c) => c.id)).toEqual(['ch_run', 'ch_wait']);
  });

  it('preserves order of input choices', () => {
    const result = filterUnlockedChoices(
      [choiceFree, choiceUnlocked, choiceLocked],
      new Set(['traverse_difficult_terrain']),
    );
    expect(result.map((c) => c.id)).toEqual(['ch_wait', 'ch_run']);
  });
});
