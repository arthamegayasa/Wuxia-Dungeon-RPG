import { create } from 'zustand';
import { GamePhase } from '@/engine/core/Types';
import { RunState } from '@/engine/events/RunState';
import { StreakState } from '@/engine/choices/StreakTracker';
import { NameRegistry } from '@/engine/narrative/NameRegistry';
import { TurnResult } from '@/engine/core/GameLoop';
import { BardoResult } from '@/engine/bardo/BardoFlow';

export interface SeedRunArgs {
  runState: RunState;
  streak: StreakState;
  nameRegistry: NameRegistry;
  lifetimeSeenEvents: ReadonlyArray<string>;
}

export interface GameStoreState {
  phase: GamePhase;
  isLoading: boolean;
  error: string | null;

  runState: RunState | null;
  streak: StreakState | null;
  nameRegistry: NameRegistry | null;
  lifetimeSeenEvents: ReadonlyArray<string>;

  turnResult: TurnResult | null;
  bardoResult: BardoResult | null;

  // Actions
  setPhase: (p: GamePhase) => void;
  setLoading: (b: boolean) => void;
  setError: (msg: string | null) => void;
  seedRun: (a: SeedRunArgs) => void;
  updateRun: (rs: RunState, s: StreakState, nr: NameRegistry) => void;
  setTurnResult: (tr: TurnResult | null) => void;
  setBardoResult: (br: BardoResult | null) => void;
  appendSeenEvent: (eventId: string) => void;
  resetRun: () => void;
  reset: () => void;
}

const INITIAL: Pick<
  GameStoreState,
  | 'phase'
  | 'isLoading'
  | 'error'
  | 'runState'
  | 'streak'
  | 'nameRegistry'
  | 'lifetimeSeenEvents'
  | 'turnResult'
  | 'bardoResult'
> = {
  phase: GamePhase.TITLE,
  isLoading: false,
  error: null,
  runState: null,
  streak: null,
  nameRegistry: null,
  lifetimeSeenEvents: [],
  turnResult: null,
  bardoResult: null,
};

export const useGameStore = create<GameStoreState>((set) => ({
  ...INITIAL,

  setPhase: (phase) => set({ phase }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  seedRun: ({ runState, streak, nameRegistry, lifetimeSeenEvents }) =>
    set({ runState, streak, nameRegistry, lifetimeSeenEvents }),

  updateRun: (runState, streak, nameRegistry) =>
    set({ runState, streak, nameRegistry }),

  setTurnResult: (turnResult) => set({ turnResult }),
  setBardoResult: (bardoResult) => set({ bardoResult }),

  appendSeenEvent: (eventId) =>
    set((prev) => ({
      lifetimeSeenEvents: prev.lifetimeSeenEvents.includes(eventId)
        ? prev.lifetimeSeenEvents
        : [...prev.lifetimeSeenEvents, eventId],
    })),

  resetRun: () =>
    set({
      runState: null,
      streak: null,
      nameRegistry: null,
      lifetimeSeenEvents: [],
      turnResult: null,
      bardoResult: null,
    }),

  reset: () => set({ ...INITIAL }),
}));
