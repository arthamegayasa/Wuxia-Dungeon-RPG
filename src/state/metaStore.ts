import { create } from 'zustand';

export interface MetaStoreState {
  karmicInsight: number;
  heavenlyNotice: number;
  unlockedEchoes: string[];
  unlockedMemories: string[];
  unlockedAnchors: string[];
  lifeCount: number;

  addKarma: (amount: number) => void;
  spendKarma: (amount: number) => boolean;
  addNotice: (amount: number) => void;
  unlockEcho: (id: string) => void;
  unlockMemory: (id: string) => void;
  unlockAnchor: (id: string) => void;
  incrementLifeCount: () => void;
  reset: () => void;
}

const initial = {
  karmicInsight: 0,
  heavenlyNotice: 0,
  unlockedEchoes: [] as string[],
  unlockedMemories: [] as string[],
  unlockedAnchors: ['true_random', 'peasant_farmer'] as string[], // defaults per spec §7.4
  lifeCount: 0,
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

  reset: () => set({
    ...initial,
    // Default anchors should always exist.
    unlockedAnchors: [...initial.unlockedAnchors],
  }),
}));
