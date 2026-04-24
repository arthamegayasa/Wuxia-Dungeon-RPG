import { describe, it, expect } from 'vitest';
import { createRng } from './RNG';
import { EventDef } from '@/content/schema';
import { createCharacter } from '@/engine/character/Character';
import { createRunState } from '@/engine/events/RunState';
import { createStreakState } from '@/engine/choices/StreakTracker';
import { createSnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { createNameRegistry } from '@/engine/narrative/NameRegistry';
import { computeDominantMood, zeroMoodInputs } from '@/engine/narrative/Mood';
import { EchoTracker } from '@/engine/meta/EchoTracker';
import { runTurn, TurnContext } from './GameLoop';

const ATTRS = { Body: 28, Mind: 20, Spirit: 15, Agility: 35, Charm: 22, Luck: 42 };

const SIMPLE_EVENT: EventDef = {
  id: 'EV_SIMPLE',
  category: 'test',
  version: 1,
  weight: 100,
  conditions: { regions: ['yellow_plains'] },
  timeCost: 'SHORT',
  text: { intro: ['Nothing much happened.'], body: [], outro: [] },
  choices: [{
    id: 'ch_walk', label: 'Walk on.', timeCost: 'SHORT',
    outcomes: {
      SUCCESS: { narrativeKey: 'ok', stateDeltas: [{ kind: 'insight_delta', amount: 1 }] },
      FAILURE: { narrativeKey: 'fail', stateDeltas: [{ kind: 'hp_delta', amount: -1 }] },
    },
  }],
  repeat: 'unlimited',
};

const TRAINING_EVENT: EventDef = {
  id: 'EV_TRAINING',
  category: 'life.training',
  version: 1,
  weight: 100,
  conditions: { regions: ['yellow_plains'] },
  timeCost: 'SHORT',
  text: { intro: ['You train your body.'], body: [], outro: [] },
  choices: [{
    id: 'ch_walk', label: 'Train on.', timeCost: 'SHORT',
    outcomes: {
      SUCCESS: { narrativeKey: 'ok', stateDeltas: [{ kind: 'insight_delta', amount: 1 }] },
      FAILURE: { narrativeKey: 'fail', stateDeltas: [{ kind: 'hp_delta', amount: -1 }] },
    },
  }],
  repeat: 'unlimited',
};

function makeCtx(opts: { events?: ReadonlyArray<EventDef> } = {}): TurnContext {
  const c = createCharacter({ name: 'Lin Wei', attributes: ATTRS, rng: createRng(1) });
  return {
    runState: createRunState({ character: c, runSeed: 42, region: 'yellow_plains', year: 1000, season: 'summer' }),
    streak: createStreakState(),
    events: opts.events ?? [SIMPLE_EVENT],
    library: createSnippetLibrary({}),
    nameRegistry: createNameRegistry(),
    lifetimeSeenEvents: [],
    dominantMood: computeDominantMood(zeroMoodInputs()),
    echoTracker: EchoTracker.empty(),
  };
}

describe('runTurn', () => {
  it('selects an admissible event and returns a composed narrative', () => {
    const ctx = makeCtx();
    const rng = createRng(100);
    const { narrative, eventId } = runTurn(ctx, 'ch_walk', rng);
    expect(eventId).toBe('EV_SIMPLE');
    expect(typeof narrative).toBe('string');
  });

  it('advances runState.turn and records the event in thisLifeSeenEvents', () => {
    const ctx = makeCtx();
    const rng = createRng(100);
    const r = runTurn(ctx, 'ch_walk', rng);
    expect(r.nextRunState.turn).toBe(1);
    expect(r.nextRunState.thisLifeSeenEvents).toContain('EV_SIMPLE');
  });

  it('applies outcome deltas to the character', () => {
    const ctx = makeCtx();
    const rng = createRng(100);
    const r = runTurn(ctx, 'ch_walk', rng);
    const changed =
      r.nextRunState.character.insight !== ctx.runState.character.insight ||
      r.nextRunState.character.hp !== ctx.runState.character.hp;
    expect(changed).toBe(true);
  });

  it('ticks streak per outcome tier', () => {
    const ctx = makeCtx();
    const rng = createRng(100);
    const r = runTurn(ctx, 'ch_walk', rng);
    expect([0, 1]).toContain(r.nextStreak.consecutiveFailures);
  });

  it('ticks age by a TimeCost-sized amount', () => {
    const ctx = makeCtx();
    const rng = createRng(100);
    const r = runTurn(ctx, 'ch_walk', rng);
    const delta = r.nextRunState.character.ageDays - ctx.runState.character.ageDays;
    expect(delta).toBeGreaterThanOrEqual(1);
    expect(delta).toBeLessThanOrEqual(7);
  });

  it('throws if no event is selectable', () => {
    const ctx = makeCtx();
    const ctxNoEvent = { ...ctx, events: [] };
    const rng = createRng(100);
    expect(() => runTurn(ctxNoEvent, 'ch_walk', rng))
      .toThrow(/no event/i);
  });

  it('throws if the selected event does not contain the requested choiceId', () => {
    const ctx = makeCtx();
    const rng = createRng(100);
    expect(() => runTurn(ctx, 'ch_nonexistent', rng))
      .toThrow(/choice.*not found/i);
  });

  it('is deterministic for the same seed + inputs', () => {
    const ctx = makeCtx();
    const r1 = runTurn(ctx, 'ch_walk', createRng(77));
    const r2 = runTurn(ctx, 'ch_walk', createRng(77));
    expect(r1.nextRunState.character.hp).toBe(r2.nextRunState.character.hp);
    expect(r1.nextRunState.character.insight).toBe(r2.nextRunState.character.insight);
    expect(r1.eventId).toBe(r2.eventId);
  });

  it('increments echoTracker with `choice_cat.<category>` after applyOutcome', () => {
    // Phase 2A-2 Task 10: EchoTracker is threaded through runTurn per-turn,
    // incrementing `choice_cat.<event.category>` after the outcome is applied.
    const ctx = makeCtx({ events: [TRAINING_EVENT] });
    const rng = createRng(100);
    const r = runTurn(ctx, 'ch_walk', rng);
    expect(r.nextEchoTracker.get('choice_cat.life.training')).toBe(1);
    // Original tracker is unchanged (immutable).
    expect(ctx.echoTracker.get('choice_cat.life.training')).toBe(0);
  });

  it('accumulates echoTracker counters across multiple runTurn calls', () => {
    // Two back-to-back turns on the same category produce a count of 2.
    const ctx1 = makeCtx({ events: [TRAINING_EVENT] });
    const r1 = runTurn(ctx1, 'ch_walk', createRng(100));
    const ctx2 = { ...ctx1, echoTracker: r1.nextEchoTracker };
    const r2 = runTurn(ctx2, 'ch_walk', createRng(101));
    expect(r2.nextEchoTracker.get('choice_cat.life.training')).toBe(2);
  });
});
