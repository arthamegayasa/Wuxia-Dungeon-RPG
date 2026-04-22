// Persistent cross-life record + SaveManager integration.
// Source: docs/spec/design.md §7 (meta-progression), §10 (persistence).

import { SaveManager } from '@/engine/persistence/SaveManager';
import { getUpgradeById } from './KarmicUpgrade';

export const METASTATE_SCHEMA_VERSION = 1;
const META_KEY = 'wdr.meta';

export interface LineageEntrySummary {
  lifeIndex: number;
  name: string;
  anchorId: string;
  yearsLived: number;
  realmReached: string;
  deathCause: string;
  karmaEarned: number;
}

export interface MetaState {
  readonly karmaBalance: number;
  readonly lifeCount: number;
  readonly ownedUpgrades: ReadonlyArray<string>;
  readonly unlockedAnchors: ReadonlyArray<string>;
  readonly lineage: ReadonlyArray<LineageEntrySummary>;
  readonly lifetimeSeenEvents: ReadonlyArray<string>;
}

export function createEmptyMetaState(): MetaState {
  return {
    karmaBalance: 0,
    lifeCount: 0,
    ownedUpgrades: [],
    unlockedAnchors: ['true_random', 'peasant_farmer'],
    lineage: [],
    lifetimeSeenEvents: [],
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

export function loadMeta(sm: SaveManager): MetaState {
  const envelope = sm.load<MetaState>(META_KEY);
  if (envelope === null) return createEmptyMetaState();
  return envelope.data;
}
