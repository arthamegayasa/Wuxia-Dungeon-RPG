// Bardo phase logic: finish a life, compute karma, commit to MetaState.
// Source: docs/spec/design.md §2.4, §7.1, §7.7, §11.6.

import { DeathCause } from '@/engine/core/Types';
import { RunState } from '@/engine/events/RunState';
import {
  MetaState, addKarma, incrementLifeCount, appendLineageEntry, LineageEntrySummary,
} from '@/engine/meta/MetaState';
import { computeKarma, LifeSummary } from '@/engine/meta/KarmicInsightRules';

export interface BardoResult {
  summary: LifeSummary;
  karmaEarned: number;
  karmaBreakdown: ReturnType<typeof computeKarma>['breakdown'];
  meta: MetaState;
}

export function buildLifeSummary(rs: RunState, anchorMultiplier: number): LifeSummary {
  if (!rs.deathCause) {
    throw new Error('buildLifeSummary: no death cause — character is still alive');
  }
  return {
    yearsLived: Math.floor(rs.character.ageDays / 365),
    realmReached: rs.character.realm,
    maxBodyTemperingLayer: rs.character.bodyTemperingLayer,
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
): BardoResult {
  if (!rs.deathCause) {
    throw new Error('runBardoFlow: no death cause — cannot enter bardo');
  }
  const summary = buildLifeSummary(rs, anchorMultiplier);
  const karma = computeKarma(summary);

  const entry: LineageEntrySummary = {
    lifeIndex: meta.lifeCount + 1,
    name: rs.character.name,
    anchorId: (rs.character.flags.find((f) => f.startsWith('anchor:'))?.slice(7)) ?? 'unknown',
    yearsLived: summary.yearsLived,
    realmReached: summary.realmReached,
    deathCause: summary.deathCause,
    karmaEarned: karma.total,
    echoesUnlockedThisLife: [],  // EchoUnlocker (Task 5) fills this; BardoFlow updated in Task 14
  };

  let nextMeta = meta;
  nextMeta = addKarma(nextMeta, karma.total);
  nextMeta = incrementLifeCount(nextMeta);
  nextMeta = appendLineageEntry(nextMeta, entry);

  return {
    summary,
    karmaEarned: karma.total,
    karmaBreakdown: karma.breakdown,
    meta: nextMeta,
  };
}
