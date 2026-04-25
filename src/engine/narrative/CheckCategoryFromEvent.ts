// Map event.category strings to CheckCategory for moodBonus lookup.
// Source: Phase 2B-1 forward note #4 — the moodBonus guard previously
// zero'd out for any check missing a techniqueBonusCategory; this mapper
// gives every check a CheckCategory derived from its event.

import { CheckCategory } from '@/engine/core/Types';

const EVENT_CATEGORY_TO_CHECK: Record<string, CheckCategory> = {
  'life.daily': 'survival',
  'life.training': 'cultivation_attempt',
  'life.training.body': 'brute_force',
  'life.training.qi': 'cultivation_attempt',
  'life.social': 'social_persuade',
  'life.social.bond': 'social_persuade',
  'life.social.rivalry': 'social_intimidate',
  'life.social.elder': 'social_persuade',
  'life.danger': 'dodge_flee',
  'life.danger.combat': 'melee_skill',
  'life.opportunity': 'lore_scholarship',
  'life.realm_gate': 'cultivation_attempt',
  'life.transition': 'survival',
  'life.meditation': 'cultivation_attempt',
  // Yellow Plains uses bare "meditation" (no "life." prefix); cover both forms.
  'meditation': 'cultivation_attempt',
};

/**
 * Map an event.category to a CheckCategory for moodBonus lookup.
 * Default: 'lore_scholarship' (most generic; no negative mood-bias against any mood).
 *
 * Used at engineBridge.resolveChoice + GameLoop.runTurn after the moodBonus
 * guard fix in Phase 2B-2 Task 13. Previously the gate required
 * `choice.check.techniqueBonusCategory` which silently zero'd mood for any
 * check without that field. New gate: any choice with a `check` gets a
 * mood bonus based on event.category.
 */
export function checkCategoryFromEvent(eventCategory: string): CheckCategory {
  return EVENT_CATEGORY_TO_CHECK[eventCategory] ?? 'lore_scholarship';
}
