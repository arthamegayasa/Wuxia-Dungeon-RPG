import { describe, it, expect, beforeEach } from 'vitest';
import { GamePhase } from '@/engine/core/Types';
import { useGameStore } from './gameStore';

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('starts in TITLE phase with no runState', () => {
    const s = useGameStore.getState();
    expect(s.phase).toBe(GamePhase.TITLE);
    expect(s.runState).toBeNull();
    expect(s.streak).toBeNull();
    expect(s.nameRegistry).toBeNull();
    expect(s.turnResult).toBeNull();
    expect(s.bardoResult).toBeNull();
  });

  it('setPhase updates the phase', () => {
    useGameStore.getState().setPhase(GamePhase.CREATION);
    expect(useGameStore.getState().phase).toBe(GamePhase.CREATION);
  });

  it('seedRun populates runState, streak, nameRegistry, lifetimeSeenEvents', () => {
    const dummyRun = { turn: 0 } as any;
    const dummyStreak = { consecutiveFailures: 0 } as any;
    const dummyRegistry = { names: new Map() } as any;
    useGameStore.getState().seedRun({
      runState: dummyRun,
      streak: dummyStreak,
      nameRegistry: dummyRegistry,
      lifetimeSeenEvents: ['EV_X'],
    });
    const s = useGameStore.getState();
    expect(s.runState).toBe(dummyRun);
    expect(s.streak).toBe(dummyStreak);
    expect(s.nameRegistry).toBe(dummyRegistry);
    expect(s.lifetimeSeenEvents).toEqual(['EV_X']);
  });

  it('setTurnResult stores the last turn output', () => {
    const tr = { narrative: 'hi', eventId: 'EV', nextRunState: {} as any } as any;
    useGameStore.getState().setTurnResult(tr);
    expect(useGameStore.getState().turnResult).toBe(tr);
  });

  it('setBardoResult stores the bardo output', () => {
    const br = { karmaEarned: 42, meta: {} as any } as any;
    useGameStore.getState().setBardoResult(br);
    expect(useGameStore.getState().bardoResult).toBe(br);
  });

  it('resetRun clears run-scoped fields but keeps phase untouched', () => {
    useGameStore.getState().setPhase(GamePhase.CREATION);
    useGameStore.getState().seedRun({
      runState: { turn: 1 } as any,
      streak: {} as any,
      nameRegistry: {} as any,
      lifetimeSeenEvents: ['x'],
    });
    useGameStore.getState().setTurnResult({ narrative: 'n' } as any);
    useGameStore.getState().setBardoResult({ karmaEarned: 1 } as any);

    useGameStore.getState().resetRun();

    const s = useGameStore.getState();
    expect(s.phase).toBe(GamePhase.CREATION); // unchanged
    expect(s.runState).toBeNull();
    expect(s.streak).toBeNull();
    expect(s.nameRegistry).toBeNull();
    expect(s.lifetimeSeenEvents).toEqual([]);
    expect(s.turnResult).toBeNull();
    expect(s.bardoResult).toBeNull();
  });

  it('reset brings the store back to initial state', () => {
    useGameStore.getState().setPhase(GamePhase.PLAYING);
    useGameStore.getState().setError('boom');
    useGameStore.getState().reset();
    const s = useGameStore.getState();
    expect(s.phase).toBe(GamePhase.TITLE);
    expect(s.error).toBeNull();
  });
});
