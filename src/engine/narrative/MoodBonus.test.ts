import { describe, it, expect } from 'vitest';
import { CheckCategory, Mood } from '@/engine/core/Types';
import { computeMoodBonus, MOOD_BONUS_TABLE } from './MoodBonus';

describe('MOOD_BONUS_TABLE', () => {
  it('returns 0 for categories with no explicit entry', () => {
    // Phase 1C: most categories × moods default to 0.
    expect(computeMoodBonus('serenity', 'lore_scholarship')).toBe(0);
  });

  it('rage boosts combat checks, penalises social ones', () => {
    expect(computeMoodBonus('rage', 'brute_force')).toBeGreaterThan(0);
    expect(computeMoodBonus('rage', 'melee_skill')).toBeGreaterThan(0);
    expect(computeMoodBonus('rage', 'social_persuade')).toBeLessThan(0);
  });

  it('serenity boosts cultivation and meditation', () => {
    expect(computeMoodBonus('serenity', 'cultivation_attempt')).toBeGreaterThan(0);
    expect(computeMoodBonus('serenity', 'insight_puzzle')).toBeGreaterThan(0);
  });

  it('paranoia boosts dodge, penalises social', () => {
    expect(computeMoodBonus('paranoia', 'dodge_flee')).toBeGreaterThan(0);
    expect(computeMoodBonus('paranoia', 'social_persuade')).toBeLessThan(0);
  });

  it('resolve gives a small bonus everywhere', () => {
    // Resolve = determined state. Small positive bonus across all categories.
    for (const cat of [
      'brute_force', 'melee_skill', 'cultivation_attempt', 'social_persuade',
    ] as CheckCategory[]) {
      expect(computeMoodBonus('resolve', cat)).toBeGreaterThanOrEqual(1);
    }
  });

  it('sorrow / melancholy penalise combat but boost insight', () => {
    expect(computeMoodBonus('sorrow', 'brute_force')).toBeLessThanOrEqual(0);
    expect(computeMoodBonus('melancholy', 'insight_puzzle')).toBeGreaterThan(0);
  });

  it('all table entries are within [-5, +5]', () => {
    for (const mood of Object.keys(MOOD_BONUS_TABLE) as Mood[]) {
      for (const cat of Object.keys(MOOD_BONUS_TABLE[mood]) as CheckCategory[]) {
        const v = MOOD_BONUS_TABLE[mood][cat]!;
        expect(v).toBeGreaterThanOrEqual(-5);
        expect(v).toBeLessThanOrEqual(5);
      }
    }
  });
});
