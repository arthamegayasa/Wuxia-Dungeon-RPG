import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { EventDef } from '@/content/schema';
import { getAnchorById } from '@/engine/meta/Anchor';
import { resolveAnchor } from '@/engine/meta/AnchorResolver';
import { characterFromAnchor } from '@/engine/meta/characterFromAnchor';
import { createEmptyMetaState, purchaseUpgrade, ownsUpgrade, addKarma } from '@/engine/meta/MetaState';
import { EchoRegistry } from '@/engine/meta/EchoRegistry';
import { createStreakState } from '@/engine/choices/StreakTracker';
import { createSnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { createNameRegistry } from '@/engine/narrative/NameRegistry';
import { computeDominantMood, zeroMoodInputs } from '@/engine/narrative/Mood';
import { runTurn } from '@/engine/core/GameLoop';
import { runBardoFlow } from '@/engine/bardo/BardoFlow';

// A tiny corpus with one benign event and one fatal event, so a loop will eventually die.
const EVENTS: EventDef[] = [
  {
    id: 'EV_BENIGN',
    category: 'life.daily',
    version: 1, weight: 100,
    conditions: { regions: ['yellow_plains'] },
    timeCost: 'MEDIUM',
    text: { intro: ['Days passed.'], body: [], outro: [] },
    choices: [{
      id: 'ch_walk', label: 'Walk on.', timeCost: 'MEDIUM',
      outcomes: {
        SUCCESS: { narrativeKey: 'ok', stateDeltas: [{ kind: 'insight_delta', amount: 1 }] },
        FAILURE: { narrativeKey: 'fail', stateDeltas: [{ kind: 'hp_delta', amount: -5 }] },
      },
    }],
    repeat: 'unlimited',
  },
  {
    id: 'EV_FATAL',
    category: 'life.danger',
    version: 1, weight: 10,
    conditions: { regions: ['yellow_plains'] },
    timeCost: 'INSTANT',
    text: { intro: ['A bandit drew a knife.'], body: [], outro: [] },
    // PLAN-BUG FIX (two issues):
    // 1. Unify choice id with EV_BENIGN (plan used `ch_die`, disjoint from `ch_walk`).
    //    `runTurn` reselects the event each call and mutates the RNG, so the
    //    plan's try/catch retry cannot reliably land on the other event.
    // 2. Add a `check` so FAILURE/CRIT_FAILURE tiers can actually fire.
    //    Without a check, `resolveCheck` auto-succeeds to SUCCESS and the
    //    `deathCause` on FAILURE/CRIT_FAILURE is unreachable. The character
    //    (Body ~10-20) almost always fails this check, so hitting EV_FATAL
    //    (10/110 weight) roughly 18× in 200 turns yields a death with very high
    //    probability.
    choices: [{
      id: 'ch_walk', label: 'Accept fate.', timeCost: 'INSTANT',
      check: { base: 20, stats: { Body: 1, Mind: 0, Spirit: 0, Agility: 0, Charm: 0, Luck: 0 }, difficulty: 80 },
      outcomes: {
        SUCCESS: { narrativeKey: 'spared', stateDeltas: [{ kind: 'hp_delta', amount: -1 }] },
        PARTIAL: { narrativeKey: 'wounded', stateDeltas: [{ kind: 'hp_delta', amount: -5 }] },
        FAILURE: { narrativeKey: 'killed', deathCause: 'combat_melee' },
        CRIT_FAILURE: { narrativeKey: 'killed', deathCause: 'combat_melee' },
      },
    }],
    repeat: 'unlimited',
  },
];

describe('life cycle: create → play → die → bardo → reincarnate', () => {
  it('completes a full cycle with karma accrued across the transition', () => {
    // LIFE 1
    const anchor = getAnchorById('peasant_farmer')!;
    const spawnRng = createRng(1);
    const resolved = resolveAnchor(anchor, spawnRng);
    const emptyRegistry = EchoRegistry.fromList([]);
    let meta = createEmptyMetaState();
    let { runState } = characterFromAnchor({
      resolved, name: 'Lin Wei', runSeed: 42, rng: spawnRng,
      meta, echoRegistry: emptyRegistry,
    });
    let streak = createStreakState();
    const library = createSnippetLibrary({});
    let nameRegistry = createNameRegistry();

    const turnRng = createRng(500);
    let turnsPlayed = 0;
    const MAX_TURNS = 200;

    while (!runState.deathCause && turnsPlayed < MAX_TURNS) {
      const ctx = {
        runState, streak, events: EVENTS, library, nameRegistry,
        lifetimeSeenEvents: [],
        dominantMood: computeDominantMood(zeroMoodInputs()),
      };
      let result;
      try {
        result = runTurn(ctx, 'ch_walk', turnRng);
      } catch {
        result = runTurn(ctx, 'ch_die', turnRng);
      }
      runState = result.nextRunState;
      streak = result.nextStreak;
      nameRegistry = result.nextNameRegistry;
      turnsPlayed++;
    }

    expect(runState.deathCause).toBeTruthy();
    expect(turnsPlayed).toBeLessThan(MAX_TURNS);

    // BARDO
    const bardo = runBardoFlow(runState, meta, resolved.karmaMultiplier);
    expect(bardo.karmaEarned).toBeGreaterThan(0);
    expect(bardo.meta.karmaBalance).toBe(bardo.karmaEarned);
    expect(bardo.meta.lifeCount).toBe(1);
    expect(bardo.meta.lineage).toHaveLength(1);

    meta = bardo.meta;

    const spendResult = meta.karmaBalance >= 80 ? purchaseUpgrade(meta, 'awakened_soul_1') : null;
    if (spendResult) {
      meta = spendResult;
      expect(ownsUpgrade(meta, 'awakened_soul_1')).toBe(true);
      expect(meta.karmaBalance).toBe(bardo.meta.karmaBalance - 80);
    } else {
      meta = addKarma(meta, 80);
      meta = purchaseUpgrade(meta, 'awakened_soul_1')!;
      expect(ownsUpgrade(meta, 'awakened_soul_1')).toBe(true);
    }

    // LIFE 2
    const resolved2 = resolveAnchor(anchor, createRng(2));
    const { runState: rs2 } = characterFromAnchor({
      resolved: resolved2, name: 'Lin Wei II', runSeed: 100, rng: createRng(2),
      meta, echoRegistry: emptyRegistry,
    });

    expect(rs2.turn).toBe(0);
    expect(meta.lifeCount).toBe(1);

    expect(meta.karmaBalance).toBeGreaterThanOrEqual(0);
    expect(meta.ownedUpgrades).toContain('awakened_soul_1');
  });
});
