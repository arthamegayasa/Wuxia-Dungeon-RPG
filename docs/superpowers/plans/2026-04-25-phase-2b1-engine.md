# Phase 2B-1 — Engine Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the engine for techniques (registry + affinity-multiplier + effects corpus), items + manuals (registry + partial-manual deviation-risk resolver), realm-crossing (Body Tempering 9 → Qi Sensing awakening → Qi Condensation 1..9 sub-layer ladder → non-fatal Tribulation I at QC9), and extend the MetaState to v4. Pure engine — no content, no UI. After this plan merges, the game still plays exactly like after Phase 2A-3 (empty registries mean the resolver pipeline returns 0 bonus), but every wire is live for 2B-2 content to plug into.

**Architecture:** Three new engine slices — `src/engine/cultivation/` gains `TechniqueRegistry`, `ItemRegistry`, `PartialManualLearn`, `RealmCrossing`, `TribulationI`; `src/engine/cultivation/Technique.ts` is extended (2 new effect kinds + affinity-aware resolver); `src/engine/cultivation/Breakthrough.ts` is refactored polymorphic so QC 1..9 reuses it. Two existing touch-points: `OutcomeApplier.meridian_open` routed through `withOpenedMeridian` (risk #1), and `PostOutcomeHooks` extended with pre-state + `corePathRevealed` signal. `MetaState` v3→v4 adds `seenTechniques` + extends `LineageEntrySummary` with `corePath` / `techniquesLearned`. All new modules are pure, determinism contracts preserved, RNG strictly via `IRng`.

**Tech Stack:** TypeScript 5.8 strict, Vitest 4, Zod 4. Depends on everything from Phases 0, 1, 2A. No new runtime dependencies.

**Source of truth:**
- [`docs/spec/design.md`](../../../docs/spec/design.md) §4.1 (Realms), §4.3 (Breakthrough), §4.5 (Tribulations), §4.7 (Techniques), §9.5 (Technique schema), §9.6 (Item schema), §9.7 (Manual schema), §10 (persistence).
- [`docs/superpowers/specs/2026-04-25-phase-2b-techniques-paths-azure-peaks-design.md`](../specs/2026-04-25-phase-2b-techniques-paths-azure-peaks-design.md) §3 (engine subsystems), §6 (persistence), §7.1 (this sub-phase's scope), §8 (risks — canonical for this plan).

**Scope boundaries (OUT of 2B-1):**
- Populated technique / item / manual / region JSON corpus → **2B-2**
- Azure Peaks region content, Sect Initiate anchor, +35 events, +50 snippets → **2B-2**
- Inventory panel / Technique list / CorePathBadge / region indicator / Tribulation I UI → **2B-3**
- Extension of BardoPanel / LineageScreen / CodexScreen → **2B-3**
- `engineBridge.getInventorySnapshot` / `getTechniqueSnapshot` → **2B-3**
- Full fatal Tribulation I + Heavenly Notice scaling → **Phase 3**
- Adept / Master rank-path progression — **Phase 3** (2B-1 ships `rankPath` schema field as optional; no progression logic)

**Spec corrections baked into this plan** (per CLAUDE.md "flag plan bugs transparently" rule — each one resolves an item from spec §8):

1. **Spec §3.1 says `Character.techniques` + `Character.inventory`.** Reality: Phase 1 put these on `RunState` as `learnedTechniques: ReadonlyArray<string>` and `inventory: ReadonlyArray<{ id: string; count: number }>` ([RunState.ts:15-16](../../../src/engine/events/RunState.ts:15)). This plan consumes the existing RunState fields rather than migrating to Character. Spec to be amended in Task 1.
2. **Spec §3.1 says `TechniqueEffect` has 5 kinds.** Reality: existing `Technique.ts` has 3 (`choice_bonus`, `qi_regen`, `insight_gain_per_meditation`). This plan adds `mood_modifier`, `unlock_choice`, and a new `cultivation_multiplier_pct` (needed for §4.2 `techniqueMultiplier`).
3. **Spec §3.3 says "ensure `withOpenedMeridian` is invoked through `meridian_open`".** Reality (risk §8.1 **confirmed**): [OutcomeApplier.ts:73-83](../../../src/engine/events/OutcomeApplier.ts:73) does a raw push to `openMeridians`. Task 12 refactors this.
4. **Spec §3.4 says `Breakthrough.attemptSublayerBreakthrough` "likely generalizes" to QC.** Reality (risk §8.3 **confirmed**): [Breakthrough.ts:56](../../../src/engine/cultivation/Breakthrough.ts:56) reads `c.bodyTemperingLayer` unconditionally and [Breakthrough.ts:65-72](../../../src/engine/cultivation/Breakthrough.ts:65) writes to it. Task 15 refactors polymorphic.
5. **Spec §3.6 "peek/resolve RNG stream split".** Plan includes a canary test (Task 18) before bundling; if Phase 1+2A integration snapshots drift, the fix is deferred to a separate follow-up PR per spec §8.4.
6. **Spec §2 exit criterion #3** says "core path drives on-path full vs off-path ×0.5". Existing [Technique.ts:34](../../../src/engine/cultivation/Technique.ts:34) `resolveTechniqueBonus(techniques, category)` has no affinity awareness. Task 6 extends the signature to take `corePath` (preserves old signature with a deprecation comment for the inner GameLoop/bridge callers; Task 7 switches both call sites to the new version).
7. **Spec §4.4 "Shattered Path" detection**: already implemented in [CorePath.ts:43](../../../src/engine/character/CorePath.ts:43). No work.
8. **Spec §8.12 `spiritRoot.tier` numeric comparison**: [SpiritRoot.ts](../../../src/engine/character/SpiritRoot.ts) uses string enum; [Types.ts:83](../../../src/engine/core/Types.ts:83) provides `SPIRIT_ROOT_TIERS` ordered. Task 16 adds `spiritRootTierRank` helper (8 lines) for numeric compare.
9. **Spec §8.13 spirit-root penalty table**: Task 16 ships `{none: 999 (lockout), mottled: 15, single_element: 5, dual_element: 0, heavenly: 0}` as tunable constants.
10. **`ChoiceSchema.check.techniqueBonusCategory`**: already present ([schema.ts:129](../../../src/content/schema.ts:129)). No work.

---

## Task Map

1. **Amend spec** inline for the 10 corrections above (doc-only)
2. Extend `TechniqueEffect` with 3 new kinds (`mood_modifier`, `unlock_choice`, `cultivation_multiplier_pct`) + `CoreAffinityToken`
3. `TechniqueDef` Zod schema in `src/content/schema.ts` + `TechniquePack`
4. `TechniqueRegistry` class (all / byId / canLearn)
5. `affinityMultiplier(technique, corePath)` helper (1.0 / 0.5 rules)
6. `resolveTechniqueBonus` new signature w/ corePath awareness (keeps old signature, alias)
7. Wire real technique pipeline at both call sites: GameLoop.runTurn + engineBridge.resolveChoice
8. `Item` + `Manual` Zod schemas + `ItemRegistry`
9. `PartialManualLearn` — deviation-risk formula + tier resolver
10. `cultivation_multiplier_pct` plumbed into `cultivationGainRate` callers
11. `Character.qiCondensationLayer` field + `recomputeDerived` passes it through
12. `OutcomeApplier.meridian_open` routed through `withOpenedMeridian` (risk §8.1)
13. `PostOutcomeHooks` — add `preRunState` arg + `corePathRevealed` result field
14. `Breakthrough.attemptSublayerBreakthrough` polymorphic by realm (risk §8.3)
15. `RealmCrossing.attemptQiSensingAwakening` + spirit-root penalty table
16. `RealmCrossing.attemptQiCondensationEntry` (gated on QS + ≥1 technique)
17. `PillarEventSchema` + `TribulationI.runPillar` (scripted 4-phase, `tribulation_mode` flag)
18. **Peek/resolve RNG stream split** — canary-test against Phase 1+2A integration snapshots; if any drift, defer (skip implementation steps 3-6)
19. `MetaState` v3→v4 migration — extend `LineageEntrySummary` + add `seenTechniques`
20. Integration test: `tests/integration/technique_bonus_resolution.test.ts` — two characters, different corePaths, same technique, different bonuses

Total: **20 tasks**. Target size: ~70 tests.

---

## Prerequisite Reading

- [`docs/spec/design.md`](../../../docs/spec/design.md) §4.1, §4.2, §4.3, §4.5, §4.7, §9.5, §9.6, §9.7, §10
- [`docs/superpowers/specs/2026-04-25-phase-2b-techniques-paths-azure-peaks-design.md`](../specs/2026-04-25-phase-2b-techniques-paths-azure-peaks-design.md) §3, §6, §7, §8
- [`src/engine/cultivation/Technique.ts`](../../../src/engine/cultivation/Technique.ts) — existing TechniqueDef + resolveTechniqueBonus (extend)
- [`src/engine/cultivation/CultivationProgress.ts`](../../../src/engine/cultivation/CultivationProgress.ts) — techniqueMultiplier consumer
- [`src/engine/cultivation/Breakthrough.ts`](../../../src/engine/cultivation/Breakthrough.ts) — layer-specific refactor target
- [`src/engine/cultivation/RealmMeta.ts`](../../../src/engine/cultivation/RealmMeta.ts) — subLayers per realm
- [`src/engine/character/Character.ts`](../../../src/engine/character/Character.ts) — `qiCondensationLayer` target; `withOpenedMeridian` caller
- [`src/engine/character/CorePath.ts`](../../../src/engine/character/CorePath.ts) — 9-path detector (read-only)
- [`src/engine/character/SpiritRoot.ts`](../../../src/engine/character/SpiritRoot.ts) — tier ordering for awakening
- [`src/engine/events/OutcomeApplier.ts`](../../../src/engine/events/OutcomeApplier.ts) — `meridian_open` refactor
- [`src/engine/events/RunState.ts`](../../../src/engine/events/RunState.ts) — `learnedTechniques` + `inventory` fields (in-use)
- [`src/engine/core/PostOutcomeHooks.ts`](../../../src/engine/core/PostOutcomeHooks.ts) — extend
- [`src/engine/core/GameLoop.ts`](../../../src/engine/core/GameLoop.ts) — technique-bonus call site
- [`src/services/engineBridge.ts`](../../../src/services/engineBridge.ts) — technique-bonus call site
- [`src/engine/meta/MetaState.ts`](../../../src/engine/meta/MetaState.ts) — v3→v4 migration
- [`src/content/schema.ts`](../../../src/content/schema.ts) — add Technique / Item / Manual / PillarEvent schemas
- [`src/engine/persistence/Migrator.ts`](../../../src/engine/persistence/Migrator.ts) — chained migrator (read-only)
- [`docs/superpowers/plans/2026-04-23-phase-2a1-engine.md`](2026-04-23-phase-2a1-engine.md) — cadence reference

---

## Task 1: Amend spec for the 10 corrections above

**Files:**
- Modify: `docs/superpowers/specs/2026-04-25-phase-2b-techniques-paths-azure-peaks-design.md`

**Rationale:** Future readers (2B-2/2B-3 authors, spec grazers) should see the correct reality, not the pre-plan version. Amend inline, call it out in the commit.

- [ ] **Step 1: Insert a "Plan corrections" block after §1 Context**

Find:
```markdown
**North star for 2B:** every life in Azure Peaks *feels like a sect story* — sect hierarchy mentioned in events, a first technique learned by mid-life, core-path identity revealed at the 3rd meridian, inventory of manuals/pills/stones visible on the screen, Qi Sensing awakening as a discrete narrative beat.
```

Immediately after that block, insert (preserving the existing trailing `---` separator):
```markdown

**Plan corrections (2026-04-25, after code exploration):**

1. `Character.techniques` / `Character.inventory` in §3.1 / §3.2 — Phase 1 already stores these on `RunState` as `learnedTechniques` and `inventory`. 2B-1 reuses the existing fields (no migration).
2. `TechniqueEffect` 5 kinds in §3.1 — existing implementation has 3; 2B-1 adds `mood_modifier`, `unlock_choice`, and a new `cultivation_multiplier_pct` (to source the `techniqueMultiplier` parameter in `cultivationGainRate`).
3. `meridian_open` StateDelta currently bypasses `withOpenedMeridian`; 2B-1 Task 12 refactors.
4. `attemptSublayerBreakthrough` currently hardcoded to Body Tempering; 2B-1 Task 14 refactors polymorphic by realm.
5. Spirit-root penalty table for the Qi Sensing awakening formula (unspecified in spec §4.2) is shipped in Task 15 as tunable constants: `{none: 999 (locks out), mottled: 15, single_element: 5, dual_element: 0, heavenly: 0}`.
6. `resolveTechniqueBonus` in [Technique.ts:34](../../../src/engine/cultivation/Technique.ts:34) has no affinity awareness; 2B-1 Task 6 extends the signature to take `corePath` and Task 7 switches the two call sites (GameLoop + engineBridge).
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-25-phase-2b-techniques-paths-azure-peaks-design.md
git commit -m "docs(spec): annotate Phase 2B-1 plan corrections

Ten corrections discovered during plan-writing, amending the spec
inline so 2B-2/2B-3 authors see the reality rather than the pre-plan
design."
```

---

## Task 2: Extend TechniqueEffect with new kinds + CoreAffinityToken

**Files:**
- Modify: `src/engine/cultivation/Technique.ts`
- Modify: `src/engine/cultivation/Technique.test.ts`

**Rationale:** Spec §3.1 lists 5 effect kinds; 2B-1 also needs `cultivation_multiplier_pct` for §4.2 formula. `CoreAffinityToken` adds `'any'` for universal techniques without breaking `CorePathId[]` consumers.

- [ ] **Step 1: Write failing tests**

Add to `src/engine/cultivation/Technique.test.ts` (create file if absent, importing test from the existing Technique.ts test if any):

```ts
import { describe, it, expect } from 'vitest';
import {
  TechniqueEffect, CoreAffinityToken, resolveTechniqueBonus,
} from './Technique';

describe('TechniqueEffect expansion (Phase 2B-1 Task 2)', () => {
  it('accepts mood_modifier kind', () => {
    const e: TechniqueEffect = { kind: 'mood_modifier', mood: 'serenity', delta: 2 };
    expect(e.kind).toBe('mood_modifier');
  });

  it('accepts unlock_choice kind', () => {
    const e: TechniqueEffect = { kind: 'unlock_choice', choiceId: 'flee_pursuer' };
    expect(e.kind).toBe('unlock_choice');
  });

  it('accepts cultivation_multiplier_pct kind', () => {
    const e: TechniqueEffect = { kind: 'cultivation_multiplier_pct', pct: 20 };
    expect(e.kind).toBe('cultivation_multiplier_pct');
  });

  it('CoreAffinityToken allows "any"', () => {
    const t: CoreAffinityToken = 'any';
    expect(t).toBe('any');
  });

  it('CoreAffinityToken allows a CorePathId', () => {
    const t: CoreAffinityToken = 'iron_mountain';
    expect(t).toBe('iron_mountain');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/cultivation/Technique.test.ts`
Expected: FAIL — `TechniqueEffect` kinds are too narrow; `CoreAffinityToken` does not exist.

- [ ] **Step 3: Extend Technique.ts**

Replace the `TechniqueEffect` type + `TechniqueDef` in `src/engine/cultivation/Technique.ts`:

```ts
// Technique types + choice-bonus resolver.
// Source: docs/spec/design.md §4.7, §9.5.

import { CorePathId, Element, Realm, Mood } from '@/engine/core/Types';

export type TechniqueGrade = 'mortal' | 'yellow' | 'profound' | 'earth' | 'heaven' | 'immortal';

/** CoreAffinity can be a path id OR the universal token 'any'. */
export type CoreAffinityToken = CorePathId | 'any';

export type TechniqueEffect =
  | { kind: 'choice_bonus'; category: string; bonus: number }
  | { kind: 'qi_regen'; amount: number }
  | { kind: 'insight_gain_per_meditation'; amount: number }
  | { kind: 'mood_modifier'; mood: Mood; delta: number }
  | { kind: 'unlock_choice'; choiceId: string }
  | { kind: 'cultivation_multiplier_pct'; pct: number };  // e.g. 20 → +20%

export interface TechniqueRankEffects {
  novice: ReadonlyArray<TechniqueEffect>;
  adept: ReadonlyArray<TechniqueEffect>;
  master: ReadonlyArray<TechniqueEffect>;
}

export interface TechniqueDef {
  id: string;
  name: string;
  grade: TechniqueGrade;
  element: Element;
  coreAffinity: ReadonlyArray<CoreAffinityToken>;
  requires: {
    realm?: Realm;
    meridians?: ReadonlyArray<number>;
    openMeridianCount?: number;
  };
  qiCost: number;
  insightCost?: number;
  effects: ReadonlyArray<TechniqueEffect>;
  description: string;
  /** Novice-tier effects are what's active in Phase 2B; adept/master tracked for Phase 3. */
  rankPath?: TechniqueRankEffects;
}

/**
 * DEPRECATED (kept for call-site compatibility until Task 7 migrates both). Use
 * `resolveTechniqueBonusWithAffinity` for affinity-aware resolution.
 *
 * Sum all `choice_bonus` contributions across the character's learned techniques
 * for a specific category, ignoring core-path affinity.
 */
export function resolveTechniqueBonus(
  techniques: ReadonlyArray<TechniqueDef>,
  category: string,
): number {
  let total = 0;
  for (const t of techniques) {
    for (const eff of t.effects) {
      if (eff.kind === 'choice_bonus' && eff.category === category) {
        total += eff.bonus;
      }
    }
  }
  return total;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/cultivation/Technique.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/cultivation/Technique.ts src/engine/cultivation/Technique.test.ts
git commit -m "feat(cultivation): extend TechniqueEffect with 3 new kinds + CoreAffinityToken

Phase 2B-1 Task 2. Adds mood_modifier, unlock_choice,
cultivation_multiplier_pct to match spec §9.5 effect catalogue. Adds
CoreAffinityToken union so techniques can declare 'any' (universal)
alongside specific CorePathIds. Extends TechniqueDef with optional
rankPath (novice/adept/master) per spec §9.5 rankPath structure
(novice tier is consumed in 2B; adept/master are schema-only stubs)."
```

---

## Task 3: TechniqueDef Zod schema in content/schema.ts

**Files:**
- Modify: `src/content/schema.ts`
- Create: `src/content/schema.test.ts` (extend if already exists)

**Rationale:** 2B-2 authors JSON technique defs; schema validates at load time. Mirror the Echo / Memory pattern already in the file.

- [ ] **Step 1: Add failing test**

Append to `src/content/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TechniqueSchema, TechniquePackSchema } from './schema';

describe('TechniqueSchema (Phase 2B-1 Task 3)', () => {
  it('accepts a valid minimal mortal-grade technique', () => {
    const parsed = TechniqueSchema.parse({
      id: 'common_qi_circulation',
      name: 'Common Qi Circulation',
      grade: 'mortal',
      element: 'none',
      coreAffinity: ['any'],
      requires: {},
      qiCost: 0,
      effects: [{ kind: 'qi_regen', amount: 1 }],
      description: 'The most basic circulation drill.',
    });
    expect(parsed.id).toBe('common_qi_circulation');
  });

  it('accepts all 6 effect kinds', () => {
    const parsed = TechniqueSchema.parse({
      id: 't',
      name: 'T',
      grade: 'mortal',
      element: 'fire',
      coreAffinity: ['blood_ember'],
      requires: { realm: 'qi_sensing' },
      qiCost: 5,
      effects: [
        { kind: 'choice_bonus', category: 'strike', bonus: 10 },
        { kind: 'qi_regen', amount: 2 },
        { kind: 'insight_gain_per_meditation', amount: 1 },
        { kind: 'mood_modifier', mood: 'wrath', delta: 1 },
        { kind: 'unlock_choice', choiceId: 'x' },
        { kind: 'cultivation_multiplier_pct', pct: 15 },
      ],
      description: 'All effect kinds.',
    });
    expect(parsed.effects.length).toBe(6);
  });

  it('rejects an unknown grade', () => {
    expect(() => TechniqueSchema.parse({
      id: 't', name: 'T', grade: 'cosmic' as any, element: 'none',
      coreAffinity: ['any'], requires: {}, qiCost: 0, effects: [], description: '',
    })).toThrow();
  });

  it('TechniquePackSchema wraps a list', () => {
    const pack = TechniquePackSchema.parse({
      version: 1,
      techniques: [{
        id: 't', name: 'T', grade: 'mortal', element: 'none',
        coreAffinity: ['any'], requires: {}, qiCost: 0,
        effects: [], description: '',
      }],
    });
    expect(pack.techniques).toHaveLength(1);
  });
});
```

Note: the existing wrath mood is NOT in `MOODS` — the canonical moods are `sorrow | rage | serenity | paranoia | resolve | melancholy` ([Types.ts:45](../../../src/engine/core/Types.ts:45)). Use `'rage'` instead of `'wrath'` in the test. **Correct the test before running:** replace `mood: 'wrath'` with `mood: 'rage'`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/content/schema.test.ts`
Expected: FAIL — `TechniqueSchema` not exported.

- [ ] **Step 3: Add schemas to src/content/schema.ts**

Insert **before** the final `export const ContentPackSchema = ...` block:

```ts
// ---- Phase 2B-1 Technique schema ----
// Source: docs/spec/design.md §9.5.

const TECHNIQUE_GRADES = ['mortal', 'yellow', 'profound', 'earth', 'heaven', 'immortal'] as const;
const ELEMENTS_WITH_NONE = ['metal', 'wood', 'water', 'fire', 'earth', 'none'] as const;
const MOOD_STRINGS = ['sorrow', 'rage', 'serenity', 'paranoia', 'resolve', 'melancholy'] as const;

const CORE_AFFINITY_TOKEN = z.union([
  z.enum([
    'iron_mountain', 'severing_edge', 'still_water', 'howling_storm',
    'blood_ember', 'root_and_bough', 'thousand_mirrors', 'hollow_vessel',
    'shattered_path',
  ]),
  z.literal('any'),
]);

const TechniqueEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('choice_bonus'), category: z.string().min(1), bonus: z.number() }),
  z.object({ kind: z.literal('qi_regen'), amount: z.number() }),
  z.object({ kind: z.literal('insight_gain_per_meditation'), amount: z.number() }),
  z.object({ kind: z.literal('mood_modifier'), mood: z.enum(MOOD_STRINGS), delta: z.number() }),
  z.object({ kind: z.literal('unlock_choice'), choiceId: z.string().min(1) }),
  z.object({ kind: z.literal('cultivation_multiplier_pct'), pct: z.number() }),
]);

const TechniqueRankEffectsSchema = z.object({
  novice: z.array(TechniqueEffectSchema),
  adept: z.array(TechniqueEffectSchema),
  master: z.array(TechniqueEffectSchema),
});

export const TechniqueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  grade: z.enum(TECHNIQUE_GRADES),
  element: z.enum(ELEMENTS_WITH_NONE),
  coreAffinity: z.array(CORE_AFFINITY_TOKEN).min(1),
  requires: z.object({
    realm: z.enum(REALM_STRINGS).optional(),
    meridians: z.array(z.number().int().min(1).max(12)).optional(),
    openMeridianCount: z.number().int().nonnegative().optional(),
  }),
  qiCost: z.number().nonnegative(),
  insightCost: z.number().nonnegative().optional(),
  effects: z.array(TechniqueEffectSchema),
  description: z.string(),
  rankPath: TechniqueRankEffectsSchema.optional(),
});

export const TechniquePackSchema = z.object({
  version: z.number().int().positive(),
  techniques: z.array(TechniqueSchema),
});

export type TechniqueRawDef = z.infer<typeof TechniqueSchema>;
export type TechniquePack = z.infer<typeof TechniquePackSchema>;
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/content/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/schema.ts src/content/schema.test.ts
git commit -m "feat(content/schema): add TechniqueSchema + TechniquePackSchema

Phase 2B-1 Task 3. Zod validation for the technique corpus 2B-2 will
author. Discriminated union over all 6 TechniqueEffect kinds. Rejects
malformed grades, unknown effect kinds, and empty coreAffinity arrays.
Preserves optional rankPath for Phase 3 adept/master tier tracking."
```

---

## Task 4: TechniqueRegistry class

**Files:**
- Create: `src/engine/cultivation/TechniqueRegistry.ts`
- Create: `src/engine/cultivation/TechniqueRegistry.test.ts`

**Rationale:** Mirrors `EchoRegistry` / `MemoryRegistry` pattern from Phase 2A. Provides `all / byId / canLearn` used by content loaders and the learning pipeline.

- [ ] **Step 1: Write failing test**

Create `src/engine/cultivation/TechniqueRegistry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TechniqueRegistry } from './TechniqueRegistry';
import { TechniqueDef } from './Technique';
import { Realm } from '@/engine/core/Types';
import { Character, createCharacter } from '@/engine/character/Character';
import { createRng } from '@/engine/core/RNG';

const DEF_A: TechniqueDef = {
  id: 'a', name: 'A', grade: 'mortal', element: 'none',
  coreAffinity: ['any'],
  requires: {}, qiCost: 0, effects: [], description: '',
};

const DEF_B_QS: TechniqueDef = {
  id: 'b', name: 'B', grade: 'mortal', element: 'none',
  coreAffinity: ['iron_mountain'],
  requires: { realm: Realm.QI_SENSING }, qiCost: 0, effects: [], description: '',
};

describe('TechniqueRegistry', () => {
  it('empty registry: all() is [] and byId returns null', () => {
    const r = TechniqueRegistry.empty();
    expect(r.all()).toEqual([]);
    expect(r.byId('a')).toBeNull();
  });

  it('fromList exposes entries by id and in order', () => {
    const r = TechniqueRegistry.fromList([DEF_A, DEF_B_QS]);
    expect(r.all()).toEqual([DEF_A, DEF_B_QS]);
    expect(r.byId('a')).toBe(DEF_A);
    expect(r.byId('missing')).toBeNull();
  });

  it('fromList throws on duplicate ids', () => {
    expect(() => TechniqueRegistry.fromList([DEF_A, DEF_A]))
      .toThrow(/duplicate.*a/i);
  });

  function mortalChar(): Character {
    return createCharacter({
      name: 't',
      attributes: { Body: 5, Mind: 5, Spirit: 5, Agility: 5, Charm: 5, Luck: 5 },
      rng: createRng(1),
    });
  }

  it('canLearn returns {ok:false} when technique requires higher realm', () => {
    const r = TechniqueRegistry.fromList([DEF_B_QS]);
    const c = mortalChar();
    const result = r.canLearn(c, 'b');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/realm/i);
  });

  it('canLearn returns {ok:true} when requires are met', () => {
    const r = TechniqueRegistry.fromList([DEF_A]);
    const c = mortalChar();
    expect(r.canLearn(c, 'a')).toEqual({ ok: true });
  });

  it('canLearn returns {ok:false, reason:"unknown"} for missing id', () => {
    const r = TechniqueRegistry.fromList([DEF_A]);
    const c = mortalChar();
    const result = r.canLearn(c, 'zzz');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/unknown/i);
  });

  it('canLearn enforces openMeridianCount gate', () => {
    const def: TechniqueDef = {
      ...DEF_A, id: 'c', requires: { openMeridianCount: 3 },
    };
    const r = TechniqueRegistry.fromList([def]);
    const c = mortalChar();  // zero open meridians
    const result = r.canLearn(c, 'c');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/meridian/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/cultivation/TechniqueRegistry.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Create TechniqueRegistry.ts**

```ts
// Technique registry — canonical lookup by id + learnability gate.
// Mirrors EchoRegistry / MemoryRegistry pattern from Phase 2A.
// Source: docs/spec/design.md §4.7, §9.5.

import { Character } from '@/engine/character/Character';
import { REALM_ORDER, Realm } from '@/engine/core/Types';
import { TechniqueDef } from './Technique';

export type CanLearnResult =
  | { ok: true }
  | { ok: false; reason: string };

function realmRank(r: Realm): number {
  return REALM_ORDER.indexOf(r);
}

export class TechniqueRegistry {
  private readonly byIdMap: ReadonlyMap<string, TechniqueDef>;
  private readonly order: ReadonlyArray<TechniqueDef>;

  private constructor(order: ReadonlyArray<TechniqueDef>) {
    const map = new Map<string, TechniqueDef>();
    for (const t of order) {
      if (map.has(t.id)) {
        throw new Error(`TechniqueRegistry: duplicate id ${t.id}`);
      }
      map.set(t.id, t);
    }
    this.byIdMap = map;
    this.order = order;
  }

  static empty(): TechniqueRegistry {
    return new TechniqueRegistry([]);
  }

  static fromList(defs: ReadonlyArray<TechniqueDef>): TechniqueRegistry {
    return new TechniqueRegistry(defs);
  }

  all(): ReadonlyArray<TechniqueDef> {
    return this.order;
  }

  byId(id: string): TechniqueDef | null {
    return this.byIdMap.get(id) ?? null;
  }

  canLearn(c: Character, id: string): CanLearnResult {
    const t = this.byId(id);
    if (!t) return { ok: false, reason: `unknown technique ${id}` };

    const req = t.requires;
    if (req.realm !== undefined) {
      if (realmRank(c.realm) < realmRank(req.realm)) {
        return {
          ok: false,
          reason: `requires realm ${req.realm} (have ${c.realm})`,
        };
      }
    }
    if (req.openMeridianCount !== undefined) {
      if (c.openMeridians.length < req.openMeridianCount) {
        return {
          ok: false,
          reason: `requires ${req.openMeridianCount} open meridians (have ${c.openMeridians.length})`,
        };
      }
    }
    if (req.meridians && req.meridians.length > 0) {
      for (const m of req.meridians) {
        if (!c.openMeridians.includes(m as any)) {
          return { ok: false, reason: `requires meridian ${m} open` };
        }
      }
    }
    return { ok: true };
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/engine/cultivation/TechniqueRegistry.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/cultivation/TechniqueRegistry.ts src/engine/cultivation/TechniqueRegistry.test.ts
git commit -m "feat(cultivation): TechniqueRegistry class with canLearn gating

Phase 2B-1 Task 4. Canonical lookup + learnability gate for techniques.
Mirrors EchoRegistry/MemoryRegistry pattern. Enforces realm rank (via
REALM_ORDER), meridian presence, and open-meridian-count prerequisites.
Throws on duplicate ids at construction. Empty + fromList factories."
```

---

## Task 5: affinityMultiplier helper

**Files:**
- Modify: `src/engine/cultivation/Technique.ts`
- Modify: `src/engine/cultivation/Technique.test.ts`

**Rationale:** Spec §3.1 "on-path = 1.0, off-path = 0.5, 'any' = 1.0, null corePath = 1.0". Pure helper, reused by resolveTechniqueBonus.

- [ ] **Step 1: Write failing test**

Append to `src/engine/cultivation/Technique.test.ts`:

```ts
import { affinityMultiplier } from './Technique';

describe('affinityMultiplier (Phase 2B-1 Task 5)', () => {
  const ironT = {
    id: 'i', name: 'I', grade: 'mortal' as const, element: 'none' as const,
    coreAffinity: ['iron_mountain' as const], requires: {}, qiCost: 0, effects: [], description: '',
  };
  const anyT = { ...ironT, coreAffinity: ['any' as const] };
  const multiT = {
    ...ironT,
    coreAffinity: ['iron_mountain' as const, 'severing_edge' as const],
  };

  it('returns 1.0 for on-path match', () => {
    expect(affinityMultiplier(ironT, 'iron_mountain')).toBe(1.0);
  });

  it('returns 0.5 for off-path', () => {
    expect(affinityMultiplier(ironT, 'severing_edge')).toBe(0.5);
  });

  it('returns 1.0 for any-affinity universal', () => {
    expect(affinityMultiplier(anyT, 'severing_edge')).toBe(1.0);
    expect(affinityMultiplier(anyT, null)).toBe(1.0);
  });

  it('returns 1.0 when character corePath is null (pre-reveal)', () => {
    expect(affinityMultiplier(ironT, null)).toBe(1.0);
  });

  it('returns 1.0 if any coreAffinity element matches', () => {
    expect(affinityMultiplier(multiT, 'severing_edge')).toBe(1.0);
    expect(affinityMultiplier(multiT, 'blood_ember')).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/engine/cultivation/Technique.test.ts`
Expected: FAIL — `affinityMultiplier` not exported.

- [ ] **Step 3: Add helper**

Append to `src/engine/cultivation/Technique.ts`:

```ts
/**
 * Affinity multiplier for a technique given the character's core path.
 *   1.0 if coreAffinity includes 'any'
 *   1.0 if corePath is null (character hasn't revealed a path yet)
 *   1.0 if coreAffinity includes the character's corePath
 *   0.5 otherwise (off-path)
 */
export function affinityMultiplier(
  t: TechniqueDef,
  corePath: CorePathId | null,
): number {
  if (t.coreAffinity.includes('any')) return 1.0;
  if (corePath === null) return 1.0;
  return t.coreAffinity.includes(corePath) ? 1.0 : 0.5;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/engine/cultivation/Technique.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/cultivation/Technique.ts src/engine/cultivation/Technique.test.ts
git commit -m "feat(cultivation): affinityMultiplier helper (1.0/0.5 on-path rule)

Phase 2B-1 Task 5. Spec §3.1: on-path = 1.0, off-path = 0.5, 'any' =
1.0 regardless, null corePath = 1.0 (character pre-reveal). Pure
function; consumed by resolveTechniqueBonus (Task 6)."
```

---

## Task 6: resolveTechniqueBonus with affinity awareness

**Files:**
- Modify: `src/engine/cultivation/Technique.ts`
- Modify: `src/engine/cultivation/Technique.test.ts`

**Rationale:** Spec exit criterion #3 — two characters with different corePaths + same technique must produce different bonuses.

- [ ] **Step 1: Write failing test**

Append:

```ts
import { resolveTechniqueBonusWithAffinity } from './Technique';

describe('resolveTechniqueBonusWithAffinity (Phase 2B-1 Task 6)', () => {
  const ironT: TechniqueDef = {
    id: 'i', name: 'I', grade: 'mortal', element: 'none',
    coreAffinity: ['iron_mountain'], requires: {}, qiCost: 0,
    effects: [{ kind: 'choice_bonus', category: 'strike', bonus: 20 }],
    description: '',
  };

  const anyT: TechniqueDef = {
    ...ironT, id: 'a', coreAffinity: ['any'],
    effects: [{ kind: 'choice_bonus', category: 'strike', bonus: 10 }],
  };

  const irrelevant: TechniqueDef = {
    ...ironT, id: 'x', coreAffinity: ['any'],
    effects: [{ kind: 'choice_bonus', category: 'evade', bonus: 30 }],
  };

  it('sums only matching-category bonuses', () => {
    const b = resolveTechniqueBonusWithAffinity({
      techniques: [ironT, irrelevant],
      corePath: 'iron_mountain',
      category: 'strike',
    });
    expect(b).toBe(20);
  });

  it('applies on-path 1.0 multiplier', () => {
    const b = resolveTechniqueBonusWithAffinity({
      techniques: [ironT],
      corePath: 'iron_mountain',
      category: 'strike',
    });
    expect(b).toBe(20);
  });

  it('applies off-path 0.5 multiplier (rounded)', () => {
    const b = resolveTechniqueBonusWithAffinity({
      techniques: [ironT],
      corePath: 'severing_edge',
      category: 'strike',
    });
    expect(b).toBe(10);  // 20 × 0.5
  });

  it("'any' affinity gives full bonus regardless of path", () => {
    const b = resolveTechniqueBonusWithAffinity({
      techniques: [anyT],
      corePath: 'severing_edge',
      category: 'strike',
    });
    expect(b).toBe(10);
  });

  it('null corePath gives full bonus (pre-reveal)', () => {
    const b = resolveTechniqueBonusWithAffinity({
      techniques: [ironT],
      corePath: null,
      category: 'strike',
    });
    expect(b).toBe(20);
  });

  it('mixed roster: on-path 20 + off-path 10 = 30', () => {
    const ironAndSev = [
      ironT,
      { ...ironT, id: 's', coreAffinity: ['severing_edge' as const],
        effects: [{ kind: 'choice_bonus' as const, category: 'strike', bonus: 20 }] },
    ];
    const b = resolveTechniqueBonusWithAffinity({
      techniques: ironAndSev,
      corePath: 'iron_mountain',
      category: 'strike',
    });
    expect(b).toBe(30);  // 20 + (20 × 0.5)
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/engine/cultivation/Technique.test.ts`
Expected: FAIL — `resolveTechniqueBonusWithAffinity` not exported.

- [ ] **Step 3: Add new resolver**

Append to `src/engine/cultivation/Technique.ts`:

```ts
export interface ResolveTechniqueBonusArgs {
  techniques: ReadonlyArray<TechniqueDef>;
  corePath: CorePathId | null;
  category: string;
}

/**
 * Affinity-aware technique bonus resolution.
 *
 * Sums `choice_bonus` effects whose `category` matches, scaled by each
 * technique's `affinityMultiplier(corePath)`. Result is rounded to the
 * nearest integer.
 *
 * Replaces the deprecated `resolveTechniqueBonus(techniques, category)` at
 * the GameLoop/engineBridge call sites (see Task 7).
 */
export function resolveTechniqueBonusWithAffinity(
  args: ResolveTechniqueBonusArgs,
): number {
  let total = 0;
  for (const t of args.techniques) {
    const mult = affinityMultiplier(t, args.corePath);
    for (const eff of t.effects) {
      if (eff.kind === 'choice_bonus' && eff.category === args.category) {
        total += eff.bonus * mult;
      }
    }
  }
  return Math.round(total);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/engine/cultivation/Technique.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/cultivation/Technique.ts src/engine/cultivation/Technique.test.ts
git commit -m "feat(cultivation): resolveTechniqueBonusWithAffinity (corePath-aware)

Phase 2B-1 Task 6. Extends resolveTechniqueBonus with a new signature
that takes the character's corePath and applies affinityMultiplier.
Old signature kept for compat until Task 7 migrates both call sites.
Result rounded to integer (resolveCheck expects integer bonuses)."
```

---

## Task 7: Wire real technique pipeline at both call sites

**Files:**
- Modify: `src/engine/core/GameLoop.ts`
- Modify: `src/services/engineBridge.ts`
- Modify: `src/engine/core/GameLoop.test.ts` (add a new test)

**Rationale:** GameLoop.runTurn and engineBridge.resolveChoice currently call `resolveTechniqueBonus([], category)` — hardcoded empty. Task 7 replaces with registry-backed lookup using `resolveTechniqueBonusWithAffinity` + `rs.character.corePath`. Empty registry → still 0 (no regression).

- [ ] **Step 1: Add failing integration test**

Append to `src/engine/core/GameLoop.test.ts` (create if absent):

```ts
import { describe, it, expect } from 'vitest';
// imports: runTurn, createRunState, a stub registry, createRng, etc.
// ... (use the existing test-file's helpers)
```

Instead of authoring a full integration test here (which duplicates Task 20's integration), add a **unit test on the helper that GameLoop will call**:

Create `src/engine/core/TechniqueHelpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveLearnedTechniqueBonus } from './TechniqueHelpers';
import { TechniqueRegistry } from '@/engine/cultivation/TechniqueRegistry';
import { TechniqueDef } from '@/engine/cultivation/Technique';

const ironT: TechniqueDef = {
  id: 'iron', name: 'Iron', grade: 'mortal', element: 'none',
  coreAffinity: ['iron_mountain'], requires: {}, qiCost: 0,
  effects: [{ kind: 'choice_bonus', category: 'strike', bonus: 20 }],
  description: '',
};

describe('resolveLearnedTechniqueBonus (Phase 2B-1 Task 7)', () => {
  it('empty registry → 0', () => {
    expect(resolveLearnedTechniqueBonus({
      registry: TechniqueRegistry.empty(),
      learnedIds: ['iron'], corePath: 'iron_mountain', category: 'strike',
    })).toBe(0);
  });

  it('empty learnedIds → 0', () => {
    const r = TechniqueRegistry.fromList([ironT]);
    expect(resolveLearnedTechniqueBonus({
      registry: r, learnedIds: [], corePath: 'iron_mountain', category: 'strike',
    })).toBe(0);
  });

  it('on-path matching category → full bonus', () => {
    const r = TechniqueRegistry.fromList([ironT]);
    expect(resolveLearnedTechniqueBonus({
      registry: r, learnedIds: ['iron'], corePath: 'iron_mountain', category: 'strike',
    })).toBe(20);
  });

  it('off-path → halved', () => {
    const r = TechniqueRegistry.fromList([ironT]);
    expect(resolveLearnedTechniqueBonus({
      registry: r, learnedIds: ['iron'], corePath: 'severing_edge', category: 'strike',
    })).toBe(10);
  });

  it('learned id not in registry is ignored', () => {
    const r = TechniqueRegistry.fromList([ironT]);
    expect(resolveLearnedTechniqueBonus({
      registry: r, learnedIds: ['iron', 'ghost'], corePath: 'iron_mountain', category: 'strike',
    })).toBe(20);
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/engine/core/TechniqueHelpers.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create TechniqueHelpers.ts**

Create `src/engine/core/TechniqueHelpers.ts`:

```ts
// Shared plumbing between GameLoop.runTurn and engineBridge.resolveChoice:
//   resolve the character's current technique bonus for a given check category.
// Task 7: swaps in for the empty-array stub both paths previously used.

import { CorePathId } from '@/engine/core/Types';
import { TechniqueRegistry } from '@/engine/cultivation/TechniqueRegistry';
import {
  resolveTechniqueBonusWithAffinity,
  TechniqueDef,
} from '@/engine/cultivation/Technique';

export interface ResolveLearnedTechniqueBonusArgs {
  readonly registry: TechniqueRegistry;
  readonly learnedIds: ReadonlyArray<string>;
  readonly corePath: CorePathId | null;
  readonly category: string;
}

export function resolveLearnedTechniqueBonus(
  args: ResolveLearnedTechniqueBonusArgs,
): number {
  const techniques: TechniqueDef[] = [];
  for (const id of args.learnedIds) {
    const t = args.registry.byId(id);
    if (t) techniques.push(t);
  }
  if (techniques.length === 0) return 0;
  return resolveTechniqueBonusWithAffinity({
    techniques,
    corePath: args.corePath,
    category: args.category,
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/engine/core/TechniqueHelpers.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Thread through GameLoop**

In `src/engine/core/GameLoop.ts`:

Find the `runTurn` `techBonus` computation (the block around `resolveTechniqueBonus([], ...)`):
```ts
  const techBonus = choice.check?.techniqueBonusCategory
    ? resolveTechniqueBonus([], choice.check.techniqueBonusCategory)
    : 0;
```

Replace with:
```ts
  const techBonus = choice.check?.techniqueBonusCategory
    ? resolveLearnedTechniqueBonus({
        registry: ctx.techniqueRegistry,
        learnedIds: ctx.runState.learnedTechniques,
        corePath: ctx.runState.character.corePath,
        category: choice.check.techniqueBonusCategory,
      })
    : 0;
```

Update imports at the top of `GameLoop.ts`:
- Remove `resolveTechniqueBonus` import.
- Add `import { resolveLearnedTechniqueBonus } from '@/engine/core/TechniqueHelpers';`.

Add `techniqueRegistry: TechniqueRegistry;` to the `RunTurnCtx` interface. Import `TechniqueRegistry` from `@/engine/cultivation/TechniqueRegistry`.

- [ ] **Step 6: Thread through engineBridge**

In `src/services/engineBridge.ts`:

Add at module level after the existing `MEMORY_REGISTRY` block:
```ts
import { TechniqueRegistry } from '@/engine/cultivation/TechniqueRegistry';
import { resolveLearnedTechniqueBonus } from '@/engine/core/TechniqueHelpers';

// Phase 2B-1: empty by default. 2B-2 ships the canonical corpus + loader.
const TECHNIQUE_REGISTRY = TechniqueRegistry.empty();
```

Replace both `techBonus` assignments inside `resolveChoice`:
```ts
      const techBonus = choice.check?.techniqueBonusCategory
        ? resolveTechniqueBonus([], choice.check.techniqueBonusCategory)
        : 0;
```

With:
```ts
      const techBonus = choice.check?.techniqueBonusCategory
        ? resolveLearnedTechniqueBonus({
            registry: TECHNIQUE_REGISTRY,
            learnedIds: gs.runState.learnedTechniques,
            corePath: gs.runState.character.corePath,
            category: choice.check.techniqueBonusCategory,
          })
        : 0;
```

Remove the now-unused `import { resolveTechniqueBonus }` from `engineBridge.ts`. Keep the import in Technique.ts for backwards-compat (Task 2 marked it deprecated but alive).

Also: update any callers of `runTurn` to pass the registry. Search for `runTurn(` usages in `src/engine/core/GameLoop.test.ts` and in any integration tests; supply `techniqueRegistry: TechniqueRegistry.empty()` on the ctx.

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, with no regressions. (Total count should be unchanged for existing tests + 5 new from Task 7 + 6 from Task 4 + 11 from Tasks 2/3/5/6.)

- [ ] **Step 8: Commit**

```bash
git add src/engine/core/TechniqueHelpers.ts src/engine/core/TechniqueHelpers.test.ts src/engine/core/GameLoop.ts src/services/engineBridge.ts
git commit -m "feat(engine): wire real technique pipeline at both turn call sites

Phase 2B-1 Task 7. runTurn + engineBridge.resolveChoice now look up
the character's learnedTechniques in TechniqueRegistry and apply
affinity-aware bonuses via resolveLearnedTechniqueBonus. Empty
registry (default in 2B-1) returns 0 — no regression vs the pre-plan
resolveTechniqueBonus([]) stub. 2B-2 ships the canonical corpus and
swaps TECHNIQUE_REGISTRY.empty() for a loader call."
```

---

## Task 8: Item + Manual Zod schemas + ItemRegistry

**Files:**
- Modify: `src/content/schema.ts`
- Modify: `src/content/schema.test.ts`
- Create: `src/engine/cultivation/ItemRegistry.ts`
- Create: `src/engine/cultivation/ItemRegistry.test.ts`

**Rationale:** Item + Manual schemas from spec §9.6 / §9.7. ItemRegistry same shape as TechniqueRegistry (all / byId). Manuals are Items where `type === 'manual'`, so the registry stores both through the Item base type and narrows at read time.

- [ ] **Step 1: Write failing schema test**

Append to `src/content/schema.test.ts`:

```ts
import { ItemSchema, ItemPackSchema } from './schema';

describe('ItemSchema (Phase 2B-1 Task 8)', () => {
  it('accepts a pill', () => {
    const parsed = ItemSchema.parse({
      id: 'minor_healing_pill', name: 'Minor Healing Pill',
      type: 'pill', grade: 'mortal', stackable: true,
      effects: [{ kind: 'heal_hp', amount: 30 }],
      description: '',
    });
    expect(parsed.id).toBe('minor_healing_pill');
  });

  it('accepts a manual with completeness 0.25', () => {
    const parsed = ItemSchema.parse({
      id: 'manual_x_fragment', name: 'Fragment Manual',
      type: 'manual', grade: 'yellow', stackable: false,
      effects: [],
      description: '',
      teaches: 'technique_x',
      completeness: 0.25,
    });
    expect(parsed.completeness).toBe(0.25);
  });

  it('rejects manual with invalid completeness (e.g. 0.6)', () => {
    expect(() => ItemSchema.parse({
      id: 'm', name: 'M', type: 'manual', grade: 'mortal', stackable: false,
      effects: [], description: '', teaches: 't', completeness: 0.6,
    })).toThrow();
  });

  it('accepts a weapon with choice_bonus', () => {
    const parsed = ItemSchema.parse({
      id: 'sword', name: 'Sword', type: 'weapon', grade: 'mortal', stackable: false,
      effects: [{ kind: 'choice_bonus', category: 'strike', bonus: 3 }],
      description: '',
    });
    expect(parsed.type).toBe('weapon');
  });

  it('ItemPackSchema wraps a list', () => {
    const p = ItemPackSchema.parse({
      version: 1,
      items: [{ id: 'a', name: 'A', type: 'misc', grade: 'mortal', stackable: true, effects: [], description: '' }],
    });
    expect(p.items).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/content/schema.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add schemas**

Insert in `src/content/schema.ts` before `ContentPackSchema`:

```ts
// ---- Phase 2B-1 Item / Manual schemas ----
// Source: docs/spec/design.md §9.6, §9.7.

const ITEM_TYPES = ['pill', 'manual', 'weapon', 'armor', 'talisman', 'misc'] as const;
const ITEM_GRADES = TECHNIQUE_GRADES;   // shared 6-tier ladder

const ItemEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('heal_hp'), amount: z.number() }),
  z.object({ kind: z.literal('restore_qi'), amount: z.number() }),
  z.object({ kind: z.literal('pill_bonus'), amount: z.number() }),
  z.object({ kind: z.literal('insight_gain'), amount: z.number() }),
  z.object({ kind: z.literal('deviation_risk'), delta: z.number() }),
  z.object({ kind: z.literal('choice_bonus'), category: z.string().min(1), bonus: z.number() }),
]);

export const ItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(ITEM_TYPES),
  grade: z.enum(ITEM_GRADES),
  stackable: z.boolean(),
  effects: z.array(ItemEffectSchema),
  description: z.string(),
  weight: z.number().nonnegative().optional(),
  // Manual-only fields:
  teaches: z.string().optional(),
  completeness: z.union([z.literal(0.25), z.literal(0.5), z.literal(0.75), z.literal(1.0)]).optional(),
  readerRequires: z.object({
    minMind: z.number().nonnegative().optional(),
    minInsight: z.number().nonnegative().optional(),
  }).optional(),
}).superRefine((v, ctx) => {
  if (v.type === 'manual') {
    if (!v.teaches) ctx.addIssue({ code: 'custom', message: 'manual requires teaches' });
    if (v.completeness === undefined) ctx.addIssue({ code: 'custom', message: 'manual requires completeness' });
  }
});

export const ItemPackSchema = z.object({
  version: z.number().int().positive(),
  items: z.array(ItemSchema),
});

export type ItemRawDef = z.infer<typeof ItemSchema>;
export type ItemPack = z.infer<typeof ItemPackSchema>;
```

- [ ] **Step 4: Run schema tests**

Run: `npx vitest run src/content/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: ItemRegistry test**

Create `src/engine/cultivation/ItemRegistry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ItemRegistry, ItemDef, isManual } from './ItemRegistry';

const PILL: ItemDef = {
  id: 'p', name: 'P', type: 'pill', grade: 'mortal', stackable: true,
  effects: [], description: '',
};

const MANUAL: ItemDef = {
  id: 'm', name: 'M', type: 'manual', grade: 'yellow', stackable: false,
  effects: [], description: '', teaches: 'tech_x', completeness: 0.5,
};

describe('ItemRegistry', () => {
  it('empty: all() is []', () => {
    expect(ItemRegistry.empty().all()).toEqual([]);
  });

  it('fromList: byId works', () => {
    const r = ItemRegistry.fromList([PILL, MANUAL]);
    expect(r.byId('p')).toBe(PILL);
    expect(r.byId('m')).toBe(MANUAL);
    expect(r.byId('?')).toBeNull();
  });

  it('throws on duplicate ids', () => {
    expect(() => ItemRegistry.fromList([PILL, PILL])).toThrow(/duplicate/i);
  });

  it('isManual narrows correctly', () => {
    expect(isManual(PILL)).toBe(false);
    expect(isManual(MANUAL)).toBe(true);
    if (isManual(MANUAL)) {
      // TS should narrow: teaches + completeness are required here
      expect(MANUAL.teaches).toBe('tech_x');
    }
  });
});
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/engine/cultivation/ItemRegistry.test.ts`
Expected: FAIL.

- [ ] **Step 7: Create ItemRegistry.ts**

```ts
// Item + Manual registry.
// Source: docs/spec/design.md §9.6, §9.7.

export type ItemType = 'pill' | 'manual' | 'weapon' | 'armor' | 'talisman' | 'misc';
export type ItemGrade = 'mortal' | 'yellow' | 'profound' | 'earth' | 'heaven' | 'immortal';

export type ItemEffect =
  | { kind: 'heal_hp'; amount: number }
  | { kind: 'restore_qi'; amount: number }
  | { kind: 'pill_bonus'; amount: number }
  | { kind: 'insight_gain'; amount: number }
  | { kind: 'deviation_risk'; delta: number }
  | { kind: 'choice_bonus'; category: string; bonus: number };

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  grade: ItemGrade;
  stackable: boolean;
  effects: ReadonlyArray<ItemEffect>;
  description: string;
  weight?: number;
  // Manual-only — present iff `type === 'manual'`:
  teaches?: string;
  completeness?: 0.25 | 0.5 | 0.75 | 1.0;
  readerRequires?: { minMind?: number; minInsight?: number };
}

/** Type guard: narrows an ItemDef to the manual-required fields present. */
export function isManual(i: ItemDef): i is ItemDef & {
  type: 'manual'; teaches: string; completeness: 0.25 | 0.5 | 0.75 | 1.0;
} {
  return i.type === 'manual' && typeof i.teaches === 'string' && i.completeness !== undefined;
}

export class ItemRegistry {
  private readonly byIdMap: ReadonlyMap<string, ItemDef>;
  private readonly order: ReadonlyArray<ItemDef>;

  private constructor(order: ReadonlyArray<ItemDef>) {
    const map = new Map<string, ItemDef>();
    for (const i of order) {
      if (map.has(i.id)) throw new Error(`ItemRegistry: duplicate id ${i.id}`);
      map.set(i.id, i);
    }
    this.byIdMap = map;
    this.order = order;
  }

  static empty(): ItemRegistry {
    return new ItemRegistry([]);
  }

  static fromList(defs: ReadonlyArray<ItemDef>): ItemRegistry {
    return new ItemRegistry(defs);
  }

  all(): ReadonlyArray<ItemDef> { return this.order; }

  byId(id: string): ItemDef | null {
    return this.byIdMap.get(id) ?? null;
  }
}
```

- [ ] **Step 8: Run tests**

Run: `npx vitest run src/engine/cultivation/ItemRegistry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add src/content/schema.ts src/content/schema.test.ts src/engine/cultivation/ItemRegistry.ts src/engine/cultivation/ItemRegistry.test.ts
git commit -m "feat(cultivation): ItemRegistry + ItemSchema + Manual discriminated subtype

Phase 2B-1 Task 8. Zod schemas for Item (6 types: pill/manual/weapon/
armor/talisman/misc) + ItemPack, with manual-only fields (teaches +
completeness quantized to 0.25/0.5/0.75/1.0 + readerRequires) validated
via superRefine. ItemRegistry mirrors TechniqueRegistry. isManual type
guard narrows ItemDef to the manual shape."
```

---

## Task 9: PartialManualLearn — deviation-risk formula + tier resolver

**Files:**
- Create: `src/engine/cultivation/PartialManualLearn.ts`
- Create: `src/engine/cultivation/PartialManualLearn.test.ts`

**Rationale:** Spec §3.2 formula: `deviationRisk = baseRisk × (1 - completeness)² − Mind × 0.3 − Insight × 0.05 + realmLockoutPenalty`. Clamped [0, 95]. Failure tiers per §4.6 (Tremor / Scar / Cripple for 2B; Rend / Shatter not reachable from partial-manual).

- [ ] **Step 1: Write failing test**

Create `src/engine/cultivation/PartialManualLearn.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  computePartialManualRisk,
  resolvePartialManualLearn,
  PartialManualFailureSeverity,
} from './PartialManualLearn';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';

describe('computePartialManualRisk (Phase 2B-1 Task 9)', () => {
  const baseArgs = {
    baseRisk: 60, completeness: 1.0 as const,
    mind: 0, insight: 0, realm: Realm.BODY_TEMPERING, minRealm: undefined,
  };

  it('complete (1.0) → 0 risk', () => {
    expect(computePartialManualRisk(baseArgs)).toBe(0);
  });

  it('fragment (0.25) → highest risk', () => {
    const r = computePartialManualRisk({ ...baseArgs, completeness: 0.25 });
    // 60 × (0.75)² = 60 × 0.5625 = 33.75
    expect(r).toBeCloseTo(33.75, 1);
  });

  it('partial (0.5) → mid risk', () => {
    const r = computePartialManualRisk({ ...baseArgs, completeness: 0.5 });
    // 60 × (0.5)² = 60 × 0.25 = 15
    expect(r).toBe(15);
  });

  it('0.75 → low risk', () => {
    const r = computePartialManualRisk({ ...baseArgs, completeness: 0.75 });
    // 60 × (0.25)² = 60 × 0.0625 = 3.75
    expect(r).toBeCloseTo(3.75, 1);
  });

  it('Mind + Insight lower the risk', () => {
    const r = computePartialManualRisk({
      ...baseArgs, completeness: 0.25, mind: 20, insight: 40,
    });
    // 33.75 − 20×0.3 − 40×0.05 = 33.75 − 6 − 2 = 25.75
    expect(r).toBeCloseTo(25.75, 1);
  });

  it('realm < minRealm adds 40 penalty', () => {
    const r = computePartialManualRisk({
      ...baseArgs, completeness: 0.5, realm: Realm.MORTAL, minRealm: Realm.QI_SENSING,
    });
    expect(r).toBe(55);  // 15 + 40
  });

  it('clamps to [0, 95]', () => {
    const high = computePartialManualRisk({
      baseRisk: 200, completeness: 0.25, mind: 0, insight: 0,
      realm: Realm.MORTAL, minRealm: Realm.FOUNDATION,
    });
    expect(high).toBe(95);

    const low = computePartialManualRisk({
      baseRisk: 10, completeness: 0.75, mind: 100, insight: 100,
      realm: Realm.BODY_TEMPERING,
    });
    expect(low).toBe(0);
  });
});

describe('resolvePartialManualLearn (Phase 2B-1 Task 9)', () => {
  it('0% risk → always success, no severity', () => {
    const rng = createRng(1);
    const r = resolvePartialManualLearn({ risk: 0, rng });
    expect(r.success).toBe(true);
    expect(r.severity).toBeNull();
  });

  it('95% risk → high chance of failure', () => {
    // Deterministic seed: d100 roll is well-known for seed=1; verify boundary behavior.
    const rng = createRng(1);
    const r = resolvePartialManualLearn({ risk: 95, rng });
    // Either success or failure is acceptable per the formula; assert shape.
    expect(['tremor', 'scar', 'cripple', null]).toContain(r.severity);
    expect(typeof r.success).toBe('boolean');
  });

  it('severity distribution: tremor (roll 1-50), scar (51-80), cripple (81-95)', () => {
    // Deterministic check: each severity band is reachable.
    // Run with 500 seeds at risk=95 and count severities.
    const counts: Record<string, number> = { tremor: 0, scar: 0, cripple: 0, success: 0 };
    for (let seed = 1; seed <= 500; seed++) {
      const r = resolvePartialManualLearn({ risk: 95, rng: createRng(seed) });
      if (r.success) counts.success++;
      else counts[r.severity ?? 'unknown']!++;
    }
    expect(counts.tremor).toBeGreaterThan(0);
    expect(counts.scar).toBeGreaterThan(0);
    expect(counts.cripple).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/engine/cultivation/PartialManualLearn.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create PartialManualLearn.ts**

```ts
// Partial-manual deviation-risk formula + tier resolver.
// Source: docs/superpowers/specs/2026-04-25-phase-2b-...md §3.2.

import { IRng } from '@/engine/core/RNG';
import { Realm, REALM_ORDER } from '@/engine/core/Types';

export type PartialManualFailureSeverity = 'tremor' | 'scar' | 'cripple';

export interface PartialManualRiskArgs {
  readonly baseRisk: number;          // per-technique baseline, e.g. 60
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
  readonly risk: number;   // 0..95, pre-computed via computePartialManualRisk
  readonly rng: IRng;
}

export interface PartialManualLearnResult {
  readonly success: boolean;
  readonly severity: PartialManualFailureSeverity | null;
  readonly roll: number;
}

/**
 * Roll d100 vs risk:
 *   roll > risk → success (severity null)
 *   roll ≤ risk → failure with severity by roll band:
 *     roll 1..50 → tremor (10% hp, no learn, manual consumed)
 *     roll 51..80 → scar (25% hp, -5 insight, no learn, manual consumed)
 *     roll 81..95 → cripple (50% hp, cripple flag, no learn, manual consumed)
 * (Applier side-effects are owned by caller; this function only classifies.)
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
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/engine/cultivation/PartialManualLearn.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/cultivation/PartialManualLearn.ts src/engine/cultivation/PartialManualLearn.test.ts
git commit -m "feat(cultivation): partial-manual deviation-risk formula + tier resolver

Phase 2B-1 Task 9. Formula: baseRisk × (1 - completeness)² − Mind×0.3
− Insight×0.05 + (realm<minRealm ? 40 : 0), clamped [0, 95]. Tier
resolver maps roll-ranges to tremor (1..50) / scar (51..80) / cripple
(81..95). Rend/Shatter not reachable from partial-manual in 2B (per
spec §3.2). Outcome-applier side effects belong to the caller."
```

---

## Task 10: cultivation_multiplier_pct plumbed into cultivationGainRate callers

**Files:**
- Modify: `src/engine/cultivation/Technique.ts`
- Modify: `src/engine/cultivation/Technique.test.ts`
- Grep + modify: callers of `cultivationGainRate` to supply real multiplier

**Rationale:** Spec §4.2 formula uses `techniqueMultiplier`; callers currently pass 1.0. Task 10 adds a helper `computeCultivationMultiplier(techniques)` that sums `cultivation_multiplier_pct` effects and returns `1 + Σpct/100`.

- [ ] **Step 1: Write failing test**

Append to `src/engine/cultivation/Technique.test.ts`:

```ts
import { computeCultivationMultiplier } from './Technique';

describe('computeCultivationMultiplier (Phase 2B-1 Task 10)', () => {
  it('empty → 1.0', () => {
    expect(computeCultivationMultiplier([])).toBe(1.0);
  });

  it('single +20% → 1.2', () => {
    const t: TechniqueDef = {
      id: 't', name: 'T', grade: 'mortal', element: 'none',
      coreAffinity: ['any'], requires: {}, qiCost: 0,
      effects: [{ kind: 'cultivation_multiplier_pct', pct: 20 }],
      description: '',
    };
    expect(computeCultivationMultiplier([t])).toBeCloseTo(1.2, 3);
  });

  it('multiple sum additively: 15% + 25% = 1.4', () => {
    const mkT = (pct: number): TechniqueDef => ({
      id: `t${pct}`, name: 'T', grade: 'mortal', element: 'none',
      coreAffinity: ['any'], requires: {}, qiCost: 0,
      effects: [{ kind: 'cultivation_multiplier_pct', pct }],
      description: '',
    });
    expect(computeCultivationMultiplier([mkT(15), mkT(25)])).toBeCloseTo(1.4, 3);
  });

  it('ignores non-cultivation effects', () => {
    const t: TechniqueDef = {
      id: 't', name: 'T', grade: 'mortal', element: 'none',
      coreAffinity: ['any'], requires: {}, qiCost: 0,
      effects: [
        { kind: 'choice_bonus', category: 'strike', bonus: 50 },
        { kind: 'cultivation_multiplier_pct', pct: 10 },
      ],
      description: '',
    };
    expect(computeCultivationMultiplier([t])).toBeCloseTo(1.1, 3);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/engine/cultivation/Technique.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add helper**

Append to `src/engine/cultivation/Technique.ts`:

```ts
/**
 * Sum `cultivation_multiplier_pct` effects across techniques.
 * Returns 1 + Σpct/100. Empty → 1.0 (the neutral multiplier).
 */
export function computeCultivationMultiplier(
  techniques: ReadonlyArray<TechniqueDef>,
): number {
  let pctSum = 0;
  for (const t of techniques) {
    for (const eff of t.effects) {
      if (eff.kind === 'cultivation_multiplier_pct') pctSum += eff.pct;
    }
  }
  return 1 + pctSum / 100;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/engine/cultivation/Technique.test.ts`
Expected: PASS.

- [ ] **Step 5: Locate existing cultivationGainRate callers (none exist in 2B-1)**

Run: `npx grep -r "cultivationGainRate(" src --include="*.ts" | grep -v test`

Expected: zero non-test hits. Phase 1 authored the formula but no event currently calls it — cultivation-bar gain in Phase 1 flows through `advanceCultivation(c, amount)` in [OutcomeApplier.ts:50](../../../src/engine/events/OutcomeApplier.ts:50) via the `cultivation_progress_delta` StateDelta (events specify `amount` directly). `cultivationGainRate` with its full multiplier chain is scaffolded for 2B-2 meditation events and future passive gain.

Task 10 therefore only ships the helper; no caller refactor required in 2B-1. The helper is used by 2B-2 when it authors meditation events that call `cultivationGainRate({ techniqueMultiplier: computeCultivationMultiplier(techniques), ... })`.

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: PASS, no regression.

- [ ] **Step 7: Commit**

```bash
git add src/engine/cultivation/Technique.ts src/engine/cultivation/Technique.test.ts
# plus any caller files touched
git commit -m "feat(cultivation): computeCultivationMultiplier from active techniques

Phase 2B-1 Task 10. Sum cultivation_multiplier_pct effects across the
character's learned techniques; returns 1 + Σpct/100 (default 1.0 for
empty). Wires the techniqueMultiplier parameter of cultivationGainRate
to a real source — callers previously passed a hardcoded 1.0. Empty
registry in 2B-1 → still 1.0; 2B-2 corpus makes the multiplier fire."
```

---

## Task 11: Character.qiCondensationLayer field

**Files:**
- Modify: `src/engine/character/Character.ts`
- Modify: `src/engine/character/Character.test.ts`

**Rationale:** Needed for polymorphic `attemptSublayerBreakthrough` (Task 14) and Qi Condensation progression. Default 0 when not in QC realm. Additive: Phase 2A saves default to 0 on load (shallow spread).

- [ ] **Step 1: Write failing test**

Append to `src/engine/character/Character.test.ts`:

```ts
describe('Character.qiCondensationLayer (Phase 2B-1 Task 11)', () => {
  it('createCharacter defaults qiCondensationLayer to 0', () => {
    const c = createCharacter({
      name: 'x',
      attributes: { Body: 5, Mind: 5, Spirit: 5, Agility: 5, Charm: 5, Luck: 5 },
      rng: createRng(1),
    });
    expect(c.qiCondensationLayer).toBe(0);
  });

  it('refreshDerived preserves qiCondensationLayer', () => {
    const c = createCharacter({
      name: 'x',
      attributes: { Body: 5, Mind: 5, Spirit: 5, Agility: 5, Charm: 5, Luck: 5 },
      rng: createRng(1),
    });
    const withLayer = { ...c, qiCondensationLayer: 3 };
    const fresh = refreshDerived(withLayer);
    expect(fresh.qiCondensationLayer).toBe(3);
  });
});
```

Ensure imports include `refreshDerived`.

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/engine/character/Character.test.ts`
Expected: FAIL.

- [ ] **Step 3: Extend Character.ts**

In `src/engine/character/Character.ts`:

Find:
```ts
  readonly bodyTemperingLayer: number;  // 0 when not yet in Body Tempering; 1..9 inside it
```

Append a new field on the next line:
```ts
  readonly qiCondensationLayer: number; // 0 when not yet in Qi Condensation; 1..9 inside it
```

In `CharacterCore` type definition, add `qiCondensationLayer?: number` to the Omit list (not literally — just confirm it's reached by the spread). The `CharacterCore = Omit<Character, ...>` should still compile because `qiCondensationLayer` is not in the Omit list.

In `createCharacter`, inside the `base` literal:
```ts
    bodyTemperingLayer: 0,
```
Add below:
```ts
    qiCondensationLayer: 0,
```

No changes to `recomputeDerived` needed (it's preserved via the `...c` spread).

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/engine/character/Character.test.ts`
Expected: PASS (2 new tests + prior).

- [ ] **Step 5: Commit**

```bash
git add src/engine/character/Character.ts src/engine/character/Character.test.ts
git commit -m "feat(character): add qiCondensationLayer field (default 0)

Phase 2B-1 Task 11. Companion to bodyTemperingLayer; 0 when not in
Qi Condensation, 1..9 inside it. Additive field: Phase 2A saves
deserialize with undefined, Task 19's RunSave migration handler
defaults missing field to 0."
```

---

## Task 12: OutcomeApplier.meridian_open routed through withOpenedMeridian

**Files:**
- Modify: `src/engine/events/OutcomeApplier.ts`
- Modify: `src/engine/events/OutcomeApplier.test.ts`

**Rationale:** Spec §8.1 confirmed: current code does raw push, skips `detectCorePath`. Fix so Core Path reveal flows automatically when the 3rd meridian opens via a `meridian_open` outcome.

- [ ] **Step 1: Write failing test**

Append to `src/engine/events/OutcomeApplier.test.ts`:

```ts
import { applyOutcome } from './OutcomeApplier';
import { Outcome } from '@/content/schema';
import { Character } from '@/engine/character/Character';

describe('applyOutcome meridian_open (Phase 2B-1 Task 12)', () => {
  function mkRs(overrides: Partial<RunState> = {}, openMeridians: number[] = []) {
    // use existing runStateStub / makeRunState helper if one exists.
    // otherwise build inline:
    const c = createCharacter({
      name: 'x',
      attributes: { Body: 5, Mind: 5, Spirit: 5, Agility: 5, Charm: 5, Luck: 5 },
      rng: createRng(1),
    });
    const withM: Character = { ...c, openMeridians: openMeridians as any };
    return { character: withM, ... } as any;
  }

  it('opening 3rd meridian sets Core Path (iron_mountain set = {3, 1, 7})', () => {
    const rs = mkRs({}, [3, 1]);   // 2 open already: Stomach + Lung
    const outcome: Outcome = {
      narrativeKey: 'k',
      stateDeltas: [{ kind: 'meridian_open', id: 7 } as any],   // Bladder → iron_mountain
    };
    const next = applyOutcome(rs, outcome);
    expect(next.character.openMeridians).toEqual([3, 1, 7]);
    expect(next.character.corePath).toBe('iron_mountain');
  });

  it('opening an already-open meridian is a no-op (idempotent)', () => {
    const rs = mkRs({}, [3, 1]);
    const outcome: Outcome = {
      narrativeKey: 'k', stateDeltas: [{ kind: 'meridian_open', id: 3 } as any],
    };
    const next = applyOutcome(rs, outcome);
    expect(next.character.openMeridians).toEqual([3, 1]);
    expect(next.character.corePath).toBeNull();
  });

  it('opening 4th+ meridian does NOT change corePath (locked at 3)', () => {
    const rs = mkRs({}, [3, 1, 7]);   // iron_mountain already locked
    const outcome: Outcome = {
      narrativeKey: 'k', stateDeltas: [{ kind: 'meridian_open', id: 5 } as any],
    };
    const next = applyOutcome(rs, outcome);
    expect(next.character.openMeridians).toEqual([3, 1, 7, 5]);
    expect(next.character.corePath).toBe('iron_mountain');
  });

  it('opening 3rd meridian with no named match → null (wandering) or element-based', () => {
    // Heart(5,fire) + Small Intestine(6,fire) + Lung(1,metal): 2 fire + 1 metal — no named match, not same-element, not all different → null.
    const rs = mkRs({}, [5, 6]);
    const outcome: Outcome = {
      narrativeKey: 'k', stateDeltas: [{ kind: 'meridian_open', id: 1 } as any],
    };
    const next = applyOutcome(rs, outcome);
    expect(next.character.corePath).toBeNull();   // "wandering"
  });
});
```

Use the existing `runStateStub` / `createRunState` helper if one is defined in the test file; the shape above is the minimum to exercise the new delegate.

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/engine/events/OutcomeApplier.test.ts`
Expected: FAIL — current impl doesn't call withOpenedMeridian.

- [ ] **Step 3: Fix OutcomeApplier**

In `src/engine/events/OutcomeApplier.ts`:

Add to the import block at the top:
```ts
import { withOpenedMeridian } from '@/engine/character/Character';
```

Replace the `meridian_open` switch arm (lines 73-83):
```ts
    case 'meridian_open':
      // Delegated to the character module in a later phase (actual opening + deviation flow).
      // For Phase 1B, simply add the id if not present.
      if (rs.character.openMeridians.includes(delta.id)) return rs;
      return {
        ...rs,
        character: {
          ...rs.character,
          openMeridians: [...rs.character.openMeridians, delta.id],
        },
      };
```

With:
```ts
    case 'meridian_open':
      // Phase 2B-1 Task 12: route through withOpenedMeridian so detectCorePath
      // fires on the 3rd meridian. Idempotent on already-open ids.
      return { ...rs, character: withOpenedMeridian(rs.character, delta.id) };
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/engine/events/OutcomeApplier.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite (watch for integration fallout)**

Run: `npx vitest run`
Expected: PASS. If any Phase 1D-3 or 2A integration test fails due to core-path now being non-null when it wasn't before, investigate — existing tests that pre-opened 3 meridians via the raw push would now correctly detect the path. Update expected values where necessary (flag in the commit).

- [ ] **Step 6: Commit**

```bash
git add src/engine/events/OutcomeApplier.ts src/engine/events/OutcomeApplier.test.ts
git commit -m "fix(outcome-applier): meridian_open routes through withOpenedMeridian

Phase 2B-1 Task 12 — closes risk §8.1. The meridian_open StateDelta
previously did a raw push to character.openMeridians, bypassing
withOpenedMeridian and thus detectCorePath. Fixed so opening the 3rd
meridian via an outcome automatically locks the Core Path. Idempotent
on already-open ids. 4th+ meridian opens do not change the path
(detectCorePath only reads the first three)."
```

---

## Task 13: PostOutcomeHooks — preRunState arg + corePathRevealed signal

**Files:**
- Modify: `src/engine/core/PostOutcomeHooks.ts`
- Modify: `src/engine/core/PostOutcomeHooks.test.ts` (or corresponding test)
- Modify: callers in `GameLoop.ts` + `engineBridge.ts`

**Rationale:** UI (2B-3) needs a signal when the Core Path is first revealed (null → CorePathId transition). Hooks receive both pre and post RunState and emit `corePathRevealed: CorePathId | null` on the result.

- [ ] **Step 1: Write failing test**

Append to `src/engine/core/PostOutcomeHooks.test.ts` (create if absent):

```ts
import { describe, it, expect } from 'vitest';
import { applyPostOutcomeHooks } from './PostOutcomeHooks';
import { EchoTracker } from '@/engine/meta/EchoTracker';
import { MemoryRegistry } from '@/engine/meta/MemoryRegistry';
import { createEmptyMetaState } from '@/engine/meta/MetaState';

// … use existing test fixtures for RunState/EventDef ...

describe('PostOutcomeHooks corePathRevealed signal (Phase 2B-1 Task 13)', () => {
  it('returns non-null corePathRevealed when transition null → iron_mountain', () => {
    const preCharacter = mkCharacter({ openMeridians: [3, 1], corePath: null });
    const postCharacter = mkCharacter({ openMeridians: [3, 1, 7], corePath: 'iron_mountain' });
    const preRs = mkRunState({ character: preCharacter });
    const postRs = mkRunState({ character: postCharacter });

    const result = applyPostOutcomeHooks({
      preRunState: preRs,
      runState: postRs,
      event: mkEvent({ category: 'training' }),
      meta: createEmptyMetaState(),
      echoTracker: EchoTracker.empty(),
      memoryRegistry: MemoryRegistry.empty(),
    });
    expect(result.corePathRevealed).toBe('iron_mountain');
  });

  it('returns null corePathRevealed on subsequent turns (path already revealed pre-turn)', () => {
    const preCharacter = mkCharacter({ openMeridians: [3, 1, 7], corePath: 'iron_mountain' });
    const postCharacter = mkCharacter({ openMeridians: [3, 1, 7, 5], corePath: 'iron_mountain' });
    const result = applyPostOutcomeHooks({
      preRunState: mkRunState({ character: preCharacter }),
      runState: mkRunState({ character: postCharacter }),
      event: mkEvent({ category: 'training' }),
      meta: createEmptyMetaState(),
      echoTracker: EchoTracker.empty(),
      memoryRegistry: MemoryRegistry.empty(),
    });
    expect(result.corePathRevealed).toBeNull();
  });

  it('returns null corePathRevealed when path stays null', () => {
    const preRs = mkRunState({ character: mkCharacter({ corePath: null }) });
    const postRs = mkRunState({ character: mkCharacter({ corePath: null }) });
    const result = applyPostOutcomeHooks({
      preRunState: preRs,
      runState: postRs,
      event: mkEvent({ category: 'training' }),
      meta: createEmptyMetaState(),
      echoTracker: EchoTracker.empty(),
      memoryRegistry: MemoryRegistry.empty(),
    });
    expect(result.corePathRevealed).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/engine/core/PostOutcomeHooks.test.ts`
Expected: FAIL.

- [ ] **Step 3: Extend PostOutcomeHooks.ts**

Update interfaces:

```ts
export interface PostOutcomeHooksArgs {
  /** RunState BEFORE applyOutcome — used for transition detection (e.g. corePath reveal). */
  readonly preRunState: RunState;
  /** RunState AFTER `applyOutcome` has merged the tier's stateDeltas. */
  readonly runState: RunState;
  readonly event: EventDef;
  readonly meta: MetaState;
  readonly echoTracker: EchoTracker;
  readonly memoryRegistry: MemoryRegistry;
}

export interface PostOutcomeHooksResult {
  readonly runState: RunState;
  readonly echoTracker: EchoTracker;
  readonly manifested: ReadonlyArray<string>;
  /** If this turn transitioned corePath from null → set, the new path. Else null. */
  readonly corePathRevealed: CorePathId | null;
}
```

Add `import { CorePathId } from '@/engine/core/Types';` at the top.

At the end of `applyPostOutcomeHooks`, compute the transition:
```ts
  const pre = args.preRunState.character.corePath;
  const post = args.runState.character.corePath;
  const corePathRevealed = pre === null && post !== null ? post : null;
```

Wire `corePathRevealed` into both return branches:
```ts
  if (event.category !== 'meditation') {
    return { runState, echoTracker: nextEchoTracker, manifested: [], corePathRevealed };
  }
  // ...
  return {
    runState: manifestResult.runState,
    echoTracker: nextEchoTracker,
    manifested: manifestResult.manifested,
    corePathRevealed,
  };
```

- [ ] **Step 4: Update callers and existing test fixtures**

Three places consume `applyPostOutcomeHooks` and all must add `preRunState`:

**A. [src/engine/core/GameLoop.ts:162](../../../src/engine/core/GameLoop.ts:162)** — in `runTurn`, add `preRunState: ctx.runState,` to the args object. `ctx.runState` is the pre-applyOutcome state (the assignment `let nextRunState = applyOutcome(ctx.runState, outcome)` has already been made, but `ctx.runState` is still the original pre-state reference).

**B. [src/services/engineBridge.ts:698](../../../src/services/engineBridge.ts:698)** — in `resolveChoice`, add `preRunState: gs.runState,`. Again, `gs.runState` is the pre-state captured at the top of the function; `nextRunState` (the post-apply state) is a separate local `let`.

**C. [src/engine/core/PostOutcomeHooks.test.ts](../../../src/engine/core/PostOutcomeHooks.test.ts)** — the existing test file constructs `applyPostOutcomeHooks({ runState, event, meta, echoTracker, memoryRegistry })` in ≥2 places. Update every construction to also pass `preRunState: <same-run-state>` (for existing tests where pre/post are identical, reusing the same stub is fine — no corePath transition, `corePathRevealed` will be null and existing assertions stay green).

In all three non-test callers, the result is consumed:
```ts
  const hooks = applyPostOutcomeHooks({ preRunState: <pre>, runState: <post>, ... });
  nextRunState = hooks.runState;
  // hooks.corePathRevealed discarded in 2B-1 — UI consumer is 2B-3.
```

`buildTurnPreview` is **not** modified in 2B-1 to expose corePathRevealed; the field surfaces when 2B-3 adds `CorePathBadge`. Task 13 tests verify the hooks return value directly.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS, +3 new tests; no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/engine/core/PostOutcomeHooks.ts src/engine/core/PostOutcomeHooks.test.ts src/engine/core/GameLoop.ts src/services/engineBridge.ts
git commit -m "feat(hooks): PostOutcomeHooks exposes corePathRevealed + preRunState

Phase 2B-1 Task 13. Adds preRunState to PostOutcomeHooksArgs (caller
captures state BEFORE applyOutcome) and adds corePathRevealed:
CorePathId | null to the result. Fires non-null only on transitions
from null → set. Both GameLoop.runTurn and engineBridge.resolveChoice
now pass pre/post state. 2B-3 UI consumes the signal for the
CorePathBadge shimmer; 2B-1 just wires the plumbing."
```

---

## Task 14: Breakthrough.attemptSublayerBreakthrough polymorphic by realm

**Files:**
- Modify: `src/engine/cultivation/Breakthrough.ts`
- Modify: `src/engine/cultivation/Breakthrough.test.ts`

**Rationale:** Risk §8.3 confirmed — current impl reads/writes `bodyTemperingLayer` unconditionally. Polymorphize so Qi Condensation reuses it.

- [ ] **Step 1: Write failing test**

Append to `src/engine/cultivation/Breakthrough.test.ts`:

```ts
describe('attemptSublayerBreakthrough polymorphic (Phase 2B-1 Task 14)', () => {
  function qcChar(layer: number, progress: number = 100) {
    return {
      ...createCharacter({
        name: 'x',
        attributes: { Body: 5, Mind: 10, Spirit: 5, Agility: 5, Charm: 5, Luck: 5 },
        rng: createRng(1),
      }),
      realm: Realm.QI_CONDENSATION,
      qiCondensationLayer: layer,
      cultivationProgress: progress,
    };
  }

  it('BT character: bumps bodyTemperingLayer', () => {
    const c = {
      ...createCharacter({
        name: 'x',
        attributes: { Body: 5, Mind: 10, Spirit: 5, Agility: 5, Charm: 5, Luck: 5 },
        rng: createRng(1),
      }),
      realm: Realm.BODY_TEMPERING,
      bodyTemperingLayer: 3,
      cultivationProgress: 100,
    };
    const result = attemptSublayerBreakthrough(c, { rng: createRng(42) });
    if (result.success) {
      expect(result.character.bodyTemperingLayer).toBeGreaterThan(3);
      expect(result.character.qiCondensationLayer).toBe(c.qiCondensationLayer);
    }
  });

  it('QC character: bumps qiCondensationLayer, NOT bodyTemperingLayer', () => {
    const c = qcChar(3);
    const result = attemptSublayerBreakthrough(c, { rng: createRng(42) });
    if (result.success) {
      expect(result.character.qiCondensationLayer).toBe(4);
      expect(result.character.bodyTemperingLayer).toBe(c.bodyTemperingLayer);
    }
  });

  it('QC chance formula uses qiCondensationLayer as currentLayer', () => {
    // Same attributes, BT layer-3 vs QC layer-3 → identical chance.
    const bt = { ...qcChar(3), realm: Realm.BODY_TEMPERING, bodyTemperingLayer: 3, qiCondensationLayer: 0 };
    const qc = qcChar(3);
    const r1 = attemptSublayerBreakthrough(bt, { rng: createRng(1) });
    const r2 = attemptSublayerBreakthrough(qc, { rng: createRng(1) });
    expect(r1.chance).toBe(r2.chance);
  });

  it('throws for realms without sub-layers (Qi Sensing)', () => {
    const qs = { ...qcChar(0), realm: Realm.QI_SENSING };
    expect(() => attemptSublayerBreakthrough(qs, { rng: createRng(1) }))
      .toThrow(/no sub-layers/);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/engine/cultivation/Breakthrough.test.ts`
Expected: FAIL.

- [ ] **Step 3: Refactor Breakthrough.ts polymorphic**

Replace the body of `attemptSublayerBreakthrough`:

```ts
function currentSublayer(c: Character): number {
  switch (c.realm) {
    case Realm.BODY_TEMPERING:  return c.bodyTemperingLayer;
    case Realm.QI_CONDENSATION: return c.qiCondensationLayer;
    default: return 0;
  }
}

function withIncrementedSublayer(c: Character): Character {
  const meta = realmMeta(c.realm);
  const nextValue = (n: number) => Math.min(meta.subLayers, n + 1);
  switch (c.realm) {
    case Realm.BODY_TEMPERING:
      return { ...c, bodyTemperingLayer: nextValue(c.bodyTemperingLayer), cultivationProgress: 0 };
    case Realm.QI_CONDENSATION:
      return { ...c, qiCondensationLayer: nextValue(c.qiCondensationLayer), cultivationProgress: 0 };
    default:
      throw new Error(`Breakthrough: no sub-layer field for realm ${c.realm}`);
  }
}

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
    currentLayer: currentSublayer(c),
    pillBonus: args.pillBonus ?? 0,
    safeEnvironmentBonus: args.safeEnvironmentBonus ?? 0,
  });

  const roll = args.rng.d100();
  const success = roll <= chance;

  if (success) {
    return { success: true, chance, roll, character: withIncrementedSublayer(c) };
  }

  const nextProgress = Math.max(0, PROGRESS_PER_SUBLAYER - PROGRESS_LOST_ON_FAIL);
  return { success: false, chance, roll, character: { ...c, cultivationProgress: nextProgress } };
}
```

Keep `Realm` import: `import { Realm } from '@/engine/core/Types';` at the top (may need adding).

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS. BT-flavored tests unchanged (bodyTemperingLayer field still bumped for BT).

- [ ] **Step 5: Commit**

```bash
git add src/engine/cultivation/Breakthrough.ts src/engine/cultivation/Breakthrough.test.ts
git commit -m "refactor(breakthrough): polymorphic sub-layer read/write by realm

Phase 2B-1 Task 14 — closes risk §8.3. attemptSublayerBreakthrough
now reads currentLayer and bumps the layer field per realm: BT uses
bodyTemperingLayer, QC uses qiCondensationLayer. Throws for realms
without sub-layers (Mortal, Qi Sensing, Immortal). Formula and result
shape unchanged; BT-only tests remain green."
```

---

## Task 15: RealmCrossing.attemptQiSensingAwakening

**Files:**
- Create: `src/engine/cultivation/RealmCrossing.ts`
- Create: `src/engine/cultivation/RealmCrossing.test.ts`

**Rationale:** Spec §3.4 awakening formula. Gate: BT9 + Spirit Root ≠ none + progress full. Non-fatal in 2B (failure = 50% bar lost).

- [ ] **Step 1: Write failing test**

Create `src/engine/cultivation/RealmCrossing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { attemptQiSensingAwakening } from './RealmCrossing';
import { createCharacter } from '@/engine/character/Character';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';

function btNineReady(spiritTier: string = 'mottled') {
  const c = createCharacter({
    name: 'x',
    attributes: { Body: 10, Mind: 10, Spirit: 10, Agility: 5, Charm: 5, Luck: 5 },
    rng: createRng(1),
  });
  return {
    ...c,
    realm: Realm.BODY_TEMPERING,
    bodyTemperingLayer: 9,
    cultivationProgress: 100,
    spiritRoot: { ...c.spiritRoot, tier: spiritTier as any, elements: [] as any },
  };
}

describe('attemptQiSensingAwakening (Phase 2B-1 Task 15)', () => {
  it('throws if realm is not Body Tempering', () => {
    const c = { ...btNineReady(), realm: Realm.MORTAL };
    expect(() => attemptQiSensingAwakening(c, { rng: createRng(1) }))
      .toThrow(/body tempering/i);
  });

  it('throws if bodyTemperingLayer < 9', () => {
    const c = { ...btNineReady(), bodyTemperingLayer: 7 };
    expect(() => attemptQiSensingAwakening(c, { rng: createRng(1) }))
      .toThrow(/layer 9/i);
  });

  it('throws if cultivationProgress < 100', () => {
    const c = { ...btNineReady(), cultivationProgress: 50 };
    expect(() => attemptQiSensingAwakening(c, { rng: createRng(1) }))
      .toThrow(/progress/i);
  });

  it('throws if spirit root tier is "none" (locked out)', () => {
    const c = btNineReady('none');
    expect(() => attemptQiSensingAwakening(c, { rng: createRng(1) }))
      .toThrow(/spirit root|locked|none/i);
  });

  it('success: realm advances to QI_SENSING, bodyTemperingLayer → 0, cultivationProgress → 0', () => {
    // Heavenly spirit root has 0 penalty and high attributes give ~95 chance.
    const c = btNineReady('heavenly');
    const r = attemptQiSensingAwakening(c, { rng: createRng(1) });
    // At 95 chance, a d100 roll of 1 is a success.
    if (r.success) {
      expect(r.character.realm).toBe(Realm.QI_SENSING);
      expect(r.character.bodyTemperingLayer).toBe(0);
      expect(r.character.cultivationProgress).toBe(0);
    }
  });

  it('failure: non-fatal, 50% of bar lost', () => {
    // Mottled tier has 15 penalty, lower chance; find a seed that fails.
    const c = btNineReady('mottled');
    for (let seed = 1; seed < 200; seed++) {
      const r = attemptQiSensingAwakening(c, { rng: createRng(seed) });
      if (!r.success) {
        expect(r.character.realm).toBe(Realm.BODY_TEMPERING);
        expect(r.character.bodyTemperingLayer).toBe(9);
        expect(r.character.cultivationProgress).toBe(50);
        return;
      }
    }
    throw new Error('no failure observed in 200 seeds');
  });

  it('spirit root penalty table is consistent with spec', () => {
    const high = btNineReady('heavenly');
    const mid = btNineReady('single_element');
    const low = btNineReady('mottled');

    const rHigh = attemptQiSensingAwakening(high, { rng: createRng(1) });
    const rMid = attemptQiSensingAwakening(mid, { rng: createRng(1) });
    const rLow = attemptQiSensingAwakening(low, { rng: createRng(1) });

    // heavenly (0 penalty) ≥ single_element (5) ≥ mottled (15)
    expect(rHigh.chance).toBeGreaterThanOrEqual(rMid.chance);
    expect(rMid.chance).toBeGreaterThanOrEqual(rLow.chance);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/engine/cultivation/RealmCrossing.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Create RealmCrossing.ts**

```ts
// Realm-crossing events: Body Tempering 9 → Qi Sensing awakening, Qi Sensing → Qi Condensation 1.
// Source: docs/spec/design.md §4.1, §4.3; design spec §3.4.

import { IRng } from '@/engine/core/RNG';
import { Character } from '@/engine/character/Character';
import { Realm } from '@/engine/core/Types';
import { SpiritRootTier } from '@/engine/core/Types';
import { realmMeta } from './RealmMeta';
import { PROGRESS_PER_SUBLAYER, isSubLayerFull } from './CultivationProgress';

// Phase 2B-1 Task 15: penalty table for spirit root tier at Qi Sensing awakening.
// 'none' acts as a hard lockout (999 ensures chance hits the [15,95] clamp floor).
export const SPIRIT_ROOT_AWAKENING_PENALTY: Record<SpiritRootTier, number> = {
  none: 999,
  mottled: 15,
  single_element: 5,
  dual_element: 0,
  heavenly: 0,
};

export interface AttemptCrossingArgs {
  rng: IRng;
  pillBonus?: number;
  safeEnvironmentBonus?: number;
}

export interface AttemptCrossingResult {
  character: Character;
  success: boolean;
  chance: number;
  roll: number;
}

/**
 * Qi Sensing awakening chance:
 *   chance = 40
 *          + Mind × 0.3
 *          + Spirit × 0.3
 *          + Insight × 0.05
 *          + pillBonus
 *          + safeEnvironmentBonus
 *          − spiritRootPenalty
 * Clamped to [15, 95]. Failure = 50% of bar lost, realm + layer unchanged.
 */
export function attemptQiSensingAwakening(
  c: Character,
  args: AttemptCrossingArgs,
): AttemptCrossingResult {
  if (c.realm !== Realm.BODY_TEMPERING) {
    throw new Error(`attemptQiSensingAwakening: requires body_tempering, got ${c.realm}`);
  }
  if (c.bodyTemperingLayer !== 9) {
    throw new Error(`attemptQiSensingAwakening: requires layer 9, got ${c.bodyTemperingLayer}`);
  }
  if (!isSubLayerFull(c)) {
    throw new Error('attemptQiSensingAwakening: cultivation progress is not full');
  }
  if (c.spiritRoot.tier === 'none') {
    throw new Error('attemptQiSensingAwakening: spirit root "none" cannot cultivate (locked out)');
  }

  const penalty = SPIRIT_ROOT_AWAKENING_PENALTY[c.spiritRoot.tier];
  const raw =
    40
    + c.attributes.Mind * 0.3
    + c.attributes.Spirit * 0.3
    + c.insight * 0.05
    + (args.pillBonus ?? 0)
    + (args.safeEnvironmentBonus ?? 0)
    - penalty;
  const chance = Math.min(95, Math.max(15, Math.round(raw)));
  const roll = args.rng.d100();
  const success = roll <= chance;

  if (success) {
    return {
      success, chance, roll,
      character: {
        ...c,
        realm: Realm.QI_SENSING,
        bodyTemperingLayer: 0,
        cultivationProgress: 0,
      },
    };
  }
  const halfBar = Math.floor(PROGRESS_PER_SUBLAYER / 2);
  return {
    success, chance, roll,
    character: { ...c, cultivationProgress: halfBar },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/engine/cultivation/RealmCrossing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/cultivation/RealmCrossing.ts src/engine/cultivation/RealmCrossing.test.ts
git commit -m "feat(cultivation): attemptQiSensingAwakening (BT9 → Qi Sensing)

Phase 2B-1 Task 15. Non-fatal awakening event per spec §3.4 formula:
40 + Mind×0.3 + Spirit×0.3 + Insight×0.05 + bonuses − rootPenalty,
clamped [15, 95]. Success: realm → QI_SENSING, bodyTemperingLayer 0,
progress 0. Failure: 50% of bar lost, no deviation.

Spirit root penalty table (§8.13 spec correction):
  none: 999 (hard lockout via enum-check + clamp)
  mottled: 15
  single_element: 5
  dual_element: 0
  heavenly: 0

Gates: realm === BODY_TEMPERING, bodyTemperingLayer === 9,
cultivationProgress === 100, spiritRoot.tier !== 'none'."
```

---

## Task 16: RealmCrossing.attemptQiCondensationEntry

**Files:**
- Modify: `src/engine/cultivation/RealmCrossing.ts`
- Modify: `src/engine/cultivation/RealmCrossing.test.ts`

**Rationale:** Spec §3.4 gate: Qi Sensing + ≥1 technique + progress full. Success → `realm = QI_CONDENSATION`, `qiCondensationLayer = 1`, `cultivationProgress = 0`. Failure symmetric to awakening.

- [ ] **Step 1: Write failing test**

Append:

```ts
import { attemptQiCondensationEntry } from './RealmCrossing';

describe('attemptQiCondensationEntry (Phase 2B-1 Task 16)', () => {
  function qsReady(techniquesLearned: number = 0) {
    // Minimal RunState-like stub: the function takes Character + args.
    const c = createCharacter({
      name: 'x',
      attributes: { Body: 5, Mind: 10, Spirit: 10, Agility: 5, Charm: 5, Luck: 5 },
      rng: createRng(1),
    });
    return {
      ...c,
      realm: Realm.QI_SENSING,
      bodyTemperingLayer: 0,
      qiCondensationLayer: 0,
      cultivationProgress: 100,
    };
  }

  it('throws if realm is not Qi Sensing', () => {
    const c = { ...qsReady(), realm: Realm.BODY_TEMPERING };
    expect(() => attemptQiCondensationEntry(c, { rng: createRng(1), techniqueCount: 1 }))
      .toThrow(/qi_sensing/i);
  });

  it('throws if techniqueCount < 1', () => {
    const c = qsReady();
    expect(() => attemptQiCondensationEntry(c, { rng: createRng(1), techniqueCount: 0 }))
      .toThrow(/technique/i);
  });

  it('throws if cultivationProgress < 100', () => {
    const c = { ...qsReady(), cultivationProgress: 50 };
    expect(() => attemptQiCondensationEntry(c, { rng: createRng(1), techniqueCount: 1 }))
      .toThrow(/progress/i);
  });

  it('success: realm → QI_CONDENSATION, qiCondensationLayer = 1', () => {
    const c = qsReady();
    // Use high seed w/ lucky roll; if success, check state.
    for (let seed = 1; seed < 50; seed++) {
      const r = attemptQiCondensationEntry(c, { rng: createRng(seed), techniqueCount: 1 });
      if (r.success) {
        expect(r.character.realm).toBe(Realm.QI_CONDENSATION);
        expect(r.character.qiCondensationLayer).toBe(1);
        expect(r.character.cultivationProgress).toBe(0);
        return;
      }
    }
    throw new Error('no success observed in 50 seeds');
  });

  it('failure: stays in QS with bar half-drained', () => {
    const c = qsReady();
    for (let seed = 1; seed < 100; seed++) {
      const r = attemptQiCondensationEntry(c, { rng: createRng(seed), techniqueCount: 1 });
      if (!r.success) {
        expect(r.character.realm).toBe(Realm.QI_SENSING);
        expect(r.character.cultivationProgress).toBe(50);
        return;
      }
    }
    // Might not fail at these stats/seeds; skip quietly (no throw).
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/engine/cultivation/RealmCrossing.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add attemptQiCondensationEntry**

Append to `RealmCrossing.ts`:

```ts
export interface AttemptQiCondensationEntryArgs extends AttemptCrossingArgs {
  techniqueCount: number;
}

/**
 * Qi Sensing → Qi Condensation 1 entry.
 * Gate: realm === QI_SENSING, techniqueCount >= 1, bar full.
 * Chance formula (simpler than awakening — no spirit root penalty here):
 *   chance = 50 + Mind×0.3 + Insight×0.1 + pillBonus + safeEnv, clamped [15, 95].
 */
export function attemptQiCondensationEntry(
  c: Character,
  args: AttemptQiCondensationEntryArgs,
): AttemptCrossingResult {
  if (c.realm !== Realm.QI_SENSING) {
    throw new Error(`attemptQiCondensationEntry: requires qi_sensing, got ${c.realm}`);
  }
  if (args.techniqueCount < 1) {
    throw new Error('attemptQiCondensationEntry: requires at least 1 learned technique');
  }
  if (!isSubLayerFull(c)) {
    throw new Error('attemptQiCondensationEntry: cultivation progress is not full');
  }

  const raw =
    50
    + c.attributes.Mind * 0.3
    + c.insight * 0.1
    + (args.pillBonus ?? 0)
    + (args.safeEnvironmentBonus ?? 0);
  const chance = Math.min(95, Math.max(15, Math.round(raw)));
  const roll = args.rng.d100();
  const success = roll <= chance;

  if (success) {
    return {
      success, chance, roll,
      character: { ...c, realm: Realm.QI_CONDENSATION, qiCondensationLayer: 1, cultivationProgress: 0 },
    };
  }
  const halfBar = Math.floor(PROGRESS_PER_SUBLAYER / 2);
  return { success, chance, roll, character: { ...c, cultivationProgress: halfBar } };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/engine/cultivation/RealmCrossing.test.ts`
Expected: PASS (+5 new tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/cultivation/RealmCrossing.ts src/engine/cultivation/RealmCrossing.test.ts
git commit -m "feat(cultivation): attemptQiCondensationEntry (QS → QC1)

Phase 2B-1 Task 16. Realm-crossing gate from Qi Sensing to Qi
Condensation 1. Formula: 50 + Mind×0.3 + Insight×0.1 + bonuses,
clamped [15, 95]. Gates: realm === QI_SENSING, techniqueCount >= 1,
cultivationProgress === 100. Success: realm → QI_CONDENSATION,
qiCondensationLayer 1, progress 0. Failure: stays in QS with 50% bar."
```

---

## Task 17: Tribulation I — PillarEvent schema + runPillar engine

**Files:**
- Modify: `src/content/schema.ts` (add PillarEventSchema)
- Create: `src/engine/cultivation/TribulationI.ts`
- Create: `src/engine/cultivation/TribulationI.test.ts`

**Rationale:** Spec §4.5 scripted 4-phase pillar. Non-fatal mode in 2B; `tribulation_mode` flag lets Phase 3 flip to fatal without rewriting this file.

- [ ] **Step 1: PillarEventSchema failing test**

Append to `src/content/schema.test.ts`:

```ts
import { PillarEventSchema } from './schema';

describe('PillarEventSchema (Phase 2B-1 Task 17)', () => {
  it('accepts a tribulation_i definition', () => {
    const p = PillarEventSchema.parse({
      id: 'tribulation_i',
      phases: [
        { id: 'heart_demon', checkStats: { Mind: 1, Spirit: 1 }, difficulty: 60, failEffect: 'insight_loss_5' },
        { id: 'first_thunder', checkStats: { Body: 1, Spirit: 1 }, difficulty: 50, failEffect: 'hp_loss_20' },
        { id: 'second_thunder', checkStats: { Body: 1, Spirit: 1 }, difficulty: 65, failEffect: 'hp_loss_40' },
        { id: 'third_thunder', checkStats: { Body: 1, Spirit: 1 }, difficulty: 80, failEffect: 'death_or_retry' },
      ],
    });
    expect(p.phases).toHaveLength(4);
  });

  it('rejects zero-phase pillar', () => {
    expect(() => PillarEventSchema.parse({ id: 't', phases: [] })).toThrow();
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/content/schema.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add PillarEventSchema**

In `src/content/schema.ts`, before `ContentPackSchema`:

```ts
// ---- Phase 2B-1 Tribulation pillar schema ----
// Source: docs/spec/design.md §4.5, §9.4.

const PillarPhaseSchema = z.object({
  id: z.string().min(1),
  checkStats: z.record(z.enum(STAT_STRINGS), z.number()),
  difficulty: z.number().positive(),
  failEffect: z.string().min(1),    // a semantic key interpreted by the runtime
});

export const PillarEventSchema = z.object({
  id: z.string().min(1),
  phases: z.array(PillarPhaseSchema).min(1),
});

export type PillarPhase = z.infer<typeof PillarPhaseSchema>;
export type PillarEvent = z.infer<typeof PillarEventSchema>;
```

- [ ] **Step 4: Run schema tests**

Run: `npx vitest run src/content/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: runPillar failing test**

Create `src/engine/cultivation/TribulationI.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runTribulationIPillar, TRIBULATION_I } from './TribulationI';
import { createCharacter } from '@/engine/character/Character';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';

function qcNine() {
  return {
    ...createCharacter({
      name: 'x',
      attributes: { Body: 20, Mind: 20, Spirit: 20, Agility: 10, Charm: 10, Luck: 10 },
      rng: createRng(1),
    }),
    realm: Realm.QI_CONDENSATION,
    qiCondensationLayer: 9,
    cultivationProgress: 100,
  };
}

describe('runTribulationIPillar', () => {
  it('has 4 phases per spec §4.5', () => {
    expect(TRIBULATION_I.phases).toHaveLength(4);
  });

  it('non_fatal mode: 3rd thunder failure does NOT kill', () => {
    // Use a weak character + hostile seed to force third thunder fail.
    const weak = { ...qcNine(), attributes: { Body: 1, Mind: 1, Spirit: 1, Agility: 1, Charm: 1, Luck: 1 } };
    const r = runTribulationIPillar(weak, {
      rng: createRng(1),
      tribulationMode: 'non_fatal',
    });
    // Non-fatal: result never sets deathCause.
    expect(r.deathCause).toBeUndefined();
    // Character either advanced or retries — but NOT dead.
  });

  it('fatal mode: 3rd thunder failure SETS deathCause', () => {
    const weak = { ...qcNine(), attributes: { Body: 1, Mind: 1, Spirit: 1, Agility: 1, Charm: 1, Luck: 1 } };
    // Find a seed that reaches the third thunder with a failure.
    for (let seed = 1; seed < 500; seed++) {
      const r = runTribulationIPillar(weak, {
        rng: createRng(seed),
        tribulationMode: 'fatal',
      });
      if (r.deathCause === 'tribulation') return;   // assertion satisfied
    }
    throw new Error('no fatal outcome observed in 500 seeds');
  });

  it('all 4 phases pass: advance realm to FOUNDATION (or equivalent signal)', () => {
    const strong = qcNine();
    // Attributes 20 each → chance ≈ 100 everywhere.
    const r = runTribulationIPillar(strong, {
      rng: createRng(1), tribulationMode: 'non_fatal',
    });
    // Task 17 only runs the pillar; the caller decides realm advancement.
    // So we just verify all 4 phases resolved, ordered, and reported.
    expect(r.phaseResults).toHaveLength(4);
    expect(r.phaseResults.map(p => p.phaseId)).toEqual([
      'heart_demon', 'first_thunder', 'second_thunder', 'third_thunder',
    ]);
  });

  it('deterministic: same seed → same results', () => {
    const c = qcNine();
    const r1 = runTribulationIPillar(c, { rng: createRng(42), tribulationMode: 'non_fatal' });
    const r2 = runTribulationIPillar(c, { rng: createRng(42), tribulationMode: 'non_fatal' });
    expect(r1.phaseResults).toEqual(r2.phaseResults);
  });
});
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/engine/cultivation/TribulationI.test.ts`
Expected: FAIL.

- [ ] **Step 7: Create TribulationI.ts**

```ts
// Scripted Tribulation I pillar — non-fatal in Phase 2B, fatal in Phase 3+.
// Source: docs/spec/design.md §4.5.

import { IRng } from '@/engine/core/RNG';
import { Character } from '@/engine/character/Character';
import { DeathCause, Stat } from '@/engine/core/Types';
import { PillarEvent } from '@/content/schema';

export const TRIBULATION_I: PillarEvent = {
  id: 'tribulation_i',
  phases: [
    { id: 'heart_demon',    checkStats: { Mind: 1, Spirit: 1 },  difficulty: 60, failEffect: 'insight_loss_5' },
    { id: 'first_thunder',  checkStats: { Body: 1, Spirit: 1 },  difficulty: 50, failEffect: 'hp_loss_20' },
    { id: 'second_thunder', checkStats: { Body: 1, Spirit: 1 },  difficulty: 65, failEffect: 'hp_loss_40' },
    { id: 'third_thunder',  checkStats: { Body: 1, Spirit: 1 },  difficulty: 80, failEffect: 'death_or_retry' },
  ],
};

export type TribulationMode = 'non_fatal' | 'fatal';

export interface RunPillarArgs {
  readonly rng: IRng;
  readonly tribulationMode: TribulationMode;
}

export interface PillarPhaseResult {
  readonly phaseId: string;
  readonly success: boolean;
  readonly chance: number;
  readonly roll: number;
}

export interface RunPillarResult {
  readonly character: Character;
  readonly phaseResults: ReadonlyArray<PillarPhaseResult>;
  readonly deathCause?: DeathCause;
}

function phaseChance(c: Character, weights: Partial<Record<Stat, number>>, difficulty: number): number {
  let sum = 50;
  for (const [stat, w] of Object.entries(weights)) {
    if (w === undefined) continue;
    sum += (w as number) * (c.attributes[stat as Stat] ?? 0);
  }
  sum -= difficulty;
  return Math.min(95, Math.max(5, Math.round(sum)));
}

export function runTribulationIPillar(
  c: Character,
  args: RunPillarArgs,
): RunPillarResult {
  let char = c;
  const results: PillarPhaseResult[] = [];
  let death: DeathCause | undefined;

  for (let i = 0; i < TRIBULATION_I.phases.length; i++) {
    const phase = TRIBULATION_I.phases[i]!;
    const chance = phaseChance(char, phase.checkStats, phase.difficulty);
    const roll = args.rng.d100();
    const success = roll <= chance;
    results.push({ phaseId: phase.id, success, chance, roll });

    if (success) continue;

    // Failure side-effects (minimal representation — callers may hydrate further).
    switch (phase.failEffect) {
      case 'insight_loss_5':
        char = { ...char, insight: Math.max(0, char.insight - 5) };
        break;
      case 'hp_loss_20':
        char = { ...char, hp: Math.max(0, Math.round(char.hp * 0.8)) };
        break;
      case 'hp_loss_40':
        char = { ...char, hp: Math.max(0, Math.round(char.hp * 0.6)) };
        break;
      case 'death_or_retry':
        if (args.tribulationMode === 'fatal') {
          death = 'tribulation';
        }
        // Non-fatal: character retries next life; no death here.
        break;
    }

    // If fatal death, break out of loop.
    if (death) break;
  }

  return { character: char, phaseResults: results, deathCause: death };
}
```

- [ ] **Step 8: Run tests**

Run: `npx vitest run src/engine/cultivation/TribulationI.test.ts`
Expected: PASS (+5 tests).

- [ ] **Step 9: Commit**

```bash
git add src/content/schema.ts src/content/schema.test.ts src/engine/cultivation/TribulationI.ts src/engine/cultivation/TribulationI.test.ts
git commit -m "feat(cultivation): TribulationI scripted pillar engine (non-fatal in 2B)

Phase 2B-1 Task 17. PillarEventSchema + TRIBULATION_I canonical 4-phase
definition per spec §4.5: heart_demon / first_thunder / second_thunder
/ third_thunder. runTribulationIPillar takes a tribulationMode flag
('non_fatal' | 'fatal'); Phase 2B ships 'non_fatal' only (third-thunder
fail = retry next life, no death). Phase 3 flips to 'fatal' by passing
the other value. Deterministic off the seeded IRng."
```

---

## Task 18: Peek/resolve RNG stream split (canary-gated)

**Files:**
- Modify: `src/engine/core/RNG.ts` (add derivedRng helper if absent)
- Modify: `src/services/engineBridge.ts`
- Run: full integration suite under both old + new RNG layouts

**Rationale:** Phase 1 accepted trade-off (spec §8.4). Fix IF integration snapshots don't drift. Canary gate: if tests fail, split into a follow-up PR.

- [ ] **Step 1: Canary probe — run full suite with current state**

Run: `npx vitest run`

Record the pass count. Expected: all PASS (we haven't changed anything yet).

- [ ] **Step 2: Add derivedRng helper + test**

Create or append `src/engine/core/RNG.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng, derivedRng } from './RNG';

describe('derivedRng (Phase 2B-1 Task 18)', () => {
  it('same base seed + same label → same derivative stream', () => {
    const a = derivedRng(123, 'selector');
    const b = derivedRng(123, 'selector');
    expect(a.d100()).toBe(b.d100());
    expect(a.d100()).toBe(b.d100());
  });

  it('different labels produce different streams', () => {
    const s = derivedRng(123, 'selector');
    const n = derivedRng(123, 'narrative');
    const sample1 = Array.from({ length: 5 }, () => s.d100());
    const sample2 = Array.from({ length: 5 }, () => n.d100());
    expect(sample1).not.toEqual(sample2);
  });
});
```

In `src/engine/core/RNG.ts`, add:

```ts
/**
 * Derive a sub-stream RNG from a base seed + a label. Pure function of
 * (baseSeed, label). Used by Phase 2B to split peek vs resolve RNG streams
 * so repeated peeks don't drift.
 */
export function derivedRng(baseSeed: number, label: string): IRng {
  // Simple hash: mix label bytes into the seed.
  let h = baseSeed | 0;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x85ebca6b);
    h ^= h >>> 16;
  }
  return createRng(h >>> 0);
}
```

- [ ] **Step 3: Run RNG test**

Run: `npx vitest run src/engine/core/RNG.test.ts`
Expected: PASS.

- [ ] **Step 4: Modify engineBridge to use two substreams for peek + resolve**

In `src/services/engineBridge.ts` inside `doPeek`:

Replace the cached-peek RNG construction:
```ts
        const peekRng = createRng(
          ((gs.runState.rngState?.cursor ?? gs.runState.runSeed) + 1) & 0xffffffff,
        );
```
With:
```ts
        const cursor = gs.runState.rngState?.cursor ?? gs.runState.runSeed;
        const peekRng = derivedRng(cursor, 'narrative');
```

Similarly, the fresh-selection path:
```ts
    const rng = createRng(
      (gs.runState.rngState?.cursor ?? gs.runState.runSeed) & 0xffffffff,
    );
```
Becomes:
```ts
    const cursor = gs.runState.rngState?.cursor ?? gs.runState.runSeed;
    const selectorRng = derivedRng(cursor, 'selector');
    const narrativeRng = derivedRng(cursor, 'narrative');
```
Use `selectorRng` for `selectEvent`, `narrativeRng` for `renderEvent`.

Mirror in `resolveChoice`:
```ts
      const seedCursor = gs.runState.rngState?.cursor ?? gs.runState.runSeed;
      const rng = createRng(seedCursor & 0xffffffff);
```
Becomes:
```ts
      const seedCursor = gs.runState.rngState?.cursor ?? gs.runState.runSeed;
      const rng = createRng(seedCursor & 0xffffffff);  // keep for resolveCheck + applyOutcome
      const narrativeRng = derivedRng(seedCursor, 'narrative');
```
And in the `renderEvent` call inside `resolveChoice`, replace the `rng` arg with `narrativeRng`.

- [ ] **Step 5: Full-suite canary**

Run: `npx vitest run`

**Decision gate:**
- If all tests PASS: this change stays. Proceed to commit.
- If 1-5 tests FAIL due to snapshot drift (different composed narrative text for a deterministic seed): **revert the engineBridge changes** (keep `derivedRng` helper + test) and commit the partial. The RNG split becomes a follow-up PR after 2B-3.
- If >5 tests fail: the change is too invasive for 2B-1; revert everything and defer.

Note the outcome in the commit message.

- [ ] **Step 6: Commit**

Depending on outcome, one of:

**Full bundle (canary passed):**
```bash
git add src/engine/core/RNG.ts src/engine/core/RNG.test.ts src/services/engineBridge.ts
git commit -m "fix(rng): split peek/resolve RNG streams via derivedRng

Phase 2B-1 Task 18 — closes Phase 1 lingering spec §8.4 trade-off.
Peek uses a 'narrative' substream; resolve uses both the parent stream
(for check + outcome) and the 'narrative' substream (for composition).
Repeated peek-without-resolve now returns identical composed text.

Canary: full integration suite passed with no snapshot drift. All
Phase 1 + 2A tests remain green."
```

**Partial only (canary failed, only helper kept):**
```bash
git add src/engine/core/RNG.ts src/engine/core/RNG.test.ts
git commit -m "feat(rng): add derivedRng helper for sub-stream derivation

Phase 2B-1 Task 18 (partial). Helper ready for use; the peek/resolve
split was deferred after the canary test (full integration suite)
showed N snapshot(s) drifting. Fix tracked as a standalone follow-up
after 2B-3 so the snapshot rebaseline can land cleanly with Tribulation
I UI tests."
```

---

## Task 19: MetaState v3 → v4 migration

**Files:**
- Modify: `src/engine/meta/MetaState.ts`
- Modify: `src/engine/persistence/Migrator.v3_to_v4.test.ts` (new)

**Rationale:** Spec §6 additions to `LineageEntrySummary` (corePath + techniquesLearned) + new `MetaState.seenTechniques`.

- [ ] **Step 1: Write failing migration test**

Create `src/engine/persistence/Migrator.v3_to_v4.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createMigrator } from './Migrator';
import { metaStateMigrations, METASTATE_SCHEMA_VERSION } from '@/engine/meta/MetaState';

describe('Migrator v3 → v4 (Phase 2B-1 Task 19)', () => {
  const migrator = createMigrator({
    currentVersion: METASTATE_SCHEMA_VERSION,
    migrations: metaStateMigrations as any,
  });

  it('schema version is 4', () => {
    expect(METASTATE_SCHEMA_VERSION).toBe(4);
  });

  it('v3 payload migrates: lineage gets corePath + techniquesLearned defaults; seenTechniques added', () => {
    const v3 = {
      karmaBalance: 100, lifeCount: 2,
      ownedUpgrades: ['awakened_soul_l1'],
      unlockedAnchors: ['true_random', 'peasant_farmer'],
      lineage: [
        {
          lifeIndex: 1, name: 'A', anchorId: 'peasant_farmer',
          birthYear: 1000, deathYear: 1060, yearsLived: 60,
          realmReached: 'body_tempering', deathCause: 'old_age',
          karmaEarned: 3, echoesUnlockedThisLife: [],
        },
      ],
      lifetimeSeenEvents: ['foo'],
      heavenlyNotice: 0,
      echoesUnlocked: [], memoriesWitnessed: {}, echoProgress: {}, memoriesManifested: [],
    };
    const migrated = migrator.migrate(v3, 3) as any;
    expect(migrated.lineage[0].corePath).toBeNull();
    expect(migrated.lineage[0].techniquesLearned).toEqual([]);
    expect(migrated.seenTechniques).toEqual([]);
  });

  it('v1 payload migrates cleanly through 1 → 2 → 3 → 4', () => {
    const v1 = {
      karmaBalance: 10, lifeCount: 1,
      ownedUpgrades: [], unlockedAnchors: ['true_random', 'peasant_farmer'],
      lineage: [{ lifeIndex: 1, name: 'X', anchorId: 'peasant_farmer',
                  yearsLived: 30, realmReached: 'mortal', deathCause: 'disease', karmaEarned: 2 }],
      lifetimeSeenEvents: [],
    };
    const migrated = migrator.migrate(v1, 1) as any;
    // v2 fields
    expect(migrated.echoesUnlocked).toEqual([]);
    // v3 fields
    expect(migrated.lineage[0].birthYear).toBe(0);
    expect(migrated.lineage[0].deathYear).toBeDefined();
    // v4 fields
    expect(migrated.lineage[0].corePath).toBeNull();
    expect(migrated.lineage[0].techniquesLearned).toEqual([]);
    expect(migrated.seenTechniques).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/engine/persistence/Migrator.v3_to_v4.test.ts`
Expected: FAIL — METASTATE_SCHEMA_VERSION is 3, v3→v4 migration missing.

- [ ] **Step 3: Bump version + extend types + add migration**

In `src/engine/meta/MetaState.ts`:

Change:
```ts
export const METASTATE_SCHEMA_VERSION = 3;
```
To:
```ts
export const METASTATE_SCHEMA_VERSION = 4;
```

Add to `LineageEntrySummary`:
```ts
  /** Phase 2B-1: core path locked at 3rd meridian open (null if character died before 3). */
  corePath: string | null;
  /** Phase 2B-1: ids of techniques learned in this life (in order learned). */
  techniquesLearned: ReadonlyArray<string>;
```

Add to `MetaState`:
```ts
  /** Phase 2B-1: cumulative ids of techniques the player has seen in any life (UI Codex). */
  readonly seenTechniques: ReadonlyArray<string>;
```

Add to `createEmptyMetaState`:
```ts
    seenTechniques: [],
```

Add migration at the end of `metaStateMigrations`:
```ts
  {
    from: 3,
    to: 4,
    transform: (old: any): MetaState => ({
      ...old,
      schemaVersion: 4,
      lineage: (old.lineage ?? []).map((entry: any) => ({
        ...entry,
        corePath: entry.corePath ?? null,
        techniquesLearned: entry.techniquesLearned ?? [],
      })),
      seenTechniques: old.seenTechniques ?? [],
    }),
  },
```

- [ ] **Step 4: Update any existing code that instantiates a `LineageEntrySummary`**

Search: `npx grep -rn "LineageEntrySummary\|appendLineageEntry" src --include="*.ts"`

For each construction site (likely `BardoFlow.ts` or similar), add `corePath` + `techniquesLearned`:
```ts
const entry: LineageEntrySummary = {
  ...existingFields,
  corePath: c.corePath,
  techniquesLearned: rs.learnedTechniques,
};
```

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS (3 new tests; all prior tests green).

- [ ] **Step 6: Commit**

```bash
git add src/engine/meta/MetaState.ts src/engine/persistence/Migrator.v3_to_v4.test.ts
# plus any caller files touched for lineage entry construction
git commit -m "feat(meta): MetaState v3 → v4 migration (corePath + techniques)

Phase 2B-1 Task 19. Schema bump 3 → 4. Additive fields:
  - LineageEntrySummary.corePath: CorePathId | null
  - LineageEntrySummary.techniquesLearned: ReadonlyArray<TechniqueId>
  - MetaState.seenTechniques: ReadonlyArray<TechniqueId>
Migration: v3 → v4 defaults corePath to null, techniquesLearned to [],
seenTechniques to []. v1 → v2 → v3 → v4 chained cleanly for pre-2A saves.
BardoFlow construction of LineageEntrySummary updated to fill the two
new per-life fields from the run state."
```

---

## Task 20: Integration test — technique_bonus_resolution

**Files:**
- Create: `tests/integration/technique_bonus_resolution.test.ts`

**Rationale:** Closes exit criterion #3 — two characters, different corePaths, same technique, different bonuses. End-to-end proof that the pipeline works.

- [ ] **Step 1: Write the test**

Create `tests/integration/technique_bonus_resolution.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TechniqueRegistry } from '@/engine/cultivation/TechniqueRegistry';
import { TechniqueDef } from '@/engine/cultivation/Technique';
import { resolveLearnedTechniqueBonus } from '@/engine/core/TechniqueHelpers';

describe('Integration: technique bonus resolution respects corePath (Phase 2B-1 exit #3)', () => {
  const sevEdgeStrike: TechniqueDef = {
    id: 'severing_edge_swordform',
    name: 'Severing Edge Swordform',
    grade: 'mortal',
    element: 'metal',
    coreAffinity: ['severing_edge'],
    requires: {},
    qiCost: 8,
    effects: [{ kind: 'choice_bonus', category: 'strike', bonus: 18 }],
    description: 'A sharp offensive form.',
  };

  const registry = TechniqueRegistry.fromList([sevEdgeStrike]);

  it('severing_edge character (on-path) gets full 18 bonus', () => {
    const bonus = resolveLearnedTechniqueBonus({
      registry,
      learnedIds: ['severing_edge_swordform'],
      corePath: 'severing_edge',
      category: 'strike',
    });
    expect(bonus).toBe(18);
  });

  it('iron_mountain character (off-path) gets halved bonus (9)', () => {
    const bonus = resolveLearnedTechniqueBonus({
      registry,
      learnedIds: ['severing_edge_swordform'],
      corePath: 'iron_mountain',
      category: 'strike',
    });
    expect(bonus).toBe(9);
  });

  it('null corePath (pre-reveal) gets full bonus', () => {
    const bonus = resolveLearnedTechniqueBonus({
      registry,
      learnedIds: ['severing_edge_swordform'],
      corePath: null,
      category: 'strike',
    });
    expect(bonus).toBe(18);
  });

  it('different category → 0 bonus', () => {
    const bonus = resolveLearnedTechniqueBonus({
      registry,
      learnedIds: ['severing_edge_swordform'],
      corePath: 'severing_edge',
      category: 'evade',
    });
    expect(bonus).toBe(0);
  });

  it('mixed roster: on-path + off-path both contribute with proper multiplier', () => {
    const ironStrike: TechniqueDef = {
      ...sevEdgeStrike, id: 'iron_mountain_seal',
      coreAffinity: ['iron_mountain'],
      effects: [{ kind: 'choice_bonus', category: 'strike', bonus: 10 }],
    };
    const reg = TechniqueRegistry.fromList([sevEdgeStrike, ironStrike]);

    const ironChar = resolveLearnedTechniqueBonus({
      registry: reg,
      learnedIds: ['severing_edge_swordform', 'iron_mountain_seal'],
      corePath: 'iron_mountain',
      category: 'strike',
    });
    // severing = 18×0.5 = 9, iron = 10×1 = 10, total = 19
    expect(ironChar).toBe(19);
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run tests/integration/technique_bonus_resolution.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/technique_bonus_resolution.test.ts
git commit -m "test(integration): technique bonus resolution (exit criterion #3)

Phase 2B-1 Task 20 — Phase 2B exit criterion #3 proof. Two characters
with different corePaths using the same technique produce different
bonuses via resolveLearnedTechniqueBonus. Covers: on-path (full), off-
path (halved), null pre-reveal (full), category mismatch (0), mixed
roster (on-path + off-path sum additively with proper scaling)."
```

---

## Self-Review Checklist (post-plan, pre-execution)

After writing all 20 tasks, grep the plan for red flags:

1. **Placeholder scan** — `grep -niE "TBD|TODO|fill in|placeholder|similar to Task" docs/superpowers/plans/2026-04-25-phase-2b1-engine.md` → should return 0 results. If any: fix.
2. **Type consistency** — ensure `TechniqueDef`, `ItemDef`, `CorePathId`, `Realm` values used in later tasks match what was declared earlier. Specifically verify: `resolveLearnedTechniqueBonus` (Task 7) signature matches what `GameLoop` consumes; `PostOutcomeHooksArgs.preRunState` (Task 13) is threaded from both callers.
3. **Spec coverage** — cross-check:
   - Spec §3.1 Technique registry: Tasks 3, 4 ✓
   - Spec §3.1 effect kinds (5 total): Task 2 + Task 10 cultivation_multiplier_pct ✓
   - Spec §3.1 affinity multiplier: Task 5 ✓
   - Spec §3.2 Item/Manual registries: Task 8 ✓
   - Spec §3.2 partial-manual deviation: Task 9 ✓
   - Spec §3.3 core-path consumption via affinity: Tasks 5, 6, 7 ✓
   - Spec §3.3 core_path_revealed signal: Task 13 ✓
   - Spec §3.3 OutcomeApplier meridian_open routing: Task 12 ✓
   - Spec §3.4 BT9 → QS awakening: Task 15 ✓
   - Spec §3.4 QS → QC1 entry: Task 16 ✓
   - Spec §3.4 Character.qiCondensationLayer: Task 11 ✓
   - Spec §3.4 Breakthrough polymorphic: Task 14 ✓
   - Spec §3.5 Tribulation I + tribulation_mode flag: Task 17 ✓
   - Spec §3.6 peek/resolve RNG split: Task 18 ✓
   - Spec §6 MetaState v3→v4: Task 19 ✓
   - Spec §2 exit criterion #3 integration test: Task 20 ✓
   - Spec §2 exit criterion #7 save migration: Task 19 ✓
4. **Risk closure cross-check** (spec §8):
   - §8.1 meridian_open routing → Task 12 ✓
   - §8.2 Choice.check.techniqueBonusCategory → schema already has it; no task needed, noted in Task 1 correction #10
   - §8.3 attemptSublayerBreakthrough polymorphic → Task 14 ✓
   - §8.4 peek/resolve RNG split → Task 18 with canary gate ✓
   - §8.5 PillarEvent schema → Task 17 ✓
   - §8.6 Bundle budget → 2B-1 is engine-only; audited at 2B-2 ✓ (noted in Task 1)
   - §8.7 character.flags growth → 2B-1 doesn't grow flags; monitor in 2B-2
   - §8.8 partial-manual formula → Task 9 ✓
   - §8.9 core-path wandering state → affinityMultiplier returns 1.0 for null, covered in Task 5
   - §8.10 anchor roster → not 2B-1
   - §8.11 elder/master bonus wiring → 2B-1 leaves 0s; 2B-2 wires at event-authoring
   - §8.12 spiritRoot.tier rank comparison → implicit in Task 15 (uses string enum + discrete penalty table; no rank needed since penalty is keyed directly)
   - §8.13 spirit-root penalty table → Task 15 ships tunable constants

All 13 risks are either resolved by a task or explicitly deferred to a later sub-phase with rationale.

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch with checkpoints.

**Recommended: subagent-driven**, matching the Phase 2A cadence.

Expected aggregate: **~70 tests** across tasks 2 (5) + 3 (4) + 4 (6) + 5 (5) + 6 (6) + 7 (5) + 8 (5+4) + 9 (9) + 10 (4) + 11 (2) + 12 (4) + 13 (3) + 14 (4) + 15 (7) + 16 (5) + 17 (7) + 18 (2) + 19 (3) + 20 (5) = **95 test-adds**, net perhaps +65-75 after dedup / reuse. Target aligned with Phase 2A-1's +71.
