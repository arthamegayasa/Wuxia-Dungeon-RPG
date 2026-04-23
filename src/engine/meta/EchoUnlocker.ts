// Evaluate locked-echo unlock conditions at end of life. Pure function.
// Source: docs/spec/design.md §7.2.

import { EchoRegistry } from './EchoRegistry';
import { UnlockCondition } from './SoulEcho';
import { MetaState } from './MetaState';

export interface UnlockContext {
  readonly meta: MetaState;
  readonly finalRealm: string;
  readonly finalBodyTemperingLayer: number;
  readonly diedOfOldAge: boolean;
  readonly yearsLived: number;
  readonly diedThisLifeFlags: ReadonlyArray<string>;
  readonly anchorThisLife: string;
  readonly echoProgressCumulative: Readonly<Record<string, number>>;
  readonly dominantRegionThisLife: string;
  readonly regionStreakByRegion: Readonly<Record<string, number>>;
}

function conditionMet(cond: UnlockCondition, ctx: UnlockContext): boolean {
  switch (cond.kind) {
    case 'reach_realm': {
      if (cond.realm === 'body_tempering' && cond.sublayer !== undefined) {
        return ctx.finalBodyTemperingLayer >= cond.sublayer;
      }
      return ctx.finalRealm === cond.realm;
    }
    case 'choice_category_count':
      return (ctx.echoProgressCumulative[`choice_cat.${cond.category}`] ?? 0) >= cond.count;
    case 'outcome_count':
      return (ctx.echoProgressCumulative[`outcome.${cond.outcomeKind}`] ?? 0) >= cond.count;
    case 'lives_as_anchor_max_age': {
      const maxAgeByAnchor = ctx.meta.lineage.filter(
        (entry) => entry.anchorId === cond.anchor && entry.deathCause === 'old_age',
      );
      return maxAgeByAnchor.length >= cond.lives;
    }
    case 'died_with_flag':
      return ctx.diedThisLifeFlags.includes(cond.flag);
    case 'flag_set':
      return ctx.diedThisLifeFlags.includes(cond.flag);
    case 'died_in_same_region_streak':
      return (ctx.regionStreakByRegion[cond.region] ?? 0) >= cond.streak;
    case 'reached_insight_cap_lives':
      return (ctx.echoProgressCumulative['reached_insight_cap'] ?? 0) >= cond.lives;
    case 'lived_min_years_in_single_life':
      return ctx.yearsLived >= cond.years;
    case 'reached_realm_without_techniques':
      return (
        ctx.finalRealm === cond.realm &&
        (ctx.echoProgressCumulative['this_life_techniques_learned'] ?? 0) === 0
      );
  }
}

export function evaluateUnlocks(registry: EchoRegistry, ctx: UnlockContext): ReadonlyArray<string> {
  const already = new Set(ctx.meta.echoesUnlocked);
  const newly: string[] = [];
  for (const echo of registry.all()) {
    if (already.has(echo.id)) continue;
    if (conditionMet(echo.unlockCondition, ctx)) {
      newly.push(echo.id);
    }
  }
  return newly;
}
