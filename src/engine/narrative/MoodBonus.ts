// Mood × CheckCategory bonus table.
// Phase 1C: small integer modifiers within [-5, +5]. Source: inferred from spec §5 tone.

import { CheckCategory, Mood } from '@/engine/core/Types';

export type MoodBonusTable = Partial<Record<Mood, Partial<Record<CheckCategory, number>>>>;

export const MOOD_BONUS_TABLE: Record<Mood, Partial<Record<CheckCategory, number>>> = {
  rage: {
    brute_force: +3,
    melee_skill: +2,
    qi_combat: +2,
    social_persuade: -3,
    social_seduce: -3,
    deception: -2,
    insight_puzzle: -2,
  },
  sorrow: {
    brute_force: -2,
    melee_skill: -2,
    social_seduce: -2,
    insight_puzzle: +1,
    lore_scholarship: +1,
  },
  serenity: {
    cultivation_attempt: +3,
    insight_puzzle: +2,
    resist_mental: +3,
    social_persuade: +1,
  },
  paranoia: {
    dodge_flee: +3,
    resist_poison: +2,
    survival: +2,
    social_persuade: -3,
    social_intimidate: +1,
    deception: +2,
  },
  resolve: {
    brute_force: +1,
    melee_skill: +1,
    cultivation_attempt: +1,
    social_persuade: +1,
    social_intimidate: +2,
    resist_mental: +2,
  },
  melancholy: {
    insight_puzzle: +2,
    lore_scholarship: +2,
    social_seduce: -2,
    brute_force: -2,
  },
};

export function computeMoodBonus(mood: Mood, category: CheckCategory): number {
  return MOOD_BONUS_TABLE[mood]?.[category] ?? 0;
}
