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
import { resolveTechniqueBonus } from '@/engine/cultivation/Technique';
import { computeMoodBonus } from '@/engine/narrative/MoodBonus';
import { EchoTracker } from '@/engine/meta/EchoTracker';

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

  // 2. Find choice
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) {
    throw new Error(`runTurn: choice ${choiceId} not found in event ${event.id}`);
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
  // Phase 1D-1 zero-placeholders: technique registry, inventory effects, echoes,
  // and memories don't exist yet. resolveTechniqueBonus([]) → 0; itemBonus /
  // echoBonus / memoryBonus wired in Phase 1D-2 / Phase 2+. NOT bugs.
  const techBonus = choice.check?.techniqueBonusCategory
    ? resolveTechniqueBonus([], choice.check.techniqueBonusCategory)
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

  // 8. Echo tracker increment (Phase 2A-2 Task 10). Key format matches
  // EchoUnlocker's `choice_cat.<category>` reader in src/engine/meta/EchoUnlocker.ts.
  // Runs AFTER applyOutcome so that if a Phase 3+ delta ever introduces a
  // category override, we still count the event's own category (stable).
  const nextEchoTracker = ctx.echoTracker.increment(`choice_cat.${event.category}`);

  // 9. [Phase 2A-2 Task 11 insertion point]
  //    MemoryManifestResolver meditation hook fires here — called when
  //    `event.category === 'life.training'` with `techniqueBonusCategory === 'meditation'`
  //    (or similar), rolls a forbidden-memory manifestation against meta, and appends
  //    any resulting `memoriesWitnessedThisLife` / narrative ornamentation to the
  //    return value. Intentionally a no-op in Task 10.

  return {
    eventId: event.id,
    choiceId,
    tier: result.tier,
    narrative,
    nextRunState,
    nextStreak,
    nextNameRegistry: ctx.nameRegistry,
    nextEchoTracker,
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
