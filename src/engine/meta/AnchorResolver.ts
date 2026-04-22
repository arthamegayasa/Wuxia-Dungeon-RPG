// Resolve an AnchorDef into concrete spawn values via seeded RNG.
// Source: docs/spec/design.md §7.4.

import { Stat, STATS } from '@/engine/core/Types';
import { IRng } from '@/engine/core/RNG';
import { AnchorDef } from './Anchor';

export interface ResolvedAnchor {
  anchorId: string;
  region: string;
  year: number;
  ageDays: number;
  /** Per-stat additive adjustment to add to a base-10 baseline. */
  attributeAdjustments: Record<Stat, number>;
  startingFlags: ReadonlyArray<string>;
  startingItems: ReadonlyArray<{ id: string; count: number }>;
  karmaMultiplier: number;
}

export function resolveAnchor(anchor: AnchorDef, rng: IRng): ResolvedAnchor {
  const region = rng.weightedPick(anchor.spawn.regions, (r) => r.weight).id;
  const year = rng.intRange(anchor.spawn.era.minYear, anchor.spawn.era.maxYear);
  const ageYears = rng.intRange(anchor.spawn.age.min, anchor.spawn.age.max);
  const ageDays = ageYears * 365;

  const adjustments = {} as Record<Stat, number>;
  for (const s of STATS) {
    const range = (anchor.spawn.attributeModifiers as Record<string, [number, number] | undefined>)[s];
    if (range && range[0] !== undefined && range[1] !== undefined) {
      adjustments[s] = rng.intRange(range[0], range[1]);
    } else {
      adjustments[s] = 0;
    }
  }

  return {
    anchorId: anchor.id,
    region,
    year,
    ageDays,
    attributeAdjustments: adjustments,
    startingFlags: [...anchor.spawn.startingFlags],
    startingItems: anchor.spawn.startingItems.map((i) => ({ id: i.id, count: i.count })),
    karmaMultiplier: anchor.karmaMultiplier,
  };
}
