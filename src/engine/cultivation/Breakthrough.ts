// Sub-layer breakthrough formula + application.
// Formula source: docs/spec/design.md §4.3.

import { IRng } from '@/engine/core/RNG';
import { Character } from '@/engine/character/Character';
import { isSubLayerFull, PROGRESS_PER_SUBLAYER } from './CultivationProgress';
import { realmMeta } from './RealmMeta';

export interface BreakthroughChanceArgs {
  mind: number;
  insight: number;
  currentLayer: number;          // 0-indexed within realm for formula purposes
  pillBonus: number;
  safeEnvironmentBonus: number;
}

/** See spec §4.3. */
export function sublayerBreakthroughChance(a: BreakthroughChanceArgs): number {
  const raw =
    50
    + a.mind * 0.3
    + a.insight * 0.1
    + a.pillBonus
    + a.safeEnvironmentBonus
    - a.currentLayer * 4;
  return Math.min(95, Math.max(15, Math.round(raw)));
}

export interface AttemptArgs {
  rng: IRng;
  pillBonus?: number;
  safeEnvironmentBonus?: number;
}

export interface AttemptResult {
  character: Character;
  success: boolean;
  chance: number;
  roll: number;
}

const PROGRESS_LOST_ON_FAIL = 25;

export function attemptSublayerBreakthrough(c: Character, args: AttemptArgs): AttemptResult {
  if (!isSubLayerFull(c)) {
    throw new Error('attemptSublayerBreakthrough: cultivation progress is not full');
  }
  const meta = realmMeta(c.realm);
  if (meta.subLayers === 0) {
    throw new Error(`realm ${c.realm} has no sub-layers`);
  }

  const chance = sublayerBreakthroughChance({
    mind: c.attributes.Mind,
    insight: c.insight,
    currentLayer: c.bodyTemperingLayer,
    pillBonus: args.pillBonus ?? 0,
    safeEnvironmentBonus: args.safeEnvironmentBonus ?? 0,
  });

  const roll = args.rng.d100();
  const success = roll <= chance;

  if (success) {
    const nextLayer = Math.min(meta.subLayers, c.bodyTemperingLayer + 1);
    return {
      success: true,
      chance,
      roll,
      character: {
        ...c,
        bodyTemperingLayer: nextLayer,
        cultivationProgress: 0,
      },
    };
  }

  const nextProgress = Math.max(0, PROGRESS_PER_SUBLAYER - PROGRESS_LOST_ON_FAIL);
  return {
    success: false,
    chance,
    roll,
    character: {
      ...c,
      cultivationProgress: nextProgress,
    },
  };
}
