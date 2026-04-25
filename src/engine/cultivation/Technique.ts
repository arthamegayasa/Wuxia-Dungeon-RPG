// Technique types + choice-bonus resolver.
// Source: docs/spec/design.md §4.7, §9.5.

import { CorePathId, Element, Realm, Mood } from '@/engine/core/Types';

export type TechniqueGrade = 'mortal' | 'yellow' | 'profound' | 'earth' | 'heaven' | 'immortal';

/** CoreAffinity can be a path id OR the universal token 'any'. */
export type CoreAffinityToken = CorePathId | 'any';

export type TechniqueEffect =
  | { kind: 'choice_bonus'; category: string; bonus: number }
  | { kind: 'qi_regen'; amount: number }
  | { kind: 'insight_gain_per_meditation'; amount: number }
  | { kind: 'mood_modifier'; mood: Mood; delta: number }
  | { kind: 'unlock_choice'; choiceId: string }
  | { kind: 'cultivation_multiplier_pct'; pct: number };  // e.g. 20 → +20%

export interface TechniqueRankEffects {
  novice: ReadonlyArray<TechniqueEffect>;
  adept: ReadonlyArray<TechniqueEffect>;
  master: ReadonlyArray<TechniqueEffect>;
}

export interface TechniqueDef {
  id: string;
  name: string;
  grade: TechniqueGrade;
  element: Element;
  coreAffinity: ReadonlyArray<CoreAffinityToken>;
  requires: {
    realm?: Realm;
    meridians?: ReadonlyArray<number>;
    openMeridianCount?: number;
  };
  qiCost: number;
  insightCost?: number;
  effects: ReadonlyArray<TechniqueEffect>;
  description: string;
  /** Novice-tier effects are what's active in Phase 2B; adept/master tracked for Phase 3. */
  rankPath?: TechniqueRankEffects;
}

/**
 * DEPRECATED (kept for call-site compatibility until Task 7 migrates both). Use
 * `resolveTechniqueBonusWithAffinity` for affinity-aware resolution.
 *
 * Sum all `choice_bonus` contributions across the character's learned techniques
 * for a specific category, ignoring core-path affinity.
 */
export function resolveTechniqueBonus(
  techniques: ReadonlyArray<TechniqueDef>,
  category: string,
): number {
  let total = 0;
  for (const t of techniques) {
    for (const eff of t.effects) {
      if (eff.kind === 'choice_bonus' && eff.category === category) {
        total += eff.bonus;
      }
    }
  }
  return total;
}

/**
 * Affinity multiplier for a technique given the character's core path.
 *   1.0 if coreAffinity includes 'any'
 *   1.0 if corePath is null (character hasn't revealed a path yet)
 *   1.0 if coreAffinity includes the character's corePath
 *   0.5 otherwise (off-path)
 */
export function affinityMultiplier(
  t: TechniqueDef,
  corePath: CorePathId | null,
): number {
  if (t.coreAffinity.includes('any')) return 1.0;
  if (corePath === null) return 1.0;
  return t.coreAffinity.includes(corePath) ? 1.0 : 0.5;
}
