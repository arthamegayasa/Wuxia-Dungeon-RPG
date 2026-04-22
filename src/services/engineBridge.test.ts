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
