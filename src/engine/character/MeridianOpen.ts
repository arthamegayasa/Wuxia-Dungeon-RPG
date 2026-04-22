// Meridian-opening attempt: rolls against effective deviation risk.
// Formula source: docs/spec/design.md §3.3.

import { MeridianId } from '@/engine/core/Types';
import { IRng } from '@/engine/core/RNG';
import { meridianDef } from './MeridianDefs';

export interface OpenAttemptArgs {
  meridianId: MeridianId;
  mind: number;                 // character Mind
  techniqueBonus: number;       // + amount subtracted from risk
  masterBonus: number;          // + amount subtracted from risk
  impatiencePenalty: number;    // + amount added to risk
  noticePenalty: number;        // + amount added to risk
  rng: IRng;
}

export interface OpenAttemptResult {
  success: boolean;
  /** The effective deviation-risk % used in the roll. */
  riskUsed: number;
  /** The raw d100 roll. */
  roll: number;
}

const MIN_RISK = 1;   // never a guaranteed success
const MAX_RISK = 95;  // never a guaranteed failure

export function rollMeridianOpen(args: OpenAttemptArgs): OpenAttemptResult {
  const def = meridianDef(args.meridianId);
  const raw =
    def.baseRisk
    - args.mind * 0.5
    - args.techniqueBonus
    - args.masterBonus
    + args.impatiencePenalty
    + args.noticePenalty;

  const riskUsed = Math.min(MAX_RISK, Math.max(MIN_RISK, Math.round(raw)));
  const roll = args.rng.d100();
  const success = roll > riskUsed;
  return { success, riskUsed, roll };
}
