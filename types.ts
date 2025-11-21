export enum GamePhase {
  SETUP = 'SETUP',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface CharacterStatus {
  date: string;
  location: string;
  name: string;
  age: string;
  realm: string;
  cp: string | number;
  root: string;
  activeArts: string[];
  keyItems: string[];
  relations: string[];
}

export interface GameChoice {
  id: number;
  text: string;
  subtext?: string; // Mechanics/Success chance/Risk
}

export interface TurnData {
  narrative: string;
  status: CharacterStatus;
  choices: GameChoice[];
}

export interface GameState {
  phase: GamePhase;
  history: TurnData[];
  currentTurn: TurnData | null;
  viewIndex: number;
  isLoading: boolean;
  language: 'English' | 'Indonesian';
  error: string | null;
}