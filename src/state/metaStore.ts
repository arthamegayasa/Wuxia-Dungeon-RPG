import { create } from 'zustand';
import {
  createEmptyMetaState,
  LineageEntrySummary,
  MetaState,
} from '@/engine/meta/MetaState';

export interface MetaStoreState {
  karmicInsight: number;
  heavenlyNotice: number;
  unlockedEchoes: string[];
  unlockedMemories: string[];
  unlockedAnchors: string[];
  lifeCount: number;
  ownedUpgrades: string[];
  lineage: LineageEntrySummary[];
  lifetimeSeenEvents: string[];
  /** Phase 2A Task 6: lifetime witness counter per memory id. */
  memoriesWitnessed: Record<string, number>;
  /** Phase 2A Task 6: ids of memories that have ever manifested. */
  memoriesManifested: string[];

  addKarma: (amount: number) => void;
  spendKarma: (amount: number) => boolean;
  addNotice: (amount: number) => void;
  unlockEcho: (id: string) => void;
  unlockMemory: (id: string) => void;
  unlockAnchor: (id: string) => void;
  incrementLifeCount: () => void;
  hydrateFromMetaState: (m: MetaState) => void;
  toMetaState: () => MetaState;
  reset: () => void;
}

const INITIAL_META = createEmptyMetaState();

const initial = {
  karmicInsight: INITIAL_META.karmaBalance,
  heavenlyNotice: 0,
  unlockedEchoes: [] as string[],
  unlockedMemories: [] as string[],
  unlockedAnchors: [...INITIAL_META.unlockedAnchors] as string[], // defaults per spec §7.4
  lifeCount: INITIAL_META.lifeCount,
  ownedUpgrades: [...INITIAL_META.ownedUpgrades] as string[],
  lineage: [...INITIAL_META.lineage] as LineageEntrySummary[],
  lifetimeSeenEvents: [...INITIAL_META.lifetimeSeenEvents] as string[],
  memoriesWitnessed: {} as Record<string, number>,
  memoriesManifested: [] as string[],
};

export const useMetaStore = create<MetaStoreState>((set, get) => ({
  ...initial,

  addKarma: (amount) => set({ karmicInsight: get().karmicInsight + amount }),

  spendKarma: (amount) => {
    const balance = get().karmicInsight;
    if (amount > balance) return false;
    set({ karmicInsight: balance - amount });
    return true;
  },

  addNotice: (amount) =>
    set({ heavenlyNotice: Math.max(0, Math.min(100, get().heavenlyNotice + amount)) }),

  unlockEcho: (id) => {
    const cur = get().unlockedEchoes;
    if (!cur.includes(id)) set({ unlockedEchoes: [...cur, id] });
  },

  unlockMemory: (id) => {
    const cur = get().unlockedMemories;
    if (!cur.includes(id)) set({ unlockedMemories: [...cur, id] });
  },

  unlockAnchor: (id) => {
    const cur = get().unlockedAnchors;
    if (!cur.includes(id)) set({ unlockedAnchors: [...cur, id] });
  },

  incrementLifeCount: () => set({ lifeCount: get().lifeCount + 1 }),

  hydrateFromMetaState: (m) =>
    set({
      karmicInsight: m.karmaBalance,
      unlockedAnchors: [...m.unlockedAnchors],
      ownedUpgrades: [...m.ownedUpgrades],
      lifeCount: m.lifeCount,
      lineage: [...m.lineage],
      lifetimeSeenEvents: [...m.lifetimeSeenEvents],
      unlockedEchoes: [...(m.echoesUnlocked ?? [])],
      memoriesWitnessed: { ...m.memoriesWitnessed },
      memoriesManifested: [...(m.memoriesManifested ?? [])],
    }),

  toMetaState: (): MetaState => {
    const s = get();
    return {
      karmaBalance: s.karmicInsight,
      lifeCount: s.lifeCount,
      ownedUpgrades: [...s.ownedUpgrades],
      unlockedAnchors: [...s.unlockedAnchors],
      lineage: [...s.lineage],
      lifetimeSeenEvents: [...s.lifetimeSeenEvents],
      // Phase 2A-1: bridge store-side projection to MetaState v2 shape.
      heavenlyNotice: s.heavenlyNotice,
      echoesUnlocked: [...s.unlockedEchoes],
      echoProgress: {},
      memoriesWitnessed: { ...s.memoriesWitnessed },
      memoriesManifested: [...s.memoriesManifested],
      seenTechniques: [],
    };
  },

  reset: () =>
    set({
      karmicInsight: initial.karmicInsight,
      heavenlyNotice: initial.heavenlyNotice,
      unlockedEchoes: [...initial.unlockedEchoes],
      unlockedMemories: [...initial.unlockedMemories],
      unlockedAnchors: [...initial.unlockedAnchors],
      lifeCount: initial.lifeCount,
      ownedUpgrades: [...initial.ownedUpgrades],
      lineage: [...initial.lineage],
      lifetimeSeenEvents: [...initial.lifetimeSeenEvents],
      memoriesWitnessed: { ...initial.memoriesWitnessed },
      memoriesManifested: [...initial.memoriesManifested],
    }),
}));
