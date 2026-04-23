// Soul Echo types + slot-count utility. Source: docs/spec/design.md §7.2.

import { MetaState } from './MetaState';

export const ECHO_SLOTS_BASELINE = 1;
export const ECHO_SLOTS_HARD_CAP = 6;

export type ChoiceCategoryTag = string;

export type UnlockCondition =
  | { kind: 'reach_realm'; realm: string; sublayer?: number }
  | { kind: 'choice_category_count'; category: ChoiceCategoryTag; count: number }
  | { kind: 'outcome_count'; outcomeKind: string; count: number }
  | { kind: 'lives_as_anchor_max_age'; anchor: string; lives: number }
  | { kind: 'died_with_flag'; flag: string }
  | { kind: 'flag_set'; flag: string }
  | { kind: 'died_in_same_region_streak'; region: string; streak: number }
  | { kind: 'reached_insight_cap_lives'; lives: number }
  | { kind: 'lived_min_years_in_single_life'; years: number }
  | { kind: 'reached_realm_without_techniques'; realm: string };

export interface StatModEffect { kind: 'stat_mod'; stat: string; delta: number }
export interface StatModPctEffect { kind: 'stat_mod_pct'; stat: string; pct: number }
export interface ResolverBonusEffect { kind: 'resolver_bonus'; category: ChoiceCategoryTag; bonus: number }
export interface EventWeightEffect { kind: 'event_weight'; eventTag: string; mult: number }
export interface StartingFlagEffect { kind: 'starting_flag'; flag: string }
export interface HealEfficacyEffect { kind: 'heal_efficacy_pct'; pct: number }
export interface HpMultEffect { kind: 'hp_mult'; mult: number }
export interface MoodSwingPctEffect { kind: 'mood_swing_pct'; pct: number }
export interface BodyCultivationRatePctEffect { kind: 'body_cultivation_rate_pct'; pct: number }
export interface InsightCapBonusEffect { kind: 'insight_cap_bonus'; bonus: number }
export interface OldAgeDeathRollPctEffect { kind: 'old_age_death_roll_pct'; pct: number }
export interface ImprintEncounterRatePctEffect { kind: 'imprint_encounter_rate_pct'; pct: number }

export type EchoEffect =
  | StatModEffect | StatModPctEffect | ResolverBonusEffect | EventWeightEffect
  | StartingFlagEffect | HealEfficacyEffect | HpMultEffect | MoodSwingPctEffect
  | BodyCultivationRatePctEffect | InsightCapBonusEffect | OldAgeDeathRollPctEffect
  | ImprintEncounterRatePctEffect;

export type EchoTier = 'fragment' | 'partial' | 'full';
export type EchoReveal = 'birth' | 'trigger';

export interface SoulEcho {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tier: EchoTier;
  readonly unlockCondition: UnlockCondition;
  readonly effects: ReadonlyArray<EchoEffect>;
  readonly conflicts: ReadonlyArray<string>;
  readonly reveal: EchoReveal;
}

/** Count the highest owned tier level of a tiered karmic upgrade (e.g. `carry_the_weight`). */
function upgradeLevel(meta: MetaState, baseId: string): number {
  let level = 0;
  for (let i = 3; i >= 1; i -= 1) {
    if (meta.ownedUpgrades.includes(`${baseId}_${i}`)) {
      level = i;
      break;
    }
  }
  return level;
}

/** Spec §7.2 formula, clamped. Phase 2A-1 keeps heavenly notice at 0 in practice. */
export function echoSlotsFor(meta: MetaState): number {
  const carry = upgradeLevel(meta, 'carry_the_weight');
  const noticeTier = Math.floor(meta.heavenlyNotice / 25);
  const slots = ECHO_SLOTS_BASELINE + carry + noticeTier;
  return Math.max(ECHO_SLOTS_BASELINE, Math.min(ECHO_SLOTS_HARD_CAP, slots));
}
