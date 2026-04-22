// Qi-deviation severity roll.
// Source: docs/spec/design.md §4.6.

import { DeviationSeverity } from '@/engine/core/Types';
import { IRng } from '@/engine/core/RNG';

export const DEVIATION_WEIGHTS: Readonly<Record<DeviationSeverity, number>> = {
  tremor:  50,
  scar:    25,
  cripple: 15,
  rend:     8,
  shatter:  2,
};

const SEVERITY_LIST: ReadonlyArray<{ v: DeviationSeverity; w: number }> = [
  { v: 'tremor',  w: DEVIATION_WEIGHTS.tremor },
  { v: 'scar',    w: DEVIATION_WEIGHTS.scar },
  { v: 'cripple', w: DEVIATION_WEIGHTS.cripple },
  { v: 'rend',    w: DEVIATION_WEIGHTS.rend },
  { v: 'shatter', w: DEVIATION_WEIGHTS.shatter },
];

export function rollDeviationSeverity(rng: IRng): DeviationSeverity {
  return rng.weightedPick(SEVERITY_LIST, (x) => x.w).v;
}
