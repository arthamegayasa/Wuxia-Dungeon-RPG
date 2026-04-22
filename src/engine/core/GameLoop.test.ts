import { describe, it, expect } from 'vitest';
import { createRng } from './RNG';
import { EventDef } from '@/content/schema';
import { createCharacter } from '@/engine/character/Character';
import { createRunState } from '@/engine/events/RunState';
import { createStreakState } from '@/engine/choices/StreakTracker';
import { createSnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { createNameRegistry } from '@/engine/narrative/NameRegistry';
import { computeDominantMood, zeroMoodInputs } from '@/engine/narrative/Mood';
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

function makeCtx(): TurnContext {
  const c = createCharacter({ name: 'Lin Wei', attributes: ATTRS, rng: createRng(1) });
  return {
    runState: createRunState({ character: c, runSeed: 42, region: 'yellow_plains', year: 1000, season: 'summer' }),
    streak: createStreakState(),
    events: [SIMPLE_EVENT],
    library: createSnippetLibrary({}),
    nameRegistry: createNameRegistry(),
    lifetimeSeenEvents: [],
    dominantMood: computeDominantMood(zeroMoodInputs()),
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
});
