// Anchor unlock evaluator. Closes the Phase 2A-2 trade-off "Anchor unlock
// evaluator deferred". Called by runBardoFlow at end-of-life so that the
// player's `meta.unlockedAnchors` list grows when the criteria from
// `AnchorDef.unlock` are satisfied.
//
// Scope (Phase 2A-3):
//   - reach_body_tempering_5  → summary.maxBodyTemperingLayer >= 5
//   - read_ten_tomes_one_life → flag `read_ten_tomes_one_life` was set this life
//   - befriend_sect_disciple  → flag `befriend_sect_disciple` was set this life
//
// The two flag-gated unlocks are AUTHORED-FROM-CONTENT contracts: events that
// satisfy them set those flags via `flag_set` outcomes. Phase 2A-2 did not
// retrofit existing events to set these flags — that's content work for 2B.
// In practice, in 2A-3 only `reach_body_tempering_5` will fire from gameplay
// against the current Yellow Plains corpus; the others are exercised by tests
// only. This is the accepted limitation; do NOT add starting-flag gates here
// (e.g. `literate` from scholars_son anchor) because they would auto-unlock
// the anchor on the player's first scholars_son life.

import { MetaState } from './MetaState';
import { LifeSummary } from './KarmicInsightRules';

export interface AnchorUnlockContext {
  readonly meta: MetaState;
  readonly summary: LifeSummary;
  readonly diedThisLifeFlags: ReadonlyArray<string>;
}

interface UnlockRule {
  readonly anchorId: string;
  readonly check: (ctx: AnchorUnlockContext) => boolean;
}

const RULES: ReadonlyArray<UnlockRule> = [
  {
    anchorId: 'martial_family',
    check: (ctx) => ctx.summary.maxBodyTemperingLayer >= 5,
  },
  {
    anchorId: 'scholars_son',
    check: (ctx) => ctx.diedThisLifeFlags.includes('read_ten_tomes_one_life'),
  },
  {
    anchorId: 'outer_disciple',
    check: (ctx) => ctx.diedThisLifeFlags.includes('befriend_sect_disciple'),
  },
];

export function evaluateAnchorUnlocks(ctx: AnchorUnlockContext): ReadonlyArray<string> {
  const owned = new Set(ctx.meta.unlockedAnchors);
  const newly: string[] = [];
  for (const rule of RULES) {
    if (owned.has(rule.anchorId)) continue;
    if (rule.check(ctx)) newly.push(rule.anchorId);
  }
  return newly;
}
