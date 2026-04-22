// Turn-advancement helpers. Rolls a day count per TimeCost bucket and advances character age.
// Source: docs/spec/design.md §2.5.

import { TIME_COST_DAYS, TimeCost } from '@/engine/core/Types';
import { IRng } from '@/engine/core/RNG';
import { ageDays } from '@/engine/character/Character';
import { RunState } from './RunState';

export function rollTimeCostDays(bucket: TimeCost, rng: IRng): number {
  const [min, max] = TIME_COST_DAYS[bucket];
  if (min === max) return min;
  return rng.intRange(min, max);
}

export function advanceTurn(rs: RunState, bucket: TimeCost, rng: IRng): RunState {
  const days = rollTimeCostDays(bucket, rng);
  const character = days > 0 ? ageDays(rs.character, days) : rs.character;
  return {
    ...rs,
    character,
    turn: rs.turn + 1,
  };
}
