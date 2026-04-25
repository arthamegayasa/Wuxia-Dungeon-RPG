// Realm-crossing events: Body Tempering 9 → Qi Sensing awakening, Qi Sensing → Qi Condensation 1.
// Source: docs/spec/design.md §4.1, §4.3; design spec §3.4.

import { IRng } from '@/engine/core/RNG';
import { Character } from '@/engine/character/Character';
import { Realm, SpiritRootTier } from '@/engine/core/Types';
import { PROGRESS_PER_SUBLAYER, isSubLayerFull } from './CultivationProgress';

// Phase 2B-1 Task 15: penalty table for spirit root tier at Qi Sensing awakening.
// 'none' acts as a hard lockout (999 ensures chance hits the [15,95] clamp floor;
// the gate check throws first, but defense in depth).
export const SPIRIT_ROOT_AWAKENING_PENALTY: Record<SpiritRootTier, number> = {
  none: 999,
  mottled: 15,
  single_element: 5,
  dual_element: 0,
  heavenly: 0,
};

export interface AttemptCrossingArgs {
  rng: IRng;
  pillBonus?: number;
  safeEnvironmentBonus?: number;
}

export interface AttemptCrossingResult {
  character: Character;
  success: boolean;
  chance: number;
  roll: number;
}

/**
 * Qi Sensing awakening chance:
 *   chance = 40
 *          + Mind × 0.3
 *          + Spirit × 0.3
 *          + Insight × 0.05
 *          + pillBonus
 *          + safeEnvironmentBonus
 *          − spiritRootPenalty
 * Clamped to [15, 95]. Failure = 50% of bar lost, realm + layer unchanged.
 */
export function attemptQiSensingAwakening(
  c: Character,
  args: AttemptCrossingArgs,
): AttemptCrossingResult {
  if (c.realm !== Realm.BODY_TEMPERING) {
    throw new Error(`attemptQiSensingAwakening: requires body tempering realm, got ${c.realm}`);
  }
  if (c.bodyTemperingLayer !== 9) {
    throw new Error(`attemptQiSensingAwakening: requires layer 9, got ${c.bodyTemperingLayer}`);
  }
  if (!isSubLayerFull(c)) {
    throw new Error('attemptQiSensingAwakening: cultivation progress is not full');
  }
  if (c.spiritRoot.tier === 'none') {
    throw new Error('attemptQiSensingAwakening: spirit root "none" cannot cultivate (locked out)');
  }

  const penalty = SPIRIT_ROOT_AWAKENING_PENALTY[c.spiritRoot.tier];
  const raw =
    40
    + c.attributes.Mind * 0.3
    + c.attributes.Spirit * 0.3
    + c.insight * 0.05
    + (args.pillBonus ?? 0)
    + (args.safeEnvironmentBonus ?? 0)
    - penalty;
  const chance = Math.min(95, Math.max(15, Math.round(raw)));
  const roll = args.rng.d100();
  const success = roll <= chance;

  if (success) {
    return {
      success, chance, roll,
      character: {
        ...c,
        realm: Realm.QI_SENSING,
        bodyTemperingLayer: 0,
        cultivationProgress: 0,
      },
    };
  }
  const halfBar = Math.floor(PROGRESS_PER_SUBLAYER / 2);
  return {
    success, chance, roll,
    character: { ...c, cultivationProgress: halfBar },
  };
}

export interface AttemptQiCondensationEntryArgs extends AttemptCrossingArgs {
  techniqueCount: number;
}

/**
 * Qi Sensing → Qi Condensation 1 entry.
 * Gate: realm === QI_SENSING, techniqueCount >= 1, bar full.
 * Chance formula:
 *   chance = 50 + Mind×0.3 + Insight×0.1 + pillBonus + safeEnv, clamped [15, 95].
 */
export function attemptQiCondensationEntry(
  c: Character,
  args: AttemptQiCondensationEntryArgs,
): AttemptCrossingResult {
  if (c.realm !== Realm.QI_SENSING) {
    throw new Error(`attemptQiCondensationEntry: requires qi sensing realm, got ${c.realm}`);
  }
  if (args.techniqueCount < 1) {
    throw new Error('attemptQiCondensationEntry: requires at least 1 learned technique');
  }
  if (!isSubLayerFull(c)) {
    throw new Error('attemptQiCondensationEntry: cultivation progress is not full');
  }

  const raw =
    50
    + c.attributes.Mind * 0.3
    + c.insight * 0.1
    + (args.pillBonus ?? 0)
    + (args.safeEnvironmentBonus ?? 0);
  const chance = Math.min(95, Math.max(15, Math.round(raw)));
  const roll = args.rng.d100();
  const success = roll <= chance;

  if (success) {
    return {
      success, chance, roll,
      character: { ...c, realm: Realm.QI_CONDENSATION, qiCondensationLayer: 1, cultivationProgress: 0 },
    };
  }
  const halfBar = Math.floor(PROGRESS_PER_SUBLAYER / 2);
  return { success, chance, roll, character: { ...c, cultivationProgress: halfBar } };
}
