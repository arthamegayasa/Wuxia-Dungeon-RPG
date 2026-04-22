// Pure predicate over a ConditionSet.
// Source: docs/spec/design.md §5.1, §9.2.
//
// NOTE (zod v4): minStat/maxStat records may contain `undefined` values for
// stat keys not specified in the original content file. We MUST skip those
// in the iteration — `stat < undefined` is silently false in JS, which would
// erroneously accept conditions that should be rejected.

import { Realm, Season } from '@/engine/core/Types';
import { Character } from '@/engine/character/Character';
import { ConditionSet } from '@/content/schema';

export interface EvalContext {
  character: Character;
  worldFlags: ReadonlyArray<string>;
  region: string;
  locale: string;
  year: number;
  season: Season;
  heavenlyNotice: number;
  ageYears: number;
}

function hasAll(list: ReadonlyArray<string> | undefined, have: ReadonlyArray<string>): boolean {
  if (!list || list.length === 0) return true;
  return list.every((f) => have.includes(f));
}

function hasAny(list: ReadonlyArray<string> | undefined, have: ReadonlyArray<string>): boolean {
  if (!list || list.length === 0) return false;
  return list.some((f) => have.includes(f));
}

export function evaluateConditions(cs: ConditionSet, ctx: EvalContext): boolean {
  // Phase 1B rejects any customPredicate outright (registry not implemented).
  if (cs.customPredicate !== undefined) return false;

  if (cs.minAge !== undefined && ctx.ageYears < cs.minAge) return false;
  if (cs.maxAge !== undefined && ctx.ageYears > cs.maxAge) return false;

  if (cs.regions && cs.regions.length > 0 && !cs.regions.includes(ctx.region)) return false;
  if (cs.locales && cs.locales.length > 0 && !cs.locales.includes(ctx.locale)) return false;

  if (cs.realms && cs.realms.length > 0) {
    // cs.realms uses the string form; Realm enum stores the same strings.
    if (!cs.realms.includes(ctx.character.realm as Realm)) return false;
  }

  if (cs.seasons && cs.seasons.length > 0 && !cs.seasons.includes(ctx.season)) return false;

  if (cs.worldFlags) {
    if (!hasAll(cs.worldFlags.require, ctx.worldFlags)) return false;
    if (hasAny(cs.worldFlags.exclude, ctx.worldFlags)) return false;
  }

  if (cs.characterFlags) {
    if (!hasAll(cs.characterFlags.require, ctx.character.flags)) return false;
    if (hasAny(cs.characterFlags.exclude, ctx.character.flags)) return false;
  }

  if (cs.minStat) {
    for (const [stat, minV] of Object.entries(cs.minStat)) {
      if (minV === undefined) continue; // zod v4 quirk — skip unspecified keys
      if ((ctx.character.attributes as Record<string, number>)[stat] < minV) return false;
    }
  }
  if (cs.maxStat) {
    for (const [stat, maxV] of Object.entries(cs.maxStat)) {
      if (maxV === undefined) continue; // zod v4 quirk — skip unspecified keys
      if ((ctx.character.attributes as Record<string, number>)[stat] > maxV) return false;
    }
  }

  if (cs.minNotice !== undefined && ctx.heavenlyNotice < cs.minNotice) return false;
  if (cs.maxNotice !== undefined && ctx.heavenlyNotice > cs.maxNotice) return false;

  if (cs.era) {
    if (cs.era.minYear !== undefined && ctx.year < cs.era.minYear) return false;
    if (cs.era.maxYear !== undefined && ctx.year > cs.era.maxYear) return false;
  }

  // Echo / Memory / Item requirements deferred to later phases; if set, treat as unmatched.
  if (cs.requiresEcho && cs.requiresEcho.length > 0) return false;
  if (cs.excludesEcho && cs.excludesEcho.length > 0) return true;
  if (cs.requiresMemory && cs.requiresMemory.length > 0) return false;
  if (cs.requiresItem && cs.requiresItem.length > 0) return false;

  return true;
}
