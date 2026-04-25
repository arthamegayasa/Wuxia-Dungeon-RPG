import { describe, it, expect } from 'vitest';
import { createMigrator } from './Migrator';
import { metaStateMigrations, METASTATE_SCHEMA_VERSION } from '@/engine/meta/MetaState';

describe('Migrator v3 → v4 (Phase 2B-1 Task 19)', () => {
  const migrator = createMigrator({
    currentVersion: METASTATE_SCHEMA_VERSION,
    migrations: metaStateMigrations as any,
  });

  it('schema version is 4', () => {
    expect(METASTATE_SCHEMA_VERSION).toBe(4);
  });

  it('v3 payload migrates: lineage gets corePath + techniquesLearned defaults; seenTechniques added', () => {
    const v3 = {
      karmaBalance: 100, lifeCount: 2,
      ownedUpgrades: ['awakened_soul_l1'],
      unlockedAnchors: ['true_random', 'peasant_farmer'],
      lineage: [
        {
          lifeIndex: 1, name: 'A', anchorId: 'peasant_farmer',
          birthYear: 1000, deathYear: 1060, yearsLived: 60,
          realmReached: 'body_tempering', deathCause: 'old_age',
          karmaEarned: 3, echoesUnlockedThisLife: [],
        },
      ],
      lifetimeSeenEvents: ['foo'],
      heavenlyNotice: 0,
      echoesUnlocked: [], memoriesWitnessed: {}, echoProgress: {}, memoriesManifested: [],
    };
    const migrated = migrator.migrate(v3, 3) as any;
    expect(migrated.lineage[0].corePath).toBeNull();
    expect(migrated.lineage[0].techniquesLearned).toEqual([]);
    expect(migrated.seenTechniques).toEqual([]);
  });

  it('v1 payload migrates cleanly through 1 → 2 → 3 → 4', () => {
    const v1 = {
      karmaBalance: 10, lifeCount: 1,
      ownedUpgrades: [], unlockedAnchors: ['true_random', 'peasant_farmer'],
      lineage: [{ lifeIndex: 1, name: 'X', anchorId: 'peasant_farmer',
                  yearsLived: 30, realmReached: 'mortal', deathCause: 'disease', karmaEarned: 2 }],
      lifetimeSeenEvents: [],
    };
    const migrated = migrator.migrate(v1, 1) as any;
    expect(migrated.echoesUnlocked).toEqual([]);
    expect(migrated.lineage[0].birthYear).toBe(0);
    expect(migrated.lineage[0].deathYear).toBeDefined();
    expect(migrated.lineage[0].corePath).toBeNull();
    expect(migrated.lineage[0].techniquesLearned).toEqual([]);
    expect(migrated.seenTechniques).toEqual([]);
  });
});
