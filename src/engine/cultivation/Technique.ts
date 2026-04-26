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

export interface ResolveTechniqueBonusArgs {
  techniques: ReadonlyArray<TechniqueDef>;
  corePath: CorePathId | null;
  category: string;
}

/**
 * Affinity-aware technique bonus resolution.
 *
 * Sums `choice_bonus` effects whose `category` matches, scaled by each
 * technique's `affinityMultiplier(corePath)`. Result is rounded to the
 * nearest integer.
 *
 * Replaces the deprecated `resolveTechniqueBonus(techniques, category)` at
 * the GameLoop/engineBridge call sites (see Task 7).
 */
export function resolveTechniqueBonusWithAffinity(
  args: ResolveTechniqueBonusArgs,
): number {
  let total = 0;
  for (const t of args.techniques) {
    const mult = affinityMultiplier(t, args.corePath);
    for (const eff of t.effects) {
      if (eff.kind === 'choice_bonus' && eff.category === args.category) {
        total += eff.bonus * mult;
      }
    }
  }
  return Math.round(total);
}

/**
 * Sum `cultivation_multiplier_pct` effects across techniques.
 * Returns 1 + Σpct/100. Empty → 1.0 (the neutral multiplier).
 *
 * `pct` is in PERCENTAGE POINTS, not a fraction — pct=20 means +20%
 * (multiplier 1.20). The `cultivationGainRate.techniqueMultiplier`
 * parameter at [src/engine/cultivation/CultivationProgress.ts:13](../../../src/engine/cultivation/CultivationProgress.ts:13)
 * consumes this directly as a multiplicative factor (default 1.0).
 */
export function computeCultivationMultiplier(
  techniques: ReadonlyArray<TechniqueDef>,
): number {
  let pctSum = 0;
  for (const t of techniques) {
    for (const eff of t.effects) {
      if (eff.kind === 'cultivation_multiplier_pct') pctSum += eff.pct;
    }
  }
  return 1 + pctSum / 100;
}
