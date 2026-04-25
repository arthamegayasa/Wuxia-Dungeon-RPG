// Sum technique mood_modifier effects into a Partial<MoodScores> delta map.
// Source: docs/spec/design.md §6.4, Phase 2B-1 forward note #1.

import { MoodScores } from './Mood';
import { TechniqueDef } from '@/engine/cultivation/Technique';

/**
 * For each `mood_modifier` effect on each technique, accumulate its delta
 * into a mood-keyed map. Result is `Partial<MoodScores>` — only moods with
 * at least one contributing effect appear. Pass to `computeDominantMood`
 * as the `deltas` argument.
 *
 * Empty input or no mood_modifier effects → empty object {}.
 */
export function moodDeltasFromTechniques(
  techniques: ReadonlyArray<TechniqueDef>,
): Partial<MoodScores> {
  const acc: Partial<MoodScores> = {};
  for (const t of techniques) {
    for (const eff of t.effects) {
      if (eff.kind === 'mood_modifier') {
        acc[eff.mood] = (acc[eff.mood] ?? 0) + eff.delta;
      }
    }
  }
  return acc;
}
