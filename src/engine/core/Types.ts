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

// ---- Phase 1A: Character System primitive types ----
// Source of truth: docs/spec/design.md §3, §4.

export type SpiritRootTier =
  | 'none'            // 95% of rolls — cannot cultivate qi
  | 'mottled'         // 4% — trash root, 0.3× absorption
  | 'single_element'  // 0.9% — sect-eligible
  | 'dual_element'    // 0.09% — prodigy
  | 'heavenly';       // 0.01% — once in ~10_000 rolls

export const SPIRIT_ROOT_TIERS: readonly SpiritRootTier[] = [
  'none', 'mottled', 'single_element', 'dual_element', 'heavenly',
] as const;

export type HeavenlyRootKind = 'frostfire' | 'severed_dao' | 'hollow';
export const HEAVENLY_ROOT_KINDS: readonly HeavenlyRootKind[] = [
  'frostfire', 'severed_dao', 'hollow',
] as const;

/** 12 canonical meridians, numbered 1..12 (see Types.ts meridian table). */
export type MeridianId =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const MERIDIAN_IDS: readonly MeridianId[] =
  [1,2,3,4,5,6,7,8,9,10,11,12] as const;

export type CorePathId =
  | 'iron_mountain'    // Stomach + Lung + Bladder
  | 'severing_edge'    // Heart + Small Intestine + Liver
  | 'still_water'      // Kidney + Bladder + Spleen
  | 'howling_storm'    // Gallbladder + Lung + Heart
  | 'blood_ember'      // Heart + Pericardium + Triple Burner
  | 'root_and_bough'   // Liver + Gallbladder + Spleen
  | 'thousand_mirrors' // Liver + Spleen + Kidney
  | 'hollow_vessel'    // any 3 of same element
  | 'shattered_path';  // 3 distinct elements, no named match

export const CORE_PATH_IDS: readonly CorePathId[] = [
  'iron_mountain', 'severing_edge', 'still_water', 'howling_storm',
  'blood_ember', 'root_and_bough', 'thousand_mirrors', 'hollow_vessel',
  'shattered_path',
] as const;

/** Qi-deviation severity tiers. 'shatter' is always fatal. */
export type DeviationSeverity = 'tremor' | 'scar' | 'cripple' | 'rend' | 'shatter';
export const DEVIATION_SEVERITIES: readonly DeviationSeverity[] = [
  'tremor', 'scar', 'cripple', 'rend', 'shatter',
] as const;
