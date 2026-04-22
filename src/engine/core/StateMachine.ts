import { GamePhase } from './Types';

// Adjacency: from → set of allowed destinations.
// CODEX is allowed as an overlay from TITLE / PLAYING / BARDO, and can return
// to the same phase it came from. We enforce "return to origin" by storing
// the previous phase when entering CODEX.
const allowed: Record<GamePhase, ReadonlySet<GamePhase>> = {
  [GamePhase.TITLE]: new Set([GamePhase.CREATION, GamePhase.CODEX]),
  [GamePhase.CREATION]: new Set([GamePhase.PLAYING, GamePhase.TITLE]),
  [GamePhase.PLAYING]: new Set([GamePhase.BARDO, GamePhase.CODEX, GamePhase.GAME_OVER_FINAL]),
  [GamePhase.BARDO]: new Set([GamePhase.CREATION, GamePhase.CODEX, GamePhase.GAME_OVER_FINAL]),
  [GamePhase.CODEX]: new Set([/* set dynamically based on whence */]),
  [GamePhase.GAME_OVER_FINAL]: new Set([GamePhase.TITLE]),
};

export interface PhaseMachine {
  phase(): GamePhase;
  canTransition(next: GamePhase): boolean;
  transition(next: GamePhase): void;
}

export function createPhaseMachine(initial: GamePhase = GamePhase.TITLE): PhaseMachine {
  let current = initial;
  let codexReturn: GamePhase | null = null;

  function canTransition(next: GamePhase): boolean {
    if (current === GamePhase.CODEX) {
      // Only legal return is to the phase we came from.
      return codexReturn === next;
    }
    return allowed[current].has(next);
  }

  function transition(next: GamePhase): void {
    if (!canTransition(next)) {
      throw new Error(`illegal transition: ${current} -> ${next}`);
    }
    if (next === GamePhase.CODEX) {
      codexReturn = current;
    } else if (current === GamePhase.CODEX) {
      codexReturn = null;
    }
    current = next;
  }

  return {
    phase: () => current,
    canTransition,
    transition,
  };
}
