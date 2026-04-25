// One-turn orchestrator. Source: docs/spec/design.md §2.3.
//
// runTurn: selectEvent → composer → resolver → outcome applier → streak tick → age tick.
// Pure function: takes a TurnContext + choiceId + rng, returns the updated state slices.

import { IRng } from './RNG';
import { Mood, OutcomeTier, CheckCategory } from './Types';
import { EventDef } from '@/content/schema';
import { RunState } from '@/engine/events/RunState';
import { applyOutcome } from '@/engine/events/OutcomeApplier';
import { selectEvent } from '@/engine/events/EventSelector';
import { advanceTurn } from '@/engine/events/AgeTick';
import { resolveCheck } from '@/engine/choices/ChoiceResolver';
import { resolveOutcome } from '@/engine/choices/OutcomeResolver';
import {
  StreakState, recordOutcome, computeStreakBonus, computeWorldMaliceBuff, tickBuff,
} from '@/engine/choices/StreakTracker';
import { renderEvent, CompositionContext } from '@/engine/narrative/Composer';
import { SnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { NameRegistry } from '@/engine/narrative/NameRegistry';
import { computeMoodBonus } from '@/engine/narrative/MoodBonus';
import { TechniqueRegistry } from '@/engine/cultivation/TechniqueRegistry';
import { resolveLearnedTechniqueBonus } from '@/engine/core/TechniqueHelpers';
import { filterUnlockedChoices, unlockedChoiceIds } from '@/engine/choices/ChoiceVisibility';
import { EchoTracker } from '@/engine/meta/EchoTracker';
import { MemoryRegistry } from '@/engine/meta/MemoryRegistry';
import { MetaState } from '@/engine/meta/MetaState';
import { applyPostOutcomeHooks } from './PostOutcomeHooks';

export interface TurnContext {
  runState: RunState;
  streak: StreakState;
  events: ReadonlyArray<EventDef>;
  library: SnippetLibrary;
  nameRegistry: NameRegistry;
  lifetimeSeenEvents: ReadonlyArray<string>;
  dominantMood: Mood;
  /**
   * Life-scoped echo counters threaded through each turn. Phase 2A-2 Task 10
   * keeps this OUTSIDE `RunState` to avoid bumping the run-save schema. The
   * bridge (or integration harness) owns persistence across turns and commits
   * the snapshot into `MetaState.echoProgress` at death.
   */
  echoTracker: EchoTracker;
  /**
   * Registry of authored forbidden memories. Phase 2A-2 Task 11 reads this in
   * `applyPostOutcomeHooks` when the resolved event's category is `meditation`
   * (the only gate that fires `MemoryManifestResolver.rollManifest`). Pass
   * `EMPTY_MEMORY_REGISTRY` in tests that don't care.
   */
  memoryRegistry: MemoryRegistry;
  /**
   * Cross-life meta snapshot — read-only inside `runTurn`. Used by the Task 11
   * manifest hook to compute manifest chance (Mind, SotW level, witness count)
   * and to gate on `memoriesWitnessed`. `runTurn` never mutates meta; the
   * bridge/integration harness is responsible for committing at bardo time.
   */
  meta: MetaState;
  /**
   * Phase 2B-1 Task 7: technique registry for affinity-aware bonus resolution.
   * Pass `TechniqueRegistry.empty()` in tests/contexts that don't need techniques.
   * 2B-2 replaces with the canonical corpus loader.
   */
  techniqueRegistry: TechniqueRegistry;
}

export interface TurnResult {
  eventId: string;
  choiceId: string;
  tier: OutcomeTier;
  narrative: string;
  nextRunState: RunState;
  nextStreak: StreakState;
  nextNameRegistry: NameRegistry;
  /** Updated tracker with this turn's `choice_cat.<event.category>` increment. */
  nextEchoTracker: EchoTracker;
  /**
   * Forbidden-memory ids that manifested on this turn. Always `[]` for non-
   * meditation events. Phase 2A-2 Task 11 surface; UI / Bardo can highlight.
   */
  manifested: ReadonlyArray<string>;
}

export function runTurn(ctx: TurnContext, choiceId: string, rng: IRng): TurnResult {
  // 1. Select event
  const event = selectEvent(
    ctx.events,
    {
      character: ctx.runState.character,
      worldFlags: ctx.runState.worldFlags,
      region: ctx.runState.region,
      locale: ctx.runState.locale,
      year: ctx.runState.year,
      season: ctx.runState.season,
      heavenlyNotice: ctx.runState.heavenlyNotice,
      ageYears: Math.floor(ctx.runState.character.ageDays / 365),
    },
    ctx.lifetimeSeenEvents,
    ctx.runState.thisLifeSeenEvents,
    rng,
  );
  if (!event) {
    throw new Error('runTurn: no event selectable from the current context');
  }

  // 2. Find choice — filter by unlock_choice gates from learned techniques.
  const learnedDefs = ctx.runState.learnedTechniques
    .map((id) => ctx.techniqueRegistry.byId(id))
    .filter((t): t is NonNullable<typeof t> => t !== null);
  const visibleChoices = filterUnlockedChoices(event.choices, unlockedChoiceIds(learnedDefs));
  const choice = visibleChoices.find((c) => c.id === choiceId);
  if (!choice) {
    throw new Error(`runTurn: choice ${choiceId} not found in event ${event.id} (or locked)`);
  }

  // 3. Render narrative
  const narrative = renderEvent(
    event,
    compositionContextFrom(ctx),
    ctx.library,
    ctx.nameRegistry,
    rng,
  );

  // 4. Resolve the check
  // Phase 2B-1 Task 7: registry-backed technique bonus. Empty registry → 0
  // (no regression vs old resolveTechniqueBonus([]) stub). 2B-2 swaps in
  // the canonical corpus; affinity halving already active here.
  const techBonus = choice.check?.techniqueBonusCategory
    ? resolveLearnedTechniqueBonus({
        registry: ctx.techniqueRegistry,
        learnedIds: ctx.runState.learnedTechniques,
        corePath: ctx.runState.character.corePath,
        category: choice.check.techniqueBonusCategory,
      })
    : 0;
  const moodBonus = choice.check?.techniqueBonusCategory
    ? computeMoodBonus(ctx.dominantMood, choice.check.techniqueBonusCategory as CheckCategory)
    : 0;

  const result = resolveCheck({
    check: choice.check,
    characterStats: ctx.runState.character.attributes,
    characterSkills: {},
    techniqueBonus: techBonus,
    itemBonus: 0,
    echoBonus: 0,
    memoryBonus: 0,
    moodBonus,
    worldMalice: computeWorldMaliceBuff(ctx.streak),
    streakBonus: computeStreakBonus(ctx.streak),
    rng,
  });

  // 5. Pick outcome for the tier
  const outcome = resolveOutcome(choice.outcomes, result.tier);

  // 6. Apply outcome deltas, then record the event in thisLifeSeenEvents.
  //    Order matters: applyOutcome does a shallow merge on RunState; adding the
  //    seen-event AFTER ensures it is not overwritten.
  let nextRunState = applyOutcome(ctx.runState, outcome);
  nextRunState = {
    ...nextRunState,
    thisLifeSeenEvents: [...nextRunState.thisLifeSeenEvents, event.id],
  };

  // 7. Streak + age tick
  let nextStreak = recordOutcome(ctx.streak, result.tier);
  nextStreak = tickBuff(nextStreak);
  nextRunState = advanceTurn(nextRunState, choice.timeCost, rng);

  // 8. Post-outcome hooks (Phase 2A-2 Task 10 + Task 11).
  //    Shared helper — kept in lockstep with `engineBridge.resolveChoice`.
  //    Owns:
  //      a. `echoTracker.increment('choice_cat.<event.category>')` — always.
  //      b. `MemoryManifestResolver.rollManifest` — meditation-category only.
  //    Runs AFTER `applyOutcome` / `advanceTurn` so it observes the final
  //    per-turn state (mirrors the bridge's ordering exactly).
  const hooks = applyPostOutcomeHooks({
    preRunState: ctx.runState,
    runState: nextRunState,
    event,
    meta: ctx.meta,
    echoTracker: ctx.echoTracker,
    memoryRegistry: ctx.memoryRegistry,
  });
  nextRunState = hooks.runState;
  const nextEchoTracker = hooks.echoTracker;

  return {
    eventId: event.id,
    choiceId,
    tier: result.tier,
    narrative,
    nextRunState,
    nextStreak,
    nextNameRegistry: ctx.nameRegistry,
    nextEchoTracker,
    manifested: hooks.manifested,
  };
}

function compositionContextFrom(ctx: TurnContext): CompositionContext {
  return {
    characterName: ctx.runState.character.name,
    region: ctx.runState.region,
    season: ctx.runState.season,
    realm: ctx.runState.character.realm,
    dominantMood: ctx.dominantMood,
    turnIndex: ctx.runState.turn,
    runSeed: ctx.runState.runSeed,
    extraVariables: {},
  };
}
