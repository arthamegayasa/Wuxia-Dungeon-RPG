// Bardo phase logic: finish a life, compute karma, commit to MetaState.
// Source: docs/spec/design.md §2.4, §7.1, §7.7, §11.6.

import { DeathCause } from '@/engine/core/Types';
import { RunState } from '@/engine/events/RunState';
import {
  MetaState, addKarma, incrementLifeCount, appendLineageEntry, LineageEntrySummary,
} from '@/engine/meta/MetaState';
import { computeKarma, LifeSummary } from '@/engine/meta/KarmicInsightRules';
import { EchoRegistry } from '@/engine/meta/EchoRegistry';
import { evaluateUnlocks, UnlockContext } from '@/engine/meta/EchoUnlocker';
import { commitWitnesses } from '@/engine/meta/MemoryWitnessLogger';
import { evaluateAnchorUnlocks } from '@/engine/meta/AnchorUnlockEvaluator';

export interface BardoResult {
  summary: LifeSummary;
  karmaEarned: number;
  karmaBreakdown: ReturnType<typeof computeKarma>['breakdown'];
  meta: MetaState;
  /** Phase 2A-3 Task 7: anchor ids freshly added by `evaluateAnchorUnlocks`. UI uses this for shimmer. */
  freshlyUnlockedAnchors: ReadonlyArray<string>;
}

export function buildLifeSummary(rs: RunState, anchorMultiplier: number): LifeSummary {
  if (!rs.deathCause) {
    throw new Error('buildLifeSummary: no death cause — character is still alive');
  }
  return {
    yearsLived: Math.floor(rs.character.ageDays / 365),
    realmReached: rs.character.realm,
    maxBodyTemperingLayer: rs.character.bodyTemperingLayer,
    maxRealm: rs.character.realm,
    deathCause: rs.deathCause as DeathCause,
    vowsUnfulfilled: 0,              // Phase 2+ vow system
    diedProtectingOther: rs.character.flags.includes('died_protecting'),
    firstTimeFlags: rs.character.flags.filter((f) => f.startsWith('first_')),
    anchorMultiplier,
    inLifeKarmaDelta: rs.karmaEarnedBuffer,
  };
}

export function runBardoFlow(
  rs: RunState,
  meta: MetaState,
  anchorMultiplier: number,
  echoRegistry: EchoRegistry,
): BardoResult {
  if (!rs.deathCause) {
    throw new Error('runBardoFlow: no death cause — cannot enter bardo');
  }
  const summary = buildLifeSummary(rs, anchorMultiplier);
  const karma = computeKarma(summary);

  // Commit witnessed memories first so any unlock condition that reads
  // meta.memoriesWitnessed observes the just-committed count.
  let nextMeta = commitWitnesses(meta, rs.memoriesWitnessedThisLife);

  // Evaluate echo unlocks using the just-updated meta.
  const anchorThisLife =
    rs.character.flags.find((f) => f.startsWith('anchor:'))?.slice(7) ?? 'unknown';
  const ctx: UnlockContext = {
    meta: nextMeta,
    finalRealm: summary.realmReached,
    finalBodyTemperingLayer: summary.maxBodyTemperingLayer,
    diedOfOldAge: summary.deathCause === 'old_age',
    yearsLived: summary.yearsLived,
    diedThisLifeFlags: rs.character.flags,
    anchorThisLife,
    echoProgressCumulative: nextMeta.echoProgress,
    dominantRegionThisLife: rs.region,
    regionStreakByRegion: computeRegionStreak(nextMeta, rs.region),
  };
  const newlyUnlocked = evaluateUnlocks(echoRegistry, ctx);
  if (newlyUnlocked.length > 0) {
    nextMeta = {
      ...nextMeta,
      echoesUnlocked: [...nextMeta.echoesUnlocked, ...newlyUnlocked],
    };
  }

  const newlyUnlockedAnchors = evaluateAnchorUnlocks({
    meta: nextMeta,
    summary,
    diedThisLifeFlags: rs.character.flags,
  });
  if (newlyUnlockedAnchors.length > 0) {
    nextMeta = {
      ...nextMeta,
      unlockedAnchors: [...nextMeta.unlockedAnchors, ...newlyUnlockedAnchors],
    };
  }

  const entry: LineageEntrySummary = {
    lifeIndex: nextMeta.lifeCount + 1,
    name: rs.character.name,
    anchorId: anchorThisLife,
    birthYear: rs.birthYear,
    deathYear: rs.birthYear + summary.yearsLived,
    yearsLived: summary.yearsLived,
    realmReached: summary.realmReached,
    deathCause: summary.deathCause,
    karmaEarned: karma.total,
    echoesUnlockedThisLife: [...newlyUnlocked],
    corePath: rs.character.corePath ?? null,
    techniquesLearned: [...rs.learnedTechniques],
  };

  nextMeta = addKarma(nextMeta, karma.total);
  nextMeta = incrementLifeCount(nextMeta);
  nextMeta = appendLineageEntry(nextMeta, entry);

  return {
    summary,
    karmaEarned: karma.total,
    karmaBreakdown: karma.breakdown,
    meta: nextMeta,
    freshlyUnlockedAnchors: newlyUnlockedAnchors,
  };
}

/**
 * Counts consecutive trailing lives that died in `region`.
 *
 * Phase 2A-2 stub: LineageEntrySummary does not yet store the region of death,
 * so this returns { [region]: 1 } for the current life only. Consequence:
 * `died_in_same_region_streak` echoes (e.g. ghost_in_mirror with streak 3)
 * will NOT unlock via this path. Phase 3 (Imprints) will extend
 * LineageEntrySummary with `regionOfDeath` and walk backward from the tail.
 */
function computeRegionStreak(_meta: MetaState, region: string): Readonly<Record<string, number>> {
  return { [region]: 1 };
}
