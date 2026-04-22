// Core Path detection from the first 3 opened meridians.
// Source: docs/spec/design.md §4.4.

import { CorePathId, MeridianId } from '@/engine/core/Types';
import { meridianDef } from './MeridianDefs';

/** Named path definitions — unordered meridian-id sets. */
const NAMED_PATHS: ReadonlyArray<{ id: CorePathId; set: ReadonlySet<MeridianId> }> = [
  { id: 'iron_mountain',    set: new Set<MeridianId>([3, 1, 7]) },
  { id: 'severing_edge',    set: new Set<MeridianId>([5, 6, 12]) },
  { id: 'still_water',      set: new Set<MeridianId>([8, 7, 4]) },
  { id: 'howling_storm',    set: new Set<MeridianId>([11, 1, 5]) },
  { id: 'blood_ember',      set: new Set<MeridianId>([5, 9, 10]) },
  { id: 'root_and_bough',   set: new Set<MeridianId>([12, 11, 4]) },
  { id: 'thousand_mirrors', set: new Set<MeridianId>([12, 4, 8]) },
];

function setsEqual(a: ReadonlySet<MeridianId>, b: ReadonlySet<MeridianId>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/**
 * Detects the Core Path from the opening order of meridians.
 * Only the first 3 entries are considered. Returns null if fewer than 3.
 */
export function detectCorePath(openingOrder: ReadonlyArray<MeridianId>): CorePathId | null {
  if (openingOrder.length < 3) return null;
  const firstThree = new Set<MeridianId>(openingOrder.slice(0, 3));

  // 1. Named paths take precedence.
  for (const p of NAMED_PATHS) {
    if (setsEqual(firstThree, p.set)) return p.id;
  }

  // 2. Hollow Vessel — all three share the same element.
  const elements = [...firstThree].map((id) => meridianDef(id).element);
  const uniqueElements = new Set(elements);
  if (uniqueElements.size === 1) return 'hollow_vessel';

  // 3. Shattered Path — three distinct elements.
  if (uniqueElements.size === 3) return 'shattered_path';

  // 4. No match (two share an element + one odd).
  return null;
}
