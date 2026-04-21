// Canonical primitive types. Imported everywhere. Keep this file free of behavior.
// Source of truth: docs/spec/design.md §2, §3, §4, §5, §7.

export enum GamePhase {
  TITLE = 'TITLE',
  CREATION = 'CREATION',
  PLAYING = 'PLAYING',
  BARDO = 'BARDO',
  CODEX = 'CODEX',
  GAME_OVER_FINAL = 'GAME_OVER_FINAL',
}

export type Stat = 'Body' | 'Mind' | 'Spirit' | 'Agility' | 'Charm' | 'Luck';
export const STATS: readonly Stat[] = ['Body', 'Mind', 'Spirit', 'Agility', 'Charm', 'Luck'] as const;

export type Element = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'none';

export enum Realm {
  MORTAL = 'mortal',
  BODY_TEMPERING = 'body_tempering',
  QI_SENSING = 'qi_sensing',
  QI_CONDENSATION = 'qi_condensation',
  FOUNDATION = 'foundation',
  CORE = 'core',
  NASCENT_SOUL = 'nascent_soul',
  SOUL_TRANSFORMATION = 'soul_transformation',
  VOID_REFINEMENT = 'void_refinement',
  IMMORTAL = 'immortal',
}

export const REALM_ORDER: readonly Realm[] = [
  Realm.MORTAL,
  Realm.BODY_TEMPERING,
  Realm.QI_SENSING,
  Realm.QI_CONDENSATION,
  Realm.FOUNDATION,
  Realm.CORE,
  Realm.NASCENT_SOUL,
  Realm.SOUL_TRANSFORMATION,
  Realm.VOID_REFINEMENT,
  Realm.IMMORTAL,
] as const;

export type Mood = 'sorrow' | 'rage' | 'serenity' | 'paranoia' | 'resolve' | 'melancholy';
export const MOODS: readonly Mood[] = ['sorrow', 'rage', 'serenity', 'paranoia', 'resolve', 'melancholy'] as const;

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type TimeCost = 'INSTANT' | 'SHORT' | 'MEDIUM' | 'LONG' | 'EPOCH';

export type OutcomeTier = 'CRIT_SUCCESS' | 'SUCCESS' | 'PARTIAL' | 'FAILURE' | 'CRIT_FAILURE';

export type DeathCause =
  | 'starvation' | 'disease' | 'old_age'
  | 'combat_melee' | 'combat_qi' | 'poison'
  | 'betrayal' | 'tribulation' | 'qi_deviation'
  | 'cripple_wasting' | 'suicide_ritual' | 'heavenly_intervention'
  | 'karmic_hunter' | 'self_sacrifice' | 'love_death' | 'madness'
  | 'drowning' | 'beast' | 'demonic_corruption' | 'childbirth';

export type NoticeTier = 'baseline' | 'awakening' | 'noticed' | 'marked' | 'watched' | 'heir_of_void';

export function noticeTierFor(value: number): NoticeTier {
  if (value >= 100) return 'heir_of_void';
  if (value >= 75)  return 'watched';
  if (value >= 50)  return 'marked';
  if (value >= 25)  return 'noticed';
  if (value >= 10)  return 'awakening';
  return 'baseline';
}

// ---- Types used by the existing UI components during Phase 0 ----
// Kept for backward-compatibility so src/components/* still typecheck.
// Phase 1 will redesign these.

export interface CharacterStatus {
  date: string;
  location: string;
  name: string;
  age: string;
  realm: string;
  cp: string | number;
  root: string;
  activeArts: string[];
  inventory: {
    weapon: string;
    equipment: string[];
    bag: string[];
  };
  relations: string[];
}

export interface GameChoice {
  id: number;
  text: string;
  subtext?: string;
}

export interface TurnData {
  narrative: string;
  status: CharacterStatus;
  choices: GameChoice[];
}
