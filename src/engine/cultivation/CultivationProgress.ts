// Cultivation progress bar: 0..100 per sub-layer. Full = breakthrough-eligible.
// Formula source: docs/spec/design.md §4.2.

import { Character } from '@/engine/character/Character';

/** Maximum progress per sub-layer. */
export const PROGRESS_PER_SUBLAYER = 100;

export interface GainRateArgs {
  baseRate: number;              // per-event base
  rootMultiplier: number;        // from SpiritRoot
  environmentDensity: number;    // from region (§8.1)
  techniqueMultiplier: number;   // from active techniques
  openMeridianBonus: number;     // e.g. 0.05 per meridian
  anchorFocusBonus: number;      // from spawn anchor
  noticeMalice: number;          // from heavenly notice (may be < 1)
}

/**
 * Compute per-tick cultivation gain (per spec §4.2).
 *   gain = base × root × env × tech × (1 + openMeridiansBonus) × anchor × notice
 */
export function cultivationGainRate(a: GainRateArgs): number {
  return (
    a.baseRate
    * a.rootMultiplier
    * a.environmentDensity
    * a.techniqueMultiplier
    * (1 + a.openMeridianBonus)
    * a.anchorFocusBonus
    * a.noticeMalice
  );
}

export function advanceCultivation(c: Character, amount: number): Character {
  if (amount < 0) throw new Error('advanceCultivation: amount must be non-negative');
  const next = Math.min(PROGRESS_PER_SUBLAYER, c.cultivationProgress + amount);
  return { ...c, cultivationProgress: next };
}

export function isSubLayerFull(c: Character): boolean {
  return c.cultivationProgress >= PROGRESS_PER_SUBLAYER;
}
