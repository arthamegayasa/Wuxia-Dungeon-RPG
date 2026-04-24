# Phase 2A-2 — Content Authoring + Engine Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the Phase 2A-1 engine with its first wave of content (10 echoes, 5 memories, 3 anchors) and wire the cross-life loop end-to-end: rolled echoes apply at spawn, witnessed memories commit on death, unlocked echoes record on the lineage card, meditation events trigger manifestation rolls. After this plan, a headless 5-life test will prove Phase 2A exit criterion #2 (memory manifests in Life N+5).

**Architecture:** Two parallel tracks stitched together. **Content:** zod-validated JSON under `src/content/{echoes,memories}` with loaders mirroring Phase 1D-3's snippet/event loader pattern; 3 new anchors authored with a `spawnRegionFallback` field so Scholar's Son / Outer Disciple spawn in Yellow Plains until their real regions ship. **Engine integration:** `characterFromAnchor` runs echo roll + apply after character construction; `BardoFlow` commits witnessed memories, evaluates echo unlocks, and annotates `echoesUnlockedThisLife` on the lineage entry; `GameLoop.runTurn` increments echo-tracker counters keyed off event `category` after each outcome; a new `meditation`-tagged event slot in the selector triggers `MemoryManifestResolver`.

**Tech Stack:** TypeScript 5.8 strict, Vitest 4, Zod 4. Depends on Phase 2A-1 (all 18 tasks + 5 prereq commits + CI typecheck fix, merged at `f1efa86`). No new runtime dependencies.

**Source of truth:** [`docs/spec/design.md`](../../../docs/spec/design.md) §7.2 (echoes), §7.3 (memories), §7.4 (anchors), §9 (content schemas); [`docs/superpowers/specs/2026-04-23-phase-2a-inheritance-and-reveal-design.md`](../specs/2026-04-23-phase-2a-inheritance-and-reveal-design.md) §3–§5 (engine + content scope).

**Scope boundaries (OUT of 2A-2):**
- Codex / Lineage / Bardo / Creation UI → **2A-3**
- `engineBridge` snapshot APIs for Codex → **2A-3**
- Full 5-anchor UI picker with locked-state hints → **2A-3**
- Technique registry + technique-learn → **Phase 2B**
- Azure Peaks region, Imperial Capital region → **2B / Phase 3**
- Heavenly Notice tier, Karmic Hunters, Imprints → **Phase 3**

---

## Task Map

1. Content schemas: `EchoSchema`, `MemorySchema`, `AnchorSchema` extension (`targetRegion` + `spawnRegionFallback`)
2. `loadEchoes` loader + fixture test
3. `loadMemories` loader + fixture test
4. `src/content/echoes/echoes.json` — 10 canonical echoes
5. `src/content/memories/memories.json` — 5 memories + matching witness/manifest snippets
6. Anchor corpus: 3 new anchors (Martial Family / Scholar's Son / Outer Disciple) appended to `DEFAULT_ANCHORS`
7. `AnchorResolver` region fallback (`targetRegion` → `spawnRegionFallback` when target not loaded)
8. `characterFromAnchor` integrates echo roll + apply at spawn
9. `BardoFlow` commits witnessed memories + evaluates echo unlocks + annotates lineage entry
10. `GameLoop.runTurn` increments `EchoTracker` from event category after each outcome
11. Meditation-event manifestation hook in `GameLoop.runTurn`
12. Snippet additions (~50 new leaves: reflection + memory + anchor openers)
13. Event retrofits — add `witnessMemory` outcomes to 10 existing Yellow Plains events
14. New anchor-bridging events — 2 per anchor × 3 anchors = 6 events
15. New meditation events — 3 meditation-tagged events
16. Integration test: memory manifestation Life N → Life N+5
17. Integration test: mood filter variance
18. Final verification (build + full suite + bundle size)

Total: **18 tasks**.

---

## Prerequisite Reading

- [`docs/superpowers/specs/2026-04-23-phase-2a-inheritance-and-reveal-design.md`](../specs/2026-04-23-phase-2a-inheritance-and-reveal-design.md) §3 (engine subsystems — the Phase 2A-1 output), §5 (content scope), §6 (UI — context for what 2A-3 will need from 2A-2 content), §10 (risks).
- [`src/content/schema.ts`](../../../src/content/schema.ts) — Phase 1B `EventSchema`, `OutcomeSchema`, `ChoiceSchema`; `witnessMemory` field already on `Outcome`.
- [`src/content/events/loader.ts`](../../../src/content/events/loader.ts) + `loader.test.ts` — style reference for new loaders.
- [`src/content/snippets/loader.ts`](../../../src/content/snippets/loader.ts) — style reference for snippet loader.
- [`src/engine/meta/Anchor.ts`](../../../src/engine/meta/Anchor.ts) + `AnchorResolver.ts` — schema to extend, resolver to modify.
- [`src/engine/meta/characterFromAnchor.ts`](../../../src/engine/meta/characterFromAnchor.ts) — integration point for echo application.
- [`src/engine/bardo/BardoFlow.ts`](../../../src/engine/bardo/BardoFlow.ts) — integration point for echo unlock + witness commit + lineage annotation.
- [`src/engine/core/GameLoop.ts`](../../../src/engine/core/GameLoop.ts) — integration point for per-turn tracker increment.
- [`src/content/events/yellow_plains/training.json`](../../../src/content/events/yellow_plains/training.json) — sample event shape for retrofit/author reference.
- Phase 2A-1 modules (all in `src/engine/meta/`): `SoulEcho`, `EchoRegistry`, `EchoTracker`, `EchoUnlocker`, `EchoRoller`, `EchoApplier`, `ForbiddenMemory`, `MemoryRegistry`, `MemoryWitnessLogger`, `MemoryManifestResolver`.

---

## Task 1: Content schemas (echoes + memories + anchor extension)

**Files:**
- Modify: `src/content/schema.ts` — add `EchoSchema`, `MemorySchema`, extend `AnchorSchema` imports
- Modify: `src/engine/meta/Anchor.ts` — extend `AnchorSchema` with `targetRegion` + `spawnRegionFallback`

**Rationale:** Schemas first so loaders in Tasks 2–3 have a validated target and anchors in Task 6 can carry the new fields. Schemas live under `src/content/schema.ts` next to existing `EventSchema` except `AnchorSchema` which lives in `src/engine/meta/Anchor.ts` (already established; just extend).

- [ ] **Step 1: Extend `AnchorSchema` in `src/engine/meta/Anchor.ts`**

Open `src/engine/meta/Anchor.ts`. Inside the `spawn` object literal of `AnchorSchema`, add two fields BEFORE the closing `})`:

```ts
    /** The region this anchor *targets* once it ships. */
    targetRegion: z.string().min(1),
    /** Fallback region while targetRegion is not loaded (Phase 2A-2/2B bridge). */
    spawnRegionFallback: z.string().min(1).optional(),
```

The existing `regions` weighted list stays for now — `true_random` and `peasant_farmer` use it. New anchors (Task 6) will supply it AND `targetRegion`/`spawnRegionFallback`.

- [ ] **Step 2: Update existing defaults to include `targetRegion`**

In the same file, add `targetRegion: 'yellow_plains'` to both `true_random` and `peasant_farmer` spawn objects (no `spawnRegionFallback` needed — they target the region they ship in).

- [ ] **Step 3: Add `EchoSchema` + `MemorySchema` to `src/content/schema.ts`**

Open `src/content/schema.ts`. Append after the existing schemas, before the `ContentPack` section:

```ts
// ---- Phase 2A-2 Echo schema ----
// Source: docs/spec/design.md §7.2, §9.8.

const REALM_OR_STRING = z.union([z.enum(REALM_STRINGS), z.string()]);
const ATTR_STAT = z.enum(STAT_STRINGS);

const UnlockConditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('reach_realm'), realm: z.string(), sublayer: z.number().int().positive().optional() }),
  z.object({ kind: z.literal('choice_category_count'), category: z.string(), count: z.number().int().positive() }),
  z.object({ kind: z.literal('outcome_count'), outcomeKind: z.string(), count: z.number().int().positive() }),
  z.object({ kind: z.literal('lives_as_anchor_max_age'), anchor: z.string(), lives: z.number().int().positive() }),
  z.object({ kind: z.literal('died_with_flag'), flag: z.string() }),
  z.object({ kind: z.literal('flag_set'), flag: z.string() }),
  z.object({ kind: z.literal('died_in_same_region_streak'), region: z.string(), streak: z.number().int().positive() }),
  z.object({ kind: z.literal('reached_insight_cap_lives'), lives: z.number().int().positive() }),
  z.object({ kind: z.literal('lived_min_years_in_single_life'), years: z.number().int().positive() }),
  z.object({ kind: z.literal('reached_realm_without_techniques'), realm: z.string() }),
]);

const EchoEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stat_mod'), stat: ATTR_STAT, delta: z.number() }),
  z.object({ kind: z.literal('stat_mod_pct'), stat: ATTR_STAT, pct: z.number() }),
  z.object({ kind: z.literal('resolver_bonus'), category: z.string(), bonus: z.number() }),
  z.object({ kind: z.literal('event_weight'), eventTag: z.string(), mult: z.number().positive() }),
  z.object({ kind: z.literal('starting_flag'), flag: z.string() }),
  z.object({ kind: z.literal('heal_efficacy_pct'), pct: z.number() }),
  z.object({ kind: z.literal('hp_mult'), mult: z.number().positive() }),
  z.object({ kind: z.literal('mood_swing_pct'), pct: z.number() }),
  z.object({ kind: z.literal('body_cultivation_rate_pct'), pct: z.number() }),
  z.object({ kind: z.literal('insight_cap_bonus'), bonus: z.number() }),
  z.object({ kind: z.literal('old_age_death_roll_pct'), pct: z.number() }),
  z.object({ kind: z.literal('imprint_encounter_rate_pct'), pct: z.number() }),
]);

export const EchoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  tier: z.enum(['fragment', 'partial', 'full']),
  unlockCondition: UnlockConditionSchema,
  effects: z.array(EchoEffectSchema),
  conflicts: z.array(z.string()),
  reveal: z.enum(['birth', 'trigger']),
});

export const EchoPackSchema = z.object({
  version: z.number().int().positive(),
  echoes: z.array(EchoSchema),
});

// ---- Phase 2A-2 Memory schema ----
// Source: docs/spec/design.md §7.3, §9.9.

export const MemoryRequirementsSchema = z.object({
  minMeridians: z.number().int().positive().optional(),
  minRealm: REALM_OR_STRING.optional(),
});

export const MemorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  element: z.enum(['metal', 'wood', 'water', 'fire', 'earth', 'void']),
  witnessFlavour: z.object({
    fragment: z.string().min(1),
    partial: z.string().min(1),
    complete: z.string().min(1),
  }),
  manifestFlavour: z.string().min(1),
  manifestInsightBonus: z.number().int().nonnegative(),
  manifestFlag: z.string().min(1),
  requirements: MemoryRequirementsSchema,
});

export const MemoryPackSchema = z.object({
  version: z.number().int().positive(),
  memories: z.array(MemorySchema),
});

export type EchoDef = z.infer<typeof EchoSchema>;
export type EchoPack = z.infer<typeof EchoPackSchema>;
export type MemoryDef = z.infer<typeof MemorySchema>;
export type MemoryPack = z.infer<typeof MemoryPackSchema>;
```

- [ ] **Step 4: Typecheck + suite green**

```
npx tsc --noEmit
npx vitest run
```

Expected: both pass. Existing anchors now carry `targetRegion: 'yellow_plains'`; existing tests that construct `AnchorDef` literals manually will need updating — grep `AnchorDef = {` or `spawn: {` in tests and add the field inline.

- [ ] **Step 5: Commit**

```bash
git add src/content/schema.ts src/engine/meta/Anchor.ts
git add -u src/engine  # any test-literal fixups
git commit -m "feat(content): Echo/Memory schemas + Anchor targetRegion/spawnRegionFallback"
```

---

## Task 2: `loadEchoes` loader

**Files:**
- Create: `src/content/echoes/loader.ts`
- Create: `src/content/echoes/loader.test.ts`
- Create: `src/content/echoes/__fixtures__/valid.json`
- Create: `src/content/echoes/__fixtures__/invalid_duplicate.json`

**Rationale:** Mirror `src/content/snippets/loader.ts` style. Parses raw JSON via `EchoPackSchema`, returns typed `EchoDef[]`.

- [ ] **Step 1: Write fixtures**

`src/content/echoes/__fixtures__/valid.json`:
```json
{
  "version": 1,
  "echoes": [
    {
      "id": "test_echo",
      "name": "Test Echo",
      "description": "For loader tests.",
      "tier": "fragment",
      "unlockCondition": { "kind": "flag_set", "flag": "t" },
      "effects": [{ "kind": "stat_mod", "stat": "Body", "delta": 1 }],
      "conflicts": [],
      "reveal": "birth"
    }
  ]
}
```

`src/content/echoes/__fixtures__/invalid_duplicate.json`:
```json
{
  "version": 1,
  "echoes": [
    { "id": "dup", "name": "A", "description": "", "tier": "fragment",
      "unlockCondition": { "kind": "flag_set", "flag": "x" },
      "effects": [], "conflicts": [], "reveal": "birth" },
    { "id": "dup", "name": "B", "description": "", "tier": "fragment",
      "unlockCondition": { "kind": "flag_set", "flag": "x" },
      "effects": [], "conflicts": [], "reveal": "birth" }
  ]
}
```

- [ ] **Step 2: Write failing test**

`src/content/echoes/loader.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { loadEchoes } from './loader';
import valid from './__fixtures__/valid.json';
import invalidDup from './__fixtures__/invalid_duplicate.json';

describe('loadEchoes', () => {
  it('parses a valid pack to EchoDef[]', () => {
    const list = loadEchoes(valid);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('test_echo');
  });

  it('throws on zod shape mismatch', () => {
    expect(() => loadEchoes({ version: 1, echoes: [{ wrong: true }] })).toThrow();
  });

  it('throws on duplicate ids', () => {
    expect(() => loadEchoes(invalidDup)).toThrow(/duplicate echo id/i);
  });
});
```

- [ ] **Step 3: Run → FAIL**

`npx vitest run src/content/echoes/loader.test.ts`

- [ ] **Step 4: Implement loader**

`src/content/echoes/loader.ts`:
```ts
import { EchoPackSchema, EchoDef } from '@/content/schema';

export function loadEchoes(raw: unknown): ReadonlyArray<EchoDef> {
  const parsed = EchoPackSchema.parse(raw);
  const seen = new Set<string>();
  for (const e of parsed.echoes) {
    if (seen.has(e.id)) throw new Error(`duplicate echo id: ${e.id}`);
    seen.add(e.id);
  }
  return parsed.echoes;
}
```

- [ ] **Step 5: Run → 3 PASS**

- [ ] **Step 6: Commit**

```bash
git add src/content/echoes/loader.ts src/content/echoes/loader.test.ts src/content/echoes/__fixtures__/
git commit -m "feat(content): loadEchoes with duplicate-id guard"
```

---

## Task 3: `loadMemories` loader

**Files:**
- Create: `src/content/memories/loader.ts`
- Create: `src/content/memories/loader.test.ts`
- Create: `src/content/memories/__fixtures__/valid.json`
- Create: `src/content/memories/__fixtures__/invalid_duplicate.json`

**Rationale:** Exact mirror of `loadEchoes`.

- [ ] **Step 1: Fixtures**

`src/content/memories/__fixtures__/valid.json`:
```json
{
  "version": 1,
  "memories": [
    {
      "id": "test_mem",
      "name": "Test Memory",
      "description": "For loader tests.",
      "element": "water",
      "witnessFlavour": {
        "fragment": "k.f", "partial": "k.p", "complete": "k.c"
      },
      "manifestFlavour": "k.m",
      "manifestInsightBonus": 5,
      "manifestFlag": "remembered_test",
      "requirements": {}
    }
  ]
}
```

`src/content/memories/__fixtures__/invalid_duplicate.json`:
```json
{
  "version": 1,
  "memories": [
    { "id": "dup", "name": "A", "description": "", "element": "water",
      "witnessFlavour": { "fragment": "a", "partial": "b", "complete": "c" },
      "manifestFlavour": "m", "manifestInsightBonus": 1, "manifestFlag": "f", "requirements": {} },
    { "id": "dup", "name": "B", "description": "", "element": "water",
      "witnessFlavour": { "fragment": "a", "partial": "b", "complete": "c" },
      "manifestFlavour": "m", "manifestInsightBonus": 1, "manifestFlag": "f", "requirements": {} }
  ]
}
```

- [ ] **Step 2: Test**

```ts
import { describe, it, expect } from 'vitest';
import { loadMemories } from './loader';
import valid from './__fixtures__/valid.json';
import invalidDup from './__fixtures__/invalid_duplicate.json';

describe('loadMemories', () => {
  it('parses a valid pack', () => {
    const list = loadMemories(valid);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('test_mem');
  });

  it('throws on zod shape mismatch', () => {
    expect(() => loadMemories({ version: 1, memories: [{ wrong: true }] })).toThrow();
  });

  it('throws on duplicate ids', () => {
    expect(() => loadMemories(invalidDup)).toThrow(/duplicate memory id/i);
  });
});
```

- [ ] **Step 3: FAIL**
- [ ] **Step 4: Implement**

```ts
import { MemoryPackSchema, MemoryDef } from '@/content/schema';

export function loadMemories(raw: unknown): ReadonlyArray<MemoryDef> {
  const parsed = MemoryPackSchema.parse(raw);
  const seen = new Set<string>();
  for (const m of parsed.memories) {
    if (seen.has(m.id)) throw new Error(`duplicate memory id: ${m.id}`);
    seen.add(m.id);
  }
  return parsed.memories;
}
```

- [ ] **Step 5: 3 PASS**
- [ ] **Step 6: Commit** `feat(content): loadMemories with duplicate-id guard`

---

## Task 4: Canonical 10 echoes JSON

**Files:**
- Create: `src/content/echoes/echoes.json`
- Create: `src/content/echoes/echoes.test.ts`

**Rationale:** Ship the 10 canonical echoes from spec §3.1 (roster). Each must be valid against schema + unique. Test: load, build registry, assert count + a few spot fields.

- [ ] **Step 1: Write `echoes.json`**

```json
{
  "version": 1,
  "echoes": [
    {
      "id": "iron_body",
      "name": "Iron Body",
      "description": "Your flesh remembers tempering. Old pains re-teach themselves.",
      "tier": "fragment",
      "unlockCondition": { "kind": "reach_realm", "realm": "body_tempering", "sublayer": 5 },
      "effects": [
        { "kind": "hp_mult", "mult": 1.2 },
        { "kind": "body_cultivation_rate_pct", "pct": 10 }
      ],
      "conflicts": [],
      "reveal": "birth"
    },
    {
      "id": "sword_memory",
      "name": "Sword Memory",
      "description": "Your hands know a grip you never learned.",
      "tier": "fragment",
      "unlockCondition": { "kind": "choice_category_count", "category": "life.training", "count": 100 },
      "effects": [
        { "kind": "stat_mod", "stat": "Agility", "delta": 5 },
        { "kind": "resolver_bonus", "category": "life.training", "bonus": 15 }
      ],
      "conflicts": [],
      "reveal": "birth"
    },
    {
      "id": "doctors_hands",
      "name": "Doctor's Hands",
      "description": "Wounds ease themselves beneath your touch.",
      "tier": "fragment",
      "unlockCondition": { "kind": "choice_category_count", "category": "life.social", "count": 50 },
      "effects": [
        { "kind": "heal_efficacy_pct", "pct": 30 },
        { "kind": "stat_mod", "stat": "Mind", "delta": 5 }
      ],
      "conflicts": [],
      "reveal": "birth"
    },
    {
      "id": "cold_resolve",
      "name": "Cold Resolve",
      "description": "You have refused temptation before. The pattern stays.",
      "tier": "fragment",
      "unlockCondition": { "kind": "choice_category_count", "category": "life.danger", "count": 10 },
      "effects": [
        { "kind": "mood_swing_pct", "pct": -10 }
      ],
      "conflicts": [],
      "reveal": "birth"
    },
    {
      "id": "regret_unspoken",
      "name": "Regret of the Unspoken",
      "description": "A vow you never fulfilled still pulls at your throat.",
      "tier": "fragment",
      "unlockCondition": { "kind": "died_with_flag", "flag": "unfulfilled_vow" },
      "effects": [
        { "kind": "stat_mod", "stat": "Charm", "delta": 15 },
        { "kind": "insight_cap_bonus", "bonus": 10 }
      ],
      "conflicts": [],
      "reveal": "birth"
    },
    {
      "id": "farmers_eye",
      "name": "Farmer's Eye",
      "description": "You read the sky without thinking. The soil speaks plainly.",
      "tier": "fragment",
      "unlockCondition": { "kind": "lives_as_anchor_max_age", "anchor": "peasant_farmer", "lives": 5 },
      "effects": [
        { "kind": "resolver_bonus", "category": "life.daily", "bonus": 20 },
        { "kind": "starting_flag", "flag": "weather_wise" }
      ],
      "conflicts": [],
      "reveal": "birth"
    },
    {
      "id": "hollow_teacher",
      "name": "Hollow Teacher",
      "description": "You learned without hands, without books. The way arrived from nowhere.",
      "tier": "fragment",
      "unlockCondition": { "kind": "reached_realm_without_techniques", "realm": "foundation" },
      "effects": [
        { "kind": "stat_mod", "stat": "Spirit", "delta": 5 },
        { "kind": "resolver_bonus", "category": "life.opportunity", "bonus": 25 }
      ],
      "conflicts": [],
      "reveal": "birth"
    },
    {
      "id": "patience_of_stone",
      "name": "Patience of Stone",
      "description": "Ninety winters taught you that endings are slow. So are beginnings.",
      "tier": "fragment",
      "unlockCondition": { "kind": "lived_min_years_in_single_life", "years": 90 },
      "effects": [
        { "kind": "old_age_death_roll_pct", "pct": -20 }
      ],
      "conflicts": [],
      "reveal": "birth"
    },
    {
      "id": "vessel_understanding",
      "name": "Vessel of Understanding",
      "description": "You have overflowed with insight before. The cup remembers its shape.",
      "tier": "fragment",
      "unlockCondition": { "kind": "reached_insight_cap_lives", "lives": 3 },
      "effects": [
        { "kind": "insight_cap_bonus", "bonus": 50 }
      ],
      "conflicts": [],
      "reveal": "birth"
    },
    {
      "id": "ghost_in_mirror",
      "name": "Ghost in the Mirror",
      "description": "The same region has buried you three times. The land has learned your face.",
      "tier": "fragment",
      "unlockCondition": { "kind": "died_in_same_region_streak", "region": "yellow_plains", "streak": 3 },
      "effects": [
        { "kind": "imprint_encounter_rate_pct", "pct": 100 }
      ],
      "conflicts": [],
      "reveal": "birth"
    }
  ]
}
```

Note: `ghost_in_mirror` effect `imprint_encounter_rate_pct` is applied by `EchoApplier` switch statement's `default` branch (no-op in 2A, wired in Phase 3 when imprints land). That's fine — the echo still unlocks and occupies a slot.

- [ ] **Step 2: Write test**

`src/content/echoes/echoes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { loadEchoes } from './loader';
import pack from './echoes.json';
import { EchoRegistry } from '@/engine/meta/EchoRegistry';

describe('canonical echoes corpus', () => {
  const list = loadEchoes(pack);

  it('contains exactly 10 echoes', () => {
    expect(list).toHaveLength(10);
  });

  it('every id is unique', () => {
    expect(new Set(list.map((e) => e.id)).size).toBe(10);
  });

  it('builds a valid registry', () => {
    const reg = EchoRegistry.fromList(list);
    expect(reg.get('iron_body')).toBeDefined();
    expect(reg.get('ghost_in_mirror')).toBeDefined();
  });

  it('no conflicts declared in 2A roster (spec §3.1)', () => {
    for (const e of list) {
      expect(e.conflicts).toEqual([]);
    }
  });
});
```

- [ ] **Step 3: Run → 4 PASS**

- [ ] **Step 4: Commit**

```bash
git add src/content/echoes/echoes.json src/content/echoes/echoes.test.ts
git commit -m "feat(content): 10 canonical echoes (spec §3.1 roster)"
```

---

## Task 5: Canonical 5 memories JSON + matching snippets

**Files:**
- Create: `src/content/memories/memories.json`
- Create: `src/content/memories/memories.test.ts`
- Modify: `src/content/snippets/yellow_plains.json` (add memory witness/manifest snippet keys)

**Rationale:** 5 memories from spec §3.2. Each must reference snippet keys that actually exist — this task adds them in the same commit so test can validate cross-reference.

- [ ] **Step 1: Write `memories.json`**

```json
{
  "version": 1,
  "memories": [
    {
      "id": "frost_palm_severing",
      "name": "Frost Palm Severing",
      "description": "A water-element severing art, cold enough to split blood.",
      "element": "water",
      "witnessFlavour": {
        "fragment": "memory.witness.frost_palm_severing.fragment",
        "partial": "memory.witness.frost_palm_severing.partial",
        "complete": "memory.witness.frost_palm_severing.complete"
      },
      "manifestFlavour": "memory.manifest.frost_palm_severing",
      "manifestInsightBonus": 10,
      "manifestFlag": "remembered_frost_palm_severing",
      "requirements": { "minMeridians": 3 }
    },
    {
      "id": "crimson_spear_river",
      "name": "Crimson Spear That Crosses the River",
      "description": "A fire-element thrusting art; the blade burns across the enemy's breath.",
      "element": "fire",
      "witnessFlavour": {
        "fragment": "memory.witness.crimson_spear_river.fragment",
        "partial": "memory.witness.crimson_spear_river.partial",
        "complete": "memory.witness.crimson_spear_river.complete"
      },
      "manifestFlavour": "memory.manifest.crimson_spear_river",
      "manifestInsightBonus": 15,
      "manifestFlag": "remembered_crimson_spear_river",
      "requirements": { "minRealm": "qi_condensation" }
    },
    {
      "id": "silent_waters_scripture",
      "name": "Scripture of the Silent Waters",
      "description": "A meditation manual. Its syllables erase the reader.",
      "element": "water",
      "witnessFlavour": {
        "fragment": "memory.witness.silent_waters_scripture.fragment",
        "partial": "memory.witness.silent_waters_scripture.partial",
        "complete": "memory.witness.silent_waters_scripture.complete"
      },
      "manifestFlavour": "memory.manifest.silent_waters_scripture",
      "manifestInsightBonus": 8,
      "manifestFlag": "remembered_silent_waters_scripture",
      "requirements": { "minMeridians": 1 }
    },
    {
      "id": "iron_bamboo_stance",
      "name": "Iron Bamboo Stance",
      "description": "A wood-element defensive form. The practitioner bends; the wood does not break.",
      "element": "wood",
      "witnessFlavour": {
        "fragment": "memory.witness.iron_bamboo_stance.fragment",
        "partial": "memory.witness.iron_bamboo_stance.partial",
        "complete": "memory.witness.iron_bamboo_stance.complete"
      },
      "manifestFlavour": "memory.manifest.iron_bamboo_stance",
      "manifestInsightBonus": 7,
      "manifestFlag": "remembered_iron_bamboo_stance",
      "requirements": { "minMeridians": 2 }
    },
    {
      "id": "hollow_mountain_breath",
      "name": "Hollow Mountain Breath",
      "description": "An earth-element breathing art. The lungs become ancient caverns.",
      "element": "earth",
      "witnessFlavour": {
        "fragment": "memory.witness.hollow_mountain_breath.fragment",
        "partial": "memory.witness.hollow_mountain_breath.partial",
        "complete": "memory.witness.hollow_mountain_breath.complete"
      },
      "manifestFlavour": "memory.manifest.hollow_mountain_breath",
      "manifestInsightBonus": 12,
      "manifestFlag": "remembered_hollow_mountain_breath",
      "requirements": { "minRealm": "foundation" }
    }
  ]
}
```

- [ ] **Step 2: Add snippet entries to `src/content/snippets/yellow_plains.json`**

Append the following keys (each a single-entry array; 2A can ship one variant per key, 2A-3+ expand):

```
"memory.witness.frost_palm_severing.fragment": [{ "text": "A stranger's hand moved once, quick as a splinter. The air shivered where it had been." }],
"memory.witness.frost_palm_severing.partial":  [{ "text": "The form is familiar. Three fingers, the pivot of the hip — a cold art that severs before the strike is named." }],
"memory.witness.frost_palm_severing.complete": [{ "text": "The Frost Palm Severing. He has seen this art completed. The lungs fill with winter; the blade has already fallen." }],
"memory.manifest.frost_palm_severing":         [{ "text": "In the quiet of the hour the hand moves on its own. He watches his own fingers draw the severing line, and remembers that he never learned it." }],

"memory.witness.crimson_spear_river.fragment": [{ "text": "A thrust — too quick, too red. The spear crossed the distance before the body began to fall." }],
"memory.witness.crimson_spear_river.partial":  [{ "text": "The movement is known now. Shoulder lowered, breath held, the red line cast across the throat." }],
"memory.witness.crimson_spear_river.complete": [{ "text": "The Crimson Spear. Completed form. One thrust ends where the river begins again." }],
"memory.manifest.crimson_spear_river":         [{ "text": "His breath finds a rhythm he did not teach it. The spear is a river; the river has always run through him." }],

"memory.witness.silent_waters_scripture.fragment": [{ "text": "He found a page. The characters dissolved when he tried to pronounce them." }],
"memory.witness.silent_waters_scripture.partial":  [{ "text": "The scripture returns in fragments. Each line a held breath; each syllable a door that closes." }],
"memory.witness.silent_waters_scripture.complete": [{ "text": "The Scripture of the Silent Waters. He knows the whole of it now, as one knows the shape of one's own skull." }],
"memory.manifest.silent_waters_scripture":         [{ "text": "In the silence between thoughts he reads himself. The syllables were there all along." }],

"memory.witness.iron_bamboo_stance.fragment": [{ "text": "A villager caught a strike without moving. The blow passed through him like wind through an old fence." }],
"memory.witness.iron_bamboo_stance.partial":  [{ "text": "Iron Bamboo. The weight settles through the feet, the breath rides the spine." }],
"memory.witness.iron_bamboo_stance.complete": [{ "text": "The Iron Bamboo Stance, perfected. His body has already settled into it before the thought arrives." }],
"memory.manifest.iron_bamboo_stance":         [{ "text": "He bends. He does not break. The stance is ancient and his own." }],

"memory.witness.hollow_mountain_breath.fragment": [{ "text": "An old monk exhaled. The cave seemed to exhale with him." }],
"memory.witness.hollow_mountain_breath.partial":  [{ "text": "Hollow Mountain Breath. The lungs become slow, become vast, become a place that is not a place." }],
"memory.witness.hollow_mountain_breath.complete": [{ "text": "The Hollow Mountain Breath, complete. He breathes as a mountain breathes. Nothing is hurried; nothing is missed." }],
"memory.manifest.hollow_mountain_breath":         [{ "text": "The breath opens, and keeps opening. He is sudden with space." }]
```

- [ ] **Step 3: Write test**

`src/content/memories/memories.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { loadMemories } from './loader';
import pack from './memories.json';
import snippetSource from '@/content/snippets/yellow_plains.json';
import { createSnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { MemoryRegistry } from '@/engine/meta/MemoryRegistry';

describe('canonical memories corpus', () => {
  const list = loadMemories(pack);

  it('contains exactly 5 memories', () => {
    expect(list).toHaveLength(5);
  });

  it('every id is unique', () => {
    expect(new Set(list.map((m) => m.id)).size).toBe(5);
  });

  it('every witness/manifest snippet key exists in the library', () => {
    const lib = createSnippetLibrary(snippetSource);
    for (const m of list) {
      expect(lib.has(m.witnessFlavour.fragment)).toBe(true);
      expect(lib.has(m.witnessFlavour.partial)).toBe(true);
      expect(lib.has(m.witnessFlavour.complete)).toBe(true);
      expect(lib.has(m.manifestFlavour)).toBe(true);
    }
  });

  it('builds a valid registry', () => {
    const reg = MemoryRegistry.fromList(list);
    expect(reg.get('frost_palm_severing')).toBeDefined();
  });

  it('manifest flags are unique and match id pattern', () => {
    const flags = list.map((m) => m.manifestFlag);
    expect(new Set(flags).size).toBe(5);
    for (const m of list) {
      expect(m.manifestFlag).toBe(`remembered_${m.id}`);
    }
  });
});
```

- [ ] **Step 4: Run → 5 PASS**

- [ ] **Step 5: Commit**

```bash
git add src/content/memories/memories.json src/content/memories/memories.test.ts src/content/snippets/yellow_plains.json
git commit -m "feat(content): 5 forbidden memories + matching snippets"
```

---

## Task 6: 3 new anchors appended to `DEFAULT_ANCHORS`

**Files:**
- Modify: `src/engine/meta/Anchor.ts` (append to `DEFAULT_ANCHORS` array)
- Modify: `src/engine/meta/Anchor.test.ts` (test new anchors parse)

**Rationale:** Author Martial Family, Scholar's Son, Outer Disciple using extended schema. All three use `spawnRegionFallback: 'yellow_plains'` until their real regions ship; `targetRegion` records the spec intent.

- [ ] **Step 1: Write failing test (append to `Anchor.test.ts`)**

```ts
describe('new 2A anchors', () => {
  it('includes martial_family, scholars_son, outer_disciple', () => {
    const ids = DEFAULT_ANCHORS.map((a) => a.id);
    expect(ids).toContain('martial_family');
    expect(ids).toContain('scholars_son');
    expect(ids).toContain('outer_disciple');
  });

  it('martial_family targets yellow_plains directly (no fallback needed)', () => {
    const a = getAnchorById('martial_family')!;
    expect(a.spawn.targetRegion).toBe('yellow_plains');
    expect(a.spawn.spawnRegionFallback).toBeUndefined();
  });

  it('scholars_son targets imperial_capital but falls back to yellow_plains', () => {
    const a = getAnchorById('scholars_son')!;
    expect(a.spawn.targetRegion).toBe('imperial_capital');
    expect(a.spawn.spawnRegionFallback).toBe('yellow_plains');
  });

  it('outer_disciple targets azure_peaks but falls back to yellow_plains', () => {
    const a = getAnchorById('outer_disciple')!;
    expect(a.spawn.targetRegion).toBe('azure_peaks');
    expect(a.spawn.spawnRegionFallback).toBe('yellow_plains');
  });

  it('new anchors have distinct attribute adjustments and starting flags', () => {
    const m = getAnchorById('martial_family')!;
    const s = getAnchorById('scholars_son')!;
    const o = getAnchorById('outer_disciple')!;
    expect(m.spawn.startingFlags).toContain('from_martial_family');
    expect(s.spawn.startingFlags).toContain('literate');
    expect(o.spawn.startingFlags).toContain('outer_sect_member');
  });
});
```

- [ ] **Step 2: Run → FAIL (new anchor ids not found)**

- [ ] **Step 3: Append to `DEFAULT_ANCHORS` array**

```ts
  {
    id: 'martial_family',
    name: 'Martial Family',
    description: 'Born among fighters. Your first memories are of a straight back and a heavy fist.',
    unlock: 'reach_body_tempering_5',
    spawn: {
      regions: [{ id: 'yellow_plains', weight: 1 }],
      targetRegion: 'yellow_plains',
      era: { minYear: 900, maxYear: 1100 },
      age: { min: 8, max: 8 },
      familyTier: 'commoner',
      attributeModifiers: {
        Body: [3, 10], Mind: [0, 4], Spirit: [0, 4],
        Agility: [2, 8], Charm: [0, 4], Luck: [0, 4],
      },
      startingItems: [],
      startingFlags: ['from_martial_family', 'parent_is_fighter'],
    },
    karmaMultiplier: 0.9,
  },
  {
    id: 'scholars_son',
    name: "Scholar's Son",
    description: 'Born into a house of books. Your fingers learn brush-grip before they learn to grip a fist.',
    unlock: 'read_ten_tomes_one_life',
    spawn: {
      regions: [{ id: 'yellow_plains', weight: 1 }],     // fallback region until imperial_capital ships
      targetRegion: 'imperial_capital',
      spawnRegionFallback: 'yellow_plains',
      era: { minYear: 900, maxYear: 1100 },
      age: { min: 10, max: 10 },
      familyTier: 'minor_noble',
      attributeModifiers: {
        Body: [0, 2], Mind: [4, 10], Spirit: [0, 4],
        Agility: [0, 4], Charm: [1, 6], Luck: [0, 4],
      },
      startingItems: [],
      startingFlags: ['literate', 'family_has_library'],
    },
    karmaMultiplier: 0.9,
  },
  {
    id: 'outer_disciple',
    name: 'Outer Disciple',
    description: 'Born poor, noticed by a sect. You sweep the halls of the stronger.',
    unlock: 'befriend_sect_disciple',
    spawn: {
      regions: [{ id: 'yellow_plains', weight: 1 }],     // fallback region until azure_peaks ships
      targetRegion: 'azure_peaks',
      spawnRegionFallback: 'yellow_plains',
      era: { minYear: 900, maxYear: 1100 },
      age: { min: 15, max: 15 },
      familyTier: 'poor',
      attributeModifiers: {
        Body: [1, 5], Mind: [1, 5], Spirit: [1, 5],
        Agility: [0, 4], Charm: [0, 4], Luck: [2, 6],
      },
      startingItems: [],
      startingFlags: ['outer_sect_member', 'sect_id:placeholder_sect'],
    },
    karmaMultiplier: 0.8,
  },
```

- [ ] **Step 4: Run tests — 5 new PASS, existing 2 unchanged. Full suite still green.**

- [ ] **Step 5: Commit**

```bash
git add src/engine/meta/Anchor.ts src/engine/meta/Anchor.test.ts
git commit -m "feat(meta): 3 new anchors (Martial Family, Scholar's Son, Outer Disciple)"
```

---

## Task 7: AnchorResolver region fallback

**Files:**
- Modify: `src/engine/meta/AnchorResolver.ts`
- Modify: `src/engine/meta/AnchorResolver.test.ts`

**Rationale:** When `targetRegion` is not in the set of currently-loaded regions (Phase 2A-2 has only `yellow_plains`), resolve to `spawnRegionFallback`. Phase 2B+/3 add `azure_peaks`, `imperial_capital`; the fallback stops being used.

The function now needs to know which regions are loaded. Simplest: accept an optional `loadedRegions: ReadonlyArray<string>` argument; default to `['yellow_plains']`.

- [ ] **Step 1: Extend test**

Append to `src/engine/meta/AnchorResolver.test.ts`:

```ts
describe('resolveAnchor — region fallback', () => {
  it('uses targetRegion when it is in loadedRegions', () => {
    const anchor = getAnchorById('scholars_son')!;
    const resolved = resolveAnchor(anchor, createRng(1), ['yellow_plains', 'imperial_capital']);
    expect(resolved.region).toBe('imperial_capital');
  });

  it('falls back when targetRegion is not loaded', () => {
    const anchor = getAnchorById('scholars_son')!;
    const resolved = resolveAnchor(anchor, createRng(1), ['yellow_plains']);
    expect(resolved.region).toBe('yellow_plains');
  });

  it('throws when targetRegion missing AND fallback missing AND neither loaded', () => {
    const bad = { ...getAnchorById('scholars_son')! };
    (bad as any).spawn = { ...bad.spawn, spawnRegionFallback: undefined };
    expect(() => resolveAnchor(bad as any, createRng(1), ['azure_peaks'])).toThrow(
      /region .* not loaded and no fallback/i,
    );
  });

  it('anchors without targetRegion-fallback scheme still work via weighted regions', () => {
    // peasant_farmer has targetRegion='yellow_plains', which IS loaded.
    const anchor = getAnchorById('peasant_farmer')!;
    const resolved = resolveAnchor(anchor, createRng(1), ['yellow_plains']);
    expect(resolved.region).toBe('yellow_plains');
  });
});
```

Make sure `getAnchorById` and `createRng` are imported at top of test file.

- [ ] **Step 2: Run → FAIL (third argument not supported)**

- [ ] **Step 3: Update `resolveAnchor` signature**

```ts
export function resolveAnchor(
  anchor: AnchorDef,
  rng: IRng,
  loadedRegions: ReadonlyArray<string> = ['yellow_plains'],
): ResolvedAnchor {
  // Primary: targetRegion if loaded.
  let region: string;
  if (loadedRegions.includes(anchor.spawn.targetRegion)) {
    region = anchor.spawn.targetRegion;
  } else if (anchor.spawn.spawnRegionFallback && loadedRegions.includes(anchor.spawn.spawnRegionFallback)) {
    region = anchor.spawn.spawnRegionFallback;
  } else {
    throw new Error(
      `AnchorResolver: target region '${anchor.spawn.targetRegion}' not loaded and no fallback available (loaded: ${loadedRegions.join(', ')})`,
    );
  }

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

Note: `anchor.spawn.regions` weighted list is no longer consulted — `targetRegion` + fallback is now authoritative. The `regions` array stays in the schema for backward compatibility but is ignored by the resolver in 2A-2. Phase 3 may re-evaluate.

- [ ] **Step 4: Run — 4 new PASS, existing `AnchorResolver` tests still green.**

- [ ] **Step 5: Commit** `feat(meta): AnchorResolver region fallback + targetRegion-first resolution`

---

## Task 8: `characterFromAnchor` rolls and applies echoes

**Files:**
- Modify: `src/engine/meta/characterFromAnchor.ts`
- Modify: `src/engine/meta/characterFromAnchor.test.ts`

**Rationale:** After character is constructed, roll echoes from `meta.echoesUnlocked` and apply them. New args: `meta: MetaState` + `echoRegistry: EchoRegistry`. Existing call-sites need updating (grep `characterFromAnchor(`).

- [ ] **Step 1: Extend test**

Append to `characterFromAnchor.test.ts`:

```ts
describe('characterFromAnchor — echo integration', () => {
  it('rolls and applies an unlocked echo to the returned character', () => {
    const ironBody: SoulEcho = {
      id: 'iron_body', name: 'Iron Body', description: '',
      tier: 'fragment',
      unlockCondition: { kind: 'flag_set', flag: 'x' },
      effects: [{ kind: 'hp_mult', mult: 1.2 }],
      conflicts: [], reveal: 'birth',
    };
    const reg = EchoRegistry.fromList([ironBody]);
    const meta = { ...createEmptyMetaState(), echoesUnlocked: ['iron_body'] };

    const anchor = getAnchorById('peasant_farmer')!;
    const resolved = resolveAnchor(anchor, createRng(1));
    const { character } = characterFromAnchor({
      resolved,
      name: 'Test',
      runSeed: 1,
      rng: createRng(1),
      meta,
      echoRegistry: reg,
    });

    expect(character.echoes).toEqual(['iron_body']);
    expect(character.hpMax).toBeGreaterThan(10);  // hp_mult 1.2 applied on top of baseline
  });

  it('returns a character with empty echoes when meta has none unlocked', () => {
    const reg = EchoRegistry.fromList([]);
    const meta = createEmptyMetaState();
    const anchor = getAnchorById('peasant_farmer')!;
    const resolved = resolveAnchor(anchor, createRng(1));
    const { character } = characterFromAnchor({
      resolved, name: 'Test', runSeed: 1, rng: createRng(1),
      meta, echoRegistry: reg,
    });
    expect(character.echoes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run → FAIL (new args not supported)**

- [ ] **Step 3: Modify `characterFromAnchor`**

Update `CharacterFromAnchorArgs` + function body:

```ts
import { EchoRegistry } from './EchoRegistry';
import { rollEchoes } from './EchoRoller';
import { applyEchoes } from './EchoApplier';
import { echoSlotsFor } from './SoulEcho';
import { MetaState } from './MetaState';

export interface CharacterFromAnchorArgs {
  resolved: ResolvedAnchor;
  name: string;
  runSeed: number;
  rng: IRng;
  meta: MetaState;
  echoRegistry: EchoRegistry;
}
```

In the function body, after the `runState = { ... createRunState(...) ... }` block, but before `return`:

Actually simpler: compute echoes right after character is created (before flags loop), apply them, then continue with flags/runState as before. Replace the function body with:

```ts
export function characterFromAnchor(args: CharacterFromAnchorArgs): CharacterFromAnchorResult {
  const { resolved, name, runSeed, rng, meta, echoRegistry } = args;

  const attrs = {} as AttributeMap;
  for (const s of Object.keys(resolved.attributeAdjustments) as Stat[]) {
    attrs[s] = addAttribute(BASELINE_ATTRIBUTE, resolved.attributeAdjustments[s]);
  }

  let character = createCharacter({
    name, attributes: attrs, rng,
    startingAgeDays: resolved.ageDays,
  });

  // Apply anchor starting flags.
  for (const flag of resolved.startingFlags) {
    if (!character.flags.includes(flag)) {
      character = { ...character, flags: [...character.flags, flag] };
    }
  }

  // Phase 2A-2: roll + apply echoes from MetaState.echoesUnlocked.
  const slots = echoSlotsFor(meta);
  const rolled = rollEchoes({
    registry: echoRegistry,
    unlockedIds: meta.echoesUnlocked,
    slotCount: slots,
    rng,
  });
  const rolledEchoes = rolled.map((id) => echoRegistry.get(id)!).filter(Boolean);
  character = applyEchoes(character, rolledEchoes, rolled);

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

- [ ] **Step 4: Update existing callers**

Grep `characterFromAnchor(` in `src/` — likely `engineBridge.ts` or similar. Add `meta` and `echoRegistry` args. For the existing bridge, pass `getMetaState()` and an `EMPTY_ECHO_REGISTRY` or a globally-loaded registry. Simplest: at the bridge level, lazy-load the canonical echo registry via `loadEchoes` + `EchoRegistry.fromList`.

If `engineBridge` doesn't yet have an echo registry, create one at module load: `const ECHO_REGISTRY = EchoRegistry.fromList(loadEchoes(echoPack));` where `echoPack` is imported from `@/content/echoes/echoes.json`.

Check which files break typecheck after the signature change — typically there will be 1–2 call-sites to update.

- [ ] **Step 5: Run full suite — expect all tests green**

- [ ] **Step 6: Commit**

```bash
git add src/engine/meta/characterFromAnchor.ts src/engine/meta/characterFromAnchor.test.ts
git add -u src  # bridge/other callers
git commit -m "feat(meta): characterFromAnchor rolls + applies echoes at spawn"
```

---

## Task 9: BardoFlow commits memories + evaluates echo unlocks + annotates lineage

**Files:**
- Modify: `src/engine/bardo/BardoFlow.ts`
- Modify: `src/engine/bardo/BardoFlow.test.ts`

**Rationale:** On death:
1. Commit `rs.memoriesWitnessedThisLife` into `meta.memoriesWitnessed` (via `commitWitnesses`)
2. Evaluate unlocks: build `UnlockContext` from finalized run state + meta, call `evaluateUnlocks`, append to `meta.echoesUnlocked`
3. Record newly-unlocked echo ids on the `LineageEntrySummary.echoesUnlockedThisLife`
4. Reset life-scoped flags (not strictly needed — new life creates a new RunState — but document)

New args: `echoRegistry: EchoRegistry`.

- [ ] **Step 1: Extend `BardoFlow.test.ts`**

```ts
describe('runBardoFlow — Phase 2A-2 integration', () => {
  const ironBody: SoulEcho = {
    id: 'iron_body', name: 'Iron Body', description: '',
    tier: 'fragment',
    unlockCondition: { kind: 'reach_realm', realm: 'body_tempering', sublayer: 5 },
    effects: [], conflicts: [], reveal: 'birth',
  };

  it('unlocks iron_body and writes it into meta.echoesUnlocked on death at BT5+', () => {
    const reg = EchoRegistry.fromList([ironBody]);
    let meta = createEmptyMetaState();
    const rs = makeRunStateDyingAt({ bodyTemperingLayer: 5, deathCause: 'starvation' });
    const result = runBardoFlow(rs, meta, 1.0, reg);
    expect(result.meta.echoesUnlocked).toContain('iron_body');
  });

  it('annotates the lineage entry with echoesUnlockedThisLife', () => {
    const reg = EchoRegistry.fromList([ironBody]);
    const meta = createEmptyMetaState();
    const rs = makeRunStateDyingAt({ bodyTemperingLayer: 5, deathCause: 'starvation' });
    const result = runBardoFlow(rs, meta, 1.0, reg);
    const lastEntry = result.meta.lineage[result.meta.lineage.length - 1];
    expect(lastEntry.echoesUnlockedThisLife).toContain('iron_body');
  });

  it('commits witnessed memories to meta.memoriesWitnessed', () => {
    const reg = EchoRegistry.fromList([]);
    const meta = createEmptyMetaState();
    const rs = {
      ...makeRunStateDyingAt({ deathCause: 'starvation' }),
      memoriesWitnessedThisLife: ['frost_palm_severing', 'silent_waters_scripture'],
    };
    const result = runBardoFlow(rs, meta, 1.0, reg);
    expect(result.meta.memoriesWitnessed.frost_palm_severing).toBe(1);
    expect(result.meta.memoriesWitnessed.silent_waters_scripture).toBe(1);
  });

  it('does not re-unlock echoes already in meta.echoesUnlocked', () => {
    const reg = EchoRegistry.fromList([ironBody]);
    const meta = { ...createEmptyMetaState(), echoesUnlocked: ['iron_body'] };
    const rs = makeRunStateDyingAt({ bodyTemperingLayer: 5, deathCause: 'starvation' });
    const result = runBardoFlow(rs, meta, 1.0, reg);
    expect(result.meta.echoesUnlocked.filter((id) => id === 'iron_body')).toHaveLength(1);
    const lastEntry = result.meta.lineage[result.meta.lineage.length - 1];
    expect(lastEntry.echoesUnlockedThisLife).not.toContain('iron_body');
  });
});
```

Helper `makeRunStateDyingAt` needs to create a minimal RunState. Add to the same test file (or reuse existing helper):

```ts
function makeRunStateDyingAt(opts: {
  bodyTemperingLayer?: number;
  deathCause: DeathCause;
}): RunState {
  const character = createCharacter({
    name: 'Test',
    attributes: { Body: 10, Mind: 10, Spirit: 10, Agility: 10, Charm: 10, Luck: 10 },
    rng: createRng(1),
  });
  const withLayer = {
    ...character,
    bodyTemperingLayer: opts.bodyTemperingLayer ?? 0,
    flags: [...character.flags, 'anchor:peasant_farmer'],
  };
  const rs = createRunState({
    character: withLayer, runSeed: 1, region: 'yellow_plains',
    year: 1000, season: 'spring',
  });
  return { ...rs, deathCause: opts.deathCause };
}
```

- [ ] **Step 2: Run → FAIL (runBardoFlow doesn't accept 4th arg yet)**

- [ ] **Step 3: Modify `runBardoFlow`**

```ts
import { EchoRegistry } from '@/engine/meta/EchoRegistry';
import { evaluateUnlocks, UnlockContext } from '@/engine/meta/EchoUnlocker';
import { commitWitnesses } from '@/engine/meta/MemoryWitnessLogger';

export function runBardoFlow(
  rs: RunState,
  meta: MetaState,
  anchorMultiplier: number,
  echoRegistry: EchoRegistry,
): BardoResult {
  if (!rs.deathCause) {
    throw new Error('runBardoFlow: no death cause — cannot enter bardo');
  }
  const summary = buildLifeSummary(rs, anchorMultiplier);
  const karma = computeKarma(summary);

  // Commit witnessed memories first, before evaluating echo unlocks (unlocker may
  // read meta.memoriesWitnessed, though 2A conditions don't — harmless order).
  let nextMeta = commitWitnesses(meta, rs.memoriesWitnessedThisLife);

  // Evaluate echo unlocks using the just-updated meta.
  const anchorThisLife =
    rs.character.flags.find((f) => f.startsWith('anchor:'))?.slice(7) ?? 'unknown';
  const ctx: UnlockContext = {
    meta: nextMeta,
    finalRealm: summary.realmReached,
    finalBodyTemperingLayer: summary.maxBodyTemperingLayer,
    diedOfOldAge: summary.deathCause === 'old_age',
    yearsLived: summary.yearsLived,
    diedThisLifeFlags: rs.character.flags,
    anchorThisLife,
    echoProgressCumulative: meta.echoProgress,
    dominantRegionThisLife: rs.region,
    regionStreakByRegion: computeRegionStreak(meta, rs.region),
  };
  const newlyUnlocked = evaluateUnlocks(echoRegistry, ctx);
  if (newlyUnlocked.length > 0) {
    nextMeta = {
      ...nextMeta,
      echoesUnlocked: [...nextMeta.echoesUnlocked, ...newlyUnlocked],
    };
  }

  const entry: LineageEntrySummary = {
    lifeIndex: nextMeta.lifeCount + 1,
    name: rs.character.name,
    anchorId: anchorThisLife,
    yearsLived: summary.yearsLived,
    realmReached: summary.realmReached,
    deathCause: summary.deathCause,
    karmaEarned: karma.total,
    echoesUnlockedThisLife: [...newlyUnlocked],
  };

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

/** Counts consecutive trailing lives that died in `region`. */
function computeRegionStreak(meta: MetaState, region: string): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  // Walk backward through lineage counting streak for each region.
  const lineageRegions: string[] = []; // Phase 2A-2 lineage doesn't store region — assume current
  lineageRegions.push(region);
  for (const r of lineageRegions) {
    counts[r] = (counts[r] ?? 0) + 1;
  }
  return counts;
}
```

Note: `LineageEntrySummary` doesn't currently store `region`. For `died_in_same_region_streak` to work meaningfully across lives, either:
- Add `region: string` to `LineageEntrySummary` (small additional migration), OR
- Leave the streak as current-life-only (value 1 for current region)

Ship option B in 2A-2 — region-streak echo (`ghost_in_mirror`) won't unlock until lineage carries region. Note this as an accepted trade-off; Phase 3 (when the Imprints system lands) fixes it.

- [ ] **Step 4: Update bridge/App callers**

Grep `runBardoFlow(` in `src/`. Pass the same `echoRegistry` the bridge already loads for `characterFromAnchor` (Task 8).

- [ ] **Step 5: Run full suite — 4 new BardoFlow tests PASS, plus all Phase 1+ tests green**

- [ ] **Step 6: Commit**

```bash
git add src/engine/bardo/BardoFlow.ts src/engine/bardo/BardoFlow.test.ts
git add -u src
git commit -m "feat(bardo): commit witnesses + evaluate echo unlocks + annotate lineage"
```

---

## Task 10: `GameLoop.runTurn` increments EchoTracker from event category

**Files:**
- Modify: `src/engine/core/GameLoop.ts`
- Modify: `src/engine/core/GameLoop.test.ts`

**Rationale:** After `applyOutcome`, increment the echo tracker counter for `choice_cat.{event.category}`. Tracker is threaded through the game loop; on death, its snapshot is merged into `meta.echoProgress` by the bardo flow OR committed directly.

Simplest shape: keep the tracker out of `RunState` (no schema churn); instead, have `runTurn` accept + return an `EchoTracker` argument alongside `RunState`. The bridge persists both.

- [ ] **Step 1: Extend test**

```ts
describe('runTurn — Phase 2A-2 echo tracker integration', () => {
  it('increments choice_cat.{category} counter after each outcome', () => {
    const event: EventDef = { /* category: 'life.training', ... */ };
    const result = runTurn({
      runState: ...,
      meta: createEmptyMetaState(),
      echoTracker: EchoTracker.empty(),
      /* ... */
    });
    expect(result.echoTracker.get('choice_cat.life.training')).toBe(1);
  });
});
```

Flesh this test out against the real `runTurn` signature — start by reading the current function to confirm call shape.

- [ ] **Step 2: Update `runTurn` signature**

Add an `echoTracker: EchoTracker` field to `RunTurnArgs` + return it in `RunTurnResult`. After `applyOutcome`, do:

```ts
const updatedTracker = echoTracker.increment(`choice_cat.${event.category}`);
```

Return `{ runState, echoTracker: updatedTracker, ... }`.

- [ ] **Step 3: Add meditation-event hook (Task 11) preview**

Task 11 will slot the `MemoryManifestResolver` call right after the tracker increment. Leave a clear insertion point.

- [ ] **Step 4: Update bridge callers**

Thread `echoTracker` through wherever runTurn is called. The bridge persists an `EchoTracker` instance per-life and resets on new life.

- [ ] **Step 5: Run full suite — pass**

- [ ] **Step 6: Commit** `feat(core): GameLoop threads EchoTracker, increments per event category`

---

## Task 11: Meditation-event manifestation hook

**Files:**
- Modify: `src/engine/core/GameLoop.ts` (the meditation hook)
- Modify: `src/engine/core/GameLoop.test.ts`

**Rationale:** When the resolved event has `category === 'meditation'` OR the event object has a tag/flag marking it as meditation (use the simpler `category === 'meditation'` convention), call `MemoryManifestResolver.rollManifest` after the tracker increment. Feed the returned `runState` forward (insight + flag updates) and return any manifested ids so the bridge can surface them in the Bardo reveal.

- [ ] **Step 1: Extend test — manifest happens only for category 'meditation'**

```ts
it('runs MemoryManifestResolver on meditation-category events', () => {
  const meditationEvent: EventDef = { /* category: 'meditation', ... */ };
  const ironBambooMem: ForbiddenMemory = { /* witnessed 10 times in meta */ };
  const memRegistry = MemoryRegistry.fromList([ironBambooMem]);
  const meta = { ...createEmptyMetaState(), memoriesWitnessed: { iron_bamboo_stance: 10 } };
  const result = runTurn({
    runState: ...,
    meta,
    echoTracker: EchoTracker.empty(),
    memoryRegistry: memRegistry,
    /* ... */
  });
  // With witness count 10 + high-Mind character, at least one manifestation expected.
  expect(result.runState.manifestAttemptsThisLife).toBe(1);
});
```

- [ ] **Step 2: Wire in `runTurn`**

```ts
import { rollManifest } from '@/engine/meta/MemoryManifestResolver';
import { MemoryRegistry } from '@/engine/meta/MemoryRegistry';

// Inside runTurn, after tracker increment:
if (event.category === 'meditation') {
  const manifestResult = rollManifest({
    runState: nextRunState,
    meta,
    registry: memoryRegistry,
  });
  nextRunState = manifestResult.runState;
  // Expose manifested ids in RunTurnResult for UI pickup.
}
```

Add `memoryRegistry: MemoryRegistry` to `RunTurnArgs` (same pattern as `echoRegistry` in the bridge).

- [ ] **Step 3: Run full suite green**

- [ ] **Step 4: Commit** `feat(core): meditation-event manifestation hook`

---

## Task 12: Snippet additions (~30 new leaves)

**Files:**
- Modify: `src/content/snippets/yellow_plains.json`
- Modify: `src/content/snippets/yellow_plains.test.ts`

**Rationale:** Add the reflection snippets (6 moods × 2 realms × 1 variant = 12 keys) for InteriorThoughtInjector + anchor-opener snippets (6) for the new events in Task 14. Memory snippets already landed in Task 5.

- [ ] **Step 1: Append keys to `yellow_plains.json`**

```
"reflection.melancholy.mortal":          [{ "text": "He stood outside his own moment, watching it close." }],
"reflection.melancholy.body_tempering":  [{ "text": "His body remembered a rhythm his life had abandoned." }],
"reflection.rage.mortal":                [{ "text": "Something inside him was a shut door kicked open." }],
"reflection.rage.body_tempering":        [{ "text": "The strength rose; it did not need his permission." }],
"reflection.serenity.mortal":            [{ "text": "The moment arrived, and he was already inside it." }],
"reflection.serenity.body_tempering":    [{ "text": "Breath found a pace he did not set. He did not argue." }],
"reflection.paranoia.mortal":            [{ "text": "He did not turn around. The back of his neck was not listening." }],
"reflection.paranoia.body_tempering":    [{ "text": "Something watched. The watching did not feel friendly." }],
"reflection.resolve.mortal":             [{ "text": "He knew, then, what he would do. The knowing was not loud." }],
"reflection.resolve.body_tempering":     [{ "text": "The next step had arrived while he slept. He stepped." }],
"reflection.sorrow.mortal":              [{ "text": "He carried a thing he could not put down." }],
"reflection.sorrow.body_tempering":      [{ "text": "The weight of the old griefs had a shape now. It fit in his hands." }],

"anchor.opener.martial_family.1":        [{ "text": "The morning drill starts before dawn. His father's boots are louder than his voice." }],
"anchor.opener.martial_family.2":        [{ "text": "The stance is the stance. Correct it for the fifth time this morning." }],
"anchor.opener.scholars_son.1":          [{ "text": "His father's library smells of lampblack and age. The characters on the oldest scrolls outlive the men who write them." }],
"anchor.opener.scholars_son.2":          [{ "text": "The tutor's cane rests across the reading table. It has ended more than one afternoon." }],
"anchor.opener.outer_disciple.1":        [{ "text": "The inner disciples do not see him. The corridor is his to sweep twice a day." }],
"anchor.opener.outer_disciple.2":        [{ "text": "The hall bell rings and he is not called." }]
```

- [ ] **Step 2: Add test**

Append to `yellow_plains.test.ts`:

```ts
it('has all 12 reflection keys for Phase 2A-2 interior-thought injection', () => {
  const lib = createSnippetLibrary(pack);
  const moods = ['sorrow', 'rage', 'serenity', 'paranoia', 'resolve', 'melancholy'] as const;
  const realms = ['mortal', 'body_tempering'] as const;
  for (const m of moods) {
    for (const r of realms) {
      expect(lib.has(`reflection.${m}.${r}`)).toBe(true);
    }
  }
});

it('has anchor-opener snippets for all 3 new anchors', () => {
  const lib = createSnippetLibrary(pack);
  expect(lib.has('anchor.opener.martial_family.1')).toBe(true);
  expect(lib.has('anchor.opener.scholars_son.1')).toBe(true);
  expect(lib.has('anchor.opener.outer_disciple.1')).toBe(true);
});
```

- [ ] **Step 3: Run → PASS**

- [ ] **Step 4: Commit** `feat(content): reflection + anchor-opener snippets (~18 new leaves)`

---

## Task 13: Event retrofits — `witnessMemory` on 10 existing events

**Files:**
- Modify: various under `src/content/events/yellow_plains/*.json`
- Modify: `src/content/events/yellow_plains/*.test.ts` (add a single meta-test that every memory is witnessable from at least one event)

**Rationale:** Give players concrete witness opportunities. Add `witnessMemory: 'X'` to one outcome branch of 10 existing events, spreading across all 5 memories (≥2 witness chances per memory). No narrative changes — just add the field.

Assignment table (event-id → memory_id; you may adjust based on thematic fit after grepping the events):

| event id | outcome to annotate | memory witnessed |
|---|---|---|
| `YP_TRAIN_STONE_LIFT` | `CRIT_SUCCESS` | `iron_bamboo_stance` |
| `YP_TRAIN_RIVER_SWIM` | `CRIT_SUCCESS` | `hollow_mountain_breath` |
| `YP_TRAIN_MOUNTAIN_RUN` | `CRIT_SUCCESS` | `iron_bamboo_stance` |
| `YP_DANGER_BANDIT_FIGHT` (or equivalent) | `PARTIAL` or `FAILURE` | `crimson_spear_river` |
| `YP_DANGER_WILD_BEAST` | `SUCCESS` | `frost_palm_severing` |
| `YP_SOCIAL_OLD_SAGE` | `CRIT_SUCCESS` | `silent_waters_scripture` |
| `YP_SOCIAL_VILLAGE_FEAST` | `SUCCESS` | `iron_bamboo_stance` |
| `YP_OPPORTUNITY_MONK_VISIT` | `SUCCESS` | `hollow_mountain_breath` |
| `YP_OPPORTUNITY_FOUND_BOOK` | `SUCCESS` | `silent_waters_scripture` |
| `YP_DAILY_VILLAGE_DUEL` | `CRIT_SUCCESS` | `frost_palm_severing` |

> Exact event ids must match files on disk. Grep `"id":` in `src/content/events/yellow_plains/*.json` to inventory, then match the closest thematic fit. If a mapped id doesn't exist, pick the closest available event of the same category; record the substitution in the commit message.

- [ ] **Step 1: For each mapped event, add `"witnessMemory": "X"` to the designated outcome block**

Example for `YP_TRAIN_STONE_LIFT` CRIT_SUCCESS:

```json
"CRIT_SUCCESS": {
  "narrativeKey": "action.work.plowing",
  "stateDeltas": [
    { "kind": "attribute_delta", "stat": "Body", "amount": 2 }
  ],
  "witnessMemory": "iron_bamboo_stance"
}
```

- [ ] **Step 2: Add a coverage meta-test**

Create `src/content/events/yellow_plains/witness_coverage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadEvents } from '@/content/events/loader';
import daily from './daily.json';
import training from './training.json';
import social from './social.json';
import danger from './danger.json';
import opportunity from './opportunity.json';
import transition from './transition.json';
import { loadMemories } from '@/content/memories/loader';
import memPack from '@/content/memories/memories.json';

describe('Phase 2A-2 witness coverage', () => {
  const allEvents = [
    ...loadEvents(daily),
    ...loadEvents(training),
    ...loadEvents(social),
    ...loadEvents(danger),
    ...loadEvents(opportunity),
    ...loadEvents(transition),
  ];
  const memories = loadMemories(memPack);

  it('every memory has at least one witness chance across Yellow Plains events', () => {
    const allWitnessRefs = new Set<string>();
    for (const ev of allEvents) {
      for (const ch of ev.choices) {
        const outs = ch.outcomes;
        for (const tier of ['CRIT_SUCCESS', 'SUCCESS', 'PARTIAL', 'FAILURE', 'CRIT_FAILURE'] as const) {
          const o = outs[tier as keyof typeof outs];
          if (o?.witnessMemory) allWitnessRefs.add(o.witnessMemory);
        }
      }
    }
    for (const m of memories) {
      expect(allWitnessRefs.has(m.id)).toBe(true);
    }
  });

  it('has at least 10 witness-annotated outcomes', () => {
    let count = 0;
    for (const ev of allEvents) {
      for (const ch of ev.choices) {
        for (const o of Object.values(ch.outcomes)) {
          if (o?.witnessMemory) count += 1;
        }
      }
    }
    expect(count).toBeGreaterThanOrEqual(10);
  });
});
```

- [ ] **Step 3: Run → PASS**

- [ ] **Step 4: Commit** `feat(content): witness_memory outcomes on 10 Yellow Plains events`

---

## Task 14: Anchor-bridging events (6 events)

**Files:**
- Modify: `src/content/events/yellow_plains/social.json` (or a new `bridge.json` — decide based on what's cleanest)

**Rationale:** 2 opening-beat events per new anchor × 3 anchors. Each event conditioned on `characterFlags.require: ['from_martial_family']` (or equivalent) + age window.

For brevity, specify 6 events as a table — full JSON for the first one, then a template for the rest.

- [ ] **Step 1: Write first event for `martial_family`**

Add to `social.json`:

```json
{
  "id": "YP_BRIDGE_MARTIAL_MORNING_DRILL",
  "category": "life.training",
  "version": 1,
  "weight": 50,
  "conditions": {
    "regions": ["yellow_plains"],
    "minAge": 8,
    "maxAge": 10,
    "characterFlags": { "require": ["from_martial_family"] }
  },
  "timeCost": "SHORT",
  "text": {
    "intro": ["$[anchor.opener.martial_family.1]"],
    "body": [],
    "outro": []
  },
  "choices": [
    {
      "id": "ch_push", "label": "Push harder than yesterday.",
      "timeCost": "SHORT",
      "check": { "base": 30, "stats": { "Body": 1, "Will": 1 }, "difficulty": 40 },
      "outcomes": {
        "SUCCESS": {
          "narrativeKey": "action.work.plowing",
          "stateDeltas": [{ "kind": "attribute_delta", "stat": "Body", "amount": 1 }],
          "unlocks": { "echoes": [] }
        },
        "FAILURE": {
          "narrativeKey": "emotion.resignation.tired",
          "stateDeltas": [{ "kind": "hp_delta", "amount": -3 }]
        }
      },
      "flagDeltas": { "set": ["martial_training_started"] }
    }
  ],
  "repeat": "once_per_life"
}
```

- [ ] **Step 2: Five more events (abbreviated)**

Author with the same structure. IDs + anchor + condition flag:

- `YP_BRIDGE_MARTIAL_SPAR_WITH_ELDER` — `from_martial_family` — age 8–10, check Body+Agility, sets flag `first_spar`
- `YP_BRIDGE_SCHOLARS_LIBRARY` — `literate` — age 10–12, check Mind, intro `$[anchor.opener.scholars_son.1]`, sets `first_formation_concept`
- `YP_BRIDGE_SCHOLARS_TUTOR_ASSESSMENT` — `literate` — age 11–13, Mind+Charm, sets `tutor_favor` OR `tutor_suspicion`
- `YP_BRIDGE_OUTER_CHORES` — `outer_sect_member` — age 15–17, Body, sets `seen_sect_hierarchy`
- `YP_BRIDGE_OUTER_OVERHEARD_LESSON` — `outer_sect_member` — age 15–18, Mind+Spirit, outcome `SUCCESS.witnessMemory = 'silent_waters_scripture'`

Full JSON for each follows the template above; narrative text keys should be reused from existing yellow_plains snippets or introduced in Task 12 if needed.

- [ ] **Step 3: Add test `src/content/events/yellow_plains/bridge.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { loadEvents } from '@/content/events/loader';
import social from './social.json';

describe('Phase 2A-2 anchor-bridging events', () => {
  const ids = loadEvents(social).map((e) => e.id);

  it('includes 2 events per new anchor (6 total)', () => {
    expect(ids).toContain('YP_BRIDGE_MARTIAL_MORNING_DRILL');
    expect(ids).toContain('YP_BRIDGE_MARTIAL_SPAR_WITH_ELDER');
    expect(ids).toContain('YP_BRIDGE_SCHOLARS_LIBRARY');
    expect(ids).toContain('YP_BRIDGE_SCHOLARS_TUTOR_ASSESSMENT');
    expect(ids).toContain('YP_BRIDGE_OUTER_CHORES');
    expect(ids).toContain('YP_BRIDGE_OUTER_OVERHEARD_LESSON');
  });
});
```

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Commit** `feat(content): 6 anchor-bridging events (2 per new anchor)`

---

## Task 15: Meditation events (3 events)

**Files:**
- Create: `src/content/events/yellow_plains/meditation.json`
- Create: `src/content/events/yellow_plains/meditation.test.ts`
- Modify: `src/content/index.ts` (or wherever event packs are loaded) to include the new file

**Rationale:** 3 events with `category: 'meditation'` so `GameLoop.runTurn` triggers the manifest roll. Each gated by min Mind or a flag so player has agency.

- [ ] **Step 1: Write `meditation.json`**

```json
{
  "version": 1,
  "events": [
    {
      "id": "YP_MEDITATION_DAWN_SITTING",
      "category": "meditation",
      "version": 1,
      "weight": 15,
      "conditions": {
        "regions": ["yellow_plains"],
        "minStat": { "Mind": 8 }
      },
      "timeCost": "MEDIUM",
      "text": {
        "intro": ["$[CHARACTER] sits, before the sun is high. The breath arrives slowly."],
        "body": [],
        "outro": []
      },
      "choices": [
        {
          "id": "ch_sit", "label": "Let the mind settle.",
          "timeCost": "MEDIUM",
          "check": { "base": 30, "stats": { "Mind": 2 }, "difficulty": 35 },
          "outcomes": {
            "SUCCESS": {
              "narrativeKey": "action.work.plowing",
              "stateDeltas": [{ "kind": "insight_delta", "amount": 2 }]
            },
            "FAILURE": {
              "narrativeKey": "emotion.resignation.tired",
              "stateDeltas": []
            }
          }
        }
      ],
      "repeat": "unlimited"
    },
    {
      "id": "YP_MEDITATION_RIVERSIDE",
      "category": "meditation",
      "version": 1,
      "weight": 10,
      "conditions": {
        "regions": ["yellow_plains"],
        "seasons": ["spring", "summer", "autumn"],
        "minStat": { "Mind": 6 }
      },
      "timeCost": "MEDIUM",
      "text": {
        "intro": ["$[CHARACTER] sits by the river. The water does not explain itself."],
        "body": [],
        "outro": []
      },
      "choices": [
        {
          "id": "ch_watch_water", "label": "Watch the water.",
          "timeCost": "MEDIUM",
          "check": { "base": 25, "stats": { "Mind": 1, "Spirit": 1 }, "difficulty": 30 },
          "outcomes": {
            "SUCCESS": {
              "narrativeKey": "action.work.plowing",
              "stateDeltas": [{ "kind": "insight_delta", "amount": 3 }]
            },
            "FAILURE": {
              "narrativeKey": "emotion.resignation.tired",
              "stateDeltas": []
            }
          }
        }
      ],
      "repeat": "unlimited"
    },
    {
      "id": "YP_MEDITATION_NIGHT_VIGIL",
      "category": "meditation",
      "version": 1,
      "weight": 8,
      "conditions": {
        "regions": ["yellow_plains"],
        "minStat": { "Mind": 10, "Spirit": 8 }
      },
      "timeCost": "LONG",
      "text": {
        "intro": ["$[CHARACTER] keeps vigil. The hours arrive and the hours pass."],
        "body": [],
        "outro": []
      },
      "choices": [
        {
          "id": "ch_vigil", "label": "Hold the watch.",
          "timeCost": "LONG",
          "check": { "base": 30, "stats": { "Mind": 1, "Spirit": 2 }, "difficulty": 45 },
          "outcomes": {
            "CRIT_SUCCESS": {
              "narrativeKey": "action.work.plowing",
              "stateDeltas": [{ "kind": "insight_delta", "amount": 8 }]
            },
            "SUCCESS": {
              "narrativeKey": "action.work.plowing",
              "stateDeltas": [{ "kind": "insight_delta", "amount": 4 }]
            },
            "FAILURE": {
              "narrativeKey": "emotion.resignation.tired",
              "stateDeltas": [{ "kind": "hp_delta", "amount": -5 }]
            }
          }
        }
      ],
      "repeat": "unlimited"
    }
  ]
}
```

- [ ] **Step 2: Test**

```ts
import { describe, it, expect } from 'vitest';
import { loadEvents } from '@/content/events/loader';
import meditation from './meditation.json';

describe('meditation events', () => {
  const events = loadEvents(meditation);
  it('has 3 events all with category meditation', () => {
    expect(events).toHaveLength(3);
    for (const e of events) expect(e.category).toBe('meditation');
  });
});
```

- [ ] **Step 3: Wire into content loader**

Whatever module aggregates Yellow Plains event packs (`src/content/events/index.ts` or similar), append the `meditation.json` import.

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Commit** `feat(content): 3 Yellow Plains meditation events`

---

## Task 16: Integration test — memory manifestation Life N → Life N+5

**Files:**
- Create: `tests/integration/memory_manifestation.test.ts`

**Rationale:** Prove Phase 2A exit criterion #2. Scripted 5-life headless playthrough. Life 1 witnesses `frost_palm_severing`. Lives 2–4 unrelated. Life 5 runs meditation events with boosted karmic upgrade `student_of_the_wheel_2`. Expected: at least one manifestation of `frost_palm_severing` in Life 5.

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createEmptyMetaState } from '@/engine/meta/MetaState';
import { commitWitnesses } from '@/engine/meta/MemoryWitnessLogger';
import { rollManifest, MANIFEST_ATTEMPTS_PER_LIFE } from '@/engine/meta/MemoryManifestResolver';
import { MemoryRegistry } from '@/engine/meta/MemoryRegistry';
import { loadMemories } from '@/content/memories/loader';
import memPack from '@/content/memories/memories.json';
import { createCharacter } from '@/engine/character/Character';
import { createRunState } from '@/engine/events/RunState';

describe('memory manifestation Life N → Life N+5', () => {
  it('frost_palm_severing witnessed Life 1 can manifest in Life 5', () => {
    const memories = loadMemories(memPack);
    const registry = MemoryRegistry.fromList(memories);
    let meta = createEmptyMetaState();

    // Life 1: witness frost_palm_severing (simulated).
    meta = commitWitnesses(meta, ['frost_palm_severing']);
    expect(meta.memoriesWitnessed.frost_palm_severing).toBe(1);

    // Lives 2–4: no relevant witnesses, just life counters.
    meta = { ...meta, lifeCount: meta.lifeCount + 3 };

    // Life 5: boosted character with karmic upgrade, runs 3 meditation events.
    meta = { ...meta, ownedUpgrades: ['student_of_the_wheel_1', 'student_of_the_wheel_2'] };

    const character = createCharacter({
      name: 'Test Life 5',
      attributes: { Body: 10, Mind: 50, Spirit: 10, Agility: 10, Charm: 10, Luck: 10 },
      rng: createRng(5),
    });
    let runState = createRunState({
      character, runSeed: 5, region: 'yellow_plains', year: 1050, season: 'autumn',
    });
    // Give character enough insight so the manifest_chance formula reliably hits.
    runState = { ...runState, character: { ...runState.character, insight: 50 } };

    let manifestedAny = false;
    for (let attempt = 0; attempt < MANIFEST_ATTEMPTS_PER_LIFE; attempt += 1) {
      runState = { ...runState, turn: runState.turn + 1 };
      const result = rollManifest({ runState, meta, registry });
      runState = result.runState;
      if (result.manifested.includes('frost_palm_severing')) {
        manifestedAny = true;
      }
    }

    expect(manifestedAny).toBe(true);
    expect(runState.character.flags).toContain('remembered_frost_palm_severing');
  });
});
```

- [ ] **Step 2: Run → PASS**

If flaky (unlikely with L2 student + Mind 50 + insight 50 + fragment level giving chance ≈ 1 + 5 + 0.5 + 5 + 50 = 61.5 → clamp 60 → 60% per attempt; across 3 attempts Pr(at-least-one) ≈ 1 − 0.4³ ≈ 0.936), bump Mind or `student_of_the_wheel_3` if available.

- [ ] **Step 3: Commit** `test(integration): memory manifestation Life N -> Life N+5 (exit criterion #2)`

---

## Task 17: Integration test — mood filter variance

**Files:**
- Create: `tests/integration/mood_filter_variance.test.ts`

**Rationale:** Prove Phase 2A exit criterion #3. Same template + same seed, two different dominant moods → different rendered text. Guards against future regressions where substitution is accidentally disabled.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { renderEvent, CompositionContext } from '@/engine/narrative/Composer';
import { NameRegistry } from '@/engine/narrative/NameRegistry';
import { createSnippetLibrary } from '@/engine/narrative/SnippetLibrary';

const event: any = {
  id: 'mood_variance_probe', category: 'daily',
  version: 1, weight: 1, timeCost: 'SHORT',
  conditions: {}, repeat: 'once_per_life',
  text: { intro: ['The warm, quiet village held its breath.'], body: [], outro: [] },
  choices: [{
    id: 'c', label: 'watch', timeCost: 'SHORT',
    outcomes: { SUCCESS: { narrativeKey: 'x' }, FAILURE: { narrativeKey: 'x' } },
  }],
};

function render(mood: 'melancholy' | 'rage'): string {
  const lib = createSnippetLibrary({});
  const reg = new NameRegistry();
  const ctx: CompositionContext = {
    characterName: 'Lin Wei', region: 'yellow_plains',
    season: 'autumn', realm: 'mortal', dominantMood: mood,
    turnIndex: 1, runSeed: 42, extraVariables: {},
  };
  return renderEvent(event, ctx, lib, reg, createRng(42));
}

describe('mood filter variance (exit criterion #3)', () => {
  it('adjective substitution produces different text under melancholy vs rage', () => {
    const mel = render('melancholy');
    const rag = render('rage');
    expect(mel).not.toBe(rag);
    expect(mel).toContain('lonely');   // warm -> lonely under melancholy
    expect(rag).toContain('stifling'); // warm -> stifling under rage
  });
});
```

- [ ] **Step 2: Run → PASS**
- [ ] **Step 3: Commit** `test(integration): mood filter variance (exit criterion #3)`

---

## Task 18: Final verification

- [ ] **Full test suite**

```
npx vitest run
```

Expected: all PASS. Target count ≈ 650 (598 after 2A-1 + ~50 new in 2A-2).

- [ ] **Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Build**

```
npx vite build
```

Expected: clean. Bundle size likely 420–430 KB raw (still under 450 KB Phase 3 budget).

- [ ] **Push + PR**

```bash
git push -u origin phase-2a2-content
```

Open PR with summary mirroring Phase 2A-1's structure: what shipped, spec bugs caught, deviations, test plan.

- [ ] **CI green → merge via `gh pr merge N --merge --delete-branch`** (fall back to `gh api` merge if local git errors due to worktree)

---

## Self-Review

- **Spec coverage:**
  - §3.1 echo roster → Task 4
  - §3.2 memory roster → Task 5
  - §3.3 MoodFilter extension → already shipped in 2A-1 (Tasks 15–17); integration proof here in Task 17
  - §4 anchors (+3) + spawnRegionFallback → Tasks 1 + 6 + 7
  - §5.1–§5.5 content authoring → Tasks 2, 3, 4, 5, 13, 14, 15
  - §5.6 snippet additions → Task 12
  - §6 UI → deferred to 2A-3 (explicit out-of-scope note)
  - §7 save migration → already shipped in 2A-1 Task 14
  - §8.2 memory manifestation integration → Task 16 (exit criterion #2)
  - §8.3 mood filter variance → Task 17 (exit criterion #3)
  - §8.4 full playable_life_2a → deferred to 2A-3 (needs UI + bridge hooks)

- **Placeholder scan:**
  - Task 14 Step 2 abbreviates 5 events to avoid plan bloat; the template is concrete (first event full JSON + table of 5 with id/anchor/condition/check/flag). Subagent uses the table to author full JSON.
  - Task 13 assignment table notes "grep to verify exact event ids"; real ids in-file control. Acceptable — the plan can't hard-code without reading the repo during plan-writing.

- **Type consistency:**
  - `EchoDef` vs `SoulEcho`: `EchoDef = z.infer<typeof EchoSchema>` is the content-schema-derived type; `SoulEcho` is the engine type. Both should be identical in shape (the schema mirrors the interface). If TS complains during integration, cast via spread rather than renaming.
  - `runBardoFlow` 4-arg signature matches `characterFromAnchor` 6-arg signature — bridge callers need updating in both Tasks 8 and 9.
  - `runTurn` signature grows by 3 args (echoTracker, memoryRegistry, plus the existing echoRegistry passed to bardo). Bridge wiring changes concentrated in one or two files.

- **Risk scan:**
  - Task 7 removes reliance on `anchor.spawn.regions` weighted list. Confirmed acceptable since `regions` now always equals `[{ id: targetRegion, weight: 1 }]` for existing anchors. Phase 3 may resurrect the weighted list when multiple regions are loaded simultaneously.
  - Task 9 leaves `died_in_same_region_streak` effectively current-life-only. Ghost-in-the-Mirror echo thus won't unlock in 2A-2 — documented trade-off; Phase 3 fixes when Imprints add per-life region tracking.
  - Task 13 retrofit assignment table is thematic-best-guess. Subagent will adjust to real event ids.

Ready for implementation.
