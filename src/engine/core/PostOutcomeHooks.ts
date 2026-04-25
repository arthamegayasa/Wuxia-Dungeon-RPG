// Shared post-outcome hooks — runs after applyOutcome in BOTH runTurn and
// engineBridge.resolveChoice. Source: docs/spec/design.md §7.2 (echoes) + §7.3
// (memory manifestation).
//
// Task 10 threaded `EchoTracker.increment('choice_cat.' + event.category)` in
// two places (runTurn + bridge) — a known landmine flagged by the reviewer. The
// shared helper dedups that increment and adds Task 11's meditation-gated
// MemoryManifestResolver call, so both call sites stay in lockstep as more
// hooks land in Phase 2B/3.

import { EventDef } from '@/content/schema';
import { RunState } from '@/engine/events/RunState';
import { MetaState } from '@/engine/meta/MetaState';
import { EchoTracker } from '@/engine/meta/EchoTracker';
import { MemoryRegistry } from '@/engine/meta/MemoryRegistry';
import { rollManifest } from '@/engine/meta/MemoryManifestResolver';
import { CorePathId } from '@/engine/core/Types';

export interface PostOutcomeHooksArgs {
  /** RunState BEFORE applyOutcome — used for transition detection (e.g. corePath reveal). */
  readonly preRunState: RunState;
  /** RunState AFTER `applyOutcome` has merged the tier's stateDeltas. */
  readonly runState: RunState;
  /** The event just resolved (used for category-keyed hooks). */
  readonly event: EventDef;
  /** Current meta snapshot — read-only here. Commit to store/save outside. */
  readonly meta: MetaState;
  /** Life-scoped echo counters (held in the store / integration harness). */
  readonly echoTracker: EchoTracker;
  /** Registry of authored forbidden memories (empty in tests if irrelevant). */
  readonly memoryRegistry: MemoryRegistry;
}

export interface PostOutcomeHooksResult {
  readonly runState: RunState;
  readonly echoTracker: EchoTracker;
  /** Forbidden-memory ids that manifested this turn — surfaced to UI/Bardo. */
  readonly manifested: ReadonlyArray<string>;
  /** If this turn transitioned corePath from null → set, the new path. Else null. */
  readonly corePathRevealed: CorePathId | null;
}

/**
 * Apply deterministic post-outcome side effects:
 *   1. Increment `echoTracker` by `choice_cat.<event.category>` (always).
 *   2. If `event.category === 'meditation'`, call `rollManifest` and fold the
 *      returned `runState` forward (manifest attempt counter + any insight/flag
 *      grants).
 *
 * The tracker increment runs on every turn (stable signal for EchoUnlocker).
 * The manifest roll is gated on the meditation category so that only
 * deliberate mind-cultivation events can unlock forbidden memories — matches
 * §7.3 "memories surface when the mind is still."
 */
export function applyPostOutcomeHooks(args: PostOutcomeHooksArgs): PostOutcomeHooksResult {
  const { preRunState, runState, event, meta, echoTracker, memoryRegistry } = args;

  // Transition detection: corePath null → set fires exactly once per life.
  const pre = preRunState.character.corePath;
  const post = runState.character.corePath;
  const corePathRevealed: CorePathId | null = pre === null && post !== null ? post : null;

  // 1. EchoTracker increment (always). Key format is the contract between the
  //    two call sites and `EchoUnlocker`'s `choice_cat.<category>` reader.
  const nextEchoTracker = echoTracker.increment(`choice_cat.${event.category}`);

  // 2. Meditation-gated manifest roll.
  if (event.category !== 'meditation') {
    return { runState, echoTracker: nextEchoTracker, manifested: [], corePathRevealed };
  }

  const manifestResult = rollManifest({ runState, meta, registry: memoryRegistry });
  return {
    runState: manifestResult.runState,
    echoTracker: nextEchoTracker,
    manifested: manifestResult.manifested,
    corePathRevealed,
  };
}
