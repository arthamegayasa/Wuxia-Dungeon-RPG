import { describe, it, expect, beforeEach } from 'vitest';
import { createSaveManager } from '@/engine/persistence/SaveManager';
import { createEngineBridge } from './engineBridge';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';
import { GamePhase } from '@/engine/core/Types';

describe('engineBridge.loadOrInit', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('returns TITLE phase when no save exists', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm });
    const result = await engine.loadOrInit();
    expect(result.phase).toBe(GamePhase.TITLE);
    expect(result.hasSave).toBe(false);
  });

  it('hydrates meta and reports a save when wdr.meta exists', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    sm.save('wdr.meta', {
      karmaBalance: 120,
      lifeCount: 2,
      ownedUpgrades: ['awakened_soul_1'],
      unlockedAnchors: ['true_random', 'peasant_farmer'],
      lineage: [],
      lifetimeSeenEvents: [],
    }, 1);
    const engine = createEngineBridge({ saveManager: sm });
    const result = await engine.loadOrInit();
    expect(result.hasSave).toBe(true);
    expect(useMetaStore.getState().karmicInsight).toBe(120);
    expect(useMetaStore.getState().lifeCount).toBe(2);
  });
});

describe('engineBridge.beginLife', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('throws if the anchorId is unknown', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm });
    await expect(engine.beginLife('not_an_anchor', 'Test Name'))
      .rejects.toThrow(/unknown anchor/i);
  });

  it('spawns a character, seeds the store, and returns a TurnPreview', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm });
    const tp = await engine.beginLife('peasant_farmer', 'Lin Wei');

    expect(tp.name).toBe('Lin Wei');
    expect(tp.ageYears).toBeGreaterThanOrEqual(10);
    expect(tp.ageYears).toBeLessThanOrEqual(14);
    expect(tp.hpMax).toBeGreaterThan(0);
    expect(typeof tp.narrative).toBe('string');
    // Phase 1D-2 simplification: beginLife's preview has no choices. UI triggers first chooseAction.
    expect(tp.choices.length).toBe(0);

    const gs = useGameStore.getState();
    expect(gs.runState).not.toBeNull();
    expect(gs.streak).not.toBeNull();
    expect(gs.phase).toBe(GamePhase.PLAYING);
  });

  it('autosaves the run after beginLife', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm });
    await engine.beginLife('peasant_farmer', 'Lin Wei');
    expect(sm.load('wdr.run')).not.toBeNull();
  });
});

describe('engineBridge.chooseAction', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('throws if called without an active run', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm });
    await expect(engine.chooseAction('ch_walk')).rejects.toThrow(/no active run/i);
  });

  it('advances the turn and returns a TurnPreview when alive', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 1 });
    await engine.beginLife('peasant_farmer', 'Lin');

    // Task 5 uses the first selectable fixture event's first choice id
    // (either FX_BENIGN_DAY.ch_work, FX_TRAIN_BODY.ch_train, or FX_BANDIT.ch_fight
    // depending on selector). We loop through both safe choices so the test is
    // robust across which event fires.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;
    for (const choiceId of ['ch_work', 'ch_train', 'ch_fight']) {
      try {
        result = await engine.chooseAction(choiceId);
        break;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        if (!/choice.*not found/i.test(e.message)) throw e;
      }
    }
    expect(result).toBeDefined();
    // If alive, result has a `narrative` and `choices`.
    // If died (possible on turn 1 with ch_fight), it's a BardoPayload.
    if ('narrative' in result!) {
      expect(typeof result.narrative).toBe('string');
      expect(useGameStore.getState().runState!.turn).toBe(1);
    } else {
      expect(useGameStore.getState().phase).toBe(GamePhase.BARDO);
    }
  });
});

// Force-death helper: mutate the store's runState to have a deathCause so
// beginBardo's "rare reload" branch fires, transitioning to BARDO. The plan
// suggests force-death loops via chooseAction, but the fixture corpus + current
// RNG-cursor handling makes the outer loop deterministically non-terminating
// within any reasonable iteration budget (same seed → same event → same tier
// every turn). Direct mutation is fallback option 3 from the plan.
function forceDeath() {
  const rs = useGameStore.getState().runState;
  if (!rs) throw new Error('forceDeath: no runState to kill');
  useGameStore.setState({
    runState: { ...rs, deathCause: 'combat_melee' },
  });
}

describe('engineBridge.beginBardo (manual)', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('returns the existing BardoPayload if chooseAction already transitioned', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 2 });

    await engine.beginLife('peasant_farmer', 'Lin');
    // Force death via direct mutation, then beginBardo hits the "rare reload"
    // branch (computes BardoResult from runState.deathCause).
    forceDeath();

    const bardo = await engine.beginBardo();
    expect(bardo.karmaEarned).toBeGreaterThanOrEqual(0);
    expect(bardo.availableUpgrades.length).toBe(5);
    expect(useGameStore.getState().phase).toBe(GamePhase.BARDO);
    expect(useGameStore.getState().bardoResult).not.toBeNull();

    // Second call is idempotent: returns the existing BardoPayload.
    const bardo2 = await engine.beginBardo();
    expect(bardo2.karmaEarned).toBe(bardo.karmaEarned);
  });

  it('throws if there is no active bardo and no death', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm });
    await engine.beginLife('peasant_farmer', 'Lin');
    await expect(engine.beginBardo()).rejects.toThrow(/no bardo/i);
  });
});

describe('engineBridge.spendKarma', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('purchases an affordable unblocked upgrade and refreshes the payload', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    // Seed a MetaState with enough karma.
    sm.save('wdr.meta', {
      karmaBalance: 500, lifeCount: 1, ownedUpgrades: [],
      unlockedAnchors: ['true_random', 'peasant_farmer'],
      lineage: [{
        lifeIndex: 1, name: 'Ancestor', anchorId: 'peasant_farmer',
        yearsLived: 40, realmReached: 'mortal', deathCause: 'old_age', karmaEarned: 500,
      }],
      lifetimeSeenEvents: [],
    }, 1);
    const engine = createEngineBridge({ saveManager: sm, now: () => 3 });
    await engine.loadOrInit();

    // Run one life, force death, transition via beginBardo.
    await engine.beginLife('peasant_farmer', 'Lin');
    forceDeath();
    await engine.beginBardo();
    expect(useGameStore.getState().phase).toBe(GamePhase.BARDO);

    const before = useMetaStore.getState().karmicInsight;
    const payload = await engine.spendKarma('awakened_soul_1');
    expect(payload.ownedUpgrades).toContain('awakened_soul_1');
    expect(useMetaStore.getState().karmicInsight).toBeLessThan(before); // deducted 80
    expect(sm.load('wdr.meta')).not.toBeNull();
  });

  it('rejects with a useful error when upgrade unknown / locked / unaffordable', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 4 });
    await engine.beginLife('peasant_farmer', 'Lin');
    forceDeath();
    await engine.beginBardo();
    await expect(engine.spendKarma('not_an_upgrade'))
      .rejects.toThrow(/unknown.*upgrade|cannot purchase/i);
  });
});

describe('engineBridge.reincarnate', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('clears the run save and advances phase to CREATION', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 5 });
    await engine.beginLife('peasant_farmer', 'Lin');
    expect(sm.load('wdr.run')).not.toBeNull();

    const result = await engine.reincarnate();
    expect(sm.load('wdr.run')).toBeNull();
    expect(useGameStore.getState().phase).toBe(GamePhase.CREATION);
    expect(result.availableAnchors.length).toBeGreaterThanOrEqual(2);
  });
});
