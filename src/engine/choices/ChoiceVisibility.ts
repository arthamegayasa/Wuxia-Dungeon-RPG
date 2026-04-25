// Filter event.choices by unlock_choice technique gates.
// Source: Phase 2B-1 forward note #2.

import { Choice } from '@/content/schema';
import { TechniqueDef } from '@/engine/cultivation/Technique';

/**
 * Returns the set of choiceIds the character has unlocked via learned techniques
 * whose effects declare `unlock_choice: { choiceId: '...' }`.
 */
export function unlockedChoiceIds(
  techniques: ReadonlyArray<TechniqueDef>,
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const t of techniques) {
    for (const eff of t.effects) {
      if (eff.kind === 'unlock_choice') ids.add(eff.choiceId);
    }
  }
  return ids;
}

/**
 * Returns the subset of `choices` visible to the character: a choice is visible
 * if it has no `unlockedBy` field OR `unlockedBy` is in the unlocked-choice set.
 */
export function filterUnlockedChoices(
  choices: ReadonlyArray<Choice>,
  unlocks: ReadonlySet<string>,
): ReadonlyArray<Choice> {
  return choices.filter((c) => !c.unlockedBy || unlocks.has(c.unlockedBy));
}
