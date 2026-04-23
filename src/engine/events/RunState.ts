// Per-life run state record. Immutable: mutations return new records.
// See docs/spec/design.md §2.6.

import { Season } from '@/engine/core/Types';
import { Character } from '@/engine/character/Character';
import { RngState } from '@/engine/core/RNG';

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
  readonly season: Season;
  readonly heavenlyNotice: number;
  /** Buffered karma earned this life; committed at Bardo (Phase 1D). */
  readonly karmaEarnedBuffer: number;
  /** Cause of death when set; triggers Bardo transition. */
  readonly deathCause: string | null;
  /** ID of the event the bridge has selected and composed but not yet resolved.
   *  Cleared by resolveChoice. Phase 1D-3 addition. */
  readonly pendingEventId?: string;
}

export interface CreateRunStateArgs {
  character: Character;
  runSeed: number;
  region: string;
  year: number;
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
    season: args.season,
    heavenlyNotice: 0,
    karmaEarnedBuffer: 0,
    deathCause: null,
  };
}
