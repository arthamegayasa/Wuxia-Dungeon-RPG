import { GamePhase } from './Types';

// Adjacency: from → set of allowed destinations.
// CODEX and LINEAGE are overlay phases allowed from TITLE / PLAYING / BARDO.
// They can return to the same phase they came from. We enforce "return to origin"
// by storing the previous phase when entering either overlay.
const allowed: Record<GamePhase, ReadonlySet<GamePhase>> = {
  [GamePhase.TITLE]: new Set([GamePhase.CREATION, GamePhase.CODEX, GamePhase.LINEAGE]),
  [GamePhase.CREATION]: new Set([GamePhase.PLAYING, GamePhase.TITLE]),
  [GamePhase.PLAYING]: new Set([GamePhase.BARDO, GamePhase.CODEX, GamePhase.LINEAGE, GamePhase.GAME_OVER_FINAL]),
  [GamePhase.BARDO]: new Set([GamePhase.CREATION, GamePhase.CODEX, GamePhase.LINEAGE, GamePhase.GAME_OVER_FINAL]),
  [GamePhase.CODEX]: new Set([/* set dynamically based on whence */]),
  [GamePhase.LINEAGE]: new Set([/* set dynamically based on whence */]),
  [GamePhase.GAME_OVER_FINAL]: new Set([GamePhase.TITLE]),
};

export interface PhaseMachine {
  phase(): GamePhase;
  canTransition(next: GamePhase): boolean;
  transition(next: GamePhase): void;
}

export function createPhaseMachine(initial: GamePhase = GamePhase.TITLE): PhaseMachine {
  let current = initial;
  let overlayReturn: GamePhase | null = null;

  function canTransition(next: GamePhase): boolean {
    if (current === GamePhase.CODEX || current === GamePhase.LINEAGE) {
      // Only legal return is to the phase we came from.
      return overlayReturn === next;
    }
    return allowed[current].has(next);
  }

  function transition(next: GamePhase): void {
    if (!canTransition(next)) {
      throw new Error(`illegal transition: ${current} -> ${next}`);
    }
    if (next === GamePhase.CODEX || next === GamePhase.LINEAGE) {
      overlayReturn = current;
    } else if (current === GamePhase.CODEX || current === GamePhase.LINEAGE) {
      overlayReturn = null;
    }
    current = next;
  }

  return {
    phase: () => current,
    canTransition,
    transition,
  };
}
