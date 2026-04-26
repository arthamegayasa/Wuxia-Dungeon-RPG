import { describe, it, expect, beforeEach } from 'vitest';
import { createSaveManager } from '@/engine/persistence/SaveManager';
import { createEngineBridge, TECHNIQUE_REGISTRY, __loadGameplayContent } from './engineBridge';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';
import { GamePhase } from '@/engine/core/Types';
import { createEmptyMetaState } from '@/engine/meta/MetaState';

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

describe('getCodexSnapshot', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('returns all 10 echoes, all 5 memories, all 6 anchors with locked/unlocked flags', () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: 'test' });
    const engine = createEngineBridge({ saveManager: sm });
    const snap = engine.getCodexSnapshot();

    expect(snap.echoes).toHaveLength(10);
    expect(snap.memories).toHaveLength(5);
    expect(snap.anchors).toHaveLength(6);

    // Default state: no echoes/memories unlocked, only `true_random` + `peasant_farmer` anchors.
    expect(snap.echoes.every((e) => !e.unlocked)).toBe(true);
    expect(snap.memories.every((m) => m.level === 'unseen')).toBe(true);
    expect(snap.anchors.find((a) => a.id === 'peasant_farmer')!.unlocked).toBe(true);
    expect(snap.anchors.find((a) => a.id === 'true_random')!.unlocked).toBe(true);
    expect(snap.anchors.find((a) => a.id === 'martial_family')!.unlocked).toBe(false);

    // Each echo and memory entry has a name + description.
    for (const e of snap.echoes) {
      expect(e.name).toBeTruthy();
      expect(e.description).toBeTruthy();
      expect(typeof e.unlockHint).toBe('string');
    }
    for (const m of snap.memories) {
      expect(m.name).toBeTruthy();
      expect(m.description).toBeTruthy();
    }
  });

  it('reflects unlocked echo and witnessed memory state after meta hydration', () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: 'test' });
    const engine = createEngineBridge({ saveManager: sm });
    // Hydrate meta directly via the store.
    useMetaStore.getState().hydrateFromMetaState({
      ...createEmptyMetaState(),
      echoesUnlocked: ['iron_body'],
      memoriesWitnessed: { 'frost_palm_severing': 4 },  // 4 → partial
      memoriesManifested: ['frost_palm_severing'],
      unlockedAnchors: ['true_random', 'peasant_farmer', 'martial_family'],
    });
    const snap = engine.getCodexSnapshot();

    expect(snap.echoes.find((e) => e.id === 'iron_body')!.unlocked).toBe(true);
    const mem = snap.memories.find((m) => m.id === 'frost_palm_severing')!;
    expect(mem.level).toBe('partial');
    expect(mem.manifested).toBe(true);
    expect(snap.anchors.find((a) => a.id === 'martial_family')!.unlocked).toBe(true);
  });
});

describe('getLineageSnapshot', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('returns empty array on a fresh meta state', () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: 'test' });
    const engine = createEngineBridge({ saveManager: sm });
    const snap = engine.getLineageSnapshot();
    expect(snap.entries).toEqual([]);
  });

  it('resolves anchor names + carries year range and echo unlocks', () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: 'test' });
    const engine = createEngineBridge({ saveManager: sm });
    useMetaStore.getState().hydrateFromMetaState({
      ...createEmptyMetaState(),
      lifeCount: 1,
      lineage: [{
        lifeIndex: 1,
        name: 'Lin Wei',
        anchorId: 'peasant_farmer',
        birthYear: 950,
        deathYear: 980,
        yearsLived: 30,
        realmReached: 'Mortal',
        deathCause: 'sickness',
        karmaEarned: 25,
        echoesUnlockedThisLife: ['iron_body'],
        corePath: null,
        techniquesLearned: [],
      }],
    });
    const snap = engine.getLineageSnapshot();
    expect(snap.entries).toHaveLength(1);
    const e = snap.entries[0];
    expect(e.lifeIndex).toBe(1);
    expect(e.name).toBe('Lin Wei');
    expect(e.anchorName).toBe('Peasant Farmer');
    expect(e.birthYear).toBe(950);
    expect(e.deathYear).toBe(980);
    expect(e.yearsLived).toBe(30);
    expect(e.echoesUnlockedThisLife).toEqual([{ id: 'iron_body', name: 'Iron Body' }]);
  });

  it('returns most-recent-life-first ordering', () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: 'test' });
    const engine = createEngineBridge({ saveManager: sm });
    useMetaStore.getState().hydrateFromMetaState({
      ...createEmptyMetaState(),
      lifeCount: 3,
      lineage: [
        { lifeIndex: 1, name: 'A', anchorId: 'peasant_farmer', birthYear: 950, deathYear: 970, yearsLived: 20, realmReached: 'Mortal', deathCause: 'old_age', karmaEarned: 5, echoesUnlockedThisLife: [], corePath: null, techniquesLearned: [] },
        { lifeIndex: 2, name: 'B', anchorId: 'peasant_farmer', birthYear: 970, deathYear: 1000, yearsLived: 30, realmReached: 'Mortal', deathCause: 'old_age', karmaEarned: 10, echoesUnlockedThisLife: [], corePath: null, techniquesLearned: [] },
        { lifeIndex: 3, name: 'C', anchorId: 'peasant_farmer', birthYear: 1000, deathYear: 1010, yearsLived: 10, realmReached: 'Mortal', deathCause: 'sickness', karmaEarned: 2, echoesUnlockedThisLife: [], corePath: null, techniquesLearned: [] },
      ],
    });
    const snap = engine.getLineageSnapshot();
    expect(snap.entries.map((e) => e.lifeIndex)).toEqual([3, 2, 1]);
  });
});

describe('listAnchors / reincarnate include locked anchors with unlockHint', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('returns all 6 anchors with locked flag', () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: 'test' });
    const engine = createEngineBridge({ saveManager: sm });
    const payload = engine.listAnchors();
    expect(payload.availableAnchors).toHaveLength(6);
    const farmer = payload.availableAnchors.find((a) => a.id === 'peasant_farmer')!;
    expect(farmer.locked).toBe(false);
    const martial = payload.availableAnchors.find((a) => a.id === 'martial_family')!;
    expect(martial.locked).toBe(true);
    expect(martial.unlockHint).toMatch(/body tempering/i);
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

describe('engineBridge dominantMood with techniques (Phase 2B-2 Task 10)', () => {
  // Phase 2B-2 Task 24: TECHNIQUE_REGISTRY is now lazy-loaded via azurePeaksLoader.
  // Must call __loadGameplayContent() to populate live-binding registries before use.
  it('TECHNIQUE_REGISTRY hydrated still_water_heart_sutra has mood_modifier serenity', async () => {
    await __loadGameplayContent();
    const t = TECHNIQUE_REGISTRY.byId('still_water_heart_sutra')!;
    expect(t).toBeDefined();
    const moodEffect = t.effects.find((e) => e.kind === 'mood_modifier');
    expect(moodEffect).toBeDefined();
    expect((moodEffect as any).mood).toBe('serenity');
  });
});

describe('Phase 2B-3: TurnPreview surfaces region + corePath + techniques + inventory', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('exposes region label, corePath, learnedTechniques, inventory on every preview', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 7 });
    await engine.loadOrInit();
    await engine.beginLife('peasant_farmer', 'Test One');
    const preview = await engine.peekNextEvent();
    expect(preview.region).toBe('yellow_plains');
    expect(preview.regionName).toMatch(/yellow plains/i);
    expect(preview.corePath).toBeNull();
    expect(preview.corePathRevealedThisTurn).toBe(false);
    expect(preview.learnedTechniques).toEqual([]);
    expect(preview.inventory).toEqual([]);
    expect(preview.openMeridians).toEqual([]);
  });
});

describe('Phase 2B-3: corePathRevealed → gameStore wiring', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('clears corePathRevealedThisTurn at the start of the next peek', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 7 });
    await engine.loadOrInit();
    await engine.beginLife('peasant_farmer', 'X');
    useGameStore.getState().markCorePathRevealed();
    expect(useGameStore.getState().corePathRevealedThisTurn).toBe(true);
    await engine.peekNextEvent();
    expect(useGameStore.getState().corePathRevealedThisTurn).toBe(false);
  });

  it('TurnPreview.corePathRevealedThisTurn reflects the live store flag', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 7 });
    await engine.loadOrInit();
    await engine.beginLife('peasant_farmer', 'Y');
    // After peek, the flag is cleared (to false) and the preview reflects false.
    const preview = await engine.peekNextEvent();
    expect(preview.corePathRevealedThisTurn).toBe(false);
  });
});

describe('Phase 2B-3: BardoPayload surfaces corePath + techniques', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('exposes corePath and techniquesLearnedThisLife on BardoPayload', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 7 });
    await engine.loadOrInit();
    await engine.beginLife('peasant_farmer', 'Bardo Test');
    // Force-mutate the run state so the character has a corePath + a learnedTechnique.
    // (Bypassing the natural progression for test brevity.)
    const gs = useGameStore.getState();
    const rs = gs.runState!;
    gs.updateRun(
      { ...rs, character: { ...rs.character, corePath: 'iron_mountain' as const }, learnedTechniques: ['iron_mountain_body_seal'], deathCause: 'old_age' as any },
      gs.streak!,
      gs.nameRegistry!,
    );
    const bardo = await engine.beginBardo();
    expect(bardo.corePath).toBe('iron_mountain');
    expect(bardo.techniquesLearnedThisLife).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'iron_mountain_body_seal' }),
      ]),
    );
  });
});
