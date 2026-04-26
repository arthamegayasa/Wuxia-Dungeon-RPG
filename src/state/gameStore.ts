import { create } from 'zustand';
import { GamePhase } from '@/engine/core/Types';
import { RunState } from '@/engine/events/RunState';
import { StreakState } from '@/engine/choices/StreakTracker';
import { NameRegistry } from '@/engine/narrative/NameRegistry';
import { TurnResult } from '@/engine/core/GameLoop';
import { BardoResult } from '@/engine/bardo/BardoFlow';
import { EchoTracker } from '@/engine/meta/EchoTracker';

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
  /**
   * Phase 2A-2 Task 10: life-scoped EchoTracker. Null between lives; reset to
   * EchoTracker.empty() in seedRun. Held OUTSIDE RunState to avoid bumping the
   * run-save schema. The bridge commits its snapshot into MetaState.echoProgress
   * on death via commitTrackerToMeta() before runBardoFlow is invoked.
   */
  echoTracker: EchoTracker | null;

  turnResult: TurnResult | null;
  bardoResult: BardoResult | null;

  /** Phase 2B-3: one-turn shimmer signal — true for exactly the turn corePath is first revealed. */
  corePathRevealedThisTurn: boolean;

  // Actions
  setPhase: (p: GamePhase) => void;
  setLoading: (b: boolean) => void;
  setError: (msg: string | null) => void;
  seedRun: (a: SeedRunArgs) => void;
  updateRun: (rs: RunState, s: StreakState, nr: NameRegistry) => void;
  setEchoTracker: (t: EchoTracker | null) => void;
  setTurnResult: (tr: TurnResult | null) => void;
  setBardoResult: (br: BardoResult | null) => void;
  appendSeenEvent: (eventId: string) => void;
  markCorePathRevealed: () => void;
  clearCorePathRevealed: () => void;
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
  | 'echoTracker'
  | 'corePathRevealedThisTurn'
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
  echoTracker: null,
  corePathRevealedThisTurn: false,
};

export const useGameStore = create<GameStoreState>((set) => ({
  ...INITIAL,

  setPhase: (phase) => set({ phase }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // EchoTracker lifecycle asymmetry (Task 10 I3):
  //   seedRun  -> EchoTracker.empty()  (fresh zero-counter tracker for a new life)
  //   resetRun -> null                 (session teardown; no life is active)
  // This matters because `bridge.resolveChoice` does `gs.echoTracker ?? EchoTracker.empty()`
  // — a null is treated as "no active life", and an empty tracker is "life in progress
  // with no hits yet". They must NOT be collapsed to a single value.
  seedRun: ({ runState, streak, nameRegistry, lifetimeSeenEvents }) =>
    set({
      runState,
      streak,
      nameRegistry,
      lifetimeSeenEvents,
      // Reset the tracker at life start; bridge can override via setEchoTracker
      // if it ever needs to replay mid-life from a persisted snapshot.
      echoTracker: EchoTracker.empty(),
    }),

  updateRun: (runState, streak, nameRegistry) =>
    set({ runState, streak, nameRegistry }),

  setEchoTracker: (echoTracker) => set({ echoTracker }),

  setTurnResult: (turnResult) => set({ turnResult }),
  setBardoResult: (bardoResult) => set({ bardoResult }),

  markCorePathRevealed: () => set({ corePathRevealedThisTurn: true }),
  clearCorePathRevealed: () => set({ corePathRevealedThisTurn: false }),

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
      echoTracker: null,
      corePathRevealedThisTurn: false,
    }),

  reset: () => set({ ...INITIAL }),
}));
