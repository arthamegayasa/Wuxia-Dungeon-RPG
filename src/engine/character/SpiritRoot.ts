// Spirit root rolling and tier multipliers.
// Source: docs/spec/design.md §3.2.

import { Element, HeavenlyRootKind, SpiritRootTier } from '@/engine/core/Types';
import { IRng } from '@/engine/core/RNG';

/** The five cultivation elements; excludes 'none'. */
export const ELEMENTS_ELEMENTAL: readonly Exclude<Element, 'none'>[] = [
  'metal', 'wood', 'water', 'fire', 'earth',
] as const;

export interface SpiritRoot {
  tier: SpiritRootTier;
  elements: ReadonlyArray<Exclude<Element, 'none'>>; // 0 for none/mottled, 1 single, 2 dual
  heavenlyKind?: HeavenlyRootKind;
}

/**
 * Roll a spirit root. Distribution on 1d10000:
 *   0–9499  (95%)    : none
 *   9500–9899 (4%)   : mottled
 *   9900–9989 (0.9%) : single_element
 *   9990–9998 (0.09%): dual_element
 *   9999     (0.01%) : heavenly
 */
export function rollSpiritRoot(rng: IRng): SpiritRoot {
  const roll = rng.intRange(0, 9999); // 1d10000 - 1

  if (roll <= 9499) {
    return { tier: 'none', elements: [] };
  }
  if (roll <= 9899) {
    return { tier: 'mottled', elements: [] };
  }
  if (roll <= 9989) {
    const el = rng.pick(ELEMENTS_ELEMENTAL);
    return { tier: 'single_element', elements: [el] };
  }
  if (roll <= 9998) {
    const first = rng.pick(ELEMENTS_ELEMENTAL);
    // Pick a distinct second element
    const remaining = ELEMENTS_ELEMENTAL.filter((e) => e !== first);
    const second = rng.pick(remaining);
    return { tier: 'dual_element', elements: [first, second] };
  }
  // 9999 -> heavenly
  const heavenlyKind: HeavenlyRootKind = rng.pick(['frostfire', 'severed_dao', 'hollow'] as const);
  return { tier: 'heavenly', elements: [], heavenlyKind };
}

export interface RootMultipliers {
  absorption: number;
  breakthrough: number;
}

/** Derive absorption and breakthrough multipliers from the root. */
export function spiritRootMultipliers(root: SpiritRoot): RootMultipliers {
  switch (root.tier) {
    case 'none':           return { absorption: 0,   breakthrough: 0   };
    case 'mottled':        return { absorption: 0.3, breakthrough: 0.5 };
    case 'single_element': return { absorption: 1.0, breakthrough: 1.0 };
    case 'dual_element':   return { absorption: 1.3, breakthrough: 1.1 };
    case 'heavenly':       return { absorption: 2.0, breakthrough: 1.3 };
  }
}
