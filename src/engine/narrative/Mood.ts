// Mood score computation. Source: docs/spec/design.md §6.4.

import { Mood } from '@/engine/core/Types';

export interface MoodInputs {
  recentRegrets: number;
  unreturnedDebts: number;
  recentBetrayals: number;
  humiliationsThisYear: number;
  recentMeditationEpochs: number;
  resolvedVows: number;
  recentCloseDeaths: number;
  heavenlyNoticeTier: number;
  recentBreakthroughs: number;
  mastershipsAcquired: number;
  yearsAlone: number;
  wintersInSeclusion: number;
}

export type MoodScores = Record<Mood, number>;

export function zeroMoodInputs(): MoodInputs {
  return {
    recentRegrets: 0,
    unreturnedDebts: 0,
    recentBetrayals: 0,
    humiliationsThisYear: 0,
    recentMeditationEpochs: 0,
    resolvedVows: 0,
    recentCloseDeaths: 0,
    heavenlyNoticeTier: 0,
    recentBreakthroughs: 0,
    mastershipsAcquired: 0,
    yearsAlone: 0,
    wintersInSeclusion: 0,
  };
}

export function moodScores(i: MoodInputs): MoodScores {
  return {
    sorrow:     i.recentRegrets * 2 + i.unreturnedDebts,
    rage:       i.recentBetrayals * 3 + i.humiliationsThisYear,
    serenity:   i.recentMeditationEpochs * 2 + i.resolvedVows,
    paranoia:   i.recentCloseDeaths * 2 + i.heavenlyNoticeTier,
    resolve:    i.recentBreakthroughs * 2 + i.mastershipsAcquired,
    melancholy: i.yearsAlone * 0.5 + i.wintersInSeclusion,
  };
}

/**
 * Tie-break priority (highest wins): resolve > serenity > sorrow > rage > paranoia > melancholy.
 * Array is ordered lowest-priority first; last mood to equal or exceed bestScore wins the tie.
 * Serenity is the quiet baseline: returned explicitly when all scores are zero.
 */
const PRIORITY: ReadonlyArray<Mood> = [
  'melancholy', 'paranoia', 'rage', 'sorrow', 'serenity', 'resolve',
];

export function computeDominantMood(inputs: MoodInputs): Mood {
  const s = moodScores(inputs);
  // If every mood scores zero return the quiet baseline.
  const allZero = (Object.values(s) as number[]).every(v => v === 0);
  if (allZero) return 'serenity';

  // Process lowest-priority first; use >= so higher-priority moods (later in array) win ties.
  let best: Mood = 'serenity';
  let bestScore = -Infinity;
  for (const mood of PRIORITY) {
    if (s[mood] >= bestScore) {
      best = mood;
      bestScore = s[mood];
    }
  }
  return best;
}
