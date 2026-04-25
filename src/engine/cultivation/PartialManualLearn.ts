// Partial-manual deviation-risk formula + tier resolver.
// Source: docs/superpowers/specs/2026-04-25-phase-2b-...md §3.2.

import { IRng } from '@/engine/core/RNG';
import { Realm, REALM_ORDER } from '@/engine/core/Types';

export type PartialManualFailureSeverity = 'tremor' | 'scar' | 'cripple';

export interface PartialManualRiskArgs {
  readonly baseRisk: number;
  readonly completeness: 0.25 | 0.5 | 0.75 | 1.0;
  readonly mind: number;
  readonly insight: number;
  readonly realm: Realm;
  readonly minRealm?: Realm;
}

/**
 * Deviation-risk % = baseRisk × (1 - completeness)²
 *                   − Mind × 0.3
 *                   − Insight × 0.05
 *                   + (realm < minRealm ? 40 : 0)
 * Clamped to [0, 95].
 */
export function computePartialManualRisk(a: PartialManualRiskArgs): number {
  const gap = 1 - a.completeness;
  const base = a.baseRisk * gap * gap;
  const mindRelief = a.mind * 0.3;
  const insightRelief = a.insight * 0.05;
  const realmPenalty = a.minRealm && realmRank(a.realm) < realmRank(a.minRealm) ? 40 : 0;
  const raw = base - mindRelief - insightRelief + realmPenalty;
  return Math.min(95, Math.max(0, Math.round(raw * 100) / 100));
}

function realmRank(r: Realm): number {
  return REALM_ORDER.indexOf(r);
}

export interface PartialManualLearnArgs {
  readonly risk: number;
  readonly rng: IRng;
}

export interface PartialManualLearnResult {
  readonly success: boolean;
  readonly severity: PartialManualFailureSeverity | null;
  readonly roll: number;
}

/**
 * Roll d100 vs risk:
 *   roll > risk → success
 *   roll ≤ risk → failure with severity by roll band:
 *     1..50 → tremor
 *     51..80 → scar
 *     81..95 → cripple
 */
export function resolvePartialManualLearn(
  args: PartialManualLearnArgs,
): PartialManualLearnResult {
  const roll = args.rng.d100();
  if (roll > args.risk) {
    return { success: true, severity: null, roll };
  }
  let severity: PartialManualFailureSeverity;
  if (roll <= 50)      severity = 'tremor';
  else if (roll <= 80) severity = 'scar';
  else                 severity = 'cripple';
  return { success: false, severity, roll };
}
