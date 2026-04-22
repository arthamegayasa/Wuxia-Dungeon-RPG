// Weighted event selector with filters + repetition penalty.
// Source: docs/spec/design.md §5.1.

import { IRng } from '@/engine/core/RNG';
import { EventDef } from '@/content/schema';
import { evaluateConditions, EvalContext } from './ConditionEvaluator';

export const REPETITION_WINDOW_TURNS = 5;
export const REPETITION_PENALTY = 0.1;

export interface PoolEntry {
  event: EventDef;
  effectiveWeight: number;
}

/**
 * Build the admissible selection pool:
 *   1. Filter by ConditionSet
 *   2. Drop events whose `repeat` has been satisfied
 *   3. Multiply base weight by repetition penalty if recently seen
 */
export function buildSelectionPool(
  events: ReadonlyArray<EventDef>,
  ctx: EvalContext,
  lifetimeSeen: ReadonlyArray<string>,
  thisLifeSeen: ReadonlyArray<string>,
): PoolEntry[] {
  // Only the last N turns count as "recent".
  const recent = thisLifeSeen.slice(-REPETITION_WINDOW_TURNS);
  const out: PoolEntry[] = [];

  for (const ev of events) {
    // Repeat gate
    if (ev.repeat === 'once_ever' && lifetimeSeen.includes(ev.id)) continue;
    if (ev.repeat === 'once_per_life' && thisLifeSeen.includes(ev.id)) continue;

    // Condition gate
    if (!evaluateConditions(ev.conditions, ctx)) continue;

    // Weight adjustment: penalise events seen in the window, but only if their
    // last occurrence is not the very most-recent turn (that event is managed
    // by the immediate-replay guard elsewhere in the engine).
    const lastIdx = recent.lastIndexOf(ev.id);
    const penalised = lastIdx !== -1 && lastIdx < recent.length - 1
      ? ev.weight * REPETITION_PENALTY
      : ev.weight;

    if (penalised > 0) out.push({ event: ev, effectiveWeight: penalised });
  }
  return out;
}

export function selectEvent(
  events: ReadonlyArray<EventDef>,
  ctx: EvalContext,
  lifetimeSeen: ReadonlyArray<string>,
  thisLifeSeen: ReadonlyArray<string>,
  rng: IRng,
): EventDef | null {
  const pool = buildSelectionPool(events, ctx, lifetimeSeen, thisLifeSeen);
  if (pool.length === 0) return null;
  return rng.weightedPick(pool, (p) => p.effectiveWeight).event;
}
