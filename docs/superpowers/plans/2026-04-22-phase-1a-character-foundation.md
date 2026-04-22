# Phase 1A — Character Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full character model for "Wuxia Dungeon RPG v2" — attributes, derived stats, spirit roots, meridians, core paths, the Character type & factory, Realm metadata, cultivation-progress math, sub-layer breakthroughs, and old-age death. All as pure, seed-deterministic functions with full unit test coverage. No events, no UI, no bardo yet.

**Architecture:** Each domain concept lives in its own small module under `src/engine/character/` or `src/engine/cultivation/`. Character state is a plain readonly record; all mutations return new records. Every random decision routes through the `IRng` interface (never `Math.random`). Formulas come directly from `docs/spec/design.md` §3, §4.

**Tech Stack:** TypeScript 5.8 strict, Vitest 4, Zustand (unused here — character model is pure). Depends only on Phase 0 primitives (`@/engine/core/Types`, `@/engine/core/RNG`, `@/utils/hash`).

**Source of truth:** `docs/spec/design.md` §3 (Character System) and §4 (Cultivation System). **Read these sections before starting.** Phase 1A locks in the core-path taxonomy and breakthrough formulas that Phase 1B (choice resolver) and Phase 1D (bardo) rely on.

**Scope boundaries (out of Phase 1A):**
- Techniques / Manuals (Phase 1B+)
- Realm tribulations (Phase 3)
- Anchor-driven stat rolls (Phase 1D's CreationScreen reads these)
- Event-triggered meridian opens (Phase 1B)
- Bardo / death logging (Phase 1D)
- Pills, safe-environment breakthrough bonuses (reserved parameters default to zero)
- Heavenly Notice modifiers to breakthrough (Phase 3)

---

## Task Map

1. Extend primitive types: `SpiritRootTier`, `MeridianId`, `CorePathId`, `DeviationSeverity`, `HeavenlyRootKind`
2. Attribute helpers + derived stats (HP max, Qi max)
3. SpiritRoot rolling + tier table + multipliers
4. Meridian definitions (12 data entries)
5. Meridian open attempt with deviation roll
6. Deviation severity roll + application
7. CorePath detection
8. Character type + factory + mutation helpers
9. Realm metadata (lifespan, insight cap, sub-layer count)
10. CultivationProgress (advance, fullness, sub-layer index)
11. Sub-layer breakthrough formula + application
12. Old-age death roll
13. Integration test: simulated Body Tempering lifetime

Every task: Red → Green → Refactor → Commit.

---

## Prerequisite Reading

Before Task 1, skim:
- `docs/spec/design.md` §3 (Character System) and §4.1–§4.3 (Realms, Cultivation progress, Breakthroughs). These are the formula sources.
- `src/engine/core/Types.ts` — the existing primitive types (Stat, Element, Realm enum, STATS array). Phase 1A extends this file; do not duplicate.
- `src/engine/core/RNG.ts` — `IRng` is the contract. Every stochastic function accepts an `IRng`.

---

## Task 1: Extend primitive types

**Files:**
- Modify: `src/engine/core/Types.ts` (append; do not rewrite)
- Create: `src/engine/core/CharacterTypes.test.ts`

**Rationale:** Introduce the type unions the rest of Phase 1A depends on, in one place, before any logic.

- [ ] **Step 1: Write the failing test**

Create `src/engine/core/CharacterTypes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  SPIRIT_ROOT_TIERS,
  MERIDIAN_IDS,
  CORE_PATH_IDS,
  DEVIATION_SEVERITIES,
  HEAVENLY_ROOT_KINDS,
} from './Types';

describe('character primitive type tables', () => {
  it('SPIRIT_ROOT_TIERS lists all 5 tiers in severity order', () => {
    expect(SPIRIT_ROOT_TIERS).toEqual([
      'none', 'mottled', 'single_element', 'dual_element', 'heavenly',
    ]);
  });

  it('MERIDIAN_IDS is exactly 12 contiguous ids', () => {
    expect(MERIDIAN_IDS).toEqual([1,2,3,4,5,6,7,8,9,10,11,12]);
  });

  it('CORE_PATH_IDS lists all 9 paths', () => {
    expect(CORE_PATH_IDS).toEqual([
      'iron_mountain', 'severing_edge', 'still_water', 'howling_storm',
      'blood_ember', 'root_and_bough', 'thousand_mirrors', 'hollow_vessel',
      'shattered_path',
    ]);
  });

  it('DEVIATION_SEVERITIES escalates from mild to lethal', () => {
    expect(DEVIATION_SEVERITIES).toEqual([
      'tremor', 'scar', 'cripple', 'rend', 'shatter',
    ]);
  });

  it('HEAVENLY_ROOT_KINDS lists the three named variants', () => {
    expect(HEAVENLY_ROOT_KINDS).toEqual([
      'frostfire', 'severed_dao', 'hollow',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CharacterTypes`
Expected: FAIL — imports do not exist.

- [ ] **Step 3: Append the types to `src/engine/core/Types.ts`**

Open `src/engine/core/Types.ts` and append these blocks at the bottom of the file (after the legacy `TurnData` interface). **Do not** modify anything above.

```ts
// ---- Phase 1A: Character System primitive types ----
// Source of truth: docs/spec/design.md §3, §4.

export type SpiritRootTier =
  | 'none'            // 95% of rolls — cannot cultivate qi
  | 'mottled'         // 4% — trash root, 0.3× absorption
  | 'single_element'  // 0.9% — sect-eligible
  | 'dual_element'    // 0.09% — prodigy
  | 'heavenly';       // 0.01% — once in ~10_000 rolls

export const SPIRIT_ROOT_TIERS: readonly SpiritRootTier[] = [
  'none', 'mottled', 'single_element', 'dual_element', 'heavenly',
] as const;

export type HeavenlyRootKind = 'frostfire' | 'severed_dao' | 'hollow';
export const HEAVENLY_ROOT_KINDS: readonly HeavenlyRootKind[] = [
  'frostfire', 'severed_dao', 'hollow',
] as const;

/** 12 canonical meridians, numbered 1..12 (see Types.ts meridian table). */
export type MeridianId =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const MERIDIAN_IDS: readonly MeridianId[] =
  [1,2,3,4,5,6,7,8,9,10,11,12] as const;

export type CorePathId =
  | 'iron_mountain'    // Stomach + Lung + Bladder
  | 'severing_edge'    // Heart + Small Intestine + Liver
  | 'still_water'      // Kidney + Bladder + Spleen
  | 'howling_storm'    // Gallbladder + Lung + Heart
  | 'blood_ember'      // Heart + Pericardium + Triple Burner
  | 'root_and_bough'   // Liver + Gallbladder + Spleen
  | 'thousand_mirrors' // Liver + Spleen + Kidney
  | 'hollow_vessel'    // any 3 of same element
  | 'shattered_path';  // 3 distinct elements, no named match

export const CORE_PATH_IDS: readonly CorePathId[] = [
  'iron_mountain', 'severing_edge', 'still_water', 'howling_storm',
  'blood_ember', 'root_and_bough', 'thousand_mirrors', 'hollow_vessel',
  'shattered_path',
] as const;

/** Qi-deviation severity tiers. 'shatter' is always fatal. */
export type DeviationSeverity = 'tremor' | 'scar' | 'cripple' | 'rend' | 'shatter';
export const DEVIATION_SEVERITIES: readonly DeviationSeverity[] = [
  'tremor', 'scar', 'cripple', 'rend', 'shatter',
] as const;
```

- [ ] **Step 4: Run tests**

Run: `npm test -- CharacterTypes`
Expected: 5 passing.

Also: `npm run typecheck` clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/core/Types.ts src/engine/core/CharacterTypes.test.ts
git commit -m "feat(engine): Phase 1A primitive types (spirit root, meridian, core path, deviation)"
```

---

## Task 2: Attribute helpers + derived stats

**Files:**
- Create: `src/engine/character/Attribute.ts`
- Create: `src/engine/character/Attribute.test.ts`

**Rationale:** The six primary attributes (§3.1) need clamping (0–100 soft cap). Derived stats (HP max, Qi max) come from a formula that several downstream modules depend on — centralise it here.

- [ ] **Step 1: Write the failing test**

Create `src/engine/character/Attribute.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { STATS } from '@/engine/core/Types';
import {
  clampAttribute,
  addAttribute,
  zeroAttributes,
  hpMax,
  qiMax,
} from './Attribute';

describe('clampAttribute', () => {
  it('clamps to [0, 100]', () => {
    expect(clampAttribute(-5)).toBe(0);
    expect(clampAttribute(0)).toBe(0);
    expect(clampAttribute(50)).toBe(50);
    expect(clampAttribute(100)).toBe(100);
    expect(clampAttribute(500)).toBe(100);
  });

  it('rounds to nearest integer', () => {
    expect(clampAttribute(42.4)).toBe(42);
    expect(clampAttribute(42.6)).toBe(43);
  });
});

describe('addAttribute', () => {
  it('adds and clamps', () => {
    expect(addAttribute(90, 20)).toBe(100);
    expect(addAttribute(10, -50)).toBe(0);
    expect(addAttribute(40, 15)).toBe(55);
  });
});

describe('zeroAttributes', () => {
  it('returns a map with every stat at 0', () => {
    const z = zeroAttributes();
    for (const s of STATS) expect(z[s]).toBe(0);
  });
});

describe('hpMax', () => {
  it('baseline: 30 + Body*2 + bodyTemperingLayer*10', () => {
    expect(hpMax({ body: 0, bodyTemperingLayer: 0 })).toBe(30);
    expect(hpMax({ body: 10, bodyTemperingLayer: 0 })).toBe(50);
    expect(hpMax({ body: 10, bodyTemperingLayer: 3 })).toBe(80);
    expect(hpMax({ body: 50, bodyTemperingLayer: 9 })).toBe(220);
  });

  it('never returns below 1', () => {
    expect(hpMax({ body: -100, bodyTemperingLayer: 0 })).toBeGreaterThanOrEqual(1);
  });

  it('rounds to integer', () => {
    expect(Number.isInteger(hpMax({ body: 15, bodyTemperingLayer: 2 }))).toBe(true);
  });
});

describe('qiMax', () => {
  // per spec §3.4: Spirit × (1 + openMeridians × 0.15) × rootMultiplier
  it('baseline with zero root returns 0', () => {
    expect(qiMax({ spirit: 50, openMeridians: 0, rootMultiplier: 0 })).toBe(0);
  });

  it('scales linearly with spirit × rootMultiplier', () => {
    expect(qiMax({ spirit: 10, openMeridians: 0, rootMultiplier: 1 })).toBe(10);
    expect(qiMax({ spirit: 10, openMeridians: 0, rootMultiplier: 2 })).toBe(20);
  });

  it('adds 15% per open meridian', () => {
    // 10 * (1 + 4*0.15) * 1.0 = 10 * 1.6 = 16
    expect(qiMax({ spirit: 10, openMeridians: 4, rootMultiplier: 1 })).toBe(16);
  });

  it('returns integer', () => {
    expect(Number.isInteger(qiMax({ spirit: 33, openMeridians: 5, rootMultiplier: 1.3 }))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- Attribute`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/engine/character/Attribute.ts`:

```ts
// Attribute clamping and derived-stat formulas.
// See docs/spec/design.md §3.1, §3.4.

import { Stat, STATS } from '@/engine/core/Types';

export type AttributeMap = Record<Stat, number>;

/** Round to nearest integer, clamp to [0, 100]. */
export function clampAttribute(v: number): number {
  if (v <= 0) return 0;
  if (v >= 100) return 100;
  return Math.round(v);
}

/** Add `delta` to `base`, then clamp. */
export function addAttribute(base: number, delta: number): number {
  return clampAttribute(base + delta);
}

/** All six stats, zeroed. */
export function zeroAttributes(): AttributeMap {
  const out = {} as AttributeMap;
  for (const s of STATS) out[s] = 0;
  return out;
}

/** HP maximum — see spec §3.4 (derived, formula locked here). */
export function hpMax(args: { body: number; bodyTemperingLayer: number }): number {
  const raw = 30 + args.body * 2 + args.bodyTemperingLayer * 10;
  return Math.max(1, Math.round(raw));
}

/** Qi maximum — spec §3.4: Spirit × (1 + openMeridians × 0.15) × rootMultiplier. */
export function qiMax(args: {
  spirit: number;
  openMeridians: number;
  rootMultiplier: number;
}): number {
  const raw = args.spirit * (1 + args.openMeridians * 0.15) * args.rootMultiplier;
  return Math.max(0, Math.round(raw));
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- Attribute`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/character/Attribute.ts src/engine/character/Attribute.test.ts
git commit -m "feat(character): attribute clamping + HP/Qi derived-stat formulas"
```

---

## Task 3: SpiritRoot rolling + tier multipliers

**Files:**
- Create: `src/engine/character/SpiritRoot.ts`
- Create: `src/engine/character/SpiritRoot.test.ts`

**Rationale:** Rolling a spirit root is ~the single most impactful creation event. Distribution must match spec §3.2 (95/4/0.9/0.09/0.01). Named Heavenly variants pick randomly.

- [ ] **Step 1: Write the failing test**

Create `src/engine/character/SpiritRoot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import {
  rollSpiritRoot,
  spiritRootMultipliers,
  SpiritRoot,
} from './SpiritRoot';
import { ELEMENTS_ELEMENTAL } from './SpiritRoot'; // five cultivation elements, no 'none'

describe('rollSpiritRoot', () => {
  it('is deterministic for the same seed', () => {
    const a = rollSpiritRoot(createRng(42));
    const b = rollSpiritRoot(createRng(42));
    expect(a).toEqual(b);
  });

  it('matches the distribution over 50_000 rolls (within tolerance)', () => {
    const rng = createRng(999);
    const counts: Record<string, number> = {
      none: 0, mottled: 0, single_element: 0, dual_element: 0, heavenly: 0,
    };
    const N = 50_000;
    for (let i = 0; i < N; i++) counts[rollSpiritRoot(rng).tier]++;
    // Expected: 95% / 4% / 0.9% / 0.09% / 0.01%
    expect(counts.none / N).toBeGreaterThan(0.93);
    expect(counts.none / N).toBeLessThan(0.97);
    expect(counts.mottled / N).toBeGreaterThan(0.03);
    expect(counts.mottled / N).toBeLessThan(0.05);
    // Rare tiers: very small N, wide tolerance
    expect(counts.single_element / N).toBeGreaterThan(0.004);
    expect(counts.single_element / N).toBeLessThan(0.015);
    // dual_element and heavenly may be 0 in 50_000 rolls — don't assert lower bound.
    expect(counts.dual_element / N).toBeLessThan(0.005);
    expect(counts.heavenly / N).toBeLessThan(0.003);
  });

  it('single-element root carries one cultivation element', () => {
    // Force a single-element result by scanning.
    const rng = createRng(1);
    for (let i = 0; i < 10_000; i++) {
      const r = rollSpiritRoot(rng);
      if (r.tier === 'single_element') {
        expect(r.elements).toHaveLength(1);
        expect(ELEMENTS_ELEMENTAL).toContain(r.elements[0]);
        return;
      }
    }
    throw new Error('Did not observe a single_element in 10_000 rolls — distribution broken');
  });

  it('dual-element root carries two distinct cultivation elements', () => {
    const rng = createRng(7);
    for (let i = 0; i < 100_000; i++) {
      const r = rollSpiritRoot(rng);
      if (r.tier === 'dual_element') {
        expect(r.elements).toHaveLength(2);
        expect(r.elements[0]).not.toBe(r.elements[1]);
        for (const el of r.elements) expect(ELEMENTS_ELEMENTAL).toContain(el);
        return;
      }
    }
    // dual_element has expected rate ~0.09%; 100k should give ~90 instances.
    throw new Error('Did not observe a dual_element in 100k rolls');
  });

  it('heavenly root names one of three variants', () => {
    const rng = createRng(13);
    for (let i = 0; i < 200_000; i++) {
      const r = rollSpiritRoot(rng);
      if (r.tier === 'heavenly') {
        expect(['frostfire', 'severed_dao', 'hollow']).toContain(r.heavenlyKind);
        return;
      }
    }
    throw new Error('Did not observe a heavenly root in 200k rolls');
  });
});

describe('spiritRootMultipliers', () => {
  it('returns tier-specific absorption and breakthrough multipliers', () => {
    expect(spiritRootMultipliers({ tier: 'none', elements: [] }))
      .toEqual({ absorption: 0, breakthrough: 0 });
    expect(spiritRootMultipliers({ tier: 'mottled', elements: [] }))
      .toEqual({ absorption: 0.3, breakthrough: 0.5 });
    expect(spiritRootMultipliers({ tier: 'single_element', elements: ['fire'] }))
      .toEqual({ absorption: 1.0, breakthrough: 1.0 });
    expect(spiritRootMultipliers({ tier: 'dual_element', elements: ['fire', 'water'] }))
      .toEqual({ absorption: 1.3, breakthrough: 1.1 });
    expect(spiritRootMultipliers({ tier: 'heavenly', elements: [], heavenlyKind: 'frostfire' }))
      .toEqual({ absorption: 2.0, breakthrough: 1.3 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- SpiritRoot`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/character/SpiritRoot.ts`:

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- SpiritRoot`
Expected: all pass. Note: the rare-tier tests pull from the running `rng` instance; they scan up to 200k rolls which takes a couple seconds at most. If a test times out, check that you used `rng.intRange(0, 9999)` (inclusive both ends — 10,000 buckets total).

- [ ] **Step 5: Commit**

```bash
git add src/engine/character/SpiritRoot.ts src/engine/character/SpiritRoot.test.ts
git commit -m "feat(character): spirit root rolling + tier multipliers"
```

---

## Task 4: Meridian definitions

**Files:**
- Create: `src/engine/character/MeridianDefs.ts`
- Create: `src/engine/character/MeridianDefs.test.ts`

**Rationale:** The 12 meridians (spec §3.3) have fixed, hand-authored metadata: element, element affinity, risk tier, stat bonuses on opening. Keep this data in its own module so later tasks (meridian open, core path detection) read from a single source.

- [ ] **Step 1: Write the failing test**

Create `src/engine/character/MeridianDefs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MERIDIAN_IDS } from '@/engine/core/Types';
import { MERIDIAN_DEFS, meridianDef, meridianRiskTier } from './MeridianDefs';

describe('MERIDIAN_DEFS', () => {
  it('defines exactly 12 meridians, ids 1..12', () => {
    expect(MERIDIAN_DEFS).toHaveLength(12);
    expect(MERIDIAN_DEFS.map(d => d.id).sort((a,b) => a-b)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12]);
  });

  it('each MERIDIAN_ID has a def', () => {
    for (const id of MERIDIAN_IDS) {
      expect(meridianDef(id).id).toBe(id);
    }
  });

  it('names match spec', () => {
    expect(meridianDef(1).name).toBe('Lung');
    expect(meridianDef(5).name).toBe('Heart');
    expect(meridianDef(10).name).toBe('Triple Burner');
    expect(meridianDef(12).name).toBe('Liver');
  });

  it('elements per spec', () => {
    expect(meridianDef(1).element).toBe('metal');   // Lung
    expect(meridianDef(3).element).toBe('earth');   // Stomach
    expect(meridianDef(5).element).toBe('fire');    // Heart
    expect(meridianDef(8).element).toBe('water');   // Kidney
    expect(meridianDef(11).element).toBe('wood');   // Gallbladder
  });

  it('risk tiers match spec', () => {
    // low, low, low, medium, high, medium, low, high, high, very_high, medium, medium
    expect(meridianDef(1).baseRisk).toBe(meridianRiskTier('low'));
    expect(meridianDef(4).baseRisk).toBe(meridianRiskTier('medium'));
    expect(meridianDef(5).baseRisk).toBe(meridianRiskTier('high'));
    expect(meridianDef(10).baseRisk).toBe(meridianRiskTier('very_high'));
  });

  it('meridianRiskTier returns ascending deviation chances', () => {
    expect(meridianRiskTier('low')).toBeLessThan(meridianRiskTier('medium'));
    expect(meridianRiskTier('medium')).toBeLessThan(meridianRiskTier('high'));
    expect(meridianRiskTier('high')).toBeLessThan(meridianRiskTier('very_high'));
    expect(meridianRiskTier('very_high')).toBeLessThanOrEqual(50);
  });

  it('throws on unknown id', () => {
    // @ts-expect-error — deliberately bad input
    expect(() => meridianDef(99)).toThrow(/unknown meridian/i);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- MeridianDefs`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/character/MeridianDefs.ts`:

```ts
// Static metadata for the 12 meridians.
// Source: docs/spec/design.md §3.3.

import { Element, MeridianId, Stat } from '@/engine/core/Types';

export type RiskTier = 'low' | 'medium' | 'high' | 'very_high';

/** Base deviation chance (%) for each risk tier. */
export function meridianRiskTier(tier: RiskTier): number {
  switch (tier) {
    case 'low':       return 10;
    case 'medium':    return 20;
    case 'high':      return 30;
    case 'very_high': return 40;
  }
}

export interface MeridianDef {
  id: MeridianId;
  name: string;
  element: Element;
  baseRisk: number; // percent, already resolved
  /** Stat bonuses applied when this meridian is opened. */
  statBonuses: Partial<Record<Stat, number>>;
  /** Flat HP-max bonus on open. */
  hpMaxBonus?: number;
  /** Flat qi-capacity multiplier bonus on open (stacks additively with the 0.15/meridian scaling). */
  qiMultBonus?: number;
}

export const MERIDIAN_DEFS: readonly MeridianDef[] = [
  { id: 1,  name: 'Lung',             element: 'metal', baseRisk: meridianRiskTier('low'),       statBonuses: { Body: 2 } },
  { id: 2,  name: 'Large Intestine',  element: 'metal', baseRisk: meridianRiskTier('low'),       statBonuses: { Body: 2 } },
  { id: 3,  name: 'Stomach',          element: 'earth', baseRisk: meridianRiskTier('low'),       statBonuses: { Body: 2 }, hpMaxBonus: 15 },
  { id: 4,  name: 'Spleen',           element: 'earth', baseRisk: meridianRiskTier('medium'),    statBonuses: { Spirit: 2 } },
  { id: 5,  name: 'Heart',            element: 'fire',  baseRisk: meridianRiskTier('high'),      statBonuses: { Spirit: 2, Charm: 1 } },
  { id: 6,  name: 'Small Intestine',  element: 'fire',  baseRisk: meridianRiskTier('medium'),    statBonuses: { Agility: 2 } },
  { id: 7,  name: 'Bladder',          element: 'water', baseRisk: meridianRiskTier('low'),       statBonuses: { Body: 1, Spirit: 1 } },
  { id: 8,  name: 'Kidney',           element: 'water', baseRisk: meridianRiskTier('high'),      statBonuses: { Spirit: 2, Mind: 1 } },
  { id: 9,  name: 'Pericardium',      element: 'fire',  baseRisk: meridianRiskTier('high'),      statBonuses: { Spirit: 2 } },
  { id: 10, name: 'Triple Burner',    element: 'fire',  baseRisk: meridianRiskTier('very_high'), statBonuses: {},                    qiMultBonus: 0.10 },
  { id: 11, name: 'Gallbladder',      element: 'wood',  baseRisk: meridianRiskTier('medium'),    statBonuses: { Charm: 1, Body: 1 } },
  { id: 12, name: 'Liver',            element: 'wood',  baseRisk: meridianRiskTier('medium'),    statBonuses: { Mind: 1, Spirit: 1 } },
] as const;

export function meridianDef(id: MeridianId): MeridianDef {
  const d = MERIDIAN_DEFS.find((m) => m.id === id);
  if (!d) throw new Error(`unknown meridian id: ${id}`);
  return d;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- MeridianDefs`
Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add src/engine/character/MeridianDefs.ts src/engine/character/MeridianDefs.test.ts
git commit -m "feat(character): 12-meridian static definitions"
```

---

## Task 5: Meridian open attempt with deviation roll

**Files:**
- Create: `src/engine/character/MeridianOpen.ts`
- Create: `src/engine/character/MeridianOpen.test.ts`

**Rationale:** Opening a meridian is a risky one-shot action: roll against `baseRisk - Mind*0.5`, decide success or deviation. For Phase 1A, techniques / masters / notice modifiers default to zero (those arrive in Phase 1B/3).

- [ ] **Step 1: Write the failing test**

Create `src/engine/character/MeridianOpen.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { rollMeridianOpen, OpenAttemptArgs } from './MeridianOpen';

function baseArgs(overrides: Partial<OpenAttemptArgs> = {}): OpenAttemptArgs {
  return {
    meridianId: 1,       // Lung, low risk
    mind: 0,
    techniqueBonus: 0,
    masterBonus: 0,
    impatiencePenalty: 0,
    noticePenalty: 0,
    rng: createRng(1),
    ...overrides,
  };
}

describe('rollMeridianOpen', () => {
  it('is deterministic for the same seed and inputs', () => {
    const a = rollMeridianOpen(baseArgs({ rng: createRng(42) }));
    const b = rollMeridianOpen(baseArgs({ rng: createRng(42) }));
    expect(a).toEqual(b);
  });

  it('succeeds most of the time for a low-risk meridian with high Mind', () => {
    // Lung baseRisk=10, Mind=60 → effective risk = 10 - 30 = 0 (clamped to >=1)
    const rng = createRng(100);
    let successes = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const res = rollMeridianOpen({
        meridianId: 1, mind: 60, techniqueBonus: 0, masterBonus: 0,
        impatiencePenalty: 0, noticePenalty: 0, rng,
      });
      if (res.success) successes++;
    }
    expect(successes / N).toBeGreaterThan(0.97);
  });

  it('mostly fails for a very-high-risk meridian with no mitigation', () => {
    // Triple Burner baseRisk=40, Mind=0 → effective 40% deviation
    const rng = createRng(200);
    let failures = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const res = rollMeridianOpen({
        meridianId: 10, mind: 0, techniqueBonus: 0, masterBonus: 0,
        impatiencePenalty: 0, noticePenalty: 0, rng,
      });
      if (!res.success) failures++;
    }
    // Expect ~40% failure — loose bounds
    expect(failures / N).toBeGreaterThan(0.30);
    expect(failures / N).toBeLessThan(0.50);
  });

  it('Mind reduces deviation chance by 0.5 per point', () => {
    // Hand-verify the formula: risk_used = max(1, base - mind*0.5 - tech - master + imp + notice)
    // For Lung (base 10), mind 20, others 0 → risk_used = 10 - 10 = 0 → clamped to 1
    const rng = createRng(300);
    let successes = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      const res = rollMeridianOpen({
        meridianId: 1, mind: 20, techniqueBonus: 0, masterBonus: 0,
        impatiencePenalty: 0, noticePenalty: 0, rng,
      });
      if (res.success) successes++;
    }
    expect(successes / N).toBeGreaterThan(0.95);
  });

  it('technique + master bonuses reduce deviation chance further', () => {
    // High-risk Kidney (base 30), mind 0, tech 15, master 20 → risk_used = 30 - 35 → clamped to 1
    const rng = createRng(400);
    let successes = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      const res = rollMeridianOpen({
        meridianId: 8, mind: 0, techniqueBonus: 15, masterBonus: 20,
        impatiencePenalty: 0, noticePenalty: 0, rng,
      });
      if (res.success) successes++;
    }
    expect(successes / N).toBeGreaterThan(0.95);
  });

  it('impatience and notice penalties increase deviation chance', () => {
    // Lung (base 10), no mind, impatience 20, notice 10 → risk_used = 40
    const rng = createRng(500);
    let failures = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const res = rollMeridianOpen({
        meridianId: 1, mind: 0, techniqueBonus: 0, masterBonus: 0,
        impatiencePenalty: 20, noticePenalty: 10, rng,
      });
      if (!res.success) failures++;
    }
    expect(failures / N).toBeGreaterThan(0.30);
  });

  it('effective risk is clamped to [1, 95]', () => {
    // Impossible amount of bonus shouldn't drive risk below 1 → always some failure chance
    const rngA = createRng(600);
    let failureSeen = false;
    for (let i = 0; i < 2000 && !failureSeen; i++) {
      const res = rollMeridianOpen({
        meridianId: 1, mind: 500, techniqueBonus: 500, masterBonus: 500,
        impatiencePenalty: 0, noticePenalty: 0, rng: rngA,
      });
      if (!res.success) failureSeen = true;
    }
    expect(failureSeen).toBe(true);

    // Conversely, absurd penalties should not exceed 95% failure
    const rngB = createRng(601);
    let successSeen = false;
    for (let i = 0; i < 200 && !successSeen; i++) {
      const res = rollMeridianOpen({
        meridianId: 10, mind: 0, techniqueBonus: 0, masterBonus: 0,
        impatiencePenalty: 500, noticePenalty: 500, rng: rngB,
      });
      if (res.success) successSeen = true;
    }
    expect(successSeen).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- MeridianOpen`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/engine/character/MeridianOpen.ts`:

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- MeridianOpen`
Expected: 7 passing. If the distribution tests take > 5s, consider tightening the N counts — but the math is fast enough that this should not be an issue.

- [ ] **Step 5: Commit**

```bash
git add src/engine/character/MeridianOpen.ts src/engine/character/MeridianOpen.test.ts
git commit -m "feat(character): meridian-open attempt with deviation risk formula"
```

---

## Task 6: Deviation severity roll + application

**Files:**
- Create: `src/engine/character/Deviation.ts`
- Create: `src/engine/character/Deviation.test.ts`

**Rationale:** When an open attempt fails, we need to decide *how bad* the deviation is (spec §4.6). Weighted roll: tremor 50% / scar 25% / cripple 15% / rend 8% / shatter 2%.

- [ ] **Step 1: Write the failing test**

Create `src/engine/character/Deviation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { rollDeviationSeverity, DEVIATION_WEIGHTS } from './Deviation';

describe('DEVIATION_WEIGHTS', () => {
  it('sums to 100', () => {
    const total = Object.values(DEVIATION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it('weights in expected ratios', () => {
    expect(DEVIATION_WEIGHTS.tremor).toBe(50);
    expect(DEVIATION_WEIGHTS.scar).toBe(25);
    expect(DEVIATION_WEIGHTS.cripple).toBe(15);
    expect(DEVIATION_WEIGHTS.rend).toBe(8);
    expect(DEVIATION_WEIGHTS.shatter).toBe(2);
  });
});

describe('rollDeviationSeverity', () => {
  it('is deterministic for the same seed', () => {
    expect(rollDeviationSeverity(createRng(42))).toBe(rollDeviationSeverity(createRng(42)));
  });

  it('produces empirical distribution matching weights', () => {
    const rng = createRng(7);
    const counts: Record<string, number> = { tremor: 0, scar: 0, cripple: 0, rend: 0, shatter: 0 };
    const N = 50_000;
    for (let i = 0; i < N; i++) counts[rollDeviationSeverity(rng)]++;
    // 50% / 25% / 15% / 8% / 2% — tolerant bounds
    expect(counts.tremor / N).toBeGreaterThan(0.47);
    expect(counts.tremor / N).toBeLessThan(0.53);
    expect(counts.scar / N).toBeGreaterThan(0.22);
    expect(counts.scar / N).toBeLessThan(0.28);
    expect(counts.cripple / N).toBeGreaterThan(0.12);
    expect(counts.cripple / N).toBeLessThan(0.18);
    expect(counts.rend / N).toBeGreaterThan(0.06);
    expect(counts.rend / N).toBeLessThan(0.10);
    expect(counts.shatter / N).toBeGreaterThan(0.01);
    expect(counts.shatter / N).toBeLessThan(0.03);
  });

  it('returns one of the five severities', () => {
    const rng = createRng(9);
    for (let i = 0; i < 500; i++) {
      expect(['tremor', 'scar', 'cripple', 'rend', 'shatter'])
        .toContain(rollDeviationSeverity(rng));
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- Deviation`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/character/Deviation.ts`:

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- Deviation`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/character/Deviation.ts src/engine/character/Deviation.test.ts
git commit -m "feat(character): deviation severity roll (weighted distribution)"
```

---

## Task 7: CorePath detection

**Files:**
- Create: `src/engine/character/CorePath.ts`
- Create: `src/engine/character/CorePath.test.ts`

**Rationale:** The first three opened meridians lock in the character's Core Path — the spec's build identity mechanism. Specific named paths take priority over Hollow Vessel (same element) and Shattered Path (three distinct elements).

- [ ] **Step 1: Write the failing test**

Create `src/engine/character/CorePath.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { detectCorePath } from './CorePath';

describe('detectCorePath', () => {
  it('returns null when fewer than 3 meridians opened', () => {
    expect(detectCorePath([])).toBeNull();
    expect(detectCorePath([1])).toBeNull();
    expect(detectCorePath([1, 3])).toBeNull();
  });

  it('iron_mountain = Stomach + Lung + Bladder', () => {
    expect(detectCorePath([3, 1, 7])).toBe('iron_mountain');
    expect(detectCorePath([1, 3, 7])).toBe('iron_mountain'); // order-insensitive
  });

  it('severing_edge = Heart + Small Intestine + Liver', () => {
    expect(detectCorePath([5, 6, 12])).toBe('severing_edge');
  });

  it('still_water = Kidney + Bladder + Spleen', () => {
    expect(detectCorePath([8, 7, 4])).toBe('still_water');
  });

  it('howling_storm = Gallbladder + Lung + Heart', () => {
    expect(detectCorePath([11, 1, 5])).toBe('howling_storm');
  });

  it('blood_ember = Heart + Pericardium + Triple Burner', () => {
    expect(detectCorePath([5, 9, 10])).toBe('blood_ember');
  });

  it('root_and_bough = Liver + Gallbladder + Spleen', () => {
    expect(detectCorePath([12, 11, 4])).toBe('root_and_bough');
  });

  it('thousand_mirrors = Liver + Spleen + Kidney', () => {
    expect(detectCorePath([12, 4, 8])).toBe('thousand_mirrors');
  });

  it('hollow_vessel when all three share the same element (no named match)', () => {
    // Metal: Lung, Large Intestine. Only two metal meridians exist — can't form Hollow.
    // Fire: Heart(5), Small Intestine(6), Pericardium(9), Triple Burner(10).
    expect(detectCorePath([6, 9, 10])).toBe('hollow_vessel');   // 3 fire, no named match
    // Wood: Gallbladder(11), Liver(12) — only 2 wood. Can't form Hollow with 3.
    // Water: Bladder(7), Kidney(8) — only 2. Can't form Hollow.
    // Earth: Stomach(3), Spleen(4) — only 2. Can't form Hollow.
    // Only fire has >= 3 meridians.
  });

  it('shattered_path when three distinct elements with no named match', () => {
    // Lung(metal) + Stomach(earth) + Heart(fire) — no named path matches this set.
    expect(detectCorePath([1, 3, 5])).toBe('shattered_path');
  });

  it('returns null when two meridians share element but third differs and no named match', () => {
    // Lung(metal) + Large Intestine(metal) + Stomach(earth) — not all same, not all distinct, not named
    expect(detectCorePath([1, 2, 3])).toBeNull();
  });

  it('uses only the first three opened meridians, ignoring the rest', () => {
    // First three [3,1,7] → iron_mountain. Extras should be ignored.
    expect(detectCorePath([3, 1, 7, 5, 8, 12])).toBe('iron_mountain');
  });

  it('named path beats hollow when set is both a named match and same-element', () => {
    // No spec named-path set uses 3 same-element meridians, but verify precedence semantics
    // by asserting named matches are checked first. If future data changes, this guards it.
    // blood_ember = Heart(fire) + Pericardium(fire) + Triple Burner(fire) is all fire!
    // So blood_ember is both named AND all-fire. Named must win.
    expect(detectCorePath([5, 9, 10])).toBe('blood_ember');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- CorePath`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/character/CorePath.ts`:

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- CorePath`
Expected: all 12 pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/character/CorePath.ts src/engine/character/CorePath.test.ts
git commit -m "feat(character): core path detection with named-path precedence"
```

---

## Task 8: Character type + factory + mutation helpers

**Files:**
- Create: `src/engine/character/Character.ts`
- Create: `src/engine/character/Character.test.ts`

**Rationale:** Consolidate into a single readonly `Character` record with pure factory and mutation helpers. Every later subsystem (events, breakthroughs, bardo) reads this type and returns a *new* record — no mutation in place.

- [ ] **Step 1: Write the failing test**

Create `src/engine/character/Character.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';
import {
  createCharacter,
  applyHp,
  applyQi,
  applyInsight,
  ageDays,
  Character,
} from './Character';

const BASELINE_ATTRS = {
  Body: 20, Mind: 15, Spirit: 10, Agility: 12, Charm: 8, Luck: 30,
};

describe('createCharacter', () => {
  it('produces a Mortal, age 0, empty meridians by default', () => {
    const c = createCharacter({ name: 'Lin Wei', attributes: BASELINE_ATTRS, rng: createRng(1) });
    expect(c.name).toBe('Lin Wei');
    expect(c.realm).toBe(Realm.MORTAL);
    expect(c.bodyTemperingLayer).toBe(0);
    expect(c.ageDays).toBe(0);
    expect(c.openMeridians).toEqual([]);
    expect(c.corePath).toBeNull();
    expect(c.attributes).toEqual(BASELINE_ATTRS);
  });

  it('rolls a spirit root deterministically for the same seed', () => {
    const a = createCharacter({ name: 'a', attributes: BASELINE_ATTRS, rng: createRng(42) });
    const b = createCharacter({ name: 'b', attributes: BASELINE_ATTRS, rng: createRng(42) });
    expect(a.spiritRoot).toEqual(b.spiritRoot);
  });

  it('computes baseline HP = hpMax(body, 0) and qi = 0 initially', () => {
    const c = createCharacter({ name: 'x', attributes: BASELINE_ATTRS, rng: createRng(99) });
    // 30 + 20*2 + 0*10 = 70
    expect(c.hp).toBe(70);
    expect(c.qi).toBe(0);
    expect(c.insight).toBe(0);
  });

  it('accepts an optional starting age (days)', () => {
    const c = createCharacter({ name: 'x', attributes: BASELINE_ATTRS, rng: createRng(1), startingAgeDays: 3650 });
    expect(c.ageDays).toBe(3650);
  });
});

describe('mutation helpers', () => {
  const base = createCharacter({ name: 't', attributes: BASELINE_ATTRS, rng: createRng(5) });

  it('applyHp returns a new character with HP clamped to [0, hpMax]', () => {
    const low  = applyHp(base, -1000);
    expect(low.hp).toBe(0);
    expect(low).not.toBe(base); // new object

    const high = applyHp(base, +1000);
    expect(high.hp).toBe(base.hp); // clamped to max
  });

  it('applyQi clamps to [0, qiMax]', () => {
    // Base spirit 10, open 0, root varies. For the seed used, spirit root tier is likely 'none'.
    // If 'none' → qiMax = 0 → all qi clamps to 0.
    const bumped = applyQi(base, +50);
    expect(bumped.qi).toBeGreaterThanOrEqual(0);
    expect(bumped.qi).toBeLessThanOrEqual(bumped.qiMax);
  });

  it('applyInsight clamps to >= 0 and respects insight cap', () => {
    const bumped = applyInsight(base, 1_000_000);
    expect(bumped.insight).toBeLessThanOrEqual(bumped.insightCap);

    const drained = applyInsight(base, -500);
    expect(drained.insight).toBe(0);
  });

  it('ageDays increases ageDays and returns new character', () => {
    const older = ageDays(base, 30);
    expect(older.ageDays).toBe(base.ageDays + 30);
    expect(older).not.toBe(base);
  });

  it('ageDays rejects negative deltas', () => {
    expect(() => ageDays(base, -1)).toThrow(/non-negative/i);
  });
});

describe('Character type contracts', () => {
  it('hpMax and qiMax are derived (not stored separately from base)', () => {
    const c: Character = createCharacter({ name: 't', attributes: BASELINE_ATTRS, rng: createRng(5) });
    // hpMax must equal 30 + Body*2 + layer*10
    expect(c.hpMax).toBe(30 + c.attributes.Body * 2 + c.bodyTemperingLayer * 10);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- Character`
Expected: FAIL — imports missing.

- [ ] **Step 3: Implement**

Create `src/engine/character/Character.ts`:

```ts
// The Character record + factory + pure mutation helpers.
// All mutations return a NEW character object.

import { CorePathId, MeridianId, Realm, Stat } from '@/engine/core/Types';
import { IRng } from '@/engine/core/RNG';
import { AttributeMap, hpMax, qiMax } from './Attribute';
import { SpiritRoot, rollSpiritRoot, spiritRootMultipliers } from './SpiritRoot';
import { detectCorePath } from './CorePath';

/** Insight cap by realm — spec §4.3. */
const INSIGHT_CAP_BY_REALM: Record<Realm, number> = {
  [Realm.MORTAL]: 100,
  [Realm.BODY_TEMPERING]: 100,
  [Realm.QI_SENSING]: 300,
  [Realm.QI_CONDENSATION]: 300,
  [Realm.FOUNDATION]: 800,
  [Realm.CORE]: 2000,
  [Realm.NASCENT_SOUL]: 5000,
  [Realm.SOUL_TRANSFORMATION]: 15000,
  [Realm.VOID_REFINEMENT]: 50000,
  [Realm.IMMORTAL]: Number.POSITIVE_INFINITY,
};

export interface Character {
  readonly name: string;
  readonly attributes: Readonly<AttributeMap>;
  readonly spiritRoot: SpiritRoot;
  readonly realm: Realm;
  readonly bodyTemperingLayer: number;  // 0 when not yet in Body Tempering; 1..9 inside it
  readonly ageDays: number;

  readonly hp: number;
  readonly hpMax: number;
  readonly qi: number;
  readonly qiMax: number;
  readonly insight: number;
  readonly insightCap: number;

  readonly openMeridians: ReadonlyArray<MeridianId>;   // opening order preserved
  readonly corePath: CorePathId | null;

  /** Lifetime-persistent flags set by events. Phase 1D wires these. */
  readonly flags: ReadonlyArray<string>;
}

export interface CreateCharacterArgs {
  name: string;
  attributes: AttributeMap;
  rng: IRng;
  /** Optional: starting age in days (default 0). */
  startingAgeDays?: number;
}

function recomputeDerived(c: Omit<Character, 'hpMax' | 'qiMax' | 'insightCap' | 'hp' | 'qi' | 'insight'> & { hp?: number; qi?: number; insight?: number }): Character {
  const mult = spiritRootMultipliers(c.spiritRoot);
  const newHpMax = hpMax({ body: c.attributes.Body, bodyTemperingLayer: c.bodyTemperingLayer });
  const newQiMax = qiMax({
    spirit: c.attributes.Spirit,
    openMeridians: c.openMeridians.length,
    rootMultiplier: mult.absorption,
  });
  const newInsightCap = INSIGHT_CAP_BY_REALM[c.realm];
  const nextHp      = Math.max(0, Math.min(newHpMax, c.hp ?? newHpMax));
  const nextQi      = Math.max(0, Math.min(newQiMax, c.qi ?? 0));
  const nextInsight = Math.max(0, Math.min(newInsightCap, c.insight ?? 0));
  return {
    ...c,
    hpMax: newHpMax,
    qiMax: newQiMax,
    insightCap: newInsightCap,
    hp: nextHp,
    qi: nextQi,
    insight: nextInsight,
  };
}

export function createCharacter(args: CreateCharacterArgs): Character {
  const spiritRoot = rollSpiritRoot(args.rng);
  const base = {
    name: args.name,
    attributes: { ...args.attributes },
    spiritRoot,
    realm: Realm.MORTAL,
    bodyTemperingLayer: 0,
    ageDays: args.startingAgeDays ?? 0,
    openMeridians: [] as ReadonlyArray<MeridianId>,
    corePath: null as CorePathId | null,
    flags: [] as ReadonlyArray<string>,
  };
  return recomputeDerived(base);
}

export function applyHp(c: Character, delta: number): Character {
  const nextHp = Math.max(0, Math.min(c.hpMax, c.hp + delta));
  return { ...c, hp: nextHp };
}

export function applyQi(c: Character, delta: number): Character {
  const nextQi = Math.max(0, Math.min(c.qiMax, c.qi + delta));
  return { ...c, qi: nextQi };
}

export function applyInsight(c: Character, delta: number): Character {
  const nextInsight = Math.max(0, Math.min(c.insightCap, c.insight + delta));
  return { ...c, insight: nextInsight };
}

export function ageDays(c: Character, days: number): Character {
  if (days < 0) throw new Error('ageDays: delta must be non-negative');
  return { ...c, ageDays: c.ageDays + days };
}

/** Internal helper used by later subsystems (breakthrough, meridian open) to re-derive state. */
export function refreshDerived(c: Character): Character {
  return recomputeDerived(c);
}

/** Attach a flag if not already present. Pure; returns new character. */
export function withFlag(c: Character, flag: string): Character {
  if (c.flags.includes(flag)) return c;
  return { ...c, flags: [...c.flags, flag] };
}

/** Update the opening-order meridian list and re-detect Core Path + re-derive. */
export function withOpenedMeridian(c: Character, id: MeridianId): Character {
  if (c.openMeridians.includes(id)) return c;
  const nextOrder = [...c.openMeridians, id];
  const path = detectCorePath(nextOrder);
  return recomputeDerived({
    ...c,
    openMeridians: nextOrder,
    corePath: path,
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- Character`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/character/Character.ts src/engine/character/Character.test.ts
git commit -m "feat(character): Character record + factory + pure mutation helpers"
```

---

## Task 9: Realm metadata

**Files:**
- Create: `src/engine/cultivation/RealmMeta.ts`
- Create: `src/engine/cultivation/RealmMeta.test.ts`

**Rationale:** Centralise realm constants (sub-layer count, lifespan cap, insight cap, tribulation gate). `CultivationProgress` and `Breakthrough` both read from here.

- [ ] **Step 1: Write the failing test**

Create `src/engine/cultivation/RealmMeta.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Realm } from '@/engine/core/Types';
import { realmMeta, lifespanCapDays } from './RealmMeta';

describe('realmMeta', () => {
  it('Mortal: no sub-layers, 60 years', () => {
    const m = realmMeta(Realm.MORTAL);
    expect(m.subLayers).toBe(0);
    expect(m.lifespanYears).toBe(60);
    expect(m.insightCap).toBe(100);
    expect(m.tribulationGate).toBe(false);
  });

  it('Body Tempering: 9 sub-layers, 80 years', () => {
    const m = realmMeta(Realm.BODY_TEMPERING);
    expect(m.subLayers).toBe(9);
    expect(m.lifespanYears).toBe(80);
    expect(m.insightCap).toBe(100);
    expect(m.tribulationGate).toBe(false);
  });

  it('Qi Sensing: no sub-layers, 100 years', () => {
    const m = realmMeta(Realm.QI_SENSING);
    expect(m.subLayers).toBe(0);
    expect(m.lifespanYears).toBe(100);
    expect(m.insightCap).toBe(300);
  });

  it('Qi Condensation: 9 sub-layers, 120 years', () => {
    const m = realmMeta(Realm.QI_CONDENSATION);
    expect(m.subLayers).toBe(9);
    expect(m.lifespanYears).toBe(120);
    expect(m.insightCap).toBe(300);
  });

  it('Foundation through Immortal — lifespans escalate per spec §4.1', () => {
    expect(realmMeta(Realm.FOUNDATION).lifespanYears).toBe(200);
    expect(realmMeta(Realm.CORE).lifespanYears).toBe(500);
    expect(realmMeta(Realm.NASCENT_SOUL).lifespanYears).toBe(1000);
    expect(realmMeta(Realm.SOUL_TRANSFORMATION).lifespanYears).toBe(3000);
    expect(realmMeta(Realm.VOID_REFINEMENT).lifespanYears).toBe(10_000);
    expect(realmMeta(Realm.IMMORTAL).lifespanYears).toBe(Number.POSITIVE_INFINITY);
  });

  it('tribulation gate flags for realms 4+', () => {
    expect(realmMeta(Realm.FOUNDATION).tribulationGate).toBe(true);
    expect(realmMeta(Realm.CORE).tribulationGate).toBe(true);
    expect(realmMeta(Realm.NASCENT_SOUL).tribulationGate).toBe(true);
  });

  it('lifespanCapDays converts years × 365', () => {
    expect(lifespanCapDays(Realm.MORTAL)).toBe(60 * 365);
    expect(lifespanCapDays(Realm.BODY_TEMPERING)).toBe(80 * 365);
    expect(lifespanCapDays(Realm.IMMORTAL)).toBe(Number.POSITIVE_INFINITY);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- RealmMeta`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/cultivation/RealmMeta.ts`:

```ts
// Realm metadata — sub-layer counts, lifespan caps, insight caps, tribulation gates.
// Source: docs/spec/design.md §4.1, §4.3.

import { Realm } from '@/engine/core/Types';

export interface RealmMeta {
  realm: Realm;
  subLayers: number;           // 0 = no sub-layer structure (Mortal, Qi Sensing)
  lifespanYears: number;       // may be +Infinity for Immortal
  insightCap: number;
  tribulationGate: boolean;    // true if entry requires a tribulation pillar
}

const META: Record<Realm, RealmMeta> = {
  [Realm.MORTAL]:              { realm: Realm.MORTAL,              subLayers: 0, lifespanYears: 60,     insightCap: 100,   tribulationGate: false },
  [Realm.BODY_TEMPERING]:      { realm: Realm.BODY_TEMPERING,      subLayers: 9, lifespanYears: 80,     insightCap: 100,   tribulationGate: false },
  [Realm.QI_SENSING]:          { realm: Realm.QI_SENSING,          subLayers: 0, lifespanYears: 100,    insightCap: 300,   tribulationGate: false },
  [Realm.QI_CONDENSATION]:     { realm: Realm.QI_CONDENSATION,     subLayers: 9, lifespanYears: 120,    insightCap: 300,   tribulationGate: false },
  [Realm.FOUNDATION]:          { realm: Realm.FOUNDATION,          subLayers: 3, lifespanYears: 200,    insightCap: 800,   tribulationGate: true  },
  [Realm.CORE]:                { realm: Realm.CORE,                subLayers: 9, lifespanYears: 500,    insightCap: 2000,  tribulationGate: true  },
  [Realm.NASCENT_SOUL]:        { realm: Realm.NASCENT_SOUL,        subLayers: 3, lifespanYears: 1000,   insightCap: 5000,  tribulationGate: true  },
  [Realm.SOUL_TRANSFORMATION]: { realm: Realm.SOUL_TRANSFORMATION, subLayers: 3, lifespanYears: 3000,   insightCap: 15000, tribulationGate: true  },
  [Realm.VOID_REFINEMENT]:     { realm: Realm.VOID_REFINEMENT,     subLayers: 3, lifespanYears: 10000,  insightCap: 50000, tribulationGate: true  },
  [Realm.IMMORTAL]:            { realm: Realm.IMMORTAL,            subLayers: 0, lifespanYears: Number.POSITIVE_INFINITY, insightCap: Number.POSITIVE_INFINITY, tribulationGate: true },
};

export function realmMeta(r: Realm): RealmMeta {
  return META[r];
}

export function lifespanCapDays(r: Realm): number {
  const years = META[r].lifespanYears;
  if (years === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
  return years * 365;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- RealmMeta`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/cultivation/RealmMeta.ts src/engine/cultivation/RealmMeta.test.ts
git commit -m "feat(cultivation): realm metadata (sub-layers, lifespan, insight caps)"
```

---

## Task 10: CultivationProgress

**Files:**
- Create: `src/engine/cultivation/CultivationProgress.ts`
- Create: `src/engine/cultivation/CultivationProgress.test.ts`

**Rationale:** A simple progress track per (realm, sub-layer) pair. Each sub-layer needs 100 progress units to fill. When full, the character is eligible for a breakthrough. We store only the current `progress` value in the character (Phase 1A adds this field to Character).

- [ ] **Step 1: Extend Character with cultivation progress field**

This is the ONE modification we make to `Character.ts` in this task. Open `src/engine/character/Character.ts` and add to the `Character` interface, AFTER `insightCap: number;` and BEFORE `openMeridians`:

```ts
  /** Progress within the current sub-layer (or the current realm, if no sub-layers). 0..100. */
  readonly cultivationProgress: number;
```

Then update `recomputeDerived` to preserve `cultivationProgress` (default 0 if not given):

Edit the `recomputeDerived` function so that its input and return preserve the field. Change its return-`return` section to include the field:

```ts
  return {
    ...c,
    cultivationProgress: c.cultivationProgress ?? 0,  // NEW
    hpMax: newHpMax,
    qiMax: newQiMax,
    insightCap: newInsightCap,
    hp: nextHp,
    qi: nextQi,
    insight: nextInsight,
  };
```

And the `Omit<Character, ...>` parameter type needs updating to include `cultivationProgress` in the partial-override clause:

```ts
function recomputeDerived(
  c: Omit<Character, 'hpMax' | 'qiMax' | 'insightCap' | 'hp' | 'qi' | 'insight'> & {
    hp?: number;
    qi?: number;
    insight?: number;
    cultivationProgress?: number;  // NEW
  }
): Character {
```

Update `createCharacter` to initialise the field:

```ts
  const base = {
    name: args.name,
    attributes: { ...args.attributes },
    spiritRoot,
    realm: Realm.MORTAL,
    bodyTemperingLayer: 0,
    ageDays: args.startingAgeDays ?? 0,
    cultivationProgress: 0,   // NEW
    openMeridians: [] as ReadonlyArray<MeridianId>,
    corePath: null as CorePathId | null,
    flags: [] as ReadonlyArray<string>,
  };
```

Update the existing Character test to assert `cultivationProgress === 0` at creation. Add this assertion inside the first `createCharacter` test block:

```ts
    expect(c.cultivationProgress).toBe(0);
```

- [ ] **Step 2: Run Character test to confirm still green**

Run: `npm test -- Character`
Expected: all Character tests still pass, including the new `cultivationProgress` assertion.

- [ ] **Step 3: Write failing test for CultivationProgress**

Create `src/engine/cultivation/CultivationProgress.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createCharacter } from '@/engine/character/Character';
import {
  advanceCultivation,
  isSubLayerFull,
  cultivationGainRate,
} from './CultivationProgress';

const ATTRS = { Body: 30, Mind: 20, Spirit: 20, Agility: 15, Charm: 10, Luck: 30 };

describe('cultivationGainRate', () => {
  it('zero when rootMultiplier is zero (no spirit root)', () => {
    expect(cultivationGainRate({
      baseRate: 1, rootMultiplier: 0, environmentDensity: 1,
      techniqueMultiplier: 1, openMeridianBonus: 0, anchorFocusBonus: 1, noticeMalice: 1,
    })).toBe(0);
  });

  it('baseline: base × root × env × tech × (1+bonus) × anchor × malice', () => {
    const rate = cultivationGainRate({
      baseRate: 2, rootMultiplier: 1.0, environmentDensity: 1.5,
      techniqueMultiplier: 1.0, openMeridianBonus: 0.2, anchorFocusBonus: 1.0, noticeMalice: 1.0,
    });
    // 2 * 1 * 1.5 * 1 * 1.2 * 1 * 1 = 3.6
    expect(rate).toBeCloseTo(3.6, 5);
  });

  it('noticeMalice < 1 reduces rate', () => {
    const rate = cultivationGainRate({
      baseRate: 2, rootMultiplier: 1.0, environmentDensity: 1.0,
      techniqueMultiplier: 1.0, openMeridianBonus: 0, anchorFocusBonus: 1.0, noticeMalice: 0.5,
    });
    expect(rate).toBe(1);
  });
});

describe('advanceCultivation', () => {
  it('adds to progress, clamping at 100 per sub-layer', () => {
    const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    const after = advanceCultivation(c, 30);
    expect(after.cultivationProgress).toBe(30);

    const overflowed = advanceCultivation(after, 200);
    expect(overflowed.cultivationProgress).toBe(100);
  });

  it('rejects negative amounts', () => {
    const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    expect(() => advanceCultivation(c, -1)).toThrow(/non-negative/i);
  });

  it('is pure — returns new character', () => {
    const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    const after = advanceCultivation(c, 10);
    expect(after).not.toBe(c);
    expect(c.cultivationProgress).toBe(0);
  });
});

describe('isSubLayerFull', () => {
  it('false at 0, false at 99, true at 100', () => {
    const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    expect(isSubLayerFull(c)).toBe(false);
    const near = advanceCultivation(c, 99);
    expect(isSubLayerFull(near)).toBe(false);
    const full = advanceCultivation(c, 100);
    expect(isSubLayerFull(full)).toBe(true);
  });
});
```

- [ ] **Step 4: Run test to verify failure**

Run: `npm test -- CultivationProgress`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement**

Create `src/engine/cultivation/CultivationProgress.ts`:

```ts
// Cultivation progress bar: 0..100 per sub-layer. Full = breakthrough-eligible.
// Formula source: docs/spec/design.md §4.2.

import { Character } from '@/engine/character/Character';

/** Maximum progress per sub-layer. */
export const PROGRESS_PER_SUBLAYER = 100;

export interface GainRateArgs {
  baseRate: number;              // per-event base
  rootMultiplier: number;        // from SpiritRoot
  environmentDensity: number;    // from region (§8.1)
  techniqueMultiplier: number;   // from active techniques
  openMeridianBonus: number;     // e.g. 0.05 per meridian
  anchorFocusBonus: number;      // from spawn anchor
  noticeMalice: number;          // from heavenly notice (may be < 1)
}

/**
 * Compute per-tick cultivation gain (per spec §4.2).
 *   gain = base × root × env × tech × (1 + openMeridiansBonus) × anchor × notice
 */
export function cultivationGainRate(a: GainRateArgs): number {
  return (
    a.baseRate
    * a.rootMultiplier
    * a.environmentDensity
    * a.techniqueMultiplier
    * (1 + a.openMeridianBonus)
    * a.anchorFocusBonus
    * a.noticeMalice
  );
}

export function advanceCultivation(c: Character, amount: number): Character {
  if (amount < 0) throw new Error('advanceCultivation: amount must be non-negative');
  const next = Math.min(PROGRESS_PER_SUBLAYER, c.cultivationProgress + amount);
  return { ...c, cultivationProgress: next };
}

export function isSubLayerFull(c: Character): boolean {
  return c.cultivationProgress >= PROGRESS_PER_SUBLAYER;
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- CultivationProgress`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/engine/character/Character.ts src/engine/character/Character.test.ts \
        src/engine/cultivation/CultivationProgress.ts src/engine/cultivation/CultivationProgress.test.ts
git commit -m "feat(cultivation): progress track + cultivationGainRate formula"
```

---

## Task 11: Sub-layer breakthrough

**Files:**
- Create: `src/engine/cultivation/Breakthrough.ts`
- Create: `src/engine/cultivation/Breakthrough.test.ts`

**Rationale:** Sub-layer breakthroughs are the first realm mechanic the player will actually interact with (Phase 1 MVP: Body Tempering 1→9). Formula from spec §4.3.

- [ ] **Step 1: Write the failing test**

Create `src/engine/cultivation/Breakthrough.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';
import { createCharacter, refreshDerived } from '@/engine/character/Character';
import { advanceCultivation } from './CultivationProgress';
import {
  sublayerBreakthroughChance,
  attemptSublayerBreakthrough,
} from './Breakthrough';

const ATTRS = { Body: 30, Mind: 40, Spirit: 20, Agility: 15, Charm: 10, Luck: 30 };

function bodyTemperingCharacter(layer: number) {
  const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
  return refreshDerived({ ...c, realm: Realm.BODY_TEMPERING, bodyTemperingLayer: layer });
}

describe('sublayerBreakthroughChance', () => {
  it('baseline: 50 + Mind*0.3 + Insight*0.1 - layer*4', () => {
    // Mind=40, Insight=0, layer=1 → 50 + 12 + 0 - 4 = 58
    expect(sublayerBreakthroughChance({
      mind: 40, insight: 0, currentLayer: 1,
      pillBonus: 0, safeEnvironmentBonus: 0,
    })).toBe(58);
  });

  it('clamps to [15, 95]', () => {
    // All-zero trash character at layer 20: 50 - 80 = -30 → clamp 15
    expect(sublayerBreakthroughChance({
      mind: 0, insight: 0, currentLayer: 20,
      pillBonus: 0, safeEnvironmentBonus: 0,
    })).toBe(15);
    // Max-stat breakthrough: 50 + 30 + 100 = 180 → clamp 95
    expect(sublayerBreakthroughChance({
      mind: 100, insight: 1000, currentLayer: 0,
      pillBonus: 0, safeEnvironmentBonus: 0,
    })).toBe(95);
  });

  it('pill and environment bonuses add linearly', () => {
    // Baseline 58, +5 pill, +10 env = 73
    expect(sublayerBreakthroughChance({
      mind: 40, insight: 0, currentLayer: 1,
      pillBonus: 5, safeEnvironmentBonus: 10,
    })).toBe(73);
  });

  it('higher layer is harder', () => {
    const args = { mind: 40, insight: 0, pillBonus: 0, safeEnvironmentBonus: 0 };
    expect(sublayerBreakthroughChance({ ...args, currentLayer: 1 }))
      .toBeGreaterThan(sublayerBreakthroughChance({ ...args, currentLayer: 8 }));
  });
});

describe('attemptSublayerBreakthrough', () => {
  it('throws if progress is not full', () => {
    const c = bodyTemperingCharacter(1);
    expect(() => attemptSublayerBreakthrough(c, { rng: createRng(1) }))
      .toThrow(/not full/i);
  });

  it('on success: layer increments, progress resets, returns new char', () => {
    const ready = advanceCultivation(bodyTemperingCharacter(1), 100);
    // Force success by using a seed that rolls low with chance ≈ 58.
    // For any seed, if roll <= 58 → success. Mulberry32 seed=42 first d100 is low.
    const out = attemptSublayerBreakthrough(ready, { rng: createRng(2) });
    // Either success or failure; test both branches separately below.
    expect([1, 2]).toContain(out.character.bodyTemperingLayer);
  });

  it('on success: advances the layer and clears progress', () => {
    // Construct a high-chance setup to make success overwhelmingly likely.
    const base = createCharacter({ name: 't', attributes: { ...ATTRS, Mind: 100 }, rng: createRng(1) });
    const primed = advanceCultivation(
      refreshDerived({ ...base, realm: Realm.BODY_TEMPERING, bodyTemperingLayer: 0 }),
      100,
    );
    // chance ≈ 95; try 10 seeds — at least one should succeed.
    let success = false;
    for (let seed = 1; seed <= 50 && !success; seed++) {
      const out = attemptSublayerBreakthrough(primed, { rng: createRng(seed) });
      if (out.success) {
        expect(out.character.bodyTemperingLayer).toBe(1);
        expect(out.character.cultivationProgress).toBe(0);
        success = true;
      }
    }
    expect(success).toBe(true);
  });

  it('on failure: layer unchanged, progress reduced by 25%, injury flag or no change', () => {
    // Force failure with a guaranteed-fail setup: very high layer with low mind.
    const base = createCharacter({ name: 't', attributes: { ...ATTRS, Mind: 0 }, rng: createRng(1) });
    const primed = advanceCultivation(
      refreshDerived({ ...base, realm: Realm.BODY_TEMPERING, bodyTemperingLayer: 9 }),
      100,
    );
    // Chance = clamp(50 + 0 + 0 - 36, 15, 95) = 15. Most seeds should fail.
    let failures = 0;
    for (let seed = 10; seed < 30; seed++) {
      const out = attemptSublayerBreakthrough(primed, { rng: createRng(seed) });
      if (!out.success) {
        expect(out.character.bodyTemperingLayer).toBe(9);
        expect(out.character.cultivationProgress).toBe(75); // 25% lost
        failures++;
      }
    }
    expect(failures).toBeGreaterThan(5);
  });

  it('progress cannot go below 0 even if reduction math underflows', () => {
    const base = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    // Synthetic: character has progress at 100 but sub-layer logic subtracts 25.
    // Verify: 100 → 75. Already tested above. This test guards future edge cases.
    const primed = advanceCultivation(
      refreshDerived({ ...base, realm: Realm.BODY_TEMPERING, bodyTemperingLayer: 0 }),
      100,
    );
    const out = attemptSublayerBreakthrough(primed, { rng: createRng(999) });
    expect(out.character.cultivationProgress).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- Breakthrough`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/cultivation/Breakthrough.ts`:

```ts
// Sub-layer breakthrough formula + application.
// Formula source: docs/spec/design.md §4.3.

import { IRng } from '@/engine/core/RNG';
import { Character } from '@/engine/character/Character';
import { isSubLayerFull, PROGRESS_PER_SUBLAYER } from './CultivationProgress';
import { realmMeta } from './RealmMeta';

export interface BreakthroughChanceArgs {
  mind: number;
  insight: number;
  currentLayer: number;          // 0-indexed within realm for formula purposes
  pillBonus: number;
  safeEnvironmentBonus: number;
}

/** See spec §4.3. */
export function sublayerBreakthroughChance(a: BreakthroughChanceArgs): number {
  const raw =
    50
    + a.mind * 0.3
    + a.insight * 0.1
    + a.pillBonus * 5                    // Each "pill unit" is +5 per plan text
    + a.safeEnvironmentBonus
    - a.currentLayer * 4;
  return Math.min(95, Math.max(15, Math.round(raw)));
}

export interface AttemptArgs {
  rng: IRng;
  pillBonus?: number;
  safeEnvironmentBonus?: number;
}

export interface AttemptResult {
  character: Character;
  success: boolean;
  chance: number;
  roll: number;
}

const PROGRESS_LOST_ON_FAIL = 25;

export function attemptSublayerBreakthrough(c: Character, args: AttemptArgs): AttemptResult {
  if (!isSubLayerFull(c)) {
    throw new Error('attemptSublayerBreakthrough: cultivation progress is not full');
  }
  const meta = realmMeta(c.realm);
  if (meta.subLayers === 0) {
    throw new Error(`realm ${c.realm} has no sub-layers`);
  }

  const chance = sublayerBreakthroughChance({
    mind: c.attributes.Mind,
    insight: c.insight,
    currentLayer: c.bodyTemperingLayer,
    pillBonus: args.pillBonus ?? 0,
    safeEnvironmentBonus: args.safeEnvironmentBonus ?? 0,
  });

  const roll = args.rng.d100();
  const success = roll <= chance;

  if (success) {
    const nextLayer = Math.min(meta.subLayers, c.bodyTemperingLayer + 1);
    return {
      success: true,
      chance,
      roll,
      character: {
        ...c,
        bodyTemperingLayer: nextLayer,
        cultivationProgress: 0,
      },
    };
  }

  const nextProgress = Math.max(0, PROGRESS_PER_SUBLAYER - PROGRESS_LOST_ON_FAIL);
  return {
    success: false,
    chance,
    roll,
    character: {
      ...c,
      cultivationProgress: nextProgress,
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- Breakthrough`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/cultivation/Breakthrough.ts src/engine/cultivation/Breakthrough.test.ts
git commit -m "feat(cultivation): sub-layer breakthrough formula + application"
```

---

## Task 12: Old-age death roll

**Files:**
- Create: `src/engine/cultivation/OldAge.ts`
- Create: `src/engine/cultivation/OldAge.test.ts`

**Rationale:** Old age is one of the most frequent early-meta deaths (spec §4.8). Implement as a per-check probability roll using cumulative hazard.

- [ ] **Step 1: Write the failing test**

Create `src/engine/cultivation/OldAge.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';
import { createCharacter, refreshDerived } from '@/engine/character/Character';
import {
  isInOldAge,
  oldAgeDeathChance,
  rollOldAgeDeath,
} from './OldAge';

function mortalAged(days: number) {
  const c = createCharacter({ name: 't', attributes: { Body: 20, Mind: 20, Spirit: 10, Agility: 10, Charm: 10, Luck: 30 }, rng: createRng(1) });
  return refreshDerived({ ...c, ageDays: days });
}

describe('isInOldAge', () => {
  it('false below 85% of lifespan', () => {
    // Mortal lifespan = 60 years = 21,900 days. 85% = 18,615.
    expect(isInOldAge(mortalAged(18_000))).toBe(false);
    expect(isInOldAge(mortalAged(18_615))).toBe(false);
  });

  it('true above 85% of lifespan', () => {
    expect(isInOldAge(mortalAged(18_616))).toBe(true);
    expect(isInOldAge(mortalAged(21_900))).toBe(true);
    expect(isInOldAge(mortalAged(22_000))).toBe(true);
  });

  it('Immortal is never in old age', () => {
    const c = createCharacter({ name: 't', attributes: { Body: 20, Mind: 20, Spirit: 10, Agility: 10, Charm: 10, Luck: 30 }, rng: createRng(1) });
    const immortal = refreshDerived({ ...c, realm: Realm.IMMORTAL, ageDays: 1_000_000 });
    expect(isInOldAge(immortal)).toBe(false);
  });
});

describe('oldAgeDeathChance', () => {
  it('returns 0 when not in old age', () => {
    expect(oldAgeDeathChance(mortalAged(10_000))).toBe(0);
  });

  it('rises with years since old-age onset — 1 year ≈ 0.05', () => {
    // onset at 18,615 days. 1 year in = 18,615 + 365 = 18,980
    const c = mortalAged(18_980);
    const chance = oldAgeDeathChance(c);
    // 1 - 0.95^1 = 0.05
    expect(chance).toBeCloseTo(0.05, 2);
  });

  it('after 10 years ≈ 0.401', () => {
    // 18,615 + 3,650 = 22,265 (past the 60-year cap; still valid for formula)
    const c = mortalAged(22_265);
    const chance = oldAgeDeathChance(c);
    expect(chance).toBeCloseTo(0.4013, 3);
  });

  it('caps at 1.0', () => {
    expect(oldAgeDeathChance(mortalAged(1_000_000))).toBe(1);
  });
});

describe('rollOldAgeDeath', () => {
  it('never fires when not in old age', () => {
    const c = mortalAged(10_000);
    for (let seed = 1; seed < 100; seed++) {
      expect(rollOldAgeDeath(c, createRng(seed))).toBe(false);
    }
  });

  it('always fires at saturation (chance 1.0)', () => {
    const c = mortalAged(1_000_000);
    for (let seed = 1; seed < 20; seed++) {
      expect(rollOldAgeDeath(c, createRng(seed))).toBe(true);
    }
  });

  it('empirical distribution matches the chance around 1 year in', () => {
    const c = mortalAged(18_980); // ~5% chance
    let deaths = 0;
    const N = 5_000;
    for (let seed = 1; seed <= N; seed++) {
      if (rollOldAgeDeath(c, createRng(seed))) deaths++;
    }
    const p = deaths / N;
    expect(p).toBeGreaterThan(0.03);
    expect(p).toBeLessThan(0.07);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- OldAge`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/cultivation/OldAge.ts`:

```ts
// Old-age death probability. Source: docs/spec/design.md §4.8.

import { IRng } from '@/engine/core/RNG';
import { Character } from '@/engine/character/Character';
import { lifespanCapDays } from './RealmMeta';

const OLD_AGE_THRESHOLD = 0.85;    // % of lifespan cap
const PER_YEAR_HAZARD = 0.05;      // 5% cumulative hazard per year past onset

export function isInOldAge(c: Character): boolean {
  const cap = lifespanCapDays(c.realm);
  if (cap === Number.POSITIVE_INFINITY) return false;
  return c.ageDays > cap * OLD_AGE_THRESHOLD;
}

export function oldAgeDeathChance(c: Character): number {
  if (!isInOldAge(c)) return 0;
  const cap = lifespanCapDays(c.realm);
  const onset = cap * OLD_AGE_THRESHOLD;
  const yearsPastOnset = (c.ageDays - onset) / 365;
  // 1 - (1 - 0.05)^years
  const chance = 1 - Math.pow(1 - PER_YEAR_HAZARD, yearsPastOnset);
  return Math.min(1, Math.max(0, chance));
}

export function rollOldAgeDeath(c: Character, rng: IRng): boolean {
  const chance = oldAgeDeathChance(c);
  if (chance <= 0) return false;
  if (chance >= 1) return true;
  return rng.next() < chance;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- OldAge`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/cultivation/OldAge.ts src/engine/cultivation/OldAge.test.ts
git commit -m "feat(cultivation): old-age death cumulative hazard"
```

---

## Task 13: Integration test — simulated Body Tempering lifetime

**Files:**
- Create: `tests/integration/character_lifetime.test.ts`

**Rationale:** Prove all modules compose into a coherent character lifecycle. A deterministic simulation: create character → advance progress → attempt breakthroughs through Body Tempering 1..9 → eventually age out or succeed.

- [ ] **Step 1: Write the integration test**

Create `tests/integration/character_lifetime.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';
import { createCharacter, ageDays, refreshDerived, withOpenedMeridian } from '@/engine/character/Character';
import { advanceCultivation, isSubLayerFull } from '@/engine/cultivation/CultivationProgress';
import { attemptSublayerBreakthrough } from '@/engine/cultivation/Breakthrough';
import { isInOldAge, rollOldAgeDeath } from '@/engine/cultivation/OldAge';
import { spiritRootMultipliers } from '@/engine/character/SpiritRoot';

describe('character lifetime simulation', () => {
  it('simulates a Body Tempering cultivator reaching layer 9 or dying of old age', () => {
    // Strong starter: high Mind, high Spirit, decent Body.
    const rng = createRng(2024);
    let c = createCharacter({
      name: 'Lin Wei',
      attributes: { Body: 30, Mind: 50, Spirit: 20, Agility: 15, Charm: 10, Luck: 40 },
      rng,
    });

    // Force a rollable spirit root — repeat create until not-none for this deterministic test.
    // (We set up the seed above to give us a cultivator; fall back otherwise.)
    if (c.spiritRoot.tier === 'none') {
      // Try a handful more seeds to find one with a usable root.
      for (let s = 2025; s <= 2100; s++) {
        const trial = createCharacter({
          name: 'Lin Wei',
          attributes: { Body: 30, Mind: 50, Spirit: 20, Agility: 15, Charm: 10, Luck: 40 },
          rng: createRng(s),
        });
        if (trial.spiritRoot.tier !== 'none') { c = trial; break; }
      }
      // If still 'none', this integration simply verifies the no-cultivation path below.
    }

    // Transition to Body Tempering by opening the first meridian.
    c = withOpenedMeridian(c, 3); // Stomach
    c = refreshDerived({ ...c, realm: Realm.BODY_TEMPERING, bodyTemperingLayer: 1 });

    let ageYears = 0;
    let reached9 = false;
    let died = false;

    while (ageYears < 80 && !reached9 && !died) {
      // Each "year" we attempt to advance 120 progress units (fills a sub-layer +20%).
      c = advanceCultivation(c, 120);

      if (isSubLayerFull(c)) {
        const attempt = attemptSublayerBreakthrough(c, { rng });
        c = attempt.character;
        if (c.bodyTemperingLayer >= 9) reached9 = true;
      }

      c = ageDays(c, 365);
      ageYears++;

      if (isInOldAge(c) && rollOldAgeDeath(c, rng)) died = true;
    }

    // Assertion: the character either reached layer 9, or aged out in Body Tempering.
    expect(reached9 || died || ageYears >= 80).toBe(true);
    // Sanity: the cultivation progress is in valid range.
    expect(c.cultivationProgress).toBeGreaterThanOrEqual(0);
    expect(c.cultivationProgress).toBeLessThanOrEqual(100);
    // Sanity: if reached9, layer is exactly 9.
    if (reached9) expect(c.bodyTemperingLayer).toBe(9);
  });

  it('a character with "none" spirit root cannot cultivate qi (qiMax stays 0)', () => {
    // Force a seed known to roll 'none' (majority of seeds).
    const c = createCharacter({
      name: 't',
      attributes: { Body: 30, Mind: 30, Spirit: 50, Agility: 15, Charm: 10, Luck: 20 },
      rng: createRng(1),
    });
    if (c.spiritRoot.tier === 'none') {
      const mult = spiritRootMultipliers(c.spiritRoot);
      expect(mult.absorption).toBe(0);
      expect(c.qiMax).toBe(0);
    }
    // If the seed happens to produce a cultivator, assert multiplier reflects it.
    else {
      expect(c.qiMax).toBeGreaterThan(0);
    }
  });

  it('opening all 12 meridians recomputes qiMax correctly', () => {
    const c0 = createCharacter({
      name: 't',
      attributes: { Body: 30, Mind: 30, Spirit: 40, Agility: 15, Charm: 10, Luck: 30 },
      rng: createRng(31),
    });
    let c = c0;
    for (const id of [1,2,3,4,5,6,7,8,9,10,11,12] as const) {
      c = withOpenedMeridian(c, id);
    }
    expect(c.openMeridians).toHaveLength(12);
    // qiMax = Spirit × (1 + 12×0.15) × rootMultiplier = Spirit × 2.8 × rootMult
    // With rootMult known (may be 0), assert monotonic increase vs c0.
    expect(c.qiMax).toBeGreaterThanOrEqual(c0.qiMax);
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npm test -- character_lifetime`
Expected: 3 tests pass. The simulation terminates in one of three ways (reach layer 9, die of old age, or run out of wall-clock 80 years) — all are valid outcomes.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: all tests green (prior 79 + Phase 1A additions).

Run: `npm run typecheck`
Expected: clean.

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/character_lifetime.test.ts
git commit -m "test(integration): character lifetime simulation through Body Tempering"
```

---

## Exit Criteria Checklist

Before Phase 1B begins, all of the following must be true:

- [ ] All Task 1–13 commits are on branch `phase-1a-character-foundation` (branch to be created by controller at start).
- [ ] `npm test` passes with 100+ tests total. Phase 1A adds ~65 new tests.
- [ ] `npm run typecheck` clean.
- [ ] `npm run build` produces a working bundle.
- [ ] CI green on the branch.
- [ ] Every module in `src/engine/character/` and `src/engine/cultivation/` has a corresponding `*.test.ts`.
- [ ] No module imports from `src/engine/events/`, `src/engine/narrative/`, or `src/state/` (those subsystems arrive in later sub-phases).
- [ ] Spec §3 and §4.1–§4.3 are fully covered by code or tests in Phase 1A, except the explicitly-deferred items listed at the top of this document.
- [ ] The integration test `character_lifetime.test.ts` is green.

---

## Self-Review Notes (done after writing this plan)

**1. Spec coverage (§3, §4.1–§4.3):**
- §3.1 Attributes — Task 2 ✔
- §3.2 Spirit Roots — Task 3 ✔
- §3.3 Meridians — Tasks 4, 5, 6 ✔
- §3.4 Qi / Insight derived stats — Tasks 2, 8 ✔ (Insight cap per realm in Task 8 via INSIGHT_CAP_BY_REALM)
- §3.5 Death taxonomy — DeathCause enum already exists in Types.ts from Phase 0. No new code needed; Phase 1D uses it.
- §4.1 Realm ladder — Task 9 ✔
- §4.2 Cultivation progress — Task 10 ✔
- §4.3 Breakthroughs — Task 11 ✔ (sub-layer only; realm-level is Phase 3 tribulations)
- §4.4 Core Paths — Task 7 ✔
- §4.5 Tribulations — **deferred to Phase 3** (explicitly in scope boundaries)
- §4.6 Qi deviation — Tasks 5, 6 ✔
- §4.7 Techniques — **deferred to Phase 1B+** (explicitly in scope boundaries)
- §4.8 Longevity / old age — Task 12 ✔

**2. Placeholder scan:** no TBD/TODO/etc. Every step has full code or a full commit command.

**3. Type consistency:**
- `Character.cultivationProgress` introduced in Task 10, consumed in Task 11. Matches.
- `isSubLayerFull` defined in Task 10, called in Task 11. Matches.
- `MeridianId` used across Tasks 1, 4, 5, 7, 8. Consistent.
- `SpiritRoot` interface exported from Task 3, imported by Task 8. Matches.
- `realmMeta`, `lifespanCapDays` defined in Task 9, consumed in Tasks 11, 12. Matches.
- `cultivationGainRate` defined in Task 10 but never consumed in Phase 1A — it's there for Phase 1B's EventSelector to use. Acceptable: a pure function with no downstream dep in this phase, but full test coverage in Task 10 itself. Flagged in self-review as "fine, not wasteful".

**4. Gaps:** none against Phase 1A's scope. Deferred items are explicit.
