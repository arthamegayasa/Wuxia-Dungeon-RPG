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

describe('engineBridge.peekNextEvent', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('returns a preview whose choices correspond to the selected event', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 1 });
    await engine.beginLife('peasant_farmer', 'Lin');
    const preview = await engine.peekNextEvent();
    expect(preview.choices.length).toBeGreaterThan(0);
    expect(typeof preview.narrative).toBe('string');
  });

  it('repeated peeks without resolving return the same event', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 1 });
    await engine.beginLife('peasant_farmer', 'Lin');
    const p1 = await engine.peekNextEvent();
    const p2 = await engine.peekNextEvent();
    expect(p1.choices.map((c) => c.id)).toEqual(p2.choices.map((c) => c.id));
  });
});

describe('engineBridge.resolveChoice', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('throws if called without a pending event', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm });
    await engine.beginLife('peasant_farmer', 'Lin');
    await expect(engine.resolveChoice('ch_anything'))
      .rejects.toThrow(/no pending event|peek/i);
  });

  it('throws on an unknown choiceId for the pending event', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 1 });
    await engine.beginLife('peasant_farmer', 'Lin');
    await engine.peekNextEvent();
    await expect(engine.resolveChoice('ch_nonsense'))
      .rejects.toThrow(/choice.*not found/i);
  });

  it('returns TurnPreview (alive) or BardoPayload (dead) after resolving', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 1 });
    await engine.beginLife('peasant_farmer', 'Lin');
    const preview = await engine.peekNextEvent();
    const firstChoiceId = preview.choices[0]!.id;
    const result = await engine.resolveChoice(firstChoiceId);
    if ('narrative' in result) {
      expect(result.choices.length).toBeGreaterThan(0); // next peek happened automatically
    } else {
      expect(useGameStore.getState().phase).toBe(GamePhase.BARDO);
    }
  });
});

// Drive the natural peek/resolve loop until the character dies. With the
// RNG-cursor fix in engineBridge (rngState is advanced after each turn),
// probed seeds 1..100 all terminate within ~30 turns; 500 is a safety cap.
// Returns the turn on which BARDO was reached.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loopUntilDeath(engine: any, cap = 500): Promise<number> {
  for (let i = 0; i < cap; i++) {
    if (useGameStore.getState().phase === GamePhase.BARDO) return i;
    const preview = await engine.peekNextEvent();
    const result = await engine.resolveChoice(preview.choices[0]!.id);
    if (result && !('narrative' in result)) return i + 1;
    if (useGameStore.getState().phase === GamePhase.BARDO) return i + 1;
  }
  throw new Error(`loopUntilDeath: character still alive after ${cap} turns`);
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
    // Natural loop: with the RNG-cursor fix, the character dies within a few
    // dozen turns on seed=2 (probed: turn 23). chooseAction auto-transitions
    // to BARDO, so beginBardo() hits the idempotent "already have result" branch.
    await loopUntilDeath(engine);

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
        echoesUnlockedThisLife: [],
      }],
      lifetimeSeenEvents: [],
      echoesUnlocked: [],
    }, 1);
    const engine = createEngineBridge({ saveManager: sm, now: () => 3 });
    await engine.loadOrInit();

    // Run one life, let the natural loop kill the character, then inspect bardo.
    await engine.beginLife('peasant_farmer', 'Lin');
    await loopUntilDeath(engine);
    await engine.beginBardo(); // idempotent: uses existing bardoResult
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
    await loopUntilDeath(engine);
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

describe('BardoPayload reveal fields', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('exposes manifestedThisLife / witnessedThisLife / echoesUnlockedThisLife after death', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: 'test' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 2 });
    await engine.loadOrInit();
    await engine.beginLife('peasant_farmer', 'Hu');
    // Pump turns until BARDO transition.
    for (let i = 0; i < 600; i++) {
      const next = await engine.peekNextEvent().catch(() => null);
      if (!next) break;
      const choiceId = next.choices[0]?.id;
      if (!choiceId) break;
      const result = await engine.resolveChoice(choiceId);
      if ('karmaEarned' in result) {
        // Bardo reached.
        expect(result).toHaveProperty('manifestedThisLife');
        expect(result).toHaveProperty('witnessedThisLife');
        expect(result).toHaveProperty('echoesUnlockedThisLife');
        expect(Array.isArray(result.manifestedThisLife)).toBe(true);
        expect(Array.isArray(result.witnessedThisLife)).toBe(true);
        expect(Array.isArray(result.echoesUnlockedThisLife)).toBe(true);
        return;
      }
    }
    throw new Error('did not reach bardo within 600 turns');
  }, 30000);
});
