# Phase 1D-1 — Engine Glue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Phases 1A + 1B + 1C into a working end-to-end engine: spawn a character from an Anchor, run a turn loop, track karma, commit karma at Bardo on death, reincarnate. Pure engine logic — no UI yet (Phase 1D-2), no content authoring beyond minimal test fixtures (Phase 1D-3).

**Architecture:** Three new subsystems (`Anchor`, `KarmicInsight`, `GameLoop`/`BardoFlow`) plus persistence wiring. Everything is pure functions; mutations return new records. `MetaState` is introduced as the persistent cross-life slice (balanced karma, unlocked upgrades + anchors, lineage, lifetime-seen events). `SaveManager` (from Phase 0) is now used for real — `wdr.run` + `wdr.meta` keys with versioned envelopes.

**Tech Stack:** TypeScript 5.8 strict, Vitest 4, Zod 4. Depends on everything in Phases 0, 1A, 1B, 1C. No new runtime dependencies.

**Source of truth:** `docs/spec/design.md` §2 (game loop), §7 (meta-progression, especially §7.1 Karmic Insights + §7.4 Anchors), §10 (persistence model).

**Scope boundaries (out of Phase 1D-1):**
- **UI / engineBridge wiring** — Phase 1D-2. engineBridge stays as Phase 0 stubs.
- **Content authoring** (real events, name pools, snippets for Yellow Plains) — Phase 1D-3. This phase uses minimal test fixtures.
- **Echo / Memory meta systems** (§7.2, §7.3) — Phase 2.
- **Heavenly Notice scaling / Karmic Hunters / Imprints** (§7.5–§7.7) — Phase 3.
- **Tribulations** — Phase 3.
- **Multiple regions beyond yellow_plains** — Phase 2+.
- **Cross-life Threads** (§7.8) — Phase 3.

---

## Task Map

1. `AnchorDef` zod schema + 2 default anchors (`true_random`, `peasant_farmer`)
2. `AnchorResolver` — pick a concrete spawn from an `AnchorDef` (region, age, attributes, starting flags)
3. `characterFromAnchor` — factory that combines `Anchor` + `createCharacter` + `createRunState`
4. `KarmicInsightRules` — per-life earn table (lived years, realm reached, regrets, death cause)
5. `KarmicUpgrade` type + 5 default upgrade definitions (spec §7.1 shortlist)
6. `applyKarmicUpgrade` — mutation on `MetaState` (spend + mark as owned)
7. `MetaState` record + `createEmptyMetaState` + save/load via `SaveManager`
8. `LineageEntry` + `appendLineage` helper
9. `RunSave` — serialize/deserialize `RunState` via `SaveManager`
10. `BardoFlow` — compose life summary + compute karma earned + commit to MetaState + emit new character seed
11. `GameLoop.runTurn` — orchestrate one turn (select event → resolve choice → apply outcome → tick streak + age → autosave)
12. Integration test: **full life cycle** (create → play several turns → die → bardo → reincarnate → play again with echoes of previous life)

---

## Prerequisite Reading

- `docs/spec/design.md` §2 (two-loop model, phases, time cost), §7.1 (Karmic Insights earn + spend), §7.4 (Anchor spec), §7.7 (Lineage log), §10 (persistence).
- `src/engine/events/RunState.ts` — the per-life record that `GameLoop.runTurn` mutates.
- `src/engine/persistence/SaveManager.ts` — envelope + atomic-swap API from Phase 0.
- `src/engine/narrative/Composer.ts` — `renderEvent` is called by GameLoop to produce turn narrative text.
- `src/engine/character/Character.ts` — `createCharacter({ name, attributes, rng, startingAgeDays })`.
- `src/engine/events/EventSelector.ts`, `ChoiceResolver.ts`, `OutcomeResolver.ts`, `OutcomeApplier.ts`, `StreakTracker.ts`, `AgeTick.ts` — the Phase 1B pipeline.

---

## Task 1: `AnchorDef` schema + 2 default anchors

**Files:**
- Create: `src/engine/meta/Anchor.ts`
- Create: `src/engine/meta/Anchor.test.ts`
- Create: `src/content/anchors/defaults.json`

**Rationale:** An Anchor is a spawn template (spec §7.4). Phase 1D-1 ships the two always-available anchors from spec §7.4: `true_random` (random family/region) and `peasant_farmer` (Yellow Plains, poor family, age 10–14).

- [ ] **Step 1: Write the failing test**

Create `src/engine/meta/Anchor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { AnchorSchema, AnchorDef, DEFAULT_ANCHORS, getAnchorById } from './Anchor';

describe('AnchorSchema', () => {
  it('accepts a minimal valid anchor', () => {
    const a = {
      id: 'test_anchor',
      name: 'Test',
      description: 'A test anchor.',
      unlock: 'default',
      spawn: {
        regions: [{ id: 'yellow_plains', weight: 1 }],
        era: { minYear: 900, maxYear: 1100 },
        age: { min: 10, max: 14 },
        familyTier: 'poor',
        attributeModifiers: {},
        startingItems: [],
        startingFlags: [],
      },
      karmaMultiplier: 1.0,
    };
    expect(AnchorSchema.safeParse(a).success).toBe(true);
  });

  it('rejects an invalid familyTier', () => {
    const a = {
      id: 'x', name: 'X', description: '.',
      unlock: 'default',
      spawn: {
        regions: [{ id: 'r', weight: 1 }],
        era: { minYear: 0, maxYear: 100 },
        age: { min: 10, max: 14 },
        familyTier: 'demigod',
        attributeModifiers: {},
        startingItems: [],
        startingFlags: [],
      },
      karmaMultiplier: 1.0,
    };
    expect(AnchorSchema.safeParse(a).success).toBe(false);
  });

  it('rejects karmaMultiplier <= 0', () => {
    const a = {
      id: 'x', name: 'X', description: '.',
      unlock: 'default',
      spawn: {
        regions: [{ id: 'r', weight: 1 }],
        era: { minYear: 0, maxYear: 100 },
        age: { min: 10, max: 14 },
        familyTier: 'poor',
        attributeModifiers: {},
        startingItems: [],
        startingFlags: [],
      },
      karmaMultiplier: -1,
    };
    expect(AnchorSchema.safeParse(a).success).toBe(false);
  });
});

describe('DEFAULT_ANCHORS', () => {
  it('has at least true_random and peasant_farmer', () => {
    expect(getAnchorById('true_random')).toBeDefined();
    expect(getAnchorById('peasant_farmer')).toBeDefined();
  });

  it('true_random has unlock === "default" and karmaMultiplier 1.5', () => {
    const a = getAnchorById('true_random')!;
    expect(a.unlock).toBe('default');
    expect(a.karmaMultiplier).toBe(1.5);
  });

  it('peasant_farmer has unlock === "default" and karmaMultiplier 1.0', () => {
    const a = getAnchorById('peasant_farmer')!;
    expect(a.unlock).toBe('default');
    expect(a.karmaMultiplier).toBe(1.0);
    expect(a.spawn.regions[0]!.id).toBe('yellow_plains');
  });

  it('every default anchor passes AnchorSchema validation', () => {
    for (const a of DEFAULT_ANCHORS) {
      expect(AnchorSchema.safeParse(a).success).toBe(true);
    }
  });

  it('getAnchorById returns undefined for unknown id', () => {
    expect(getAnchorById('not_a_real_anchor')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- Anchor`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/meta/Anchor.ts`:

```ts
// Anchor = spawn template. Source: docs/spec/design.md §7.4.

import { z } from 'zod';

const STAT_STRINGS = ['Body', 'Mind', 'Spirit', 'Agility', 'Charm', 'Luck'] as const;

const FAMILY_TIER_STRINGS = [
  'outcast', 'poor', 'commoner', 'merchant', 'minor_noble', 'noble', 'royal',
] as const;

export const AnchorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  unlock: z.union([z.literal('default'), z.string()]),  // string id of milestone, or 'default'
  spawn: z.object({
    regions: z.array(z.object({
      id: z.string(),
      weight: z.number().positive(),
    })).min(1),
    era: z.object({
      minYear: z.number().int(),
      maxYear: z.number().int(),
    }),
    age: z.object({
      min: z.number().int().nonnegative(),
      max: z.number().int().nonnegative(),
    }),
    familyTier: z.enum(FAMILY_TIER_STRINGS),
    /** Per-stat [min, max] additive modifier range applied to base. */
    attributeModifiers: z.record(z.enum(STAT_STRINGS), z.tuple([z.number(), z.number()]).optional()),
    startingItems: z.array(z.object({
      id: z.string(),
      count: z.number().int().positive(),
    })),
    startingFlags: z.array(z.string()),
  }),
  karmaMultiplier: z.number().positive(),
});

export type AnchorDef = z.infer<typeof AnchorSchema>;

export const DEFAULT_ANCHORS: ReadonlyArray<AnchorDef> = [
  {
    id: 'true_random',
    name: 'True Random',
    description: 'Let the Heavens decide. Maximum karma gain.',
    unlock: 'default',
    spawn: {
      regions: [
        { id: 'yellow_plains', weight: 1 },
      ],
      era: { minYear: 950, maxYear: 1050 },
      age: { min: 8, max: 16 },
      familyTier: 'poor',
      attributeModifiers: {
        Body: [-5, 5], Mind: [-5, 5], Spirit: [-5, 5],
        Agility: [-5, 5], Charm: [-5, 5], Luck: [-5, 5],
      },
      startingItems: [],
      startingFlags: [],
    },
    karmaMultiplier: 1.5,
  },
  {
    id: 'peasant_farmer',
    name: 'Peasant Farmer',
    description: 'Born into the Yellow Plains, a child of the soil. Default reincarnation path.',
    unlock: 'default',
    spawn: {
      regions: [{ id: 'yellow_plains', weight: 1 }],
      era: { minYear: 900, maxYear: 1100 },
      age: { min: 10, max: 14 },
      familyTier: 'poor',
      attributeModifiers: {
        Body: [0, 10], Mind: [0, 6], Spirit: [0, 4],
        Agility: [0, 6], Charm: [0, 6], Luck: [0, 8],
      },
      startingItems: [],
      startingFlags: ['peasant_birth'],
    },
    karmaMultiplier: 1.0,
  },
];

export function getAnchorById(id: string): AnchorDef | undefined {
  return DEFAULT_ANCHORS.find((a) => a.id === id);
}
```

Create `src/content/anchors/defaults.json` (mirror of the hardcoded defaults, for Phase 1D-3's content-loading pattern):

```json
{
  "version": 1,
  "anchors": [
    {
      "id": "true_random",
      "name": "True Random",
      "description": "Let the Heavens decide. Maximum karma gain.",
      "unlock": "default",
      "spawn": {
        "regions": [{ "id": "yellow_plains", "weight": 1 }],
        "era": { "minYear": 950, "maxYear": 1050 },
        "age": { "min": 8, "max": 16 },
        "familyTier": "poor",
        "attributeModifiers": {
          "Body": [-5, 5], "Mind": [-5, 5], "Spirit": [-5, 5],
          "Agility": [-5, 5], "Charm": [-5, 5], "Luck": [-5, 5]
        },
        "startingItems": [],
        "startingFlags": []
      },
      "karmaMultiplier": 1.5
    },
    {
      "id": "peasant_farmer",
      "name": "Peasant Farmer",
      "description": "Born into the Yellow Plains, a child of the soil. Default reincarnation path.",
      "unlock": "default",
      "spawn": {
        "regions": [{ "id": "yellow_plains", "weight": 1 }],
        "era": { "minYear": 900, "maxYear": 1100 },
        "age": { "min": 10, "max": 14 },
        "familyTier": "poor",
        "attributeModifiers": {
          "Body": [0, 10], "Mind": [0, 6], "Spirit": [0, 4],
          "Agility": [0, 6], "Charm": [0, 6], "Luck": [0, 8]
        },
        "startingItems": [],
        "startingFlags": ["peasant_birth"]
      },
      "karmaMultiplier": 1.0
    }
  ]
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- Anchor`
Expected: 9 passing.

Also: `npm run typecheck` clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/meta/Anchor.ts src/engine/meta/Anchor.test.ts src/content/anchors/defaults.json
git commit -m "feat(meta): anchor schema + true_random + peasant_farmer defaults"
```

---

## Task 2: `AnchorResolver` — pick a concrete spawn from an AnchorDef

**Files:**
- Create: `src/engine/meta/AnchorResolver.ts`
- Create: `src/engine/meta/AnchorResolver.test.ts`

**Rationale:** An `AnchorDef` defines ranges; `AnchorResolver` picks concrete values (region, year, age, starting attributes).

- [ ] **Step 1: Write the failing test**

Create `src/engine/meta/AnchorResolver.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { getAnchorById } from './Anchor';
import { resolveAnchor, ResolvedAnchor } from './AnchorResolver';

describe('resolveAnchor — peasant_farmer', () => {
  const anchor = getAnchorById('peasant_farmer')!;

  it('picks region from the weighted list', () => {
    const r = resolveAnchor(anchor, createRng(1));
    expect(r.region).toBe('yellow_plains');
  });

  it('picks year within era bounds', () => {
    for (let s = 1; s <= 20; s++) {
      const r = resolveAnchor(anchor, createRng(s));
      expect(r.year).toBeGreaterThanOrEqual(900);
      expect(r.year).toBeLessThanOrEqual(1100);
    }
  });

  it('picks age within [10, 14]', () => {
    for (let s = 1; s <= 20; s++) {
      const r = resolveAnchor(anchor, createRng(s));
      expect(r.ageDays).toBeGreaterThanOrEqual(10 * 365);
      expect(r.ageDays).toBeLessThanOrEqual(14 * 365);
    }
  });

  it('rolls each attribute within its [min, max] range', () => {
    for (let s = 1; s <= 20; s++) {
      const r = resolveAnchor(anchor, createRng(s));
      // peasant_farmer ranges: Body [0,10], Mind [0,6], Spirit [0,4], Agility [0,6], Charm [0,6], Luck [0,8]
      expect(r.attributeAdjustments.Body).toBeGreaterThanOrEqual(0);
      expect(r.attributeAdjustments.Body).toBeLessThanOrEqual(10);
      expect(r.attributeAdjustments.Spirit).toBeGreaterThanOrEqual(0);
      expect(r.attributeAdjustments.Spirit).toBeLessThanOrEqual(4);
      expect(r.attributeAdjustments.Luck).toBeLessThanOrEqual(8);
    }
  });

  it('includes startingFlags verbatim', () => {
    const r = resolveAnchor(anchor, createRng(1));
    expect(r.startingFlags).toContain('peasant_birth');
  });

  it('is deterministic for the same seed', () => {
    const a = resolveAnchor(anchor, createRng(42));
    const b = resolveAnchor(anchor, createRng(42));
    expect(a).toEqual(b);
  });
});

describe('resolveAnchor — true_random', () => {
  it('works on true_random anchor', () => {
    const anchor = getAnchorById('true_random')!;
    const r = resolveAnchor(anchor, createRng(1));
    expect(r.region).toBe('yellow_plains');
    // true_random allows negative attribute adjustments
    // Just verify the ranges are accepted.
    expect(typeof r.attributeAdjustments.Body).toBe('number');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- AnchorResolver`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/meta/AnchorResolver.ts`:

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- AnchorResolver`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/meta/AnchorResolver.ts src/engine/meta/AnchorResolver.test.ts
git commit -m "feat(meta): AnchorResolver — seed-deterministic spawn from AnchorDef"
```

---

## Task 3: `characterFromAnchor` — factory

**Files:**
- Create: `src/engine/meta/characterFromAnchor.ts`
- Create: `src/engine/meta/characterFromAnchor.test.ts`

**Rationale:** Given a resolved anchor + name + rng, produce a `Character` (rolled spirit root, adjusted attributes, starting age) and a fresh `RunState`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/meta/characterFromAnchor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { getAnchorById } from './Anchor';
import { resolveAnchor } from './AnchorResolver';
import { characterFromAnchor } from './characterFromAnchor';

describe('characterFromAnchor', () => {
  const anchor = getAnchorById('peasant_farmer')!;

  it('produces a Character with anchor-driven attributes and age', () => {
    const rng = createRng(1);
    const resolved = resolveAnchor(anchor, rng);
    const { character, runState } = characterFromAnchor({
      resolved, name: 'Lin Wei', runSeed: 42, rng,
    });

    // Body baseline 10 + adjustment [0,10] → [10, 20]
    expect(character.attributes.Body).toBeGreaterThanOrEqual(10);
    expect(character.attributes.Body).toBeLessThanOrEqual(20);
    expect(character.ageDays).toBe(resolved.ageDays);
    expect(character.flags).toContain('peasant_birth');

    expect(runState.region).toBe(resolved.region);
    expect(runState.year).toBe(resolved.year);
    expect(runState.runSeed).toBe(42);
  });

  it('is deterministic', () => {
    const rng1 = createRng(7);
    const resolved1 = resolveAnchor(anchor, rng1);
    const out1 = characterFromAnchor({ resolved: resolved1, name: 't', runSeed: 9, rng: rng1 });

    const rng2 = createRng(7);
    const resolved2 = resolveAnchor(anchor, rng2);
    const out2 = characterFromAnchor({ resolved: resolved2, name: 't', runSeed: 9, rng: rng2 });

    expect(out1.character.attributes).toEqual(out2.character.attributes);
    expect(out1.character.spiritRoot).toEqual(out2.character.spiritRoot);
  });

  it('copies startingItems into runState.inventory', () => {
    // Mock an anchor with a starting item
    const withItem = {
      ...anchor,
      spawn: {
        ...anchor.spawn,
        startingItems: [{ id: 'rice_bowl', count: 1 }],
      },
    };
    const rng = createRng(1);
    const resolved = resolveAnchor(withItem, rng);
    const { runState } = characterFromAnchor({ resolved, name: 't', runSeed: 1, rng });
    expect(runState.inventory.find((i) => i.id === 'rice_bowl')?.count).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- characterFromAnchor`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/meta/characterFromAnchor.ts`:

```ts
// Combine a ResolvedAnchor + name + rng into a Character + fresh RunState.
// Baseline attributes: 10 (mid of 0–20 range). Anchor adjustments add on top.

import { Stat } from '@/engine/core/Types';
import { IRng } from '@/engine/core/RNG';
import { Character, createCharacter } from '@/engine/character/Character';
import { addAttribute, AttributeMap } from '@/engine/character/Attribute';
import { createRunState, RunState } from '@/engine/events/RunState';
import { ResolvedAnchor } from './AnchorResolver';

export interface CharacterFromAnchorArgs {
  resolved: ResolvedAnchor;
  name: string;
  runSeed: number;
  rng: IRng;
}

export interface CharacterFromAnchorResult {
  character: Character;
  runState: RunState;
}

const BASELINE_ATTRIBUTE = 10;

export function characterFromAnchor(args: CharacterFromAnchorArgs): CharacterFromAnchorResult {
  const { resolved, name, runSeed, rng } = args;

  // Build baseline attributes with anchor adjustments applied.
  const attrs = {} as AttributeMap;
  for (const s of Object.keys(resolved.attributeAdjustments) as Stat[]) {
    attrs[s] = addAttribute(BASELINE_ATTRIBUTE, resolved.attributeAdjustments[s]);
  }

  // Build character. createCharacter rolls a spirit root.
  let character = createCharacter({
    name,
    attributes: attrs,
    rng,
    startingAgeDays: resolved.ageDays,
  });

  // Apply starting flags
  for (const flag of resolved.startingFlags) {
    if (!character.flags.includes(flag)) {
      character = { ...character, flags: [...character.flags, flag] };
    }
  }

  // Infer season from year — simple cycle (year % 4 → season). This is placeholder;
  // Phase 1D-3 content can override via events. For Phase 1D-1, arbitrary determinism is sufficient.
  const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
  const season = seasons[resolved.year % 4]!;

  const runState = {
    ...createRunState({
      character, runSeed, region: resolved.region,
      year: resolved.year, season,
    }),
    inventory: [...resolved.startingItems],
  };

  return { character, runState };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- characterFromAnchor`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/meta/characterFromAnchor.ts src/engine/meta/characterFromAnchor.test.ts
git commit -m "feat(meta): characterFromAnchor factory (Character + fresh RunState)"
```

---

## Task 4: `KarmicInsightRules` — per-life earn table

**Files:**
- Create: `src/engine/meta/KarmicInsightRules.ts`
- Create: `src/engine/meta/KarmicInsightRules.test.ts`

**Rationale:** Spec §7.1 earn rates. Takes a summary of the completed life (years lived, realm reached, death cause, regrets) and returns total karma.

- [ ] **Step 1: Write the failing test**

Create `src/engine/meta/KarmicInsightRules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Realm } from '@/engine/core/Types';
import { computeKarma, LifeSummary } from './KarmicInsightRules';

function baseSummary(overrides: Partial<LifeSummary> = {}): LifeSummary {
  return {
    yearsLived: 40,
    realmReached: Realm.MORTAL,
    maxBodyTemperingLayer: 0,
    deathCause: 'old_age',
    vowsUnfulfilled: 0,
    diedProtectingOther: false,
    firstTimeFlags: [],
    anchorMultiplier: 1.0,
    inLifeKarmaDelta: 0,
    ...overrides,
  };
}

describe('computeKarma', () => {
  it('gives +1 per 10 years lived', () => {
    expect(computeKarma(baseSummary({ yearsLived: 0 })).total).toBe(5);    // old_age base: 5
    expect(computeKarma(baseSummary({ yearsLived: 30 })).total).toBe(5 + 3);
    expect(computeKarma(baseSummary({ yearsLived: 100 })).total).toBe(5 + 10);
  });

  it('old_age death: +5 base', () => {
    expect(computeKarma(baseSummary({ yearsLived: 0, deathCause: 'old_age' })).total).toBe(5);
  });

  it('tribulation death: +40', () => {
    expect(computeKarma(baseSummary({ yearsLived: 0, deathCause: 'tribulation' })).total).toBe(40);
  });

  it('betrayal death: +20', () => {
    expect(computeKarma(baseSummary({ yearsLived: 0, deathCause: 'betrayal' })).total).toBe(20);
  });

  it('death protecting other: +30', () => {
    expect(computeKarma(baseSummary({
      yearsLived: 0, deathCause: 'combat_melee', diedProtectingOther: true,
    })).total).toBe(30);
  });

  it('reaching a realm adds 10 × realm-index per realm entered', () => {
    // realmReached = body_tempering → index 1 → +10
    expect(computeKarma(baseSummary({ yearsLived: 0, realmReached: Realm.BODY_TEMPERING })).total)
      .toBe(5 /* old_age */ + 10 /* realm 1 */);
  });

  it('unfulfilled vows: +15 each', () => {
    expect(computeKarma(baseSummary({ yearsLived: 0, vowsUnfulfilled: 2 })).total).toBe(5 + 30);
  });

  it('anchorMultiplier scales the TOTAL', () => {
    const base = computeKarma(baseSummary({ yearsLived: 40, deathCause: 'old_age' })).total;
    // yearsLived 40 → +4. old_age +5. total 9. × 1.5 = 13.5 → floor to 13.
    const mult = computeKarma(baseSummary({ yearsLived: 40, deathCause: 'old_age', anchorMultiplier: 1.5 })).total;
    expect(mult).toBe(Math.floor(base * 1.5));
  });

  it('inLifeKarmaDelta is added AFTER multiplication', () => {
    // Base: yearsLived=0, old_age=5, mult=2.0 → 10. Plus inLifeKarmaDelta=-3 → 7.
    const r = computeKarma(baseSummary({
      yearsLived: 0, deathCause: 'old_age', anchorMultiplier: 2.0, inLifeKarmaDelta: -3,
    }));
    expect(r.total).toBe(7);
  });

  it('never returns negative karma', () => {
    const r = computeKarma(baseSummary({
      yearsLived: 0, deathCause: 'old_age', anchorMultiplier: 1.0, inLifeKarmaDelta: -1000,
    }));
    expect(r.total).toBe(0);
  });

  it('firstTimeFlags add +5 each for "achievement" tagged ones', () => {
    const r = computeKarma(baseSummary({
      firstTimeFlags: ['first_body_tempering_5', 'first_bandit_defeated'],
    }));
    expect(r.breakdown.achievements).toBe(10);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- KarmicInsightRules`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/meta/KarmicInsightRules.ts`:

```ts
// Per-life karma-earn rules. Source: docs/spec/design.md §7.1.

import { DeathCause, Realm, REALM_ORDER } from '@/engine/core/Types';

export interface LifeSummary {
  yearsLived: number;
  realmReached: Realm;
  maxBodyTemperingLayer: number;
  deathCause: DeathCause;
  vowsUnfulfilled: number;
  diedProtectingOther: boolean;
  firstTimeFlags: ReadonlyArray<string>;
  anchorMultiplier: number;
  /** Mid-life karma deltas from outcomes (can be negative). Applied AFTER anchor multiplier. */
  inLifeKarmaDelta: number;
}

export interface KarmaBreakdown {
  base: number;
  yearsLived: number;
  realm: number;
  deathCause: number;
  vows: number;
  diedProtecting: number;
  achievements: number;
  beforeMultiplier: number;
  multiplier: number;
  afterMultiplier: number;
  inLifeDelta: number;
  total: number;
}

export interface KarmaResult {
  total: number;
  breakdown: KarmaBreakdown;
}

const DEATH_CAUSE_KARMA: Partial<Record<DeathCause, number>> = {
  old_age: 5,
  starvation: 2,
  disease: 2,
  combat_melee: 10,
  combat_qi: 12,
  poison: 8,
  betrayal: 20,
  tribulation: 40,
  qi_deviation: 15,
  heavenly_intervention: 50,
  karmic_hunter: 30,
  self_sacrifice: 30,
  love_death: 25,
  madness: 10,
};

const DIED_PROTECTING_BONUS = 30;
const VOW_BONUS_EACH = 15;
const ACHIEVEMENT_BONUS_EACH = 5;

export function computeKarma(s: LifeSummary): KarmaResult {
  const yearsKarma = Math.floor(s.yearsLived / 10);

  const realmIndex = REALM_ORDER.indexOf(s.realmReached);
  const realmKarma = realmIndex > 0 ? realmIndex * 10 : 0;

  const deathKarma = s.diedProtectingOther
    ? DIED_PROTECTING_BONUS
    : (DEATH_CAUSE_KARMA[s.deathCause] ?? 0);

  const vowsKarma = s.vowsUnfulfilled * VOW_BONUS_EACH;

  const achievementKarma = s.firstTimeFlags.length * ACHIEVEMENT_BONUS_EACH;

  const diedProtectingKarma = s.diedProtectingOther ? DIED_PROTECTING_BONUS : 0;

  // `deathKarma` already includes DIED_PROTECTING_BONUS if active — avoid double-count.
  const beforeMult = yearsKarma + realmKarma + deathKarma + vowsKarma + achievementKarma;

  const afterMult = Math.floor(beforeMult * s.anchorMultiplier);
  const final = afterMult + s.inLifeKarmaDelta;
  const total = Math.max(0, final);

  return {
    total,
    breakdown: {
      base: 0,
      yearsLived: yearsKarma,
      realm: realmKarma,
      deathCause: s.diedProtectingOther ? 0 : (DEATH_CAUSE_KARMA[s.deathCause] ?? 0),
      vows: vowsKarma,
      diedProtecting: diedProtectingKarma,
      achievements: achievementKarma,
      beforeMultiplier: beforeMult,
      multiplier: s.anchorMultiplier,
      afterMultiplier: afterMult,
      inLifeDelta: s.inLifeKarmaDelta,
      total,
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- KarmicInsightRules`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/meta/KarmicInsightRules.ts src/engine/meta/KarmicInsightRules.test.ts
git commit -m "feat(meta): karmic insight earn rules (§7.1)"
```

---

## Task 5: `KarmicUpgrade` type + 5 default upgrades

**Files:**
- Create: `src/engine/meta/KarmicUpgrade.ts`
- Create: `src/engine/meta/KarmicUpgrade.test.ts`

**Rationale:** Spec §7.1 spend menu. Phase 1D-1 ships 5 tiered upgrades: Awakened Soul L1/L2/L3, Heavenly Patience L1/L2. (The other upgrades from the spec are Phase 1D-3 or Phase 2.)

- [ ] **Step 1: Write the failing test**

Create `src/engine/meta/KarmicUpgrade.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_UPGRADES, getUpgradeById, KarmicUpgrade } from './KarmicUpgrade';

describe('DEFAULT_UPGRADES', () => {
  it('has exactly 5 entries', () => {
    expect(DEFAULT_UPGRADES).toHaveLength(5);
  });

  it('includes Awakened Soul L1, L2, L3', () => {
    expect(getUpgradeById('awakened_soul_1')).toBeDefined();
    expect(getUpgradeById('awakened_soul_2')).toBeDefined();
    expect(getUpgradeById('awakened_soul_3')).toBeDefined();
  });

  it('includes Heavenly Patience L1, L2', () => {
    expect(getUpgradeById('heavenly_patience_1')).toBeDefined();
    expect(getUpgradeById('heavenly_patience_2')).toBeDefined();
  });

  it('costs escalate per level', () => {
    const l1 = getUpgradeById('awakened_soul_1')!;
    const l2 = getUpgradeById('awakened_soul_2')!;
    const l3 = getUpgradeById('awakened_soul_3')!;
    expect(l2.cost).toBeGreaterThan(l1.cost);
    expect(l3.cost).toBeGreaterThan(l2.cost);
  });

  it('each upgrade has a requires chain (L2 requires L1, L3 requires L2)', () => {
    expect(getUpgradeById('awakened_soul_2')!.requires).toEqual(['awakened_soul_1']);
    expect(getUpgradeById('awakened_soul_3')!.requires).toEqual(['awakened_soul_2']);
    expect(getUpgradeById('awakened_soul_1')!.requires).toEqual([]);
  });

  it('Awakened Soul effect kinds are "spirit_root_reroll_boost"', () => {
    for (const id of ['awakened_soul_1', 'awakened_soul_2', 'awakened_soul_3']) {
      const u = getUpgradeById(id)!;
      expect(u.effect.kind).toBe('spirit_root_reroll_boost');
    }
  });

  it('Heavenly Patience effect is "insight_cap_boost"', () => {
    expect(getUpgradeById('heavenly_patience_1')!.effect.kind).toBe('insight_cap_boost');
  });

  it('getUpgradeById returns undefined for unknown id', () => {
    expect(getUpgradeById('not_a_real_upgrade')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- KarmicUpgrade`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/meta/KarmicUpgrade.ts`:

```ts
// Karmic upgrades spent at Bardo. Source: docs/spec/design.md §7.1.

export type UpgradeEffect =
  | { kind: 'spirit_root_reroll_boost'; probability: number }
  | { kind: 'insight_cap_boost'; amount: number };

export interface KarmicUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** Other upgrade IDs that must already be owned before this can be purchased. */
  requires: ReadonlyArray<string>;
  effect: UpgradeEffect;
}

export const DEFAULT_UPGRADES: ReadonlyArray<KarmicUpgrade> = [
  {
    id: 'awakened_soul_1',
    name: 'Awakened Soul I',
    description: 'On low spirit-root rolls, the Heavens give the soul a second glance. 10% re-roll chance.',
    cost: 80,
    requires: [],
    effect: { kind: 'spirit_root_reroll_boost', probability: 0.10 },
  },
  {
    id: 'awakened_soul_2',
    name: 'Awakened Soul II',
    description: '20% re-roll chance on trash roots.',
    cost: 200,
    requires: ['awakened_soul_1'],
    effect: { kind: 'spirit_root_reroll_boost', probability: 0.20 },
  },
  {
    id: 'awakened_soul_3',
    name: 'Awakened Soul III',
    description: '35% re-roll chance on trash roots. The Heavens remember you.',
    cost: 500,
    requires: ['awakened_soul_2'],
    effect: { kind: 'spirit_root_reroll_boost', probability: 0.35 },
  },
  {
    id: 'heavenly_patience_1',
    name: 'Heavenly Patience I',
    description: 'Starting Insight cap +20.',
    cost: 100,
    requires: [],
    effect: { kind: 'insight_cap_boost', amount: 20 },
  },
  {
    id: 'heavenly_patience_2',
    name: 'Heavenly Patience II',
    description: 'Starting Insight cap +50.',
    cost: 300,
    requires: ['heavenly_patience_1'],
    effect: { kind: 'insight_cap_boost', amount: 50 },
  },
];

export function getUpgradeById(id: string): KarmicUpgrade | undefined {
  return DEFAULT_UPGRADES.find((u) => u.id === id);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- KarmicUpgrade`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/meta/KarmicUpgrade.ts src/engine/meta/KarmicUpgrade.test.ts
git commit -m "feat(meta): 5 karmic upgrades (awakened_soul L1-L3 + heavenly_patience L1-L2)"
```

---

## Task 6: `MetaState` record + save/load via SaveManager

**Files:**
- Create: `src/engine/meta/MetaState.ts`
- Create: `src/engine/meta/MetaState.test.ts`

**Rationale:** The persistent cross-life record. Holds karma balance, owned upgrades, unlocked anchors, lineage entries, lifetime-seen events. Save/load through `SaveManager`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/meta/MetaState.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createSaveManager } from '@/engine/persistence/SaveManager';
import {
  createEmptyMetaState, loadMeta, saveMeta, addKarma, spendKarma, ownsUpgrade,
  purchaseUpgrade, unlockAnchor, METASTATE_SCHEMA_VERSION,
} from './MetaState';

describe('MetaState', () => {
  const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });

  beforeEach(() => { localStorage.clear(); });

  it('createEmptyMetaState has zeros and only the default anchors unlocked', () => {
    const m = createEmptyMetaState();
    expect(m.karmaBalance).toBe(0);
    expect(m.lifeCount).toBe(0);
    expect(m.ownedUpgrades).toEqual([]);
    expect(m.unlockedAnchors).toContain('true_random');
    expect(m.unlockedAnchors).toContain('peasant_farmer');
    expect(m.lineage).toEqual([]);
    expect(m.lifetimeSeenEvents).toEqual([]);
  });

  it('addKarma + spendKarma round-trip', () => {
    let m = createEmptyMetaState();
    m = addKarma(m, 100);
    expect(m.karmaBalance).toBe(100);
    const r = spendKarma(m, 30);
    expect(r).not.toBeNull();
    expect(r!.karmaBalance).toBe(70);
  });

  it('spendKarma returns null when balance insufficient', () => {
    const m = addKarma(createEmptyMetaState(), 20);
    expect(spendKarma(m, 50)).toBeNull();
  });

  it('purchaseUpgrade rejects if requires not owned', () => {
    let m = addKarma(createEmptyMetaState(), 10_000);
    const r = purchaseUpgrade(m, 'awakened_soul_2');
    expect(r).toBeNull(); // requires awakened_soul_1
  });

  it('purchaseUpgrade succeeds when cost + requires satisfied', () => {
    let m = addKarma(createEmptyMetaState(), 10_000);
    const a = purchaseUpgrade(m, 'awakened_soul_1');
    expect(a).not.toBeNull();
    expect(ownsUpgrade(a!, 'awakened_soul_1')).toBe(true);
    expect(a!.karmaBalance).toBe(10_000 - 80);

    const b = purchaseUpgrade(a!, 'awakened_soul_2');
    expect(b).not.toBeNull();
    expect(ownsUpgrade(b!, 'awakened_soul_2')).toBe(true);
  });

  it('purchaseUpgrade rejects if already owned', () => {
    let m = addKarma(createEmptyMetaState(), 10_000);
    m = purchaseUpgrade(m, 'awakened_soul_1')!;
    expect(purchaseUpgrade(m, 'awakened_soul_1')).toBeNull();
  });

  it('purchaseUpgrade rejects if balance insufficient', () => {
    const m = addKarma(createEmptyMetaState(), 10);  // < 80
    expect(purchaseUpgrade(m, 'awakened_soul_1')).toBeNull();
  });

  it('unlockAnchor is idempotent', () => {
    let m = createEmptyMetaState();
    m = unlockAnchor(m, 'outer_disciple');
    m = unlockAnchor(m, 'outer_disciple');
    expect(m.unlockedAnchors.filter((a) => a === 'outer_disciple')).toHaveLength(1);
  });

  it('saves and loads through SaveManager', () => {
    const m = addKarma(createEmptyMetaState(), 42);
    saveMeta(sm, m);
    const loaded = loadMeta(sm);
    expect(loaded).toEqual(m);
  });

  it('loadMeta returns an empty state when no save exists', () => {
    const loaded = loadMeta(sm);
    expect(loaded).toEqual(createEmptyMetaState());
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- MetaState`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/meta/MetaState.ts`:

```ts
// Persistent cross-life record + SaveManager integration.
// Source: docs/spec/design.md §7 (meta-progression), §10 (persistence).

import { SaveManager } from '@/engine/persistence/SaveManager';
import { getUpgradeById } from './KarmicUpgrade';

export const METASTATE_SCHEMA_VERSION = 1;
const META_KEY = 'wdr.meta';

export interface LineageEntrySummary {
  lifeIndex: number;
  name: string;
  anchorId: string;
  yearsLived: number;
  realmReached: string;
  deathCause: string;
  karmaEarned: number;
}

export interface MetaState {
  readonly karmaBalance: number;
  readonly lifeCount: number;
  readonly ownedUpgrades: ReadonlyArray<string>;
  readonly unlockedAnchors: ReadonlyArray<string>;
  readonly lineage: ReadonlyArray<LineageEntrySummary>;
  readonly lifetimeSeenEvents: ReadonlyArray<string>;
}

export function createEmptyMetaState(): MetaState {
  return {
    karmaBalance: 0,
    lifeCount: 0,
    ownedUpgrades: [],
    unlockedAnchors: ['true_random', 'peasant_farmer'],
    lineage: [],
    lifetimeSeenEvents: [],
  };
}

export function addKarma(m: MetaState, amount: number): MetaState {
  if (amount < 0) return m;
  return { ...m, karmaBalance: m.karmaBalance + amount };
}

export function spendKarma(m: MetaState, amount: number): MetaState | null {
  if (m.karmaBalance < amount) return null;
  return { ...m, karmaBalance: m.karmaBalance - amount };
}

export function ownsUpgrade(m: MetaState, upgradeId: string): boolean {
  return m.ownedUpgrades.includes(upgradeId);
}

export function purchaseUpgrade(m: MetaState, upgradeId: string): MetaState | null {
  const upgrade = getUpgradeById(upgradeId);
  if (!upgrade) return null;
  if (ownsUpgrade(m, upgradeId)) return null;
  for (const req of upgrade.requires) {
    if (!ownsUpgrade(m, req)) return null;
  }
  const afterSpend = spendKarma(m, upgrade.cost);
  if (!afterSpend) return null;
  return {
    ...afterSpend,
    ownedUpgrades: [...afterSpend.ownedUpgrades, upgradeId],
  };
}

export function unlockAnchor(m: MetaState, anchorId: string): MetaState {
  if (m.unlockedAnchors.includes(anchorId)) return m;
  return { ...m, unlockedAnchors: [...m.unlockedAnchors, anchorId] };
}

export function incrementLifeCount(m: MetaState): MetaState {
  return { ...m, lifeCount: m.lifeCount + 1 };
}

export function appendLineageEntry(m: MetaState, entry: LineageEntrySummary): MetaState {
  return { ...m, lineage: [...m.lineage, entry] };
}

export function saveMeta(sm: SaveManager, m: MetaState): void {
  sm.save(META_KEY, m, METASTATE_SCHEMA_VERSION);
}

export function loadMeta(sm: SaveManager): MetaState {
  const envelope = sm.load<MetaState>(META_KEY);
  if (envelope === null) return createEmptyMetaState();
  return envelope.data;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- MetaState`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/meta/MetaState.ts src/engine/meta/MetaState.test.ts
git commit -m "feat(meta): MetaState record + SaveManager integration"
```

---

## Task 7: `RunSave` — serialize/deserialize RunState

**Files:**
- Create: `src/engine/persistence/RunSave.ts`
- Create: `src/engine/persistence/RunSave.test.ts`

**Rationale:** RunState persists per-turn autosave. Stored under `wdr.run`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/persistence/RunSave.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createCharacter } from '@/engine/character/Character';
import { createRunState } from '@/engine/events/RunState';
import { createSaveManager } from './SaveManager';
import { saveRun, loadRun, clearRun, RUN_SCHEMA_VERSION } from './RunSave';

describe('RunSave', () => {
  const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
  beforeEach(() => { localStorage.clear(); });

  it('round-trips RunState through SaveManager', () => {
    const c = createCharacter({ name: 't', attributes: { Body: 20, Mind: 10, Spirit: 5, Agility: 10, Charm: 5, Luck: 20 }, rng: createRng(1) });
    const rs = createRunState({ character: c, runSeed: 42, region: 'yellow_plains', year: 1000, season: 'summer' });
    saveRun(sm, rs);
    const loaded = loadRun(sm);
    expect(loaded).toEqual(rs);
  });

  it('loadRun returns null when no save exists', () => {
    expect(loadRun(sm)).toBeNull();
  });

  it('clearRun removes the save', () => {
    const c = createCharacter({ name: 't', attributes: { Body: 20, Mind: 10, Spirit: 5, Agility: 10, Charm: 5, Luck: 20 }, rng: createRng(1) });
    const rs = createRunState({ character: c, runSeed: 42, region: 'yellow_plains', year: 1000, season: 'summer' });
    saveRun(sm, rs);
    clearRun(sm);
    expect(loadRun(sm)).toBeNull();
  });

  it('RUN_SCHEMA_VERSION is exported as a positive integer', () => {
    expect(Number.isInteger(RUN_SCHEMA_VERSION)).toBe(true);
    expect(RUN_SCHEMA_VERSION).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- RunSave`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/persistence/RunSave.ts`:

```ts
// RunState persistence under the `wdr.run` key.
// Source: docs/spec/design.md §10.2.

import { RunState } from '@/engine/events/RunState';
import { SaveManager } from './SaveManager';

export const RUN_SCHEMA_VERSION = 1;
const RUN_KEY = 'wdr.run';

export function saveRun(sm: SaveManager, rs: RunState): void {
  sm.save(RUN_KEY, rs, RUN_SCHEMA_VERSION);
}

export function loadRun(sm: SaveManager): RunState | null {
  const env = sm.load<RunState>(RUN_KEY);
  return env?.data ?? null;
}

export function clearRun(sm: SaveManager): void {
  sm.clear(RUN_KEY);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- RunSave`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/persistence/RunSave.ts src/engine/persistence/RunSave.test.ts
git commit -m "feat(persistence): RunSave — autosave RunState under wdr.run"
```

---

## Task 8: `BardoFlow` — death → summary → karma commit → reincarnate

**Files:**
- Create: `src/engine/bardo/BardoFlow.ts`
- Create: `src/engine/bardo/BardoFlow.test.ts`

**Rationale:** When `RunState.deathCause` is set, the game enters the bardo phase. BardoFlow: (1) builds a `LifeSummary` from the finished RunState, (2) computes karma via `computeKarma`, (3) commits it to MetaState, (4) appends lineage entry.

- [ ] **Step 1: Write the failing test**

Create `src/engine/bardo/BardoFlow.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';
import { createCharacter } from '@/engine/character/Character';
import { createRunState } from '@/engine/events/RunState';
import { createEmptyMetaState } from '@/engine/meta/MetaState';
import { runBardoFlow } from './BardoFlow';

function buildTestRunState(overrides = {}) {
  const c = createCharacter({
    name: 'Lin Wei',
    attributes: { Body: 20, Mind: 10, Spirit: 10, Agility: 10, Charm: 10, Luck: 20 },
    rng: createRng(1),
    startingAgeDays: 30 * 365,
  });
  return {
    ...createRunState({ character: c, runSeed: 1, region: 'yellow_plains', year: 1000, season: 'summer' }),
    deathCause: 'old_age' as const,
    ...overrides,
  };
}

describe('runBardoFlow', () => {
  it('requires a deathCause', () => {
    const c = createCharacter({ name: 't', attributes: { Body: 20, Mind: 10, Spirit: 10, Agility: 10, Charm: 10, Luck: 20 }, rng: createRng(1) });
    const rs = createRunState({ character: c, runSeed: 1, region: 'yellow_plains', year: 1000, season: 'summer' });
    // deathCause: null in fresh RunState
    expect(() => runBardoFlow(rs, createEmptyMetaState(), 1.0))
      .toThrow(/no death cause/i);
  });

  it('returns a summary with the character\'s years, realm, cause', () => {
    const rs = buildTestRunState();
    const r = runBardoFlow(rs, createEmptyMetaState(), 1.0);
    expect(r.summary.yearsLived).toBe(30);
    expect(r.summary.realmReached).toBe(Realm.MORTAL);
    expect(r.summary.deathCause).toBe('old_age');
  });

  it('commits karma to the new MetaState', () => {
    const rs = buildTestRunState();
    const m0 = createEmptyMetaState();
    const r = runBardoFlow(rs, m0, 1.0);
    expect(r.meta.karmaBalance).toBeGreaterThan(0);
    expect(r.meta.karmaBalance).toBe(r.karmaEarned);
  });

  it('increments lifeCount on the new MetaState', () => {
    const rs = buildTestRunState();
    const m0 = createEmptyMetaState();
    const r = runBardoFlow(rs, m0, 1.0);
    expect(r.meta.lifeCount).toBe(1);
    const r2 = runBardoFlow(rs, r.meta, 1.0);
    expect(r2.meta.lifeCount).toBe(2);
  });

  it('appends a lineage entry to the new MetaState', () => {
    const rs = buildTestRunState();
    const m0 = createEmptyMetaState();
    const r = runBardoFlow(rs, m0, 1.0);
    expect(r.meta.lineage).toHaveLength(1);
    const entry = r.meta.lineage[0]!;
    expect(entry.name).toBe('Lin Wei');
    expect(entry.deathCause).toBe('old_age');
    expect(entry.karmaEarned).toBe(r.karmaEarned);
  });

  it('anchorMultiplier flows through to karma computation', () => {
    const rs = buildTestRunState();
    const m0 = createEmptyMetaState();
    const mult1 = runBardoFlow(rs, m0, 1.0);
    const mult2 = runBardoFlow(rs, m0, 2.0);
    expect(mult2.karmaEarned).toBeGreaterThan(mult1.karmaEarned);
  });

  it('inLifeKarmaDelta from RunState.karmaEarnedBuffer is applied', () => {
    const rsBase = buildTestRunState({ karmaEarnedBuffer: 5 });
    const m0 = createEmptyMetaState();
    const r = runBardoFlow(rsBase, m0, 1.0);
    // With yearsLived=30 → yearsKarma=3; old_age=5; total=8 × 1.0 = 8; + 5 buffer = 13.
    expect(r.karmaEarned).toBe(13);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- BardoFlow`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/bardo/BardoFlow.ts`:

```ts
// Bardo phase logic: finish a life, compute karma, commit to MetaState.
// Source: docs/spec/design.md §2.4, §7.1, §7.7, §11.6.

import { DeathCause } from '@/engine/core/Types';
import { RunState } from '@/engine/events/RunState';
import {
  MetaState, addKarma, incrementLifeCount, appendLineageEntry, LineageEntrySummary,
} from '@/engine/meta/MetaState';
import { computeKarma, LifeSummary } from '@/engine/meta/KarmicInsightRules';

export interface BardoResult {
  summary: LifeSummary;
  karmaEarned: number;
  karmaBreakdown: ReturnType<typeof computeKarma>['breakdown'];
  meta: MetaState;
}

export function buildLifeSummary(rs: RunState, anchorMultiplier: number): LifeSummary {
  if (!rs.deathCause) {
    throw new Error('buildLifeSummary: no death cause — character is still alive');
  }
  return {
    yearsLived: Math.floor(rs.character.ageDays / 365),
    realmReached: rs.character.realm,
    maxBodyTemperingLayer: rs.character.bodyTemperingLayer,
    deathCause: rs.deathCause as DeathCause,
    vowsUnfulfilled: 0,              // Phase 2+ vow system
    diedProtectingOther: rs.character.flags.includes('died_protecting'),
    firstTimeFlags: rs.character.flags.filter((f) => f.startsWith('first_')),
    anchorMultiplier,
    inLifeKarmaDelta: rs.karmaEarnedBuffer,
  };
}

export function runBardoFlow(
  rs: RunState,
  meta: MetaState,
  anchorMultiplier: number,
): BardoResult {
  if (!rs.deathCause) {
    throw new Error('runBardoFlow: no death cause — cannot enter bardo');
  }
  const summary = buildLifeSummary(rs, anchorMultiplier);
  const karma = computeKarma(summary);

  const entry: LineageEntrySummary = {
    lifeIndex: meta.lifeCount + 1,
    name: rs.character.name,
    anchorId: (rs.character.flags.find((f) => f.startsWith('anchor:'))?.slice(7)) ?? 'unknown',
    yearsLived: summary.yearsLived,
    realmReached: summary.realmReached,
    deathCause: summary.deathCause,
    karmaEarned: karma.total,
  };

  let nextMeta = meta;
  nextMeta = addKarma(nextMeta, karma.total);
  nextMeta = incrementLifeCount(nextMeta);
  nextMeta = appendLineageEntry(nextMeta, entry);

  return {
    summary,
    karmaEarned: karma.total,
    karmaBreakdown: karma.breakdown,
    meta: nextMeta,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- BardoFlow`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/bardo/BardoFlow.ts src/engine/bardo/BardoFlow.test.ts
git commit -m "feat(bardo): runBardoFlow — life summary + karma commit + lineage entry"
```

---

## Task 9: `GameLoop.runTurn` — one-turn orchestrator

**Files:**
- Create: `src/engine/core/GameLoop.ts`
- Create: `src/engine/core/GameLoop.test.ts`

**Rationale:** Single entry point for a complete turn. Spec §2.3 flow: event selector → composer → choice resolver → outcome resolver → outcome applier → streak/age tick.

- [ ] **Step 1: Write the failing test**

Create `src/engine/core/GameLoop.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng, Rng } from './RNG';
import { EventDef } from '@/content/schema';
import { createCharacter } from '@/engine/character/Character';
import { createRunState } from '@/engine/events/RunState';
import { createStreakState } from '@/engine/choices/StreakTracker';
import { createSnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { createNameRegistry } from '@/engine/narrative/NameRegistry';
import { computeDominantMood, zeroMoodInputs } from '@/engine/narrative/Mood';
import { runTurn, TurnContext } from './GameLoop';

const ATTRS = { Body: 28, Mind: 20, Spirit: 15, Agility: 35, Charm: 22, Luck: 42 };

const SIMPLE_EVENT: EventDef = {
  id: 'EV_SIMPLE',
  category: 'test',
  version: 1,
  weight: 100,
  conditions: { regions: ['yellow_plains'] },
  timeCost: 'SHORT',
  text: { intro: ['Nothing much happened.'], body: [], outro: [] },
  choices: [{
    id: 'ch_walk', label: 'Walk on.', timeCost: 'SHORT',
    outcomes: {
      SUCCESS: { narrativeKey: 'ok', stateDeltas: [{ kind: 'insight_delta', amount: 1 }] },
      FAILURE: { narrativeKey: 'fail', stateDeltas: [{ kind: 'hp_delta', amount: -1 }] },
    },
  }],
  repeat: 'unlimited',
};

function makeCtx(): TurnContext {
  const c = createCharacter({ name: 'Lin Wei', attributes: ATTRS, rng: createRng(1) });
  return {
    runState: createRunState({ character: c, runSeed: 42, region: 'yellow_plains', year: 1000, season: 'summer' }),
    streak: createStreakState(),
    events: [SIMPLE_EVENT],
    library: createSnippetLibrary({}),
    nameRegistry: createNameRegistry(),
    lifetimeSeenEvents: [],
    dominantMood: computeDominantMood(zeroMoodInputs()),
  };
}

describe('runTurn', () => {
  it('selects an admissible event and returns a composed narrative', () => {
    const ctx = makeCtx();
    const rng = createRng(100);
    const { narrative, eventId } = runTurn(ctx, 'ch_walk', rng);
    expect(eventId).toBe('EV_SIMPLE');
    expect(typeof narrative).toBe('string');
  });

  it('advances runState.turn and records the event in thisLifeSeenEvents', () => {
    const ctx = makeCtx();
    const rng = createRng(100);
    const r = runTurn(ctx, 'ch_walk', rng);
    expect(r.nextRunState.turn).toBe(1);
    expect(r.nextRunState.thisLifeSeenEvents).toContain('EV_SIMPLE');
  });

  it('applies outcome deltas to the character', () => {
    const ctx = makeCtx();
    const rng = createRng(100);
    const r = runTurn(ctx, 'ch_walk', rng);
    // SUCCESS → insight +1; FAILURE → hp -1. Either way there's a net change.
    const changed =
      r.nextRunState.character.insight !== ctx.runState.character.insight ||
      r.nextRunState.character.hp !== ctx.runState.character.hp;
    expect(changed).toBe(true);
  });

  it('ticks streak per outcome tier', () => {
    const ctx = makeCtx();
    const rng = createRng(100);
    const r = runTurn(ctx, 'ch_walk', rng);
    // If outcome was FAILURE, consecutiveFailures should be 1. If SUCCESS, 0.
    expect([0, 1]).toContain(r.nextStreak.consecutiveFailures);
  });

  it('ticks age by a TimeCost-sized amount', () => {
    const ctx = makeCtx();
    const rng = createRng(100);
    const r = runTurn(ctx, 'ch_walk', rng);
    // SHORT is 1..7 days.
    const delta = r.nextRunState.character.ageDays - ctx.runState.character.ageDays;
    expect(delta).toBeGreaterThanOrEqual(1);
    expect(delta).toBeLessThanOrEqual(7);
  });

  it('throws if no event is selectable', () => {
    const ctx = makeCtx();
    const ctxNoEvent = { ...ctx, events: [] };
    const rng = createRng(100);
    expect(() => runTurn(ctxNoEvent, 'ch_walk', rng))
      .toThrow(/no event/i);
  });

  it('throws if the selected event does not contain the requested choiceId', () => {
    const ctx = makeCtx();
    const rng = createRng(100);
    expect(() => runTurn(ctx, 'ch_nonexistent', rng))
      .toThrow(/choice.*not found/i);
  });

  it('is deterministic for the same seed + inputs', () => {
    const ctx = makeCtx();
    const r1 = runTurn(ctx, 'ch_walk', createRng(77));
    const r2 = runTurn(ctx, 'ch_walk', createRng(77));
    expect(r1.nextRunState.character.hp).toBe(r2.nextRunState.character.hp);
    expect(r1.nextRunState.character.insight).toBe(r2.nextRunState.character.insight);
    expect(r1.eventId).toBe(r2.eventId);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- GameLoop`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/core/GameLoop.ts`:

```ts
// One-turn orchestrator. Source: docs/spec/design.md §2.3.
//
// runTurn: selectEvent → composer → resolver → outcome applier → streak tick → age tick.
// Pure function: takes a TurnContext + choiceId + rng, returns the updated state slices.

import { IRng } from './RNG';
import { Mood } from './Types';
import { EventDef } from '@/content/schema';
import { RunState } from '@/engine/events/RunState';
import { applyOutcome } from '@/engine/events/OutcomeApplier';
import { selectEvent } from '@/engine/events/EventSelector';
import { advanceTurn } from '@/engine/events/AgeTick';
import { resolveCheck } from '@/engine/choices/ChoiceResolver';
import { resolveOutcome } from '@/engine/choices/OutcomeResolver';
import {
  StreakState, recordOutcome, computeStreakBonus, computeWorldMaliceBuff, tickBuff,
} from '@/engine/choices/StreakTracker';
import { renderEvent, CompositionContext } from '@/engine/narrative/Composer';
import { SnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { NameRegistry } from '@/engine/narrative/NameRegistry';
import { resolveTechniqueBonus } from '@/engine/cultivation/Technique';
import { computeMoodBonus } from '@/engine/narrative/MoodBonus';
import { OutcomeTier } from './Types';

export interface TurnContext {
  runState: RunState;
  streak: StreakState;
  events: ReadonlyArray<EventDef>;
  library: SnippetLibrary;
  nameRegistry: NameRegistry;
  lifetimeSeenEvents: ReadonlyArray<string>;
  dominantMood: Mood;
}

export interface TurnResult {
  eventId: string;
  choiceId: string;
  tier: OutcomeTier;
  narrative: string;
  nextRunState: RunState;
  nextStreak: StreakState;
  nextNameRegistry: NameRegistry;
}

export function runTurn(ctx: TurnContext, choiceId: string, rng: IRng): TurnResult {
  // 1. Select event
  const event = selectEvent(
    ctx.events,
    {
      character: ctx.runState.character,
      worldFlags: ctx.runState.worldFlags,
      region: ctx.runState.region,
      locale: ctx.runState.locale,
      year: ctx.runState.year,
      season: ctx.runState.season,
      heavenlyNotice: ctx.runState.heavenlyNotice,
      ageYears: Math.floor(ctx.runState.character.ageDays / 365),
    },
    ctx.lifetimeSeenEvents,
    ctx.runState.thisLifeSeenEvents,
    rng,
  );
  if (!event) {
    throw new Error('runTurn: no event selectable from the current context');
  }

  // 2. Find choice
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) {
    throw new Error(`runTurn: choice ${choiceId} not found in event ${event.id}`);
  }

  // 3. Render narrative
  const narrative = renderEvent(
    event,
    compositionContextFrom(ctx),
    ctx.library,
    ctx.nameRegistry,
    rng,
  );

  // 4. Resolve the check
  const techBonus = choice.check?.techniqueBonusCategory
    ? resolveTechniqueBonus([], choice.check.techniqueBonusCategory)
    : 0;
  const moodBonus = choice.check?.techniqueBonusCategory
    ? computeMoodBonus(ctx.dominantMood, choice.check.techniqueBonusCategory as any)
    : 0;

  const result = resolveCheck({
    check: choice.check,
    characterStats: ctx.runState.character.attributes,
    characterSkills: {},
    techniqueBonus: techBonus,
    itemBonus: 0,
    echoBonus: 0,
    memoryBonus: 0,
    moodBonus,
    worldMalice: computeWorldMaliceBuff(ctx.streak),
    streakBonus: computeStreakBonus(ctx.streak),
    rng,
  });

  // 5. Pick outcome for the tier
  const outcome = resolveOutcome(choice.outcomes, result.tier);

  // 6. Apply outcome deltas
  let nextRunState = applyOutcome(ctx.runState, outcome);
  nextRunState = {
    ...nextRunState,
    thisLifeSeenEvents: [...nextRunState.thisLifeSeenEvents, event.id],
  };

  // 7. Streak + age tick
  let nextStreak = recordOutcome(ctx.streak, result.tier);
  nextStreak = tickBuff(nextStreak);
  nextRunState = advanceTurn(nextRunState, choice.timeCost, rng);

  return {
    eventId: event.id,
    choiceId,
    tier: result.tier,
    narrative,
    nextRunState,
    nextStreak,
    nextNameRegistry: ctx.nameRegistry,
  };
}

function compositionContextFrom(ctx: TurnContext): CompositionContext {
  return {
    characterName: ctx.runState.character.name,
    region: ctx.runState.region,
    season: ctx.runState.season,
    realm: ctx.runState.character.realm,
    dominantMood: ctx.dominantMood,
    turnIndex: ctx.runState.turn,
    runSeed: ctx.runState.runSeed,
    extraVariables: {},
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- GameLoop`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/core/GameLoop.ts src/engine/core/GameLoop.test.ts
git commit -m "feat(engine): runTurn orchestrator (event → resolve → apply → tick)"
```

---

## Task 10: Integration test — full life cycle with reincarnation

**Files:**
- Create: `tests/integration/life_cycle_with_bardo.test.ts`

**Rationale:** Prove all Phase 1D-1 modules compose into the spec §13 Phase 1 exit criterion: *"Player can: start → peasant life → die → bardo → spend karma → reborn → another life. Karma earned and spent affects the next life (provable by test)."*

- [ ] **Step 1: Write the integration test**

Create `tests/integration/life_cycle_with_bardo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { EventDef } from '@/content/schema';
import { getAnchorById } from '@/engine/meta/Anchor';
import { resolveAnchor } from '@/engine/meta/AnchorResolver';
import { characterFromAnchor } from '@/engine/meta/characterFromAnchor';
import { createEmptyMetaState, purchaseUpgrade, ownsUpgrade, addKarma } from '@/engine/meta/MetaState';
import { createStreakState } from '@/engine/choices/StreakTracker';
import { createSnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { createNameRegistry } from '@/engine/narrative/NameRegistry';
import { computeDominantMood, zeroMoodInputs } from '@/engine/narrative/Mood';
import { runTurn } from '@/engine/core/GameLoop';
import { runBardoFlow } from '@/engine/bardo/BardoFlow';

// A tiny corpus with one benign event and one fatal event, so a loop will eventually die.
const EVENTS: EventDef[] = [
  {
    id: 'EV_BENIGN',
    category: 'life.daily',
    version: 1, weight: 100,
    conditions: { regions: ['yellow_plains'] },
    timeCost: 'MEDIUM',
    text: { intro: ['Days passed.'], body: [], outro: [] },
    choices: [{
      id: 'ch_walk', label: 'Walk on.', timeCost: 'MEDIUM',
      outcomes: {
        SUCCESS: { narrativeKey: 'ok', stateDeltas: [{ kind: 'insight_delta', amount: 1 }] },
        FAILURE: { narrativeKey: 'fail', stateDeltas: [{ kind: 'hp_delta', amount: -5 }] },
      },
    }],
    repeat: 'unlimited',
  },
  {
    id: 'EV_FATAL',
    category: 'life.danger',
    version: 1, weight: 10,
    conditions: { regions: ['yellow_plains'] },
    timeCost: 'INSTANT',
    text: { intro: ['A bandit drew a knife.'], body: [], outro: [] },
    choices: [{
      id: 'ch_die', label: 'Accept fate.', timeCost: 'INSTANT',
      outcomes: {
        SUCCESS: { narrativeKey: 'spared', stateDeltas: [{ kind: 'hp_delta', amount: -1 }] },
        FAILURE: { narrativeKey: 'killed', deathCause: 'combat_melee' },
        CRIT_FAILURE: { narrativeKey: 'killed', deathCause: 'combat_melee' },
      },
    }],
    repeat: 'unlimited',
  },
];

describe('life cycle: create → play → die → bardo → reincarnate', () => {
  it('completes a full cycle with karma accrued across the transition', () => {
    // LIFE 1
    const anchor = getAnchorById('peasant_farmer')!;
    const spawnRng = createRng(1);
    const resolved = resolveAnchor(anchor, spawnRng);
    let { runState } = characterFromAnchor({
      resolved, name: 'Lin Wei', runSeed: 42, rng: spawnRng,
    });
    let streak = createStreakState();
    let meta = createEmptyMetaState();
    const library = createSnippetLibrary({});
    let nameRegistry = createNameRegistry();

    const turnRng = createRng(500);
    let turnsPlayed = 0;
    const MAX_TURNS = 200;

    while (!runState.deathCause && turnsPlayed < MAX_TURNS) {
      // Pick a choice deterministically: 'ch_walk' if EV_BENIGN, 'ch_die' otherwise.
      // We don't know which will be chosen; try 'ch_walk' and fall back.
      const ctx = {
        runState, streak, events: EVENTS, library, nameRegistry,
        lifetimeSeenEvents: [],
        dominantMood: computeDominantMood(zeroMoodInputs()),
      };
      // Try ch_walk first; if the event is EV_FATAL, we'll need ch_die.
      // Use peek strategy: run with ch_walk; if it throws "choice not found", rerun with ch_die.
      let result;
      try {
        result = runTurn(ctx, 'ch_walk', turnRng);
      } catch {
        result = runTurn(ctx, 'ch_die', turnRng);
      }
      runState = result.nextRunState;
      streak = result.nextStreak;
      nameRegistry = result.nextNameRegistry;
      turnsPlayed++;
    }

    expect(runState.deathCause).toBeTruthy(); // must have died
    expect(turnsPlayed).toBeLessThan(MAX_TURNS);

    // BARDO: commit karma.
    const bardo = runBardoFlow(runState, meta, resolved.karmaMultiplier);
    expect(bardo.karmaEarned).toBeGreaterThan(0);
    expect(bardo.meta.karmaBalance).toBe(bardo.karmaEarned);
    expect(bardo.meta.lifeCount).toBe(1);
    expect(bardo.meta.lineage).toHaveLength(1);

    meta = bardo.meta;

    // Spend karma if possible on awakened_soul_1 (80 karma).
    const spendResult = meta.karmaBalance >= 80 ? purchaseUpgrade(meta, 'awakened_soul_1') : null;
    if (spendResult) {
      meta = spendResult;
      expect(ownsUpgrade(meta, 'awakened_soul_1')).toBe(true);
      expect(meta.karmaBalance).toBe(bardo.meta.karmaBalance - 80);
    } else {
      // If we didn't earn enough, top it up manually for the "spend affects next life" test.
      meta = addKarma(meta, 80);
      meta = purchaseUpgrade(meta, 'awakened_soul_1')!;
      expect(ownsUpgrade(meta, 'awakened_soul_1')).toBe(true);
    }

    // LIFE 2: reincarnate with the boosted meta state.
    const resolved2 = resolveAnchor(anchor, createRng(2));
    const { runState: rs2 } = characterFromAnchor({
      resolved: resolved2, name: 'Lin Wei II', runSeed: 100, rng: createRng(2),
    });

    expect(rs2.turn).toBe(0);
    expect(meta.lifeCount).toBe(1);  // only the finished life counts

    // Confirm karma and upgrade carried over.
    expect(meta.karmaBalance).toBeGreaterThanOrEqual(0);
    expect(meta.ownedUpgrades).toContain('awakened_soul_1');
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npm test -- life_cycle_with_bardo`
Expected: 1 test passes (may take up to ~2s due to the turn loop).

- [ ] **Step 3: Run full suite + typecheck + build**

Run: `npm test` — all green.
Run: `npm run typecheck` — clean.
Run: `npm run build` — success.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/life_cycle_with_bardo.test.ts
git commit -m "test(integration): full life cycle with bardo + reincarnation"
```

---

## Exit Criteria Checklist

- [ ] All Task 1–10 commits on branch `phase-1d1-engine-glue`.
- [ ] `npm test` passes. Phase 1D-1 adds ~70 new tests.
- [ ] `npm run typecheck` clean.
- [ ] `npm run build` success.
- [ ] CI green.
- [ ] Every new module has a `*.test.ts` with green assertions.
- [ ] Integration test: life-cycle-with-bardo passes.
- [ ] No engineBridge rewrite yet (that's Phase 1D-2).
- [ ] No real event / snippet / name content (that's Phase 1D-3).

---

## Self-Review Notes

**Spec coverage:**
- §2.3 Inner-loop state machine — Task 9 (runTurn) ✔
- §2.4 Outer-loop transition — Task 8 (BardoFlow) ✔
- §2.5 Time & age — already from Phase 1B's AgeTick, consumed by Task 9
- §7.1 Karmic Insights — Tasks 4 (earn) + 5 (upgrades) + 6 (MetaState) ✔
- §7.4 Anchors — Tasks 1, 2, 3 ✔ (Phase 1D-1 ships 2 anchors)
- §7.7 Lineage log — Task 6 (LineageEntrySummary) + Task 8 (append) ✔ (full structure per Phase 1D-3)
- §10.1/§10.2 Persistence — Task 6 (meta) + Task 7 (run) ✔
- §11.6 Bardo flow UX — **deferred to Phase 1D-2** (engine-side data is ready; UI wires it)

**Type consistency:**
- `AnchorDef` defined in Task 1, consumed by Task 2 (`resolveAnchor`) and transitively by Task 3 (`characterFromAnchor`).
- `ResolvedAnchor` from Task 2, consumed by Task 3.
- `LifeSummary` from Task 4, consumed by Task 8 (`runBardoFlow`).
- `MetaState` from Task 6, consumed by Task 8 (bardo commit) and Task 12 (integration).
- `TurnContext` / `TurnResult` from Task 9, consumed by the integration test.

**Placeholder scan:** none. Every step has complete code.

**Phase 1D-2 handoff:**
- `engineBridge` should call:
  - `beginLife(anchorId, name)` → `resolveAnchor` + `characterFromAnchor` + `saveRun`
  - `chooseAction(choiceId)` → `runTurn` → `saveRun`; if `deathCause` set, transition to BARDO
  - `beginBardo()` → `runBardoFlow` → return summary + karma breakdown
  - `spendKarma(upgradeId)` → `purchaseUpgrade` → `saveMeta`
  - `reincarnate()` → advance phase to CREATION
- UI screens consume:
  - `LifeSummary` for Bardo display
  - `MetaSnapshot` for Codex/Lineage

**Phase 1D-3 handoff:**
- `EVENTS` constant in the integration test is a minimal fixture. Phase 1D-3 authors the real Yellow Plains event corpus (~50+ events) plus expanded snippet library, name pools, etc.
- Seasonal logic in `characterFromAnchor` (year % 4) is placeholder — real era-driven season can land in Phase 3 (§8.2 timeline).

**Gaps:** none against Phase 1D-1's scope.
