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
 * Phase 2C novel-mode pacing multiplier.
 *
 * Three bands governed by `turnsSinceLastDecision` (tslc):
 *   - tslc < 4:  beats favoured 3.0x, decisions suppressed 0.2x  (post-decision rest)
 *   - tslc 4-7:  neutral 1.0x both                                (open mid-stretch)
 *   - tslc >= 8: decisions favoured 3.0x, beats suppressed 0.2x  (force fork)
 *
 * Combined with each event's base weight and the repetition penalty, this
 * pushes the selector to interleave roughly 4-8 beats between decisions.
 */
export function pacingMultiplier(eventKind: 'beat' | 'decision', tslc: number): number {
  if (tslc < 4) return eventKind === 'beat' ? 3.0 : 0.2;
  if (tslc < 8) return 1.0;
  return eventKind === 'decision' ? 3.0 : 0.2;
}

/**
 * Build the admissible selection pool:
 *   1. Filter by ConditionSet
 *   2. Drop events whose `repeat` has been satisfied
 *   3. Multiply base weight by repetition penalty if recently seen
 *   4. Phase 2C: multiply by pacingMultiplier(event.kind, tslc)
 */
export function buildSelectionPool(
  events: ReadonlyArray<EventDef>,
  ctx: EvalContext,
  lifetimeSeen: ReadonlyArray<string>,
  thisLifeSeen: ReadonlyArray<string>,
): PoolEntry[] {
  // Only the last N turns count as "recent".
  const recent = thisLifeSeen.slice(-REPETITION_WINDOW_TURNS);
  const tslc = ctx.turnsSinceLastDecision ?? 0;
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

    // Phase 2C pacing — fold beat/decision rhythm into effective weight.
    // Events without an explicit kind default to 'decision' (matches schema
    // backward-compat semantics).
    const kind: 'beat' | 'decision' = ev.kind ?? 'decision';
    const paced = penalised * pacingMultiplier(kind, tslc);

    if (paced > 0) out.push({ event: ev, effectiveWeight: paced });
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
