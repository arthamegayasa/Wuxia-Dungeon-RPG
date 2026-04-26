// Per-life run state record. Immutable: mutations return new records.
// See docs/spec/design.md §2.6.

import { Season } from '@/engine/core/Types';
import { Character } from '@/engine/character/Character';
import { RngState } from '@/engine/core/RNG';

export interface PendingTribulationResult {
  readonly pillarId: 'tribulation_i';
  readonly phases: ReadonlyArray<{
    readonly phaseId: string;
    readonly success: boolean;
    readonly chance: number;
    readonly roll: number;
  }>;
  readonly fatal: boolean;
}

export interface RunState {
  readonly character: Character;
  readonly turn: number;
  readonly runSeed: number;
  readonly rngState: RngState;
  readonly worldFlags: ReadonlyArray<string>;
  readonly thisLifeSeenEvents: ReadonlyArray<string>;
  readonly learnedTechniques: ReadonlyArray<string>;  // technique IDs
  readonly inventory: ReadonlyArray<{ id: string; count: number }>;
  readonly region: string;
  readonly locale: string;
  readonly year: number;
  /** Phase 2A-3 Task 2: the year the character was born. Set once at
   *  characterFromAnchor; never advanced. Distinct from `year` which tracks
   *  the current calendar year as turns advance. Lineage card uses this. */
  readonly birthYear: number;
  readonly season: Season;
  readonly heavenlyNotice: number;
  /** Buffered karma earned this life; committed at Bardo (Phase 1D). */
  readonly karmaEarnedBuffer: number;
  /** Cause of death when set; triggers Bardo transition. */
  readonly deathCause: string | null;
  /** ID of the event the bridge has selected and composed but not yet resolved.
   *  Cleared by resolveChoice. Phase 1D-3 addition. */
  readonly pendingEventId?: string;
  /** Technique / memory IDs witnessed this life. Deduped by logWitness. Task 13 field. */
  readonly memoriesWitnessedThisLife: ReadonlyArray<string>;
  /** Memory IDs that have already manifested in this life. Task 11/13 field. */
  readonly memoriesManifestedThisLife: ReadonlyArray<string>;
  /** How many manifestation attempts have been made this life. Max 3. Task 11/13 field. */
  readonly manifestAttemptsThisLife: number;
  /** Phase 2B-3: Tribulation I result captured at qc9_to_foundation, consumed by UI. */
  readonly pendingTribulationResult?: PendingTribulationResult;
  /** Phase 2C: turns since the last `kind: 'decision'` event resolved. Drives
   *  the EventSelector pacing multiplier so beats and decisions interleave
   *  in roughly the 4-8-beat / decision rhythm of a chapter. Optional for
   *  backward compat with pre-2C RunState saves and test fixtures (consumers
   *  treat `undefined` as `0`). New runs initialize to `0`. */
  readonly turnsSinceLastDecision?: number;
}

export interface CreateRunStateArgs {
  character: Character;
  runSeed: number;
  region: string;
  year: number;
  birthYear: number;
  season: Season;
  locale?: string;
}

export function createRunState(args: CreateRunStateArgs): RunState {
  return {
    character: args.character,
    turn: 0,
    runSeed: args.runSeed,
    rngState: { seed: args.runSeed, cursor: args.runSeed },
    worldFlags: [],
    thisLifeSeenEvents: [],
    learnedTechniques: [],
    inventory: [],
    region: args.region,
    locale: args.locale ?? 'unnamed',
    year: args.year,
    birthYear: args.birthYear,
    season: args.season,
    heavenlyNotice: 0,
    karmaEarnedBuffer: 0,
    deathCause: null,
    memoriesWitnessedThisLife: [],
    memoriesManifestedThisLife: [],
    manifestAttemptsThisLife: 0,
    turnsSinceLastDecision: 0,
  };
}
