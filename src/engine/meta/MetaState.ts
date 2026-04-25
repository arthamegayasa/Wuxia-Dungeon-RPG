// Persistent cross-life record + SaveManager integration.
// Source: docs/spec/design.md §7 (meta-progression), §10 (persistence).

import { SaveManager } from '@/engine/persistence/SaveManager';
import { createMigrator } from '@/engine/persistence/Migrator';
import type { Migration } from '@/engine/persistence/Migrator';
import { getUpgradeById } from './KarmicUpgrade';

export const METASTATE_SCHEMA_VERSION = 4;
const META_KEY = 'wdr.meta';

export interface LineageEntrySummary {
  lifeIndex: number;
  name: string;
  anchorId: string;
  /** Phase 2A-3 Task 3: absolute calendar year of birth. 0 for entries from
   *  pre-v3 saves (rendered as "Years lived: N" instead of "(Year X – Y)"). */
  birthYear: number;
  /** Phase 2A-3 Task 3: absolute calendar year of death = birthYear + yearsLived. */
  deathYear: number;
  yearsLived: number;
  realmReached: string;
  deathCause: string;
  karmaEarned: number;
  echoesUnlockedThisLife: ReadonlyArray<string>;
  /** Phase 2B-1: core path locked at 3rd meridian open (null if character died before 3). */
  corePath: string | null;
  /** Phase 2B-1: ids of techniques learned in this life (in order learned). */
  techniquesLearned: ReadonlyArray<string>;
}

export interface MetaState {
  readonly karmaBalance: number;
  readonly lifeCount: number;
  readonly ownedUpgrades: ReadonlyArray<string>;
  readonly unlockedAnchors: ReadonlyArray<string>;
  readonly lineage: ReadonlyArray<LineageEntrySummary>;
  readonly lifetimeSeenEvents: ReadonlyArray<string>;
  /** Stub added Task 2 (Phase 2A-1). Full migration done in Task 14. */
  readonly heavenlyNotice: number;
  /** All echo ids ever unlocked across all lives. Task 14 will add more fields. */
  readonly echoesUnlocked: ReadonlyArray<string>;
  /** Lifetime witness counter per technique/memory id. Incremented each life a memory is witnessed. Task 14 field. */
  readonly memoriesWitnessed: Readonly<Record<string, number>>;
  /** Cumulative echo unlock progress counters (choice category hits, outcome counts, etc.). Task 14 field. */
  readonly echoProgress: Readonly<Record<string, number>>;
  /** Ids of forbidden memories that have ever manifested across all lives. Task 14 field. */
  readonly memoriesManifested: ReadonlyArray<string>;
  /** Phase 2B-1: cumulative ids of techniques the player has seen in any life (UI Codex). */
  readonly seenTechniques: ReadonlyArray<string>;
}

export function createEmptyMetaState(): MetaState {
  return {
    karmaBalance: 0,
    lifeCount: 0,
    ownedUpgrades: [],
    unlockedAnchors: ['true_random', 'peasant_farmer'],
    lineage: [],
    lifetimeSeenEvents: [],
    heavenlyNotice: 0,
    echoesUnlocked: [],
    memoriesWitnessed: {},
    echoProgress: {},
    memoriesManifested: [],
    seenTechniques: [],
  };
}

export function addKarma(m: MetaState, amount: number): MetaState {
  if (amount < 0) return m;
  return { ...m, karmaBalance: m.karmaBalance + amount };
}

export function spendKarma(m: MetaState, amount: number): MetaState | null {
  if (m.karmaBalance < amount) return null;
  return { ...m, karmaBalance: m.karmaBalance - amount };
}

export function ownsUpgrade(m: MetaState, upgradeId: string): boolean {
  return m.ownedUpgrades.includes(upgradeId);
}

export function purchaseUpgrade(m: MetaState, upgradeId: string): MetaState | null {
  const upgrade = getUpgradeById(upgradeId);
  if (!upgrade) return null;
  if (ownsUpgrade(m, upgradeId)) return null;
  for (const req of upgrade.requires) {
    if (!ownsUpgrade(m, req)) return null;
  }
  const afterSpend = spendKarma(m, upgrade.cost);
  if (!afterSpend) return null;
  return {
    ...afterSpend,
    ownedUpgrades: [...afterSpend.ownedUpgrades, upgradeId],
  };
}

export function unlockAnchor(m: MetaState, anchorId: string): MetaState {
  if (m.unlockedAnchors.includes(anchorId)) return m;
  return { ...m, unlockedAnchors: [...m.unlockedAnchors, anchorId] };
}

export function incrementLifeCount(m: MetaState): MetaState {
  return { ...m, lifeCount: m.lifeCount + 1 };
}

export function appendLineageEntry(m: MetaState, entry: LineageEntrySummary): MetaState {
  return { ...m, lineage: [...m.lineage, entry] };
}

export function saveMeta(sm: SaveManager, m: MetaState): void {
  sm.save(META_KEY, m, METASTATE_SCHEMA_VERSION);
}

export const metaStateMigrations: ReadonlyArray<Migration> = [
  {
    from: 1,
    to: 2,
    transform: (old: any): MetaState => ({
      karmaBalance: old.karmaBalance ?? 0,
      lifeCount: old.lifeCount ?? 0,
      ownedUpgrades: old.ownedUpgrades ?? [],
      unlockedAnchors: old.unlockedAnchors ?? ['true_random', 'peasant_farmer'],
      lineage: (old.lineage ?? []).map((entry: any) => ({
        ...entry,
        echoesUnlockedThisLife: entry.echoesUnlockedThisLife ?? [],
        birthYear: entry.birthYear ?? 0,
        deathYear: entry.deathYear ?? entry.yearsLived ?? 0,
        corePath: entry.corePath ?? null,
        techniquesLearned: entry.techniquesLearned ?? [],
      })),
      lifetimeSeenEvents: old.lifetimeSeenEvents ?? [],
      echoesUnlocked: [],
      echoProgress: {},
      memoriesWitnessed: {},
      memoriesManifested: [],
      heavenlyNotice: 0,
      seenTechniques: [],
    }),
  },
  {
    from: 2,
    to: 3,
    transform: (old: any): MetaState => ({
      ...old,
      schemaVersion: 3,
      lineage: (old.lineage ?? []).map((entry: any) => ({
        ...entry,
        birthYear: entry.birthYear ?? 0,
        deathYear: entry.deathYear ?? entry.yearsLived ?? 0,
      })),
    }),
  },
  {
    from: 3,
    to: 4,
    transform: (old: any): MetaState => ({
      ...old,
      schemaVersion: 4,
      lineage: (old.lineage ?? []).map((entry: any) => ({
        ...entry,
        corePath: entry.corePath ?? null,
        techniquesLearned: entry.techniquesLearned ?? [],
      })),
      seenTechniques: old.seenTechniques ?? [],
    }),
  },
];

const metaMigrator = createMigrator<MetaState>({
  currentVersion: METASTATE_SCHEMA_VERSION,
  migrations: metaStateMigrations as any,
});

export function loadMeta(sm: SaveManager): MetaState {
  const envelope = sm.load<unknown>(META_KEY);
  if (envelope === null) return createEmptyMetaState();
  return metaMigrator.migrate(envelope.data, envelope.schemaVersion);
}
