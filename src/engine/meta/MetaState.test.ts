import { describe, it, expect, beforeEach } from 'vitest';
import { createSaveManager } from '@/engine/persistence/SaveManager';
import {
  createEmptyMetaState, loadMeta, saveMeta, addKarma, spendKarma, ownsUpgrade,
  purchaseUpgrade, unlockAnchor, METASTATE_SCHEMA_VERSION, metaStateMigrations,
  MetaState,
} from './MetaState';

describe('MetaState', () => {
  const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });

  beforeEach(() => { localStorage.clear(); });

  it('createEmptyMetaState has zeros and only the default anchors unlocked', () => {
    const m = createEmptyMetaState();
    expect(m.karmaBalance).toBe(0);
    expect(m.lifeCount).toBe(0);
    expect(m.ownedUpgrades).toEqual([]);
    expect(m.unlockedAnchors).toContain('true_random');
    expect(m.unlockedAnchors).toContain('peasant_farmer');
    expect(m.lineage).toEqual([]);
    expect(m.lifetimeSeenEvents).toEqual([]);
  });

  it('addKarma + spendKarma round-trip', () => {
    let m = createEmptyMetaState();
    m = addKarma(m, 100);
    expect(m.karmaBalance).toBe(100);
    const r = spendKarma(m, 30);
    expect(r).not.toBeNull();
    expect(r!.karmaBalance).toBe(70);
  });

  it('spendKarma returns null when balance insufficient', () => {
    const m = addKarma(createEmptyMetaState(), 20);
    expect(spendKarma(m, 50)).toBeNull();
  });

  it('purchaseUpgrade rejects if requires not owned', () => {
    let m = addKarma(createEmptyMetaState(), 10_000);
    const r = purchaseUpgrade(m, 'awakened_soul_2');
    expect(r).toBeNull(); // requires awakened_soul_1
  });

  it('purchaseUpgrade succeeds when cost + requires satisfied', () => {
    let m = addKarma(createEmptyMetaState(), 10_000);
    const a = purchaseUpgrade(m, 'awakened_soul_1');
    expect(a).not.toBeNull();
    expect(ownsUpgrade(a!, 'awakened_soul_1')).toBe(true);
    expect(a!.karmaBalance).toBe(10_000 - 80);

    const b = purchaseUpgrade(a!, 'awakened_soul_2');
    expect(b).not.toBeNull();
    expect(ownsUpgrade(b!, 'awakened_soul_2')).toBe(true);
  });

  it('purchaseUpgrade rejects if already owned', () => {
    let m = addKarma(createEmptyMetaState(), 10_000);
    m = purchaseUpgrade(m, 'awakened_soul_1')!;
    expect(purchaseUpgrade(m, 'awakened_soul_1')).toBeNull();
  });

  it('purchaseUpgrade rejects if balance insufficient', () => {
    const m = addKarma(createEmptyMetaState(), 10);  // < 80
    expect(purchaseUpgrade(m, 'awakened_soul_1')).toBeNull();
  });

  it('unlockAnchor is idempotent', () => {
    let m = createEmptyMetaState();
    m = unlockAnchor(m, 'outer_disciple');
    m = unlockAnchor(m, 'outer_disciple');
    expect(m.unlockedAnchors.filter((a) => a === 'outer_disciple')).toHaveLength(1);
  });

  it('saves and loads through SaveManager', () => {
    const m = addKarma(createEmptyMetaState(), 42);
    saveMeta(sm, m);
    const loaded = loadMeta(sm);
    expect(loaded).toEqual(m);
  });

  it('loadMeta returns an empty state when no save exists', () => {
    const loaded = loadMeta(sm);
    expect(loaded).toEqual(createEmptyMetaState());
  });
});

describe('MetaState v2 → v3 migration', () => {
  it('migrates v2 lineage entries to v3 with default birthYear=0, deathYear=yearsLived', () => {
    const v2 = {
      schemaVersion: 2,
      karmaBalance: 100,
      lifeCount: 1,
      ownedUpgrades: [],
      unlockedAnchors: ['true_random', 'peasant_farmer'],
      lineage: [{
        lifeIndex: 1,
        name: 'Old Hu',
        anchorId: 'peasant_farmer',
        yearsLived: 47,
        realmReached: 'Mortal',
        deathCause: 'old_age',
        karmaEarned: 30,
        echoesUnlockedThisLife: ['iron_body'],
      }],
      lifetimeSeenEvents: [],
      heavenlyNotice: 0,
      echoesUnlocked: ['iron_body'],
      echoProgress: { 'choice_cat.life.training': 5 },
      memoriesWitnessed: {},
      memoriesManifested: [],
    };

    const migration = metaStateMigrations.find((m) => m.from === 2 && m.to === 3);
    expect(migration).toBeDefined();
    const v3 = migration!.transform(v2) as MetaState;

    // Year fields backfilled
    expect(v3.lineage[0].birthYear).toBe(0);
    expect(v3.lineage[0].deathYear).toBe(47);  // = yearsLived
    // Other fields preserved
    expect(v3.karmaBalance).toBe(100);
    expect(v3.echoesUnlocked).toEqual(['iron_body']);
    expect(v3.lineage[0].echoesUnlockedThisLife).toEqual(['iron_body']);
  });

  it('METASTATE_SCHEMA_VERSION is 3', () => {
    expect(METASTATE_SCHEMA_VERSION).toBe(3);
  });
});
