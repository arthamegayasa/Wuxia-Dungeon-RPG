import { describe, it, expect } from 'vitest';
import { GamePhase } from './Types';
import { createPhaseMachine } from './StateMachine';

describe('PhaseMachine', () => {
  it('starts at TITLE', () => {
    const m = createPhaseMachine();
    expect(m.phase()).toBe(GamePhase.TITLE);
  });

  it('allows TITLE -> CREATION', () => {
    const m = createPhaseMachine();
    m.transition(GamePhase.CREATION);
    expect(m.phase()).toBe(GamePhase.CREATION);
  });

  it('allows CREATION -> PLAYING', () => {
    const m = createPhaseMachine();
    m.transition(GamePhase.CREATION);
    m.transition(GamePhase.PLAYING);
    expect(m.phase()).toBe(GamePhase.PLAYING);
  });

  it('allows PLAYING -> BARDO', () => {
    const m = createPhaseMachine();
    m.transition(GamePhase.CREATION);
    m.transition(GamePhase.PLAYING);
    m.transition(GamePhase.BARDO);
    expect(m.phase()).toBe(GamePhase.BARDO);
  });

  it('allows BARDO -> CREATION', () => {
    const m = createPhaseMachine();
    m.transition(GamePhase.CREATION);
    m.transition(GamePhase.PLAYING);
    m.transition(GamePhase.BARDO);
    m.transition(GamePhase.CREATION);
    expect(m.phase()).toBe(GamePhase.CREATION);
  });

  it('rejects PLAYING -> CREATION (must go through BARDO)', () => {
    const m = createPhaseMachine();
    m.transition(GamePhase.CREATION);
    m.transition(GamePhase.PLAYING);
    expect(() => m.transition(GamePhase.CREATION))
      .toThrow(/illegal transition/i);
    expect(m.phase()).toBe(GamePhase.PLAYING);
  });

  it('allows CODEX as a modal overlay from TITLE, PLAYING, BARDO', () => {
    for (const from of [GamePhase.TITLE, GamePhase.PLAYING, GamePhase.BARDO]) {
      const m = createPhaseMachine(from);
      m.transition(GamePhase.CODEX);
      expect(m.phase()).toBe(GamePhase.CODEX);
      // and back
      m.transition(from);
      expect(m.phase()).toBe(from);
    }
  });

  it('allows LINEAGE as a modal overlay from TITLE, PLAYING, BARDO', () => {
    for (const from of [GamePhase.TITLE, GamePhase.PLAYING, GamePhase.BARDO]) {
      const m = createPhaseMachine(from);
      m.transition(GamePhase.LINEAGE);
      expect(m.phase()).toBe(GamePhase.LINEAGE);
      m.transition(from);
      expect(m.phase()).toBe(from);
    }
  });

  it('GAME_OVER_FINAL is terminal from any state (except itself)', () => {
    const m = createPhaseMachine();
    m.transition(GamePhase.CREATION);
    m.transition(GamePhase.PLAYING);
    m.transition(GamePhase.GAME_OVER_FINAL);
    expect(m.phase()).toBe(GamePhase.GAME_OVER_FINAL);
    expect(() => m.transition(GamePhase.PLAYING))
      .toThrow(/illegal transition/i);
  });

  it('exposes canTransition() without throwing', () => {
    const m = createPhaseMachine();
    expect(m.canTransition(GamePhase.CREATION)).toBe(true);
    expect(m.canTransition(GamePhase.PLAYING)).toBe(false);
    expect(m.canTransition(GamePhase.BARDO)).toBe(false);
  });
});
