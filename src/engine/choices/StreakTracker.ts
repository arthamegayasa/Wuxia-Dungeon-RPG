// Streak tracking: anti-frustration (+10 after 4 failures)
// and anti-greed (+3 world malice for 5 turns after 3 crit successes).
// Source: docs/spec/design.md §5.6.

import { OutcomeTier } from '@/engine/core/Types';

export interface WorldMaliceBuff {
  value: number;
  turnsRemaining: number;
}

export interface StreakState {
  consecutiveFailures: number;
  consecutiveCritSuccesses: number;
  worldMaliceBuff: WorldMaliceBuff | null;
}

const STREAKBREAK_FAILURES_NEEDED = 4;
const STREAKBREAK_BONUS = 10;

const ANTI_GREED_CRITS_NEEDED = 3;
const ANTI_GREED_MALICE = 3;
const ANTI_GREED_DURATION_TURNS = 5;

export function createStreakState(): StreakState {
  return {
    consecutiveFailures: 0,
    consecutiveCritSuccesses: 0,
    worldMaliceBuff: null,
  };
}

export function recordOutcome(state: StreakState, tier: OutcomeTier): StreakState {
  let s = { ...state };

  // Failure streak: only regular FAILURE counts (not CRIT_FAILURE).
  if (tier === 'FAILURE') {
    s = { ...s, consecutiveFailures: s.consecutiveFailures + 1 };
  } else if (tier === 'SUCCESS' || tier === 'CRIT_SUCCESS') {
    s = { ...s, consecutiveFailures: 0 };
  }
  // PARTIAL and CRIT_FAILURE leave consecutiveFailures unchanged.

  // Crit streak.
  if (tier === 'CRIT_SUCCESS') {
    const nextCount = s.consecutiveCritSuccesses + 1;
    s = { ...s, consecutiveCritSuccesses: nextCount };
    if (nextCount >= ANTI_GREED_CRITS_NEEDED) {
      s = { ...s, worldMaliceBuff: { value: ANTI_GREED_MALICE, turnsRemaining: ANTI_GREED_DURATION_TURNS } };
    }
  } else {
    s = { ...s, consecutiveCritSuccesses: 0 };
  }

  return s;
}

export function computeStreakBonus(state: StreakState): number {
  return state.consecutiveFailures >= STREAKBREAK_FAILURES_NEEDED ? STREAKBREAK_BONUS : 0;
}

export function computeWorldMaliceBuff(state: StreakState): number {
  return state.worldMaliceBuff?.value ?? 0;
}

/** Decrement the buff's turnsRemaining. Called once per turn tick. */
export function tickBuff(state: StreakState): StreakState {
  if (!state.worldMaliceBuff) return state;
  const next = state.worldMaliceBuff.turnsRemaining - 1;
  if (next <= 0) return { ...state, worldMaliceBuff: null };
  return { ...state, worldMaliceBuff: { ...state.worldMaliceBuff, turnsRemaining: next } };
}
