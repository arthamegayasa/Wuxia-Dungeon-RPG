import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import { GamePhase } from '@/engine/core/Types';

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('initialises in TITLE phase', () => {
    expect(useGameStore.getState().phase).toBe(GamePhase.TITLE);
  });

  it('setPhase updates the phase', () => {
    useGameStore.getState().setPhase(GamePhase.CREATION);
    expect(useGameStore.getState().phase).toBe(GamePhase.CREATION);
  });

  it('reset returns to TITLE and clears error/loading', () => {
    const s = useGameStore.getState();
    s.setPhase(GamePhase.PLAYING);
    s.setError('something');
    s.setLoading(true);
    s.reset();
    const after = useGameStore.getState();
    expect(after.phase).toBe(GamePhase.TITLE);
    expect(after.error).toBeNull();
    expect(after.isLoading).toBe(false);
  });
});
