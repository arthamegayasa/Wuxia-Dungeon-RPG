import { create } from 'zustand';
import { GamePhase } from '@/engine/core/Types';

export interface GameStoreState {
  phase: GamePhase;
  isLoading: boolean;
  error: string | null;

  // Actions
  setPhase: (p: GamePhase) => void;
  setLoading: (b: boolean) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

const initial = {
  phase: GamePhase.TITLE,
  isLoading: false,
  error: null,
} as const;

export const useGameStore = create<GameStoreState>((set) => ({
  ...initial,
  setPhase: (p) => set({ phase: p }),
  setLoading: (b) => set({ isLoading: b }),
  setError: (msg) => set({ error: msg }),
  reset: () => set({ ...initial }),
}));
