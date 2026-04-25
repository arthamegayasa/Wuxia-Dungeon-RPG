import { describe, it, expect } from 'vitest';
import { createMigrator } from './Migrator';
import fixtureV1 from '@/engine/meta/__fixtures__/metastate_v1.json';
import { metaStateMigrations, METASTATE_SCHEMA_VERSION } from '@/engine/meta/MetaState';
import type { MetaState } from '@/engine/meta/MetaState';

describe('Migrator v1 → v2 for MetaState', () => {
  const migrator = createMigrator<MetaState>({
    currentVersion: METASTATE_SCHEMA_VERSION,
    migrations: metaStateMigrations as any,
  });

  it('preserves karmaBalance and ownedUpgrades', () => {
    const migrated = migrator.migrate(fixtureV1, 1);
    expect(migrated.karmaBalance).toBe(57);
    expect(migrated.ownedUpgrades).toEqual(['awakened_soul_1']);
  });

  it('defaults new Phase 2A fields to empty', () => {
    const migrated = migrator.migrate(fixtureV1, 1);
    expect(migrated.echoesUnlocked).toEqual([]);
    expect(migrated.echoProgress).toEqual({});
    expect(migrated.memoriesWitnessed).toEqual({});
    expect(migrated.memoriesManifested).toEqual([]);
    expect(migrated.heavenlyNotice).toBe(0);
  });

  it('backfills lineage entries with echoesUnlockedThisLife: []', () => {
    const migrated = migrator.migrate(fixtureV1, 1);
    expect(migrated.lineage[0].echoesUnlockedThisLife).toEqual([]);
  });

  it('backfills lineage entries with birthYear=0, deathYear=yearsLived (v1→v3 chain)', () => {
    const migrated = migrator.migrate(fixtureV1, 1);
    expect(migrated.lineage[0].birthYear).toBe(0);
    expect(migrated.lineage[0].deathYear).toBe(42); // yearsLived from fixture
  });

  it('target schema version matches the current-version constant', () => {
    expect(METASTATE_SCHEMA_VERSION).toBe(4);
  });
});
