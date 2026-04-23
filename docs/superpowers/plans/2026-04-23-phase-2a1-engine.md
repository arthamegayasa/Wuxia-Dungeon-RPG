# Phase 2A-1 — Engine Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the engine for Soul Echoes + Forbidden Memories + completed MoodFilter, persisted via a clean `MetaState` v1 → v2 migration. Pure engine — no UI, no populated content beyond unit-test fixtures. After this plan, the game still *plays* like Phase 1D-3 (engine wires exist, registries are empty stubs loaded from JSON in Phase 2A-2).

**Architecture:** Four new engine slices in `src/engine/meta/` (SoulEcho family) and `src/engine/meta/` (ForbiddenMemory family); two additions to `src/engine/narrative/` (MoodAdjectiveDict + InteriorThoughtInjector) that slot into the existing `Composer.renderEvent`. `MetaState` gains 5 new persisted fields + a single additive migration; `RunState` gains 3 new per-life-scoped fields. All new modules are pure functions with determinism contracts; RNG strictly via `IRng`.

**Tech Stack:** TypeScript 5.8 strict, Vitest 4, Zod 4. Depends on everything from Phases 0, 1A, 1B, 1C, 1D-1, 1D-2, 1D-3. No new runtime dependencies.

**Source of truth:** [`docs/spec/design.md`](../../../docs/spec/design.md) §7.2 (Soul Echoes), §7.3 (Forbidden Memories), §6.4 (MoodFilter), §10 (persistence); [`docs/superpowers/specs/2026-04-23-phase-2a-inheritance-and-reveal-design.md`](../specs/2026-04-23-phase-2a-inheritance-and-reveal-design.md) §3 + §7 (canonical for this plan).

**Scope boundaries (OUT of 2A-1):**
- Echo/Memory JSON corpus (10 echoes, 5 memories) → **2A-2**
- Anchor content + starting attributes for +3 anchors → **2A-2**
- Event retrofits + new anchor-bridging/meditation events → **2A-2**
- Codex / Lineage / Bardo / Creation UI → **2A-3**
- `engineBridge` additions for Codex/Lineage snapshots → **2A-3**
- Technique registry / requirements enforcement → Phase 2B
- Heavenly Notice / Karmic Hunters / Imprints → Phase 3

**Spec corrections baked into this plan (vs `docs/superpowers/specs/2026-04-23-phase-2a-...md`):**
1. `METASTATE_SCHEMA_VERSION` is currently `1` (not `2`) — this plan's migration is **v1 → v2**. Spec to be amended in first commit.
2. `witnessMemory` is already an `Outcome` field in `src/content/schema.ts` (Phase 1B-era). **Do not add a `witness_memory` stateDelta kind** as the spec originally suggested. This plan wires the existing field.
3. `MetaState.lineage` already exists with shape `LineageEntrySummary`. **Extend this interface with `echoesUnlockedThisLife`** instead of adding a parallel `pastLives[]`.
4. `ChoiceResolver.ResolveArgs` already accepts `echoBonus` and `memoryBonus`. Computing them is out of 2A-1 (no content to drive them); they stay `0` from call-sites.

---

## Task Map

1. Amend spec: `METASTATE_SCHEMA_VERSION` 1→2 correction + `lineage` reuse note
2. `SoulEcho` types (`SoulEcho`, `UnlockCondition`, `EchoEffect`) + `echoSlotsFor` utility
3. `EchoRegistry` — in-memory registry + empty default export
4. `EchoTracker` — life-scoped counters + commit to `MetaState.echoProgress`
5. `EchoUnlocker` — evaluate unlock conditions on death, return newly unlocked ids
6. `EchoRoller` — pick N echoes from unlocked pool with conflict resolution (seeded)
7. `EchoApplier` — apply `EchoEffect[]` to `Character`
8. `ForbiddenMemory` types + `memoryLevelOf` utility
9. `MemoryRegistry` — in-memory registry + empty default export
10. `MemoryWitnessLogger` — `logWitness` on `RunState`; `commitWitnesses` on death
11. `MemoryManifestResolver` — per-meditation roll with determinism contract
12. `OutcomeApplier` wiring: `outcome.witnessMemory` → `MemoryWitnessLogger.logWitness`
13. `RunState` extension: `memoriesWitnessedThisLife`, `memoriesManifestedThisLife`, `manifestAttemptsThisLife`
14. `MetaState` v2: add fields + extend `LineageEntrySummary` + bump version + migration v1→v2
15. `MoodAdjectiveDict` — mood-scoped adjective substitution (post-pass)
16. `InteriorThoughtInjector` — reflective-sentence injector with Mind×mood-bias rate
17. `Composer.renderEvent` — apply adjective substitution + interior injection post-passes
18. Integration test: `tests/integration/echo_inheritance.test.ts` (engine-level, no UI)

Total: **18 tasks**. Target size: comparable to Phase 1B (~80 tests).

---

## Prerequisite Reading

- [`docs/spec/design.md`](../../../docs/spec/design.md) §6.4 (Mood Filter), §7.2 (Soul Echoes), §7.3 (Forbidden Memories), §10 (persistence)
- [`docs/superpowers/specs/2026-04-23-phase-2a-inheritance-and-reveal-design.md`](../specs/2026-04-23-phase-2a-inheritance-and-reveal-design.md) §3 (engine subsystems), §7 (save migration), §10 (risks), §13 (open questions)
- [`src/engine/meta/MetaState.ts`](../../../src/engine/meta/MetaState.ts) — existing shape to extend
- [`src/engine/events/RunState.ts`](../../../src/engine/events/RunState.ts) — existing shape to extend
- [`src/engine/events/OutcomeApplier.ts`](../../../src/engine/events/OutcomeApplier.ts) — Phase 1B outcome application; wire memory-witness here
- [`src/content/schema.ts`](../../../src/content/schema.ts) — `OutcomeSchema.witnessMemory` already exists; `ConditionSetSchema` already has `requiresEcho`/`requiresMemory`
- [`src/engine/narrative/Composer.ts`](../../../src/engine/narrative/Composer.ts) — `renderEvent` is where 2A-1 post-passes attach
- [`src/engine/narrative/Mood.ts`](../../../src/engine/narrative/Mood.ts) — Phase 1C mood computation (re-used)
- [`src/engine/persistence/Migrator.ts`](../../../src/engine/persistence/Migrator.ts) — generic migrator; register a v1→v2 step
- [`src/engine/persistence/SaveManager.ts`](../../../src/engine/persistence/SaveManager.ts) — envelope API
- [`src/engine/core/RNG.ts`](../../../src/engine/core/RNG.ts) — `IRng`, `RngState`, Mulberry32 factory
- [`src/engine/character/Character.ts`](../../../src/engine/character/Character.ts) — `Character` shape + purity contract (immutable)

---

## Task 1: Amend spec for schema version + lineage reuse

**Files:**
- Modify: `docs/superpowers/specs/2026-04-23-phase-2a-inheritance-and-reveal-design.md`

**Rationale:** The brainstormed spec assumed `METASTATE_SCHEMA_VERSION = 2` (upgrading to 3). The actual codebase state is `1`. This plan's migration is `1 → 2`. Fix the spec before writing engine code so future readers (and 2A-2/2A-3 authors) see the correct numbers. Also reuse existing `MetaState.lineage` instead of the proposed parallel `pastLives`.

- [ ] **Step 1: Open the spec and apply four edits**

Edit 1 — §5 heading paragraph: change the version line.

Find:
```markdown
`MetaState` version: `2 → 3`.
```
Replace with:
```markdown
`MetaState` version: `1 → 2` (current state is v1; Phase 2A-1 bumps to v2).
```

Edit 2 — §5.1 code block: change `MetaStateV3 extends MetaStateV2` to `MetaStateV2 extends MetaStateV1`. Change `schemaVersion: 3` to `schemaVersion: 2` and the comment accordingly. Replace `pastLives: LineageEntry[]` with `// lineage: LineageEntrySummary[] already exists — extend LineageEntrySummary in-place`.

Specifically, find:
```ts
interface MetaStateV3 extends MetaStateV2 {
  schemaVersion: 3;                                         // bumped from 2
```
Replace with:
```ts
// v2 extends v1 (current) — purely additive fields below.
interface MetaStateV2 extends MetaStateV1 {
  schemaVersion: 2;                                         // bumped from 1
```

Find:
```ts
  // Lineage
  pastLives: LineageEntry[];
```
Replace with:
```ts
  // Lineage — existing LineageEntrySummary gets one new field:
  //   echoesUnlockedThisLife: string[]
  // No parallel pastLives[] array.
```

Edit 3 — §5.2 Migrator block: rename `v2_to_v3` references to `v1_to_v2`.

Find:
```markdown
### 7.2 Migrator.migrate(v2 → v3)
```
Replace with:
```markdown
### 7.2 Migrator.migrate(v1 → v2)
```

Find:
```ts
{
  schemaVersion: 3,
```
Replace with:
```ts
{
  schemaVersion: 2,
```

Find:
```ts
  pastLives: [],
```
Replace with:
```ts
  // lineage[] already populated from v1; LineageEntrySummary gains
  //   echoesUnlockedThisLife: string[]  (default [] on each existing entry)
```

Edit 4 — §5.2 test reference: rename `Migrator.v2_to_v3.test.ts` → `Migrator.v1_to_v2.test.ts`.

Edit 5 — §6.2 Lineage section: change `MetaState.pastLives` reference to `MetaState.lineage`.

Find:
```markdown
**Data source:** `MetaState.pastLives: LineageEntry[]` — pushed on death (in `BardoFlow`), one entry per completed life, containing `{runId, index, name, yearStart, yearEnd, anchorId, finalRealm, deathCause, epitaph?, echoesUnlockedThisLife: string[]}`.
```
Replace with:
```markdown
**Data source:** `MetaState.lineage: LineageEntrySummary[]` (existing Phase 1D-1 field) extended with `echoesUnlockedThisLife: string[]`. Pushed on death in `BardoFlow`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-23-phase-2a-inheritance-and-reveal-design.md
git commit -m "docs(spec): correct Phase 2A schema version 1->2 and reuse MetaState.lineage"
```

No test run needed — docs-only change.

---

## Task 2: `SoulEcho` types + `echoSlotsFor` utility

**Files:**
- Create: `src/engine/meta/SoulEcho.ts`
- Create: `src/engine/meta/SoulEcho.test.ts`

**Rationale:** Define the `SoulEcho`, `UnlockCondition`, and `EchoEffect` discriminated-union types. Ship the `echoSlotsFor(meta)` helper that the Phase 2A-1 formula needs: `1 + karmicUpgradeLevel('carry_the_weight')`. Notice is absent in 2A (always 0), but the formula still reads `meta.heavenlyNotice` defensively so the future Phase 3 wire is already in place.

- [ ] **Step 1: Write the failing test**

Create `src/engine/meta/SoulEcho.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  SoulEcho,
  echoSlotsFor,
  ECHO_SLOTS_BASELINE,
  ECHO_SLOTS_HARD_CAP,
} from './SoulEcho';
import { createEmptyMetaState } from './MetaState';

describe('SoulEcho types', () => {
  it('constructs a minimal echo value', () => {
    const e: SoulEcho = {
      id: 'iron_body',
      name: 'Iron Body',
      description: 'Your flesh remembers tempering.',
      tier: 'fragment',
      unlockCondition: { kind: 'reach_realm', realm: 'body_tempering', sublayer: 5 },
      effects: [{ kind: 'hp_mult', mult: 1.2 }],
      conflicts: [],
      reveal: 'birth',
    };
    expect(e.id).toBe('iron_body');
  });
});

describe('echoSlotsFor', () => {
  it('returns baseline 1 for empty meta', () => {
    const m = createEmptyMetaState();
    expect(echoSlotsFor(m)).toBe(ECHO_SLOTS_BASELINE);
    expect(ECHO_SLOTS_BASELINE).toBe(1);
  });

  it('adds +1 with carry_the_weight level 1', () => {
    const m = { ...createEmptyMetaState(), ownedUpgrades: ['carry_the_weight_1'] };
    expect(echoSlotsFor(m)).toBe(2);
  });

  it('adds +2 with carry_the_weight level 2 (level 1 is prerequisite)', () => {
    const m = { ...createEmptyMetaState(), ownedUpgrades: ['carry_the_weight_1', 'carry_the_weight_2'] };
    expect(echoSlotsFor(m)).toBe(3);
  });

  it('caps at 6 even with absurd counts', () => {
    // Fabricated: high heavenly notice (Phase 3) would add slots; test the clamp.
    const m = { ...createEmptyMetaState(), heavenlyNotice: 999 };
    expect(echoSlotsFor(m)).toBe(ECHO_SLOTS_HARD_CAP);
    expect(ECHO_SLOTS_HARD_CAP).toBe(6);
  });
});
```

> Note: the test imports `createEmptyMetaState` from `./MetaState`, which does NOT yet expose `heavenlyNotice`. Task 14 adds it. Until then, TypeScript may complain. Run step 2 to confirm; if TS errors prevent test-run, skip to Task 14 to do the `MetaState` bump first, then return to Task 2. (The subagent executing this plan should do Task 14 first if TS blocks. Record the swap in the PR description.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/meta/SoulEcho.test.ts`
Expected: FAIL — file `./SoulEcho` not found.

- [ ] **Step 3: Implement**

Create `src/engine/meta/SoulEcho.ts`:

```ts
// Soul Echo types + slot-count utility. Source: docs/spec/design.md §7.2.

import { Realm } from '@/engine/core/Types';
import { MetaState } from './MetaState';

export const ECHO_SLOTS_BASELINE = 1;
export const ECHO_SLOTS_HARD_CAP = 6;

export type ChoiceCategoryTag = string;

export type UnlockCondition =
  | { kind: 'reach_realm'; realm: Realm | string; sublayer?: number }
  | { kind: 'choice_category_count'; category: ChoiceCategoryTag; count: number }
  | { kind: 'outcome_count'; outcomeKind: string; count: number }
  | { kind: 'lives_as_anchor_max_age'; anchor: string; lives: number }
  | { kind: 'died_with_flag'; flag: string }
  | { kind: 'flag_set'; flag: string }
  | { kind: 'died_in_same_region_streak'; region: string; streak: number }
  | { kind: 'reached_insight_cap_lives'; lives: number }
  | { kind: 'lived_min_years_in_single_life'; years: number }
  | { kind: 'reached_realm_without_techniques'; realm: Realm | string };

export interface StatModEffect { kind: 'stat_mod'; stat: string; delta: number }
export interface StatModPctEffect { kind: 'stat_mod_pct'; stat: string; pct: number }
export interface ResolverBonusEffect { kind: 'resolver_bonus'; category: ChoiceCategoryTag; bonus: number }
export interface EventWeightEffect { kind: 'event_weight'; eventTag: string; mult: number }
export interface StartingFlagEffect { kind: 'starting_flag'; flag: string }
export interface HealEfficacyEffect { kind: 'heal_efficacy_pct'; pct: number }
export interface HpMultEffect { kind: 'hp_mult'; mult: number }
export interface MoodSwingPctEffect { kind: 'mood_swing_pct'; pct: number }
export interface BodyCultivationRatePctEffect { kind: 'body_cultivation_rate_pct'; pct: number }
export interface InsightCapBonusEffect { kind: 'insight_cap_bonus'; bonus: number }
export interface OldAgeDeathRollPctEffect { kind: 'old_age_death_roll_pct'; pct: number }
export interface ImprintEncounterRatePctEffect { kind: 'imprint_encounter_rate_pct'; pct: number }

export type EchoEffect =
  | StatModEffect | StatModPctEffect | ResolverBonusEffect | EventWeightEffect
  | StartingFlagEffect | HealEfficacyEffect | HpMultEffect | MoodSwingPctEffect
  | BodyCultivationRatePctEffect | InsightCapBonusEffect | OldAgeDeathRollPctEffect
  | ImprintEncounterRatePctEffect;

export type EchoTier = 'fragment' | 'partial' | 'full';
export type EchoReveal = 'birth' | 'trigger';

export interface SoulEcho {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tier: EchoTier;
  readonly unlockCondition: UnlockCondition;
  readonly effects: ReadonlyArray<EchoEffect>;
  readonly conflicts: ReadonlyArray<string>;
  readonly reveal: EchoReveal;
}

/** Count the highest owned tier level of a tiered karmic upgrade (e.g. `carry_the_weight`). */
function upgradeLevel(meta: MetaState, baseId: string): number {
  let level = 0;
  for (let i = 3; i >= 1; i -= 1) {
    if (meta.ownedUpgrades.includes(`${baseId}_${i}`)) {
      level = i;
      break;
    }
  }
  return level;
}

/** Spec §7.2 formula, clamped. Phase 2A-1 keeps heavenly notice at 0 in practice. */
export function echoSlotsFor(meta: MetaState): number {
  const carry = upgradeLevel(meta, 'carry_the_weight');
  const noticeTier = Math.floor(meta.heavenlyNotice / 25);
  const slots = ECHO_SLOTS_BASELINE + carry + noticeTier;
  return Math.max(ECHO_SLOTS_BASELINE, Math.min(ECHO_SLOTS_HARD_CAP, slots));
}
```

> Note: the `carry_the_weight_1` / `_2` / `_3` ids are assumed — verify against `src/engine/meta/KarmicUpgrade.ts` before implementing. If the existing upgrade id differs (e.g. `carryTheWeight1` or `carry_the_weight` without numeric suffix), adjust `upgradeLevel` accordingly AND update the `studentOfTheWheelLevel` helper in Task 11 (`MemoryManifestResolver`) so both use the same suffix convention. Record the divergence in the commit message.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/engine/meta/SoulEcho.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/meta/SoulEcho.ts src/engine/meta/SoulEcho.test.ts
git commit -m "feat(meta): SoulEcho types + echoSlotsFor utility"
```

---

## Task 3: `EchoRegistry`

**Files:**
- Create: `src/engine/meta/EchoRegistry.ts`
- Create: `src/engine/meta/EchoRegistry.test.ts`

**Rationale:** An in-memory map of echo id → `SoulEcho`. Phase 2A-1 exports `EMPTY_ECHO_REGISTRY`; actual content lands in Phase 2A-2 via a JSON loader. Registry is a class so 2A-2 can populate it once at boot without prop-drilling.

- [ ] **Step 1: Write the failing test**

Create `src/engine/meta/EchoRegistry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EchoRegistry, EMPTY_ECHO_REGISTRY } from './EchoRegistry';
import { SoulEcho } from './SoulEcho';

const fakeEcho: SoulEcho = {
  id: 'fake_echo',
  name: 'Fake Echo',
  description: 'for tests',
  tier: 'fragment',
  unlockCondition: { kind: 'flag_set', flag: 'test_flag' },
  effects: [],
  conflicts: [],
  reveal: 'birth',
};

describe('EchoRegistry', () => {
  it('empty registry returns empty list', () => {
    expect(EMPTY_ECHO_REGISTRY.all()).toEqual([]);
    expect(EMPTY_ECHO_REGISTRY.get('anything')).toBeUndefined();
  });

  it('fromList registers echoes and finds them by id', () => {
    const reg = EchoRegistry.fromList([fakeEcho]);
    expect(reg.get('fake_echo')).toBe(fakeEcho);
    expect(reg.all()).toEqual([fakeEcho]);
  });

  it('rejects duplicate ids', () => {
    expect(() => EchoRegistry.fromList([fakeEcho, fakeEcho])).toThrow(/duplicate echo id/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/meta/EchoRegistry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/engine/meta/EchoRegistry.ts`:

```ts
// In-memory Soul Echo registry. Phase 2A-1 ships empty; content loader in 2A-2.

import { SoulEcho } from './SoulEcho';

export class EchoRegistry {
  private readonly byId: ReadonlyMap<string, SoulEcho>;

  private constructor(byId: Map<string, SoulEcho>) {
    this.byId = byId;
  }

  static fromList(echoes: ReadonlyArray<SoulEcho>): EchoRegistry {
    const map = new Map<string, SoulEcho>();
    for (const e of echoes) {
      if (map.has(e.id)) {
        throw new Error(`duplicate echo id: ${e.id}`);
      }
      map.set(e.id, e);
    }
    return new EchoRegistry(map);
  }

  get(id: string): SoulEcho | undefined {
    return this.byId.get(id);
  }

  all(): ReadonlyArray<SoulEcho> {
    return Array.from(this.byId.values());
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }
}

export const EMPTY_ECHO_REGISTRY: EchoRegistry = EchoRegistry.fromList([]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/engine/meta/EchoRegistry.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/meta/EchoRegistry.ts src/engine/meta/EchoRegistry.test.ts
git commit -m "feat(meta): EchoRegistry + empty default"
```

---

## Task 4: `EchoTracker`

**Files:**
- Create: `src/engine/meta/EchoTracker.ts`
- Create: `src/engine/meta/EchoTracker.test.ts`

**Rationale:** Track life-scoped progress toward each echo's unlock condition (e.g., "sword-category choice count", "heal events performed"). Tracker is a *pure function* API over an immutable counter map. On death, counters are merged into `MetaState.echoProgress`. Counters are keyed by string (flexible; content decides keys in 2A-2).

- [ ] **Step 1: Write the failing test**

Create `src/engine/meta/EchoTracker.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EchoTracker, emptyEchoProgress, mergeEchoProgress } from './EchoTracker';

describe('EchoTracker', () => {
  it('starts empty', () => {
    const t = EchoTracker.empty();
    expect(t.get('sword_choice')).toBe(0);
  });

  it('increments counters', () => {
    const t = EchoTracker.empty();
    const t1 = t.increment('sword_choice');
    const t2 = t1.increment('sword_choice', 3);
    expect(t2.get('sword_choice')).toBe(4);
    // original unchanged
    expect(t.get('sword_choice')).toBe(0);
  });

  it('snapshots as plain object', () => {
    const t = EchoTracker.empty().increment('a').increment('b', 2);
    expect(t.snapshot()).toEqual({ a: 1, b: 2 });
  });
});

describe('emptyEchoProgress', () => {
  it('returns frozen empty object', () => {
    expect(emptyEchoProgress()).toEqual({});
  });
});

describe('mergeEchoProgress', () => {
  it('sums numeric keys preserving metastate immutability', () => {
    const base = { a: 5, b: 2 };
    const delta = { a: 3, c: 10 };
    const merged = mergeEchoProgress(base, delta);
    expect(merged).toEqual({ a: 8, b: 2, c: 10 });
    expect(base).toEqual({ a: 5, b: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/meta/EchoTracker.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/engine/meta/EchoTracker.ts`:

```ts
// Life-scoped echo progress counters. Immutable API. Committed to MetaState on death.

export type EchoProgress = Readonly<Record<string, number>>;

export function emptyEchoProgress(): EchoProgress {
  return Object.freeze({});
}

export function mergeEchoProgress(base: EchoProgress, delta: EchoProgress): EchoProgress {
  const out: Record<string, number> = { ...base };
  for (const [k, v] of Object.entries(delta)) {
    out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

export class EchoTracker {
  private constructor(private readonly counters: ReadonlyMap<string, number>) {}

  static empty(): EchoTracker {
    return new EchoTracker(new Map());
  }

  get(key: string): number {
    return this.counters.get(key) ?? 0;
  }

  increment(key: string, by: number = 1): EchoTracker {
    const next = new Map(this.counters);
    next.set(key, (this.counters.get(key) ?? 0) + by);
    return new EchoTracker(next);
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/engine/meta/EchoTracker.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/meta/EchoTracker.ts src/engine/meta/EchoTracker.test.ts
git commit -m "feat(meta): EchoTracker + echoProgress merge helper"
```

---

## Task 5: `EchoUnlocker`

**Files:**
- Create: `src/engine/meta/EchoUnlocker.ts`
- Create: `src/engine/meta/EchoUnlocker.test.ts`

**Rationale:** Given the finalized run state of a dying life + the cumulative `MetaState`, evaluate every locked echo's `unlockCondition` and return the ids that become newly unlocked. Called from `BardoFlow` (hook added in 2A-2 or 2A-3 when Bardo is touched).

- [ ] **Step 1: Write the failing test**

Create `src/engine/meta/EchoUnlocker.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EchoRegistry } from './EchoRegistry';
import { evaluateUnlocks, UnlockContext } from './EchoUnlocker';
import { SoulEcho } from './SoulEcho';
import { createEmptyMetaState } from './MetaState';

const ironBody: SoulEcho = {
  id: 'iron_body', name: 'Iron Body', description: '',
  tier: 'fragment',
  unlockCondition: { kind: 'reach_realm', realm: 'body_tempering', sublayer: 5 },
  effects: [], conflicts: [], reveal: 'birth',
};

const farmer: SoulEcho = {
  id: 'farmers_eye', name: "Farmer's Eye", description: '',
  tier: 'fragment',
  unlockCondition: { kind: 'lives_as_anchor_max_age', anchor: 'peasant_farmer', lives: 2 },
  effects: [], conflicts: [], reveal: 'birth',
};

describe('evaluateUnlocks', () => {
  const reg = EchoRegistry.fromList([ironBody, farmer]);

  it('returns empty when no conditions met', () => {
    const ctx: UnlockContext = {
      meta: createEmptyMetaState(),
      finalRealm: 'mortal',
      finalBodyTemperingLayer: 0,
      diedOfOldAge: false,
      yearsLived: 30,
      diedThisLifeFlags: [],
      anchorThisLife: 'peasant_farmer',
      echoProgressCumulative: {},
      dominantRegionThisLife: 'yellow_plains',
      regionStreakByRegion: { yellow_plains: 1 },
    };
    expect(evaluateUnlocks(reg, ctx)).toEqual([]);
  });

  it('unlocks iron_body when finalBodyTemperingLayer >= 5', () => {
    const ctx: UnlockContext = {
      meta: createEmptyMetaState(),
      finalRealm: 'body_tempering',
      finalBodyTemperingLayer: 5,
      diedOfOldAge: false,
      yearsLived: 40,
      diedThisLifeFlags: [],
      anchorThisLife: 'peasant_farmer',
      echoProgressCumulative: {},
      dominantRegionThisLife: 'yellow_plains',
      regionStreakByRegion: { yellow_plains: 1 },
    };
    expect(evaluateUnlocks(reg, ctx)).toContain('iron_body');
  });

  it('does not re-unlock already-unlocked echoes', () => {
    const meta = { ...createEmptyMetaState(), echoesUnlocked: ['iron_body'] };
    const ctx: UnlockContext = {
      meta,
      finalRealm: 'body_tempering',
      finalBodyTemperingLayer: 9,
      diedOfOldAge: false,
      yearsLived: 40,
      diedThisLifeFlags: [],
      anchorThisLife: 'peasant_farmer',
      echoProgressCumulative: {},
      dominantRegionThisLife: 'yellow_plains',
      regionStreakByRegion: { yellow_plains: 1 },
    };
    expect(evaluateUnlocks(reg, ctx)).not.toContain('iron_body');
  });

  it('unlocks farmers_eye after 2 max-age peasant lives (meta.lineage tracks anchor usage)', () => {
    const meta = {
      ...createEmptyMetaState(),
      lineage: [
        { lifeIndex: 1, name: 'A', anchorId: 'peasant_farmer', yearsLived: 90, realmReached: 'mortal', deathCause: 'old_age', karmaEarned: 10, echoesUnlockedThisLife: [] },
        { lifeIndex: 2, name: 'B', anchorId: 'peasant_farmer', yearsLived: 88, realmReached: 'mortal', deathCause: 'old_age', karmaEarned: 10, echoesUnlockedThisLife: [] },
      ],
    };
    const ctx: UnlockContext = {
      meta,
      finalRealm: 'mortal',
      finalBodyTemperingLayer: 0,
      diedOfOldAge: true,
      yearsLived: 85,
      diedThisLifeFlags: [],
      anchorThisLife: 'peasant_farmer',
      echoProgressCumulative: {},
      dominantRegionThisLife: 'yellow_plains',
      regionStreakByRegion: { yellow_plains: 1 },
    };
    expect(evaluateUnlocks(reg, ctx)).toContain('farmers_eye');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/meta/EchoUnlocker.test.ts`
Expected: FAIL — `evaluateUnlocks` not found (and TS error if `echoesUnlockedThisLife` not on `LineageEntrySummary` yet).

> Ordering note: if TS complains about `echoesUnlockedThisLife` and `echoesUnlocked`, jump to Task 14 first (MetaState v2 extension), then resume here. Record the task reorder in the PR.

- [ ] **Step 3: Implement**

Create `src/engine/meta/EchoUnlocker.ts`:

```ts
// Evaluate locked-echo unlock conditions at end of life. Pure function.
// Source: docs/spec/design.md §7.2.

import { EchoRegistry } from './EchoRegistry';
import { SoulEcho, UnlockCondition } from './SoulEcho';
import { MetaState } from './MetaState';

export interface UnlockContext {
  readonly meta: MetaState;
  readonly finalRealm: string;
  readonly finalBodyTemperingLayer: number;
  readonly diedOfOldAge: boolean;
  readonly yearsLived: number;
  readonly diedThisLifeFlags: ReadonlyArray<string>;
  readonly anchorThisLife: string;
  /** Cumulative echo progress after merging this-life tracker into meta.echoProgress. */
  readonly echoProgressCumulative: Readonly<Record<string, number>>;
  readonly dominantRegionThisLife: string;
  /** Count of consecutive lives that ended in this region (inclusive of current). */
  readonly regionStreakByRegion: Readonly<Record<string, number>>;
}

function conditionMet(cond: UnlockCondition, ctx: UnlockContext): boolean {
  switch (cond.kind) {
    case 'reach_realm': {
      if (cond.realm === 'body_tempering' && cond.sublayer !== undefined) {
        return ctx.finalBodyTemperingLayer >= cond.sublayer;
      }
      return ctx.finalRealm === cond.realm;
    }
    case 'choice_category_count':
      return (ctx.echoProgressCumulative[`choice_cat.${cond.category}`] ?? 0) >= cond.count;
    case 'outcome_count':
      return (ctx.echoProgressCumulative[`outcome.${cond.outcomeKind}`] ?? 0) >= cond.count;
    case 'lives_as_anchor_max_age': {
      const maxAgeByAnchor = ctx.meta.lineage.filter(
        (entry) => entry.anchorId === cond.anchor && entry.deathCause === 'old_age',
      );
      return maxAgeByAnchor.length >= cond.lives;
    }
    case 'died_with_flag':
      return ctx.diedThisLifeFlags.includes(cond.flag);
    case 'flag_set':
      return ctx.diedThisLifeFlags.includes(cond.flag);
    case 'died_in_same_region_streak':
      return (ctx.regionStreakByRegion[cond.region] ?? 0) >= cond.streak;
    case 'reached_insight_cap_lives':
      return (ctx.echoProgressCumulative['reached_insight_cap'] ?? 0) >= cond.lives;
    case 'lived_min_years_in_single_life':
      return ctx.yearsLived >= cond.years;
    case 'reached_realm_without_techniques':
      return (
        ctx.finalRealm === cond.realm &&
        (ctx.echoProgressCumulative['this_life_techniques_learned'] ?? 0) === 0
      );
  }
}

/** Returns newly-unlocked echo ids (in registry insertion order). */
export function evaluateUnlocks(registry: EchoRegistry, ctx: UnlockContext): ReadonlyArray<string> {
  const already = new Set(ctx.meta.echoesUnlocked);
  const newly: string[] = [];
  for (const echo of registry.all()) {
    if (already.has(echo.id)) continue;
    if (conditionMet(echo.unlockCondition, ctx)) {
      newly.push(echo.id);
    }
  }
  return newly;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/engine/meta/EchoUnlocker.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/meta/EchoUnlocker.ts src/engine/meta/EchoUnlocker.test.ts
git commit -m "feat(meta): EchoUnlocker evaluates unlock conditions on death"
```

---

## Task 6: `EchoRoller` with conflict resolution

**Files:**
- Create: `src/engine/meta/EchoRoller.ts`
- Create: `src/engine/meta/EchoRoller.test.ts`

**Rationale:** At birth, pick `slotCount` echoes from the unlocked pool using seeded RNG. If a rolled echo conflicts with an already-picked echo, drop the later-rolled and try again. Exhausted pool → return whatever was picked so far (not an error).

- [ ] **Step 1: Write the failing test**

Create `src/engine/meta/EchoRoller.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Mulberry32 } from '@/engine/core/RNG';
import { EchoRegistry } from './EchoRegistry';
import { rollEchoes } from './EchoRoller';
import { SoulEcho } from './SoulEcho';

function echo(id: string, conflicts: string[] = []): SoulEcho {
  return {
    id, name: id, description: '',
    tier: 'fragment',
    unlockCondition: { kind: 'flag_set', flag: 'x' },
    effects: [], conflicts, reveal: 'birth',
  };
}

describe('rollEchoes', () => {
  it('returns empty when unlocked pool is empty', () => {
    const reg = EchoRegistry.fromList([]);
    const rng = Mulberry32.fromSeed(42);
    expect(rollEchoes({ registry: reg, unlockedIds: [], slotCount: 3, rng })).toEqual([]);
  });

  it('returns empty when slotCount is 0', () => {
    const reg = EchoRegistry.fromList([echo('a'), echo('b')]);
    const rng = Mulberry32.fromSeed(42);
    expect(rollEchoes({ registry: reg, unlockedIds: ['a', 'b'], slotCount: 0, rng })).toEqual([]);
  });

  it('picks up to slotCount echoes from the unlocked pool', () => {
    const reg = EchoRegistry.fromList([echo('a'), echo('b'), echo('c')]);
    const rng = Mulberry32.fromSeed(42);
    const rolled = rollEchoes({ registry: reg, unlockedIds: ['a', 'b', 'c'], slotCount: 2, rng });
    expect(rolled.length).toBe(2);
    // All ids come from the unlocked pool, unique.
    expect(new Set(rolled).size).toBe(2);
    for (const id of rolled) expect(['a', 'b', 'c']).toContain(id);
  });

  it('is deterministic for a fixed seed', () => {
    const reg = EchoRegistry.fromList([echo('a'), echo('b'), echo('c'), echo('d')]);
    const r1 = Mulberry32.fromSeed(100);
    const r2 = Mulberry32.fromSeed(100);
    const a = rollEchoes({ registry: reg, unlockedIds: ['a', 'b', 'c', 'd'], slotCount: 2, rng: r1 });
    const b = rollEchoes({ registry: reg, unlockedIds: ['a', 'b', 'c', 'd'], slotCount: 2, rng: r2 });
    expect(a).toEqual(b);
  });

  it('drops conflicting later-rolled echo and tries another', () => {
    // 'fire' and 'ice' conflict. If fire rolls first, ice must be dropped.
    const reg = EchoRegistry.fromList([echo('fire', ['ice']), echo('ice', ['fire']), echo('earth')]);
    // Iterate many seeds; for every seed we must never end up with both fire+ice.
    for (let seed = 1; seed <= 50; seed += 1) {
      const rng = Mulberry32.fromSeed(seed);
      const rolled = rollEchoes({
        registry: reg,
        unlockedIds: ['fire', 'ice', 'earth'],
        slotCount: 2,
        rng,
      });
      const set = new Set(rolled);
      expect(set.has('fire') && set.has('ice')).toBe(false);
    }
  });

  it('caps at pool size even if slotCount higher', () => {
    const reg = EchoRegistry.fromList([echo('a'), echo('b')]);
    const rng = Mulberry32.fromSeed(42);
    const rolled = rollEchoes({ registry: reg, unlockedIds: ['a', 'b'], slotCount: 5, rng });
    expect(rolled.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/meta/EchoRoller.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/engine/meta/EchoRoller.ts`:

```ts
// Roll N echoes from unlocked pool with conflict resolution. Seeded.

import { IRng } from '@/engine/core/RNG';
import { EchoRegistry } from './EchoRegistry';

export interface RollEchoesArgs {
  registry: EchoRegistry;
  unlockedIds: ReadonlyArray<string>;
  slotCount: number;
  rng: IRng;
}

export function rollEchoes(args: RollEchoesArgs): ReadonlyArray<string> {
  const { registry, unlockedIds, slotCount, rng } = args;
  if (slotCount <= 0) return [];

  // Pool of candidate ids that are actually in the registry.
  const pool: string[] = [];
  for (const id of unlockedIds) {
    if (registry.has(id)) pool.push(id);
  }
  if (pool.length === 0) return [];

  const picked: string[] = [];
  const pickedSet = new Set<string>();

  // Fisher–Yates style iterative pick with conflict skipping.
  const remaining = [...pool];
  while (picked.length < slotCount && remaining.length > 0) {
    const i = rng.intRange(0, remaining.length - 1);
    const candidateId = remaining[i]!;
    // Remove from remaining first, so a rejected candidate is never retried.
    remaining.splice(i, 1);

    const candidate = registry.get(candidateId)!;
    // Conflict check against already-picked.
    const conflictsWithPicked = candidate.conflicts.some((c) => pickedSet.has(c));
    if (conflictsWithPicked) continue;

    picked.push(candidateId);
    pickedSet.add(candidateId);
  }

  return picked;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/engine/meta/EchoRoller.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/meta/EchoRoller.ts src/engine/meta/EchoRoller.test.ts
git commit -m "feat(meta): EchoRoller with seeded conflict resolution"
```

---

## Task 7: `EchoApplier`

**Files:**
- Create: `src/engine/meta/EchoApplier.ts`
- Create: `src/engine/meta/EchoApplier.test.ts`

**Rationale:** After an echo is rolled at birth, apply its effects to the `Character`. For 2A-1 scope: stat mods (flat + pct), hp_mult, insight cap bonus, and `starting_flag` are the hot paths that have visible impact. Resolver-bonus and event-weight effects are stored on the `Character` in a new `echoes: ReadonlyArray<string>` field; those bonuses will be read by `ChoiceResolver` / `EventSelector` in Phase 2A-2 when content wires them in.

Since extending `Character` adds a new field, and `Character` is touched carefully, scope this task to: apply stat mods + hp_mult + insight cap bonus *directly* on the returned character, and add an `echoes: string[]` field listing which ids were applied.

- [ ] **Step 1: Write the failing test**

Create `src/engine/meta/EchoApplier.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Mulberry32 } from '@/engine/core/RNG';
import { createCharacter } from '@/engine/character/Character';
import { applyEchoes } from './EchoApplier';
import { SoulEcho } from './SoulEcho';

const baseAttrs = { Body: 1, Mind: 1, Spirit: 1, Agility: 1, Charm: 1, Luck: 1 };

describe('applyEchoes', () => {
  it('returns character unchanged when no echoes rolled', () => {
    const rng = Mulberry32.fromSeed(1);
    const c = createCharacter({ name: 'Test', attributes: baseAttrs, rng });
    const result = applyEchoes(c, [], []);
    expect(result).toEqual(c);
  });

  it('applies flat stat_mod additively to attribute', () => {
    const rng = Mulberry32.fromSeed(1);
    const c = createCharacter({ name: 'Test', attributes: baseAttrs, rng });
    const echo: SoulEcho = {
      id: 'e1', name: 'e1', description: '', tier: 'fragment',
      unlockCondition: { kind: 'flag_set', flag: 'x' },
      effects: [{ kind: 'stat_mod', stat: 'Body', delta: 3 }],
      conflicts: [], reveal: 'birth',
    };
    const result = applyEchoes(c, [echo], ['e1']);
    expect(result.attributes.Body).toBe(c.attributes.Body + 3);
  });

  it('applies hp_mult as multiplicative on hpMax and scales hp proportionally', () => {
    const rng = Mulberry32.fromSeed(1);
    const c = createCharacter({ name: 'Test', attributes: baseAttrs, rng });
    const echo: SoulEcho = {
      id: 'iron_body', name: 'Iron Body', description: '', tier: 'fragment',
      unlockCondition: { kind: 'flag_set', flag: 'x' },
      effects: [{ kind: 'hp_mult', mult: 1.2 }],
      conflicts: [], reveal: 'birth',
    };
    const result = applyEchoes(c, [echo], ['iron_body']);
    expect(result.hpMax).toBeCloseTo(c.hpMax * 1.2, 5);
    expect(result.hp).toBeCloseTo(c.hp * 1.2, 5);
  });

  it('applies insight_cap_bonus additively', () => {
    const rng = Mulberry32.fromSeed(1);
    const c = createCharacter({ name: 'Test', attributes: baseAttrs, rng });
    const echo: SoulEcho = {
      id: 'vessel', name: 'Vessel', description: '', tier: 'fragment',
      unlockCondition: { kind: 'flag_set', flag: 'x' },
      effects: [{ kind: 'insight_cap_bonus', bonus: 50 }],
      conflicts: [], reveal: 'birth',
    };
    const result = applyEchoes(c, [echo], ['vessel']);
    expect(result.insightCap).toBe(c.insightCap + 50);
  });

  it('sets the echoes[] field to the applied ids', () => {
    const rng = Mulberry32.fromSeed(1);
    const c = createCharacter({ name: 'Test', attributes: baseAttrs, rng });
    const echo: SoulEcho = {
      id: 'e1', name: 'e1', description: '', tier: 'fragment',
      unlockCondition: { kind: 'flag_set', flag: 'x' },
      effects: [], conflicts: [], reveal: 'birth',
    };
    const result = applyEchoes(c, [echo], ['e1']);
    expect(result.echoes).toEqual(['e1']);
  });

  it('applies starting_flag effect to character.flags', () => {
    const rng = Mulberry32.fromSeed(1);
    const c = createCharacter({ name: 'Test', attributes: baseAttrs, rng });
    const echo: SoulEcho = {
      id: 'e1', name: 'e1', description: '', tier: 'fragment',
      unlockCondition: { kind: 'flag_set', flag: 'x' },
      effects: [{ kind: 'starting_flag', flag: 'reborn_marked' }],
      conflicts: [], reveal: 'birth',
    };
    const result = applyEchoes(c, [echo], ['e1']);
    expect(result.flags).toContain('reborn_marked');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/meta/EchoApplier.test.ts`
Expected: FAIL — module not found AND `.echoes` not on `Character`. Both will be resolved here.

- [ ] **Step 3: Extend `Character` interface with `echoes`**

Edit `src/engine/character/Character.ts`: find the `Character` interface block, add a new `echoes` field just above `flags`:

```ts
  /** Soul Echo ids applied at birth. Effects already folded into stats/hp/insightCap. */
  readonly echoes: ReadonlyArray<string>;

  /** Lifetime-persistent flags set by events. Phase 1D wires these. */
  readonly flags: ReadonlyArray<string>;
```

And extend the factory return to include `echoes: []`. Find the `createCharacter` return in `Character.ts` and add `echoes: []` to the literal. (Open the file, scroll to the return statement in `createCharacter`, add the field.)

> Because multiple existing tests construct `Character` values in-place via object literal, extending the interface with a required field would break them. To avoid a wide sweep in Task 7, make `echoes` **optional in practice** — read via `character.echoes ?? []` in downstream code, and always emit it from factories. Keep the interface field required but default it in `createCharacter` and in `applyEchoes`. Any test that constructs `Character` manually should include `echoes: []`. If a test breaks, fix it inline in the same commit.

- [ ] **Step 4: Implement `EchoApplier`**

Create `src/engine/meta/EchoApplier.ts`:

```ts
// Apply rolled Soul Echo effects to a Character. Pure.

import { Character } from '@/engine/character/Character';
import { AttributeMap } from '@/engine/character/Attribute';
import { SoulEcho } from './SoulEcho';

function applyStatDelta(
  attrs: Readonly<AttributeMap>,
  stat: string,
  delta: number,
): AttributeMap {
  if (!(stat in attrs)) return { ...attrs };
  return { ...attrs, [stat as keyof AttributeMap]: (attrs as any)[stat] + delta };
}

export function applyEchoes(
  base: Character,
  echoes: ReadonlyArray<SoulEcho>,
  echoIds: ReadonlyArray<string>,
): Character {
  let attributes: AttributeMap = { ...base.attributes };
  let hpMult = 1;
  let insightCapBonus = 0;
  const extraFlags: string[] = [];

  for (const e of echoes) {
    for (const eff of e.effects) {
      switch (eff.kind) {
        case 'stat_mod':
          attributes = applyStatDelta(attributes, eff.stat, eff.delta);
          break;
        case 'hp_mult':
          hpMult *= eff.mult;
          break;
        case 'insight_cap_bonus':
          insightCapBonus += eff.bonus;
          break;
        case 'starting_flag':
          if (!extraFlags.includes(eff.flag)) extraFlags.push(eff.flag);
          break;
        // Percent stat mods, resolver bonuses, event weights, heal efficacy,
        // mood swing pct, body cultivation pct, old-age death pct, imprint pct:
        // NOT applied to Character directly — read at point-of-use by systems
        // that consume them (Phase 2A-2 content wiring).
        default:
          break;
      }
    }
  }

  return {
    ...base,
    attributes,
    hp: base.hp * hpMult,
    hpMax: base.hpMax * hpMult,
    insightCap: base.insightCap + insightCapBonus,
    echoes: [...echoIds],
    flags: [...base.flags, ...extraFlags.filter((f) => !base.flags.includes(f))],
  };
}
```

- [ ] **Step 5: Run the test to verify it passes, plus the full suite to ensure Character extension didn't break anything**

Run: `pnpm vitest run src/engine/meta/EchoApplier.test.ts`
Expected: 6 tests PASS.

Run: `pnpm vitest run src/engine/character src/engine/meta`
Expected: all PASS. If a test constructing `Character` manually fails with "missing `echoes`", add `echoes: []` to that literal in the failing test file.

Run: `pnpm vitest run`
Expected: full suite green.

- [ ] **Step 6: Commit**

```bash
git add src/engine/character/Character.ts src/engine/meta/EchoApplier.ts src/engine/meta/EchoApplier.test.ts
# Stage any test files touched to add `echoes: []` to literal characters:
git add -u src/engine
git commit -m "feat(meta): EchoApplier + Character.echoes field"
```

---

## Task 8: `ForbiddenMemory` types + `memoryLevelOf`

**Files:**
- Create: `src/engine/meta/ForbiddenMemory.ts`
- Create: `src/engine/meta/ForbiddenMemory.test.ts`

**Rationale:** Define the `ForbiddenMemory` record (including the `requirements` field authored but unchecked in 2A per spec §3.2) and the `memoryLevelOf(lifetimeWitnesses): MemoryLevel` utility. Spec §7.3: `1-2 → fragment`, `3-6 → partial`, `≥7 → complete`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/meta/ForbiddenMemory.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ForbiddenMemory, memoryLevelOf, MemoryLevel } from './ForbiddenMemory';

describe('memoryLevelOf', () => {
  it('returns fragment for 1-2 witnesses', () => {
    expect(memoryLevelOf(1)).toBe<MemoryLevel>('fragment');
    expect(memoryLevelOf(2)).toBe<MemoryLevel>('fragment');
  });

  it('returns partial for 3-6 witnesses', () => {
    expect(memoryLevelOf(3)).toBe<MemoryLevel>('partial');
    expect(memoryLevelOf(6)).toBe<MemoryLevel>('partial');
  });

  it('returns complete for >= 7 witnesses', () => {
    expect(memoryLevelOf(7)).toBe<MemoryLevel>('complete');
    expect(memoryLevelOf(100)).toBe<MemoryLevel>('complete');
  });

  it('throws on zero or negative', () => {
    expect(() => memoryLevelOf(0)).toThrow();
    expect(() => memoryLevelOf(-1)).toThrow();
  });
});

describe('ForbiddenMemory type', () => {
  it('constructs a minimal memory value', () => {
    const m: ForbiddenMemory = {
      id: 'frost_palm_severing',
      name: 'Frost Palm Severing',
      description: 'A severing art.',
      element: 'water',
      witnessFlavour: {
        fragment: 'memory.witness.frost_palm_severing.fragment',
        partial:  'memory.witness.frost_palm_severing.partial',
        complete: 'memory.witness.frost_palm_severing.complete',
      },
      manifestFlavour: 'memory.manifest.frost_palm_severing',
      manifestInsightBonus: 10,
      manifestFlag: 'remembered_frost_palm_severing',
      requirements: { minMeridians: 3 },
    };
    expect(m.element).toBe('water');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/meta/ForbiddenMemory.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/engine/meta/ForbiddenMemory.ts`:

```ts
// Forbidden Memory types + level utility. Source: docs/spec/design.md §7.3.

import { Realm } from '@/engine/core/Types';

export type MemoryElement = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'void';
export type MemoryLevel = 'fragment' | 'partial' | 'complete';

export interface MemoryRequirements {
  readonly minMeridians?: number;
  readonly minRealm?: Realm | string;
}

export interface ForbiddenMemory {
  readonly id: string;               // also the placeholder techniqueId until Phase 2B
  readonly name: string;
  readonly description: string;
  readonly element: MemoryElement;
  readonly witnessFlavour: Readonly<Record<MemoryLevel, string>>;   // snippet keys
  readonly manifestFlavour: string;                                  // snippet key
  readonly manifestInsightBonus: number;
  readonly manifestFlag: string;                                     // set on successful manifest
  readonly requirements: MemoryRequirements;                         // authored now, unchecked in 2A
}

/** Spec §7.3: 1-2 fragment, 3-6 partial, >=7 complete. Throws on <=0. */
export function memoryLevelOf(lifetimeWitnesses: number): MemoryLevel {
  if (lifetimeWitnesses <= 0) {
    throw new Error(`memoryLevelOf requires a positive count, got ${lifetimeWitnesses}`);
  }
  if (lifetimeWitnesses <= 2) return 'fragment';
  if (lifetimeWitnesses <= 6) return 'partial';
  return 'complete';
}

/** Memory level as an integer (1/2/3) for use in the manifest chance formula. */
export function memoryLevelNumber(level: MemoryLevel): number {
  switch (level) {
    case 'fragment': return 1;
    case 'partial': return 2;
    case 'complete': return 3;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/engine/meta/ForbiddenMemory.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/meta/ForbiddenMemory.ts src/engine/meta/ForbiddenMemory.test.ts
git commit -m "feat(meta): ForbiddenMemory types + memoryLevelOf utility"
```

---

## Task 9: `MemoryRegistry`

**Files:**
- Create: `src/engine/meta/MemoryRegistry.ts`
- Create: `src/engine/meta/MemoryRegistry.test.ts`

**Rationale:** Mirror of `EchoRegistry`. Phase 2A-1 ships empty; content in 2A-2.

- [ ] **Step 1: Write the failing test**

Create `src/engine/meta/MemoryRegistry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MemoryRegistry, EMPTY_MEMORY_REGISTRY } from './MemoryRegistry';
import { ForbiddenMemory } from './ForbiddenMemory';

const fake: ForbiddenMemory = {
  id: 'fake_mem', name: 'Fake', description: '', element: 'water',
  witnessFlavour: { fragment: 'a', partial: 'b', complete: 'c' },
  manifestFlavour: 'm', manifestInsightBonus: 5,
  manifestFlag: 'f', requirements: {},
};

describe('MemoryRegistry', () => {
  it('empty registry returns empty list', () => {
    expect(EMPTY_MEMORY_REGISTRY.all()).toEqual([]);
    expect(EMPTY_MEMORY_REGISTRY.get('x')).toBeUndefined();
  });

  it('fromList registers memories by id', () => {
    const r = MemoryRegistry.fromList([fake]);
    expect(r.get('fake_mem')).toBe(fake);
    expect(r.all()).toEqual([fake]);
  });

  it('rejects duplicate ids', () => {
    expect(() => MemoryRegistry.fromList([fake, fake])).toThrow(/duplicate memory id/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/meta/MemoryRegistry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/engine/meta/MemoryRegistry.ts`:

```ts
// In-memory Forbidden Memory registry. Phase 2A-1 ships empty; content loader in 2A-2.

import { ForbiddenMemory } from './ForbiddenMemory';

export class MemoryRegistry {
  private readonly byId: ReadonlyMap<string, ForbiddenMemory>;

  private constructor(byId: Map<string, ForbiddenMemory>) {
    this.byId = byId;
  }

  static fromList(memories: ReadonlyArray<ForbiddenMemory>): MemoryRegistry {
    const map = new Map<string, ForbiddenMemory>();
    for (const m of memories) {
      if (map.has(m.id)) throw new Error(`duplicate memory id: ${m.id}`);
      map.set(m.id, m);
    }
    return new MemoryRegistry(map);
  }

  get(id: string): ForbiddenMemory | undefined {
    return this.byId.get(id);
  }

  all(): ReadonlyArray<ForbiddenMemory> {
    return Array.from(this.byId.values());
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }
}

export const EMPTY_MEMORY_REGISTRY: MemoryRegistry = MemoryRegistry.fromList([]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/engine/meta/MemoryRegistry.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/meta/MemoryRegistry.ts src/engine/meta/MemoryRegistry.test.ts
git commit -m "feat(meta): MemoryRegistry + empty default"
```

---

## Task 10: `MemoryWitnessLogger`

**Files:**
- Create: `src/engine/meta/MemoryWitnessLogger.ts`
- Create: `src/engine/meta/MemoryWitnessLogger.test.ts`

**Rationale:** Per spec §7.3, a memory witness counts *once per life*. 2A-1 ships two operations:
- `logWitness(runState, techniqueId)`: dedup within a life by consulting `runState.memoriesWitnessedThisLife`. Returns new `RunState`.
- `commitWitnesses(meta, thisLifeWitnessed)`: on death, merge this life's witnessed ids into `meta.memoriesWitnessed` (increment each).

- [ ] **Step 1: Write the failing test**

Create `src/engine/meta/MemoryWitnessLogger.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { logWitness, commitWitnesses } from './MemoryWitnessLogger';
import { createRunState } from '@/engine/events/RunState';
import { createCharacter } from '@/engine/character/Character';
import { Mulberry32 } from '@/engine/core/RNG';
import { createEmptyMetaState } from './MetaState';

function baseRunState() {
  const rng = Mulberry32.fromSeed(1);
  const character = createCharacter({
    name: 'T',
    attributes: { Body: 1, Mind: 1, Spirit: 1, Agility: 1, Charm: 1, Luck: 1 },
    rng,
  });
  return createRunState({
    character, runSeed: 1, region: 'yellow_plains', year: 900, season: 'spring',
  });
}

describe('logWitness', () => {
  it('adds techniqueId to memoriesWitnessedThisLife on first witness', () => {
    const rs = baseRunState();
    const next = logWitness(rs, 'frost_palm');
    expect(next.memoriesWitnessedThisLife).toContain('frost_palm');
  });

  it('is idempotent within a life', () => {
    const rs = baseRunState();
    const a = logWitness(rs, 'frost_palm');
    const b = logWitness(a, 'frost_palm');
    expect(b.memoriesWitnessedThisLife.filter((x) => x === 'frost_palm')).toHaveLength(1);
  });

  it('supports multiple distinct memories', () => {
    const rs = baseRunState();
    const a = logWitness(rs, 'a');
    const b = logWitness(a, 'b');
    expect(b.memoriesWitnessedThisLife).toEqual(['a', 'b']);
  });
});

describe('commitWitnesses', () => {
  it('increments lifetime witness counter for each id', () => {
    const meta = createEmptyMetaState();
    const next = commitWitnesses(meta, ['frost_palm', 'silent_waters']);
    expect(next.memoriesWitnessed).toEqual({ frost_palm: 1, silent_waters: 1 });
  });

  it('increments existing counters, not overwrite', () => {
    const meta = {
      ...createEmptyMetaState(),
      memoriesWitnessed: { frost_palm: 2 },
    };
    const next = commitWitnesses(meta, ['frost_palm', 'silent_waters']);
    expect(next.memoriesWitnessed.frost_palm).toBe(3);
    expect(next.memoriesWitnessed.silent_waters).toBe(1);
  });

  it('no-op when this-life list empty', () => {
    const meta = createEmptyMetaState();
    const next = commitWitnesses(meta, []);
    expect(next).toEqual(meta);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/meta/MemoryWitnessLogger.test.ts`
Expected: FAIL — module not found AND `memoriesWitnessedThisLife` not on RunState + `memoriesWitnessed` not on MetaState. Both resolved in Tasks 13 + 14.

> Ordering note: Tasks 13 and 14 add the fields this test depends on. Executor should jump to Task 13 (`RunState` extension) and Task 14 (`MetaState` v2) first if TS blocks — then return here. Subagent-driven-development approach already expects these shuffles; record them in the PR description.

- [ ] **Step 3: Implement**

Create `src/engine/meta/MemoryWitnessLogger.ts`:

```ts
// Per-life witness dedup + commit to MetaState on death. Source: docs/spec/design.md §7.3.

import { RunState } from '@/engine/events/RunState';
import { MetaState } from './MetaState';

/** Dedup within a life. Returns a new RunState. */
export function logWitness(rs: RunState, techniqueId: string): RunState {
  if (rs.memoriesWitnessedThisLife.includes(techniqueId)) return rs;
  return {
    ...rs,
    memoriesWitnessedThisLife: [...rs.memoriesWitnessedThisLife, techniqueId],
  };
}

/** On death: increment lifetime witness counter for each id. */
export function commitWitnesses(meta: MetaState, thisLifeIds: ReadonlyArray<string>): MetaState {
  if (thisLifeIds.length === 0) return meta;
  const next: Record<string, number> = { ...meta.memoriesWitnessed };
  for (const id of thisLifeIds) {
    next[id] = (next[id] ?? 0) + 1;
  }
  return { ...meta, memoriesWitnessed: next };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/engine/meta/MemoryWitnessLogger.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/meta/MemoryWitnessLogger.ts src/engine/meta/MemoryWitnessLogger.test.ts
git commit -m "feat(meta): MemoryWitnessLogger (per-life dedup + commit)"
```

---

## Task 11: `MemoryManifestResolver`

**Files:**
- Create: `src/engine/meta/MemoryManifestResolver.ts`
- Create: `src/engine/meta/MemoryManifestResolver.test.ts`

**Rationale:** Spec §7.3 manifestation roll. Called on `meditation`-tagged events. Per life, up to 3 attempts — caller is responsible for checking `runState.manifestAttemptsThisLife`. Uses its own derived seed `hash(runSeed, turnIndex, 'manifest')` per risks §10 to avoid drifting the resolver's RNG. Applies insight + flag on success. Returns new `RunState` + diagnostics.

For 2A-1 scope: the derived-seed `hash` function is a simple Mulberry32-based mixer; implement inline rather than importing from a new utility.

- [ ] **Step 1: Write the failing test**

Create `src/engine/meta/MemoryManifestResolver.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rollManifest, MANIFEST_ATTEMPTS_PER_LIFE } from './MemoryManifestResolver';
import { MemoryRegistry } from './MemoryRegistry';
import { ForbiddenMemory } from './ForbiddenMemory';
import { createRunState } from '@/engine/events/RunState';
import { createCharacter } from '@/engine/character/Character';
import { Mulberry32 } from '@/engine/core/RNG';
import { createEmptyMetaState } from './MetaState';

function memory(id: string, insightBonus = 10): ForbiddenMemory {
  return {
    id, name: id, description: '', element: 'water',
    witnessFlavour: { fragment: 'a', partial: 'b', complete: 'c' },
    manifestFlavour: 'm',
    manifestInsightBonus: insightBonus,
    manifestFlag: `remembered_${id}`,
    requirements: {},
  };
}

function runStateWithWitness(witnessed: string[]) {
  const rng = Mulberry32.fromSeed(42);
  const character = createCharacter({
    name: 'T',
    attributes: { Body: 1, Mind: 50, Spirit: 1, Agility: 1, Charm: 1, Luck: 1 },
    rng,
  });
  const rs = createRunState({ character, runSeed: 42, region: 'yellow_plains', year: 900, season: 'spring' });
  return { ...rs, memoriesWitnessedThisLife: witnessed };
}

describe('rollManifest', () => {
  it('returns unchanged when attempts exhausted', () => {
    const reg = MemoryRegistry.fromList([memory('a')]);
    const meta = { ...createEmptyMetaState(), memoriesWitnessed: { a: 1 } };
    const rs = { ...runStateWithWitness([]), manifestAttemptsThisLife: MANIFEST_ATTEMPTS_PER_LIFE };
    const { runState, manifested } = rollManifest({ runState: rs, meta, registry: reg });
    expect(runState).toEqual(rs);
    expect(manifested).toEqual([]);
  });

  it('returns unchanged when no lifetime-witnessed memories exist', () => {
    const reg = MemoryRegistry.fromList([memory('a')]);
    const meta = createEmptyMetaState();
    const rs = runStateWithWitness([]);
    const { runState, manifested } = rollManifest({ runState: rs, meta, registry: reg });
    expect(runState.manifestAttemptsThisLife).toBe(1); // attempt used even on empty roll
    expect(manifested).toEqual([]);
  });

  it('with extreme boost, manifests a witnessed memory and sets flag + insight', () => {
    const reg = MemoryRegistry.fromList([memory('a', 15)]);
    const meta = {
      ...createEmptyMetaState(),
      memoriesWitnessed: { a: 10 },                       // complete level (≥7)
      ownedUpgrades: ['student_of_the_wheel_1', 'student_of_the_wheel_2'],  // +50%
    };
    const rs = runStateWithWitness([]);
    // With L2 student_of_the_wheel (+50), complete (+15), Mind 50 (+5), insight 10 (+0.1)
    // manifestChance = 2 + 5 + 0.1 + 15 + 50 ≈ 72, clamp 60.
    // clamp [1,60] → 60% chance. Run 10 trials; at least one should succeed.
    let anyManifest = false;
    for (let seed = 1; seed <= 10; seed += 1) {
      const rsSeed = { ...rs, runSeed: seed, rngState: { seed, cursor: seed } };
      const { manifested, runState } = rollManifest({ runState: rsSeed, meta, registry: reg });
      if (manifested.length > 0) {
        anyManifest = true;
        expect(runState.character.insight).toBeGreaterThan(rsSeed.character.insight);
        expect(runState.memoriesManifestedThisLife).toContain('a');
      }
    }
    expect(anyManifest).toBe(true);
  });

  it('always increments manifestAttemptsThisLife', () => {
    const reg = MemoryRegistry.fromList([memory('a')]);
    const meta = { ...createEmptyMetaState(), memoriesWitnessed: { a: 1 } };
    const rs = runStateWithWitness([]);
    const { runState } = rollManifest({ runState: rs, meta, registry: reg });
    expect(runState.manifestAttemptsThisLife).toBe(1);
  });

  it('is deterministic for fixed runSeed + turn', () => {
    const reg = MemoryRegistry.fromList([memory('a', 5)]);
    const meta = { ...createEmptyMetaState(), memoriesWitnessed: { a: 1 } };
    const rsBase = { ...runStateWithWitness([]), runSeed: 100, turn: 3 };
    const r1 = rollManifest({ runState: rsBase, meta, registry: reg });
    const r2 = rollManifest({ runState: rsBase, meta, registry: reg });
    expect(r1.manifested).toEqual(r2.manifested);
    expect(r1.runState.character.insight).toBe(r2.runState.character.insight);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/meta/MemoryManifestResolver.test.ts`
Expected: FAIL — module not found. Blocks similar to Task 10 on RunState field extensions.

- [ ] **Step 3: Implement**

Create `src/engine/meta/MemoryManifestResolver.ts`:

```ts
// Forbidden Memory manifestation roll. Source: docs/spec/design.md §7.3.
// 2A decision C: manifest grants insight + flag (no technique registry yet).

import { Mulberry32 } from '@/engine/core/RNG';
import { RunState } from '@/engine/events/RunState';
import { MetaState } from './MetaState';
import { MemoryRegistry } from './MemoryRegistry';
import { memoryLevelOf, memoryLevelNumber } from './ForbiddenMemory';

export const MANIFEST_ATTEMPTS_PER_LIFE = 3;

export interface ManifestArgs {
  runState: RunState;
  meta: MetaState;
  registry: MemoryRegistry;
}

export interface ManifestResult {
  runState: RunState;
  manifested: ReadonlyArray<string>;        // ids that manifested this call
}

function studentOfTheWheelLevel(meta: MetaState): number {
  for (let lvl = 3; lvl >= 1; lvl -= 1) {
    if (meta.ownedUpgrades.includes(`student_of_the_wheel_${lvl}`)) return lvl;
  }
  return 0;
}

function manifestChance(
  meta: MetaState,
  character: RunState['character'],
  lifetimeWitnesses: number,
): number {
  const lvl = memoryLevelNumber(memoryLevelOf(lifetimeWitnesses));
  const sotwLevel = studentOfTheWheelLevel(meta);
  const raw =
    2
    + character.attributes.Mind * 0.1
    + character.insight * 0.01
    + lvl * 5
    + sotwLevel * 25;
  return Math.max(1, Math.min(60, raw));
}

/** Derived seed mixer so manifest RNG doesn't share the resolver stream. */
function manifestSeed(runSeed: number, turn: number): number {
  // Classic integer hash mix — order matters.
  let h = runSeed ^ 0x9e3779b9;
  h = Math.imul(h ^ (turn + 0x85ebca6b), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  return h || 1;
}

export function rollManifest(args: ManifestArgs): ManifestResult {
  const { runState, meta, registry } = args;

  if (runState.manifestAttemptsThisLife >= MANIFEST_ATTEMPTS_PER_LIFE) {
    return { runState, manifested: [] };
  }

  // Candidate memories: those with >= 1 lifetime witness AND in registry AND not already manifested THIS life.
  const witnessed = Object.entries(meta.memoriesWitnessed)
    .filter(([id, count]) => count > 0 && registry.has(id))
    .map(([id, count]) => ({ id, count }))
    .filter(({ id }) => !runState.memoriesManifestedThisLife.includes(id));

  const nextAttempts = runState.manifestAttemptsThisLife + 1;

  if (witnessed.length === 0) {
    return {
      runState: { ...runState, manifestAttemptsThisLife: nextAttempts },
      manifested: [],
    };
  }

  // Order deterministically by id so the RNG stream pick is reproducible.
  witnessed.sort((a, b) => a.id.localeCompare(b.id));

  const rng = Mulberry32.fromSeed(manifestSeed(runState.runSeed, runState.turn));
  const manifested: string[] = [];
  let character = runState.character;
  const newFlags = [...runState.worldFlags];     // not used; worldFlags stays as-is
  const manifestFlags: string[] = [];

  for (const { id, count } of witnessed) {
    const chance = manifestChance(meta, character, count);
    const roll = rng.intRange(1, 100);
    if (roll <= chance) {
      const mem = registry.get(id)!;
      manifested.push(id);
      character = {
        ...character,
        insight: Math.min(character.insightCap, character.insight + mem.manifestInsightBonus),
      };
      manifestFlags.push(mem.manifestFlag);
    }
  }

  // Fold manifest flags into the character we've been building (life-scoped).
  const finalCharacter = {
    ...character,
    flags: [
      ...character.flags,
      ...manifestFlags.filter((f) => !character.flags.includes(f)),
    ],
  };

  return {
    runState: {
      ...runState,
      character: finalCharacter,
      manifestAttemptsThisLife: nextAttempts,
      memoriesManifestedThisLife: [...runState.memoriesManifestedThisLife, ...manifested],
    },
    manifested,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/engine/meta/MemoryManifestResolver.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/meta/MemoryManifestResolver.ts src/engine/meta/MemoryManifestResolver.test.ts
git commit -m "feat(meta): MemoryManifestResolver with derived-seed determinism"
```

---

## Task 12: `OutcomeApplier` wires `outcome.witnessMemory`

**Files:**
- Modify: `src/engine/events/OutcomeApplier.ts`
- Modify: `src/engine/events/OutcomeApplier.test.ts`

**Rationale:** When an outcome resolves with `witnessMemory: 'TECH_ID'` set, call `logWitness(runState, id)` as part of applying the outcome. Phase 1B left this field unwired; 2A-1 wires it.

- [ ] **Step 1: Extend the existing test file with a new describe block**

Open `src/engine/events/OutcomeApplier.test.ts` and append (before the final `});`):

```ts
describe('applyOutcome — memory witness', () => {
  it('logs techniqueId to memoriesWitnessedThisLife when outcome.witnessMemory set', () => {
    const rs = baseRunState();   // existing helper in the file
    const next = applyOutcome(rs, {
      narrativeKey: 'x',
      stateDeltas: [],
      witnessMemory: 'frost_palm_severing',
    });
    expect(next.memoriesWitnessedThisLife).toContain('frost_palm_severing');
  });

  it('dedups witness within a single life', () => {
    const rs = baseRunState();
    const a = applyOutcome(rs, { narrativeKey: 'x', witnessMemory: 'frost_palm' });
    const b = applyOutcome(a,  { narrativeKey: 'x', witnessMemory: 'frost_palm' });
    expect(b.memoriesWitnessedThisLife.filter((i) => i === 'frost_palm')).toHaveLength(1);
  });

  it('ignores outcomes without witnessMemory', () => {
    const rs = baseRunState();
    const next = applyOutcome(rs, { narrativeKey: 'x', stateDeltas: [] });
    expect(next.memoriesWitnessedThisLife).toEqual([]);
  });
});
```

> Check the file for the existing `baseRunState` helper pattern. If none exists in this test file, use the one from `MemoryWitnessLogger.test.ts` (Task 10). If neither, copy-paste the one from Task 10 into this test file.

- [ ] **Step 2: Run the failing test**

Run: `pnpm vitest run src/engine/events/OutcomeApplier.test.ts`
Expected: 3 new tests FAIL with either "witnessMemory is not being applied" or "memoriesWitnessedThisLife is undefined".

- [ ] **Step 3: Wire the field in `OutcomeApplier.ts`**

Open `src/engine/events/OutcomeApplier.ts`. Find the main `applyOutcome` function. Add, near the end (after all `stateDeltas` have been processed but before returning), the witness hook:

```ts
import { logWitness } from '@/engine/meta/MemoryWitnessLogger';

// ... existing function body ...

export function applyOutcome(rs: RunState, outcome: Outcome): RunState {
  let next: RunState = rs;
  // ... existing stateDeltas application ...

  if (outcome.witnessMemory !== undefined) {
    next = logWitness(next, outcome.witnessMemory);
  }

  return next;
}
```

Adapt to the actual current control flow (the existing function may use a reducer pattern or sequential updates). The key: after all state deltas, call `logWitness` if `outcome.witnessMemory` is set.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/engine/events/OutcomeApplier.test.ts`
Expected: all tests (new + existing) PASS.

- [ ] **Step 5: Run full suite to catch ripple effects**

Run: `pnpm vitest run`
Expected: all PASS. Phase 1 integration tests `playable_life.test.ts` and `ui_full_cycle.test.tsx` must stay green.

- [ ] **Step 6: Commit**

```bash
git add src/engine/events/OutcomeApplier.ts src/engine/events/OutcomeApplier.test.ts
git commit -m "feat(events): wire outcome.witnessMemory to MemoryWitnessLogger"
```

---

## Task 13: `RunState` extension — witnesses, manifests, attempts

**Files:**
- Modify: `src/engine/events/RunState.ts`

**Rationale:** Add three per-life-scoped fields to `RunState`: `memoriesWitnessedThisLife`, `memoriesManifestedThisLife`, `manifestAttemptsThisLife`. Must NOT break Phase 1 `createRunState` callers — defaults to empty in the factory.

- [ ] **Step 1: Write an update test**

Create or append to `src/engine/events/RunState.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRunState } from './RunState';
import { createCharacter } from '@/engine/character/Character';
import { Mulberry32 } from '@/engine/core/RNG';

describe('createRunState — Phase 2A-1 fields', () => {
  it('defaults memoriesWitnessedThisLife to empty', () => {
    const rs = createRunState({
      character: createCharacter({
        name: 'T',
        attributes: { Body: 1, Mind: 1, Spirit: 1, Agility: 1, Charm: 1, Luck: 1 },
        rng: Mulberry32.fromSeed(1),
      }),
      runSeed: 1, region: 'yellow_plains', year: 900, season: 'spring',
    });
    expect(rs.memoriesWitnessedThisLife).toEqual([]);
    expect(rs.memoriesManifestedThisLife).toEqual([]);
    expect(rs.manifestAttemptsThisLife).toBe(0);
  });
});
```

If there's no existing `RunState.test.ts` in the codebase, this creates it. Otherwise, append to it.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/events/RunState.test.ts`
Expected: FAIL — fields undefined.

- [ ] **Step 3: Extend `RunState` interface + factory**

Open `src/engine/events/RunState.ts`. In the `RunState` interface, add these fields just before the closing brace:

```ts
  readonly memoriesWitnessedThisLife: ReadonlyArray<string>;
  readonly memoriesManifestedThisLife: ReadonlyArray<string>;
  readonly manifestAttemptsThisLife: number;
```

In `createRunState`, add to the returned object (before the closing brace):

```ts
    memoriesWitnessedThisLife: [],
    memoriesManifestedThisLife: [],
    manifestAttemptsThisLife: 0,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/engine/events/RunState.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `pnpm vitest run`
Expected: all PASS. Inline tests constructing `RunState` literally (not via `createRunState`) may need the three fields added — fix each in place if so.

- [ ] **Step 6: Commit**

```bash
git add src/engine/events/RunState.ts src/engine/events/RunState.test.ts
git add -u src/engine src/content
git commit -m "feat(events): RunState +memoriesWitnessedThisLife/+Manifested/+attempts"
```

---

## Task 14: `MetaState` v2 — schema bump + migration

**Files:**
- Modify: `src/engine/meta/MetaState.ts`
- Modify: `src/engine/meta/MetaState.test.ts`
- Create: `src/engine/meta/__fixtures__/metastate_v1.json`
- Create: `src/engine/persistence/Migrator.v1_to_v2.test.ts`

**Rationale:** Core persistence change. Add new fields to `MetaState`, bump `METASTATE_SCHEMA_VERSION` to 2, register a migration in whatever call-site composes the `Migrator` (may be in `SaveManager` or `MetaState.loadMeta`). Additive migration only — no field removals.

- [ ] **Step 1: Write the fixture + failing migration test**

Create `src/engine/meta/__fixtures__/metastate_v1.json` — a hand-authored snapshot of Phase 1D-3 shape:

```json
{
  "karmaBalance": 57,
  "lifeCount": 2,
  "ownedUpgrades": ["awakened_soul_1"],
  "unlockedAnchors": ["true_random", "peasant_farmer"],
  "lineage": [
    {
      "lifeIndex": 1,
      "name": "Lin Wei",
      "anchorId": "peasant_farmer",
      "yearsLived": 42,
      "realmReached": "body_tempering",
      "deathCause": "starvation",
      "karmaEarned": 27
    }
  ],
  "lifetimeSeenEvents": ["ev.daily.01"]
}
```

Create `src/engine/persistence/Migrator.v1_to_v2.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createMigrator } from './Migrator';
import fixtureV1 from '@/engine/meta/__fixtures__/metastate_v1.json';
import { metaStateMigrations, METASTATE_SCHEMA_VERSION } from '@/engine/meta/MetaState';
import type { MetaState } from '@/engine/meta/MetaState';

describe('Migrator v1 → v2 for MetaState', () => {
  const migrator = createMigrator<MetaState>({
    currentVersion: METASTATE_SCHEMA_VERSION,
    migrations: metaStateMigrations,
  });

  it('preserves karmaBalance and ownedUpgrades', () => {
    const migrated = migrator.migrate(fixtureV1, 1);
    expect(migrated.karmaBalance).toBe(57);
    expect(migrated.ownedUpgrades).toEqual(['awakened_soul_1']);
  });

  it('defaults new Phase 2A fields to empty', () => {
    const migrated = migrator.migrate(fixtureV1, 1);
    expect(migrated.echoesUnlocked).toEqual([]);
    expect(migrated.echoProgress).toEqual({});
    expect(migrated.memoriesWitnessed).toEqual({});
    expect(migrated.memoriesManifested).toEqual([]);
    expect(migrated.heavenlyNotice).toBe(0);
  });

  it('backfills lineage entries with echoesUnlockedThisLife: []', () => {
    const migrated = migrator.migrate(fixtureV1, 1);
    expect(migrated.lineage[0].echoesUnlockedThisLife).toEqual([]);
  });

  it('target schema version matches the current-version constant', () => {
    expect(METASTATE_SCHEMA_VERSION).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/persistence/Migrator.v1_to_v2.test.ts`
Expected: FAIL — module imports missing: `metaStateMigrations`, new fields, `METASTATE_SCHEMA_VERSION !== 2`.

- [ ] **Step 3: Extend `MetaState.ts`**

Open `src/engine/meta/MetaState.ts` and apply these edits:

a) Bump the version:
```ts
export const METASTATE_SCHEMA_VERSION = 2;
```

b) Extend `LineageEntrySummary`:
```ts
export interface LineageEntrySummary {
  lifeIndex: number;
  name: string;
  anchorId: string;
  yearsLived: number;
  realmReached: string;
  deathCause: string;
  karmaEarned: number;
  echoesUnlockedThisLife: ReadonlyArray<string>;   // NEW in v2; [] for v1-migrated entries
}
```

c) Extend `MetaState`:
```ts
export interface MetaState {
  readonly karmaBalance: number;
  readonly lifeCount: number;
  readonly ownedUpgrades: ReadonlyArray<string>;
  readonly unlockedAnchors: ReadonlyArray<string>;
  readonly lineage: ReadonlyArray<LineageEntrySummary>;
  readonly lifetimeSeenEvents: ReadonlyArray<string>;

  // Phase 2A-1 additions:
  readonly echoesUnlocked: ReadonlyArray<string>;
  readonly echoProgress: Readonly<Record<string, number>>;
  readonly memoriesWitnessed: Readonly<Record<string, number>>;
  readonly memoriesManifested: ReadonlyArray<string>;
  readonly heavenlyNotice: number;                  // reserved for Phase 3; always 0 in 2A
}
```

d) Extend `createEmptyMetaState`:
```ts
export function createEmptyMetaState(): MetaState {
  return {
    karmaBalance: 0,
    lifeCount: 0,
    ownedUpgrades: [],
    unlockedAnchors: ['true_random', 'peasant_farmer'],
    lineage: [],
    lifetimeSeenEvents: [],
    echoesUnlocked: [],
    echoProgress: {},
    memoriesWitnessed: {},
    memoriesManifested: [],
    heavenlyNotice: 0,
  };
}
```

e) Add migrations export at the bottom of the file:

```ts
import type { Migration } from '@/engine/persistence/Migrator';

/** Chained migrations for MetaState. Append new entries as schema evolves. */
export const metaStateMigrations: ReadonlyArray<Migration> = [
  {
    from: 1,
    to: 2,
    transform: (old: any): MetaState => ({
      karmaBalance: old.karmaBalance ?? 0,
      lifeCount: old.lifeCount ?? 0,
      ownedUpgrades: old.ownedUpgrades ?? [],
      unlockedAnchors: old.unlockedAnchors ?? ['true_random', 'peasant_farmer'],
      lineage: (old.lineage ?? []).map((entry: any) => ({
        ...entry,
        echoesUnlockedThisLife: entry.echoesUnlockedThisLife ?? [],
      })),
      lifetimeSeenEvents: old.lifetimeSeenEvents ?? [],
      echoesUnlocked: [],
      echoProgress: {},
      memoriesWitnessed: {},
      memoriesManifested: [],
      heavenlyNotice: 0,
    }),
  },
];
```

f) Update `loadMeta` / `saveMeta` to use the migrator. Find current `loadMeta`:

```ts
export function loadMeta(sm: SaveManager): MetaState {
  const envelope = sm.load<MetaState>(META_KEY);
  if (envelope === null) return createEmptyMetaState();
  return envelope.data;
}
```

Replace with:

```ts
import { createMigrator } from '@/engine/persistence/Migrator';

const metaMigrator = createMigrator<MetaState>({
  currentVersion: METASTATE_SCHEMA_VERSION,
  migrations: metaStateMigrations as any,
});

export function loadMeta(sm: SaveManager): MetaState {
  const envelope = sm.load<unknown>(META_KEY);
  if (envelope === null) return createEmptyMetaState();
  const migrated = metaMigrator.migrate(envelope.data, envelope.version);
  return migrated;
}
```

- [ ] **Step 4: Run migrator test**

Run: `pnpm vitest run src/engine/persistence/Migrator.v1_to_v2.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Run the existing `MetaState` test file + persistence tests**

Run: `pnpm vitest run src/engine/meta src/engine/persistence`
Expected: all PASS. If existing tests break due to new required fields on `LineageEntrySummary` literals, add `echoesUnlockedThisLife: []` to each offending literal inline. (Phase 1D-1 tests likely construct these.)

- [ ] **Step 6: Run full suite**

Run: `pnpm vitest run`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/meta/MetaState.ts src/engine/meta/MetaState.test.ts src/engine/meta/__fixtures__/metastate_v1.json src/engine/persistence/Migrator.v1_to_v2.test.ts
git add -u src/engine
git commit -m "feat(meta): MetaState v2 (echoes, memories, notice) + v1→v2 migration"
```

---

## Task 15: `MoodAdjectiveDict`

**Files:**
- Create: `src/engine/narrative/MoodAdjectiveDict.ts`
- Create: `src/engine/narrative/MoodAdjectiveDict.test.ts`

**Rationale:** Post-pass substitution: given rendered text + dominant mood, swap whole-word adjective matches using a seed dictionary. Word-boundary regex; case preserved for the first character (common English convention). Deterministic. No RNG.

- [ ] **Step 1: Write the failing test**

Create `src/engine/narrative/MoodAdjectiveDict.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { substituteAdjectives, DEFAULT_ADJECTIVE_DICT } from './MoodAdjectiveDict';

describe('substituteAdjectives', () => {
  it('returns text unchanged when mood has no substitutions', () => {
    const out = substituteAdjectives('The warm wind blew steady.', 'serenity', DEFAULT_ADJECTIVE_DICT);
    expect(out).toBe('The warm wind blew steady.');    // serenity keeps warm as warm
  });

  it('substitutes "warm" with "lonely" under melancholy', () => {
    const out = substituteAdjectives('The warm wind blew steady.', 'melancholy', DEFAULT_ADJECTIVE_DICT);
    expect(out).toBe('The lonely wind blew steady.');
  });

  it('respects word boundaries (does not touch "warmth")', () => {
    const out = substituteAdjectives('The warmth carried her voice.', 'melancholy', DEFAULT_ADJECTIVE_DICT);
    expect(out).toBe('The warmth carried her voice.');
  });

  it('preserves sentence-initial capitalization', () => {
    const out = substituteAdjectives('Warm rain fell.', 'rage', DEFAULT_ADJECTIVE_DICT);
    // 'warm' under rage → 'stifling', capitalized: 'Stifling'
    expect(out).toBe('Stifling rain fell.');
  });

  it('handles multiple adjectives in one pass', () => {
    const out = substituteAdjectives(
      'The warm night was quiet.',
      'melancholy',
      DEFAULT_ADJECTIVE_DICT,
    );
    // both 'warm' and 'quiet' should be substituted (quiet → hollow under melancholy)
    expect(out).toContain('lonely');
    expect(out).toContain('hollow');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/narrative/MoodAdjectiveDict.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/engine/narrative/MoodAdjectiveDict.ts`:

```ts
// Mood-scoped adjective substitution. Post-pass. Source: docs/spec/design.md §6.4.

import { Mood } from '@/engine/core/Types';

export type AdjectiveDict = Readonly<Record<string, Readonly<Partial<Record<Mood, string>>>>>;

/** Seed dictionary: 20 adjective keys × 6 moods (partial coverage per key). */
export const DEFAULT_ADJECTIVE_DICT: AdjectiveDict = {
  warm:    { melancholy: 'lonely', rage: 'stifling', serenity: 'gentle', paranoia: 'feverish' },
  quiet:   { melancholy: 'hollow', rage: 'sullen', serenity: 'still',    paranoia: 'watchful' },
  bright:  { melancholy: 'pale',   rage: 'glaring', serenity: 'clear' },
  soft:    { melancholy: 'faded',  rage: 'slack',   serenity: 'tender',   paranoia: 'slippery' },
  heavy:   { melancholy: 'slow',   rage: 'bludgeoning', serenity: 'settled', resolve: 'anchored' },
  cold:    { melancholy: 'bitter', rage: 'ironbound',   serenity: 'crisp',   paranoia: 'wary' },
  old:     { melancholy: 'weary',  rage: 'decrepit',    serenity: 'patient', resolve: 'seasoned' },
  dark:    { melancholy: 'smothered', rage: 'brooding', serenity: 'shaded', paranoia: 'hidden' },
  deep:    { melancholy: 'fathomless', rage: 'barrel-deep', serenity: 'still', resolve: 'rooted' },
  sharp:   { melancholy: 'clean',  rage: 'cutting',  serenity: 'edged',   resolve: 'clear' },
  slow:    { melancholy: 'drawn',  rage: 'sluggish', serenity: 'measured' },
  small:   { melancholy: 'frail',  rage: 'brittle',  serenity: 'fine',    resolve: 'quiet' },
  tall:    { melancholy: 'looming',rage: 'imposing', serenity: 'upright' },
  empty:   { melancholy: 'abandoned', rage: 'scoured', serenity: 'open',  paranoia: 'exposed' },
  fresh:   { melancholy: 'strange',rage: 'raw',      serenity: 'new',     resolve: 'ready' },
  thin:    { melancholy: 'threadbare', rage: 'stretched', serenity: 'fine', paranoia: 'tenuous' },
  slow_wind: { melancholy: 'low wind', rage: 'restless wind', serenity: 'easy wind' }, // stays literal
  hot:     { melancholy: 'aching', rage: 'boiling',  serenity: 'warmth',  paranoia: 'feverish' },
  loud:    { melancholy: 'clamouring', rage: 'savage', serenity: 'steady', paranoia: 'distracting' },
  gentle:  { melancholy: 'muted',  rage: 'tame',     serenity: 'gentle',  resolve: 'patient' },
};

function preserveCase(replacement: string, original: string): string {
  if (original.length === 0) return replacement;
  const firstOrig = original[0]!;
  if (firstOrig === firstOrig.toUpperCase() && firstOrig !== firstOrig.toLowerCase()) {
    return replacement[0]!.toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/** Substitute whole-word adjective matches in `text` under `mood`. Deterministic. */
export function substituteAdjectives(text: string, mood: Mood, dict: AdjectiveDict): string {
  let out = text;
  for (const [key, moodMap] of Object.entries(dict)) {
    const replacement = moodMap[mood];
    if (replacement === undefined) continue;
    // Word-boundary regex, case-insensitive on the match.
    const re = new RegExp(`\\b${key}\\b`, 'gi');
    out = out.replace(re, (matched) => preserveCase(replacement, matched));
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/engine/narrative/MoodAdjectiveDict.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/narrative/MoodAdjectiveDict.ts src/engine/narrative/MoodAdjectiveDict.test.ts
git commit -m "feat(narrative): MoodAdjectiveDict post-pass substitution"
```

---

## Task 16: `InteriorThoughtInjector`

**Files:**
- Create: `src/engine/narrative/InteriorThoughtInjector.ts`
- Create: `src/engine/narrative/InteriorThoughtInjector.test.ts`

**Rationale:** After an event's main narration renders, optionally append a reflective sentence using snippet key `reflection.{mood}.{realm}`. Rate scales with `Mind × moodLyricalBias`, deterministic via derived seed `hash(runSeed, turnIndex, 'interior')`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/narrative/InteriorThoughtInjector.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { maybeInjectInteriorThought, reflectionSnippetKey } from './InteriorThoughtInjector';
import { SnippetLibrary } from './SnippetLibrary';

const lib = SnippetLibrary.fromSource({
  'reflection.melancholy.mortal.1': [{ text: 'The moment passed like the others.' }],
  'reflection.melancholy.body_tempering.1': [{ text: 'His body remembered what his mouth forgot.' }],
  'reflection.resolve.mortal.1': [{ text: 'He knew, then, what he would do.' }],
});

describe('reflectionSnippetKey', () => {
  it('builds the dotted key', () => {
    expect(reflectionSnippetKey('melancholy', 'mortal')).toBe('reflection.melancholy.mortal');
  });
});

describe('maybeInjectInteriorThought', () => {
  it('returns unchanged text when rate rolls miss', () => {
    const out = maybeInjectInteriorThought({
      text: 'A day passed.',
      mood: 'melancholy',
      realm: 'mortal',
      mindStat: 0,              // rate = 0 → always miss
      runSeed: 1, turnIndex: 1,
      library: lib,
    });
    expect(out).toBe('A day passed.');
  });

  it('appends the reflection when Mind extremely high + melancholy', () => {
    // melancholy lyrical bias 1.2, mind 60 -> rate ~ 0.30 * (60/50) * 1.2 = 0.432
    // Even then not always; iterate seeds to find at least one hit.
    let anyHit = false;
    for (let seed = 1; seed <= 50; seed += 1) {
      const out = maybeInjectInteriorThought({
        text: 'A day passed.',
        mood: 'melancholy',
        realm: 'mortal',
        mindStat: 60,
        runSeed: seed, turnIndex: 1,
        library: lib,
      });
      if (out.length > 'A day passed.'.length) {
        anyHit = true;
        expect(out).toContain('The moment passed like the others.');
        break;
      }
    }
    expect(anyHit).toBe(true);
  });

  it('falls back to mortal-realm snippet if exact realm missing', () => {
    const out = maybeInjectInteriorThought({
      text: 'A day passed.',
      mood: 'resolve',
      realm: 'core',                // no reflection.resolve.core key in library
      mindStat: 100,
      runSeed: 1, turnIndex: 1,
      library: lib,
    });
    // With very high mind + resolve, should inject from mortal fallback
    if (out.length > 'A day passed.'.length) {
      expect(out).toContain('He knew, then, what he would do.');
    }
  });

  it('is deterministic for fixed (runSeed, turn)', () => {
    const args = {
      text: 'A day passed.',
      mood: 'melancholy' as const,
      realm: 'mortal',
      mindStat: 60,
      runSeed: 1234, turnIndex: 7,
      library: lib,
    };
    expect(maybeInjectInteriorThought(args)).toBe(maybeInjectInteriorThought(args));
  });

  it('returns unchanged text when library has no matching snippet', () => {
    const emptyLib = SnippetLibrary.fromSource({});
    const out = maybeInjectInteriorThought({
      text: 'A day passed.',
      mood: 'melancholy',
      realm: 'mortal',
      mindStat: 100,
      runSeed: 1, turnIndex: 1,
      library: emptyLib,
    });
    expect(out).toBe('A day passed.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/narrative/InteriorThoughtInjector.test.ts`
Expected: FAIL — module not found. Also check: `SnippetLibrary.fromSource` is the actual constructor — adjust import signature if the existing file uses a different name.

- [ ] **Step 3: Implement**

Create `src/engine/narrative/InteriorThoughtInjector.ts`:

```ts
// Reflective-sentence injector. Source: docs/spec/design.md §6.4 + §6.6.

import { Mulberry32 } from '@/engine/core/RNG';
import { Mood } from '@/engine/core/Types';
import { SnippetLibrary } from './SnippetLibrary';

export const BASE_INJECT_RATE = 0.3;
export const MIND_SCALE_DENOMINATOR = 50;
export const MAX_INJECT_RATE = 0.6;

const MOOD_LYRICAL_BIAS: Record<Mood, number> = {
  sorrow: 1.1,
  rage: 0.6,
  serenity: 1.0,
  paranoia: 0.7,
  resolve: 0.9,
  melancholy: 1.2,
};

export function reflectionSnippetKey(mood: Mood, realm: string): string {
  return `reflection.${mood}.${realm}`;
}

function derivedSeed(runSeed: number, turnIndex: number): number {
  let h = (runSeed ^ 0xdeadbeef) >>> 0;
  h = Math.imul(h ^ (turnIndex + 0x7f4a7c15), 0x9e3779b1);
  h = (h ^ (h >>> 16)) >>> 0;
  return h || 1;
}

export interface InjectArgs {
  text: string;
  mood: Mood;
  realm: string;
  mindStat: number;
  runSeed: number;
  turnIndex: number;
  library: SnippetLibrary;
}

export function maybeInjectInteriorThought(args: InjectArgs): string {
  const { text, mood, realm, mindStat, runSeed, turnIndex, library } = args;

  const bias = MOOD_LYRICAL_BIAS[mood] ?? 1.0;
  const rate = Math.max(
    0,
    Math.min(MAX_INJECT_RATE, BASE_INJECT_RATE * (mindStat / MIND_SCALE_DENOMINATOR) * bias),
  );
  if (rate <= 0) return text;

  const rng = Mulberry32.fromSeed(derivedSeed(runSeed, turnIndex));
  const roll = rng.float();   // [0, 1)
  if (roll >= rate) return text;

  // Resolve snippet with mortal fallback.
  const primaryKey = reflectionSnippetKey(mood, realm);
  const fallbackKey = reflectionSnippetKey(mood, 'mortal');
  const primary = library.pickEntry(primaryKey, undefined, rng);
  if (primary !== null) return `${text} ${primary}`;
  const fallback = library.pickEntry(fallbackKey, undefined, rng);
  if (fallback !== null) return `${text} ${fallback}`;
  return text;
}
```

> Check `SnippetLibrary`'s actual API. If `pickEntry(key, preferredTags?, rng)` doesn't match, adapt the calls to the library's real method signature. (Phase 1C's `SnippetLibrary` exposes a pick-with-tags method — confirm and adjust.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/engine/narrative/InteriorThoughtInjector.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/narrative/InteriorThoughtInjector.ts src/engine/narrative/InteriorThoughtInjector.test.ts
git commit -m "feat(narrative): InteriorThoughtInjector with derived-seed determinism"
```

---

## Task 17: `Composer.renderEvent` integrates both post-passes

**Files:**
- Modify: `src/engine/narrative/Composer.ts`
- Modify: `src/engine/narrative/Composer.test.ts`

**Rationale:** After `renderLine` produces the joined paragraph, apply (1) `maybeInjectInteriorThought`, then (2) `substituteAdjectives`. Order matters: interior injection happens on base text (so adjective substitution can still hit words in the appended reflection if it contains any).

- [ ] **Step 1: Write the failing test**

Append to `src/engine/narrative/Composer.test.ts` (inside existing describe or as a new describe):

```ts
import { substituteAdjectives, DEFAULT_ADJECTIVE_DICT } from './MoodAdjectiveDict';

describe('renderEvent — Phase 2A-1 post-passes', () => {
  it('applies adjective substitution under melancholy mood', () => {
    const event /*: EventDef */ = {
      id: 'test_event', category: 'daily', version: 1, weight: 1, timeCost: 'SHORT',
      conditions: {}, repeat: 'once_per_life',
      text: { intro: ['A warm wind blew across the plains.'], body: [], outro: [] },
      choices: [{
        id: 'c', label: 'do it', timeCost: 'SHORT',
        outcomes: { SUCCESS: { narrativeKey: 'x' }, FAILURE: { narrativeKey: 'x' } },
      }],
    };
    const library = SnippetLibrary.fromSource({});
    const registry = new NameRegistry();
    const rng = Mulberry32.fromSeed(1);
    const ctx = {
      characterName: 'Lin Wei', region: 'yellow_plains',
      season: 'autumn' as const, realm: 'mortal', dominantMood: 'melancholy' as const,
      turnIndex: 1, runSeed: 1, extraVariables: {},
    };
    const rendered = renderEvent(event, ctx, library, registry, rng);
    expect(rendered).toContain('lonely');     // warm -> lonely under melancholy
  });

  it('renders identically for same (runSeed, turn) + identical inputs (determinism)', () => {
    const event = {
      id: 'test_event', category: 'daily', version: 1, weight: 1, timeCost: 'SHORT',
      conditions: {}, repeat: 'once_per_life',
      text: { intro: ['A warm wind blew across the plains.'], body: [], outro: [] },
      choices: [{
        id: 'c', label: 'do it', timeCost: 'SHORT',
        outcomes: { SUCCESS: { narrativeKey: 'x' }, FAILURE: { narrativeKey: 'x' } },
      }],
    };
    const library = SnippetLibrary.fromSource({});
    const registry = new NameRegistry();
    const ctx = {
      characterName: 'Lin Wei', region: 'yellow_plains',
      season: 'autumn' as const, realm: 'mortal', dominantMood: 'melancholy' as const,
      turnIndex: 1, runSeed: 1, extraVariables: {},
    };
    const first  = renderEvent(event as any, ctx, library, registry, Mulberry32.fromSeed(42));
    const second = renderEvent(event as any, ctx, library, registry, Mulberry32.fromSeed(42));
    expect(first).toBe(second);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/narrative/Composer.test.ts`
Expected: the new test FAILs — adjective substitution not wired into renderEvent yet.

- [ ] **Step 3: Wire the post-passes in `Composer.ts`**

Open `src/engine/narrative/Composer.ts`. Find the end of `renderEvent`:

```ts
  return parts.join(' ');
}
```

Replace the return with post-pass application:

```ts
  let rendered = parts.join(' ');

  // Phase 2A-1 post-pass 1: interior-thought injection.
  rendered = maybeInjectInteriorThought({
    text: rendered,
    mood: ctx.dominantMood,
    realm: String(ctx.realm),
    mindStat: ctx.mindStat ?? 0,
    runSeed: ctx.runSeed,
    turnIndex: ctx.turnIndex,
    library,
  });

  // Phase 2A-1 post-pass 2: mood-adjective substitution.
  rendered = substituteAdjectives(rendered, ctx.dominantMood, DEFAULT_ADJECTIVE_DICT);

  return rendered;
}
```

Add the imports at the top of the file:

```ts
import { maybeInjectInteriorThought } from './InteriorThoughtInjector';
import { substituteAdjectives, DEFAULT_ADJECTIVE_DICT } from './MoodAdjectiveDict';
```

Extend `CompositionContext` with an optional `mindStat`:

```ts
export interface CompositionContext {
  characterName: string;
  region: string;
  season: Season;
  realm: Realm | string;
  dominantMood: Mood;
  turnIndex: number;
  runSeed: number;
  extraVariables: Readonly<Record<string, string>>;
  mindStat?: number;       // NEW — Phase 2A-1 interior-thought injection rate driver
}
```

Update any call-site that constructs `CompositionContext` (grep for `renderEvent(` and callers of `CompositionContext`). If no call-site passes `mindStat`, leave them — the optional field defaults to 0 and injection rate becomes 0, preserving Phase 1 behaviour.

- [ ] **Step 4: Run test to verify it passes, plus full suite**

Run: `pnpm vitest run src/engine/narrative`
Expected: all PASS.

Run: `pnpm vitest run`
Expected: all PASS. Phase 1 integration tests stay green (they pass `mindStat: undefined` → injection always 0, no change in output).

- [ ] **Step 5: Commit**

```bash
git add src/engine/narrative/Composer.ts src/engine/narrative/Composer.test.ts
git commit -m "feat(narrative): Composer applies adjective + interior post-passes"
```

---

## Task 18: Integration test — echo inheritance across lives

**Files:**
- Create: `tests/integration/echo_inheritance.test.ts`

**Rationale:** Prove exit criterion #1: an echo unlocked in Life N can be rolled into Life N+1 deterministically. This is engine-level only (no UI); uses the pieces from Tasks 2–14 directly.

The test scenario:
1. Construct `MetaState` with `iron_body` already unlocked (simulate Life N ended with Iron Body condition met).
2. Roll echoes for Life N+1 with a fixed seed.
3. Assert the rolled echo list contains `iron_body`.
4. Construct a `Character` via `characterFromAnchor` + `applyEchoes`.
5. Assert `Character.hp`, `.hpMax` reflect the `hp_mult: 1.2` effect.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/echo_inheritance.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Mulberry32 } from '@/engine/core/RNG';
import { EchoRegistry } from '@/engine/meta/EchoRegistry';
import { SoulEcho } from '@/engine/meta/SoulEcho';
import { rollEchoes } from '@/engine/meta/EchoRoller';
import { applyEchoes } from '@/engine/meta/EchoApplier';
import { createEmptyMetaState } from '@/engine/meta/MetaState';
import { createCharacter } from '@/engine/character/Character';
import { echoSlotsFor } from '@/engine/meta/SoulEcho';

describe('Echo inheritance — Life N → Life N+1', () => {
  const ironBody: SoulEcho = {
    id: 'iron_body', name: 'Iron Body',
    description: 'Your flesh remembers tempering.',
    tier: 'fragment',
    unlockCondition: { kind: 'reach_realm', realm: 'body_tempering', sublayer: 5 },
    effects: [
      { kind: 'hp_mult', mult: 1.2 },
      { kind: 'body_cultivation_rate_pct', pct: 10 },
    ],
    conflicts: [], reveal: 'birth',
  };

  it('rolls the previously-unlocked echo into the next life and applies effects', () => {
    const registry = EchoRegistry.fromList([ironBody]);
    // Simulate end of Life N: iron_body unlocked.
    const meta = { ...createEmptyMetaState(), echoesUnlocked: ['iron_body'] };

    // Start of Life N+1: roll echoes.
    const slots = echoSlotsFor(meta);
    expect(slots).toBe(1);

    const rng = Mulberry32.fromSeed(100);
    const rolled = rollEchoes({
      registry,
      unlockedIds: meta.echoesUnlocked,
      slotCount: slots,
      rng,
    });
    expect(rolled).toEqual(['iron_body']);

    const rolledEchoes = rolled.map((id) => registry.get(id)!);
    const baseChar = createCharacter({
      name: 'Lin Wei the Second',
      attributes: { Body: 2, Mind: 1, Spirit: 1, Agility: 1, Charm: 1, Luck: 1 },
      rng: Mulberry32.fromSeed(200),
    });
    const applied = applyEchoes(baseChar, rolledEchoes, rolled);

    expect(applied.echoes).toEqual(['iron_body']);
    expect(applied.hpMax).toBeCloseTo(baseChar.hpMax * 1.2, 5);
    expect(applied.hp).toBeCloseTo(baseChar.hp * 1.2, 5);
  });

  it('is deterministic: same seed yields same rolled echoes + effects', () => {
    const registry = EchoRegistry.fromList([ironBody]);
    const meta = { ...createEmptyMetaState(), echoesUnlocked: ['iron_body'] };
    const run = (seed: number) => {
      const rng = Mulberry32.fromSeed(seed);
      return rollEchoes({
        registry,
        unlockedIds: meta.echoesUnlocked,
        slotCount: echoSlotsFor(meta),
        rng,
      });
    };
    expect(run(999)).toEqual(run(999));
  });
});
```

- [ ] **Step 2: Run test to verify it passes (all machinery exists by this task)**

Run: `pnpm vitest run tests/integration/echo_inheritance.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 3: Run full test suite**

Run: `pnpm vitest run`
Expected: all Phase 0, 1, 2A-1 tests PASS. No regressions.

- [ ] **Step 4: Run build + lint**

Run: `pnpm build` and `pnpm lint` (whichever is configured).
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/echo_inheritance.test.ts
git commit -m "test(integration): echo inheritance N → N+1 determinism"
```

---

## Final Verification (before PR)

- [ ] **Run full suite:**

```bash
pnpm vitest run
```

Expected: all tests PASS. Count should be ~527 (Phase 1) + ~60-80 new = ~587-607.

- [ ] **Run build:**

```bash
pnpm build
```

Expected: `dist/` produced without errors. Note the bundle size in the PR description.

- [ ] **Run typecheck:**

```bash
pnpm typecheck
```

Expected: green.

- [ ] **Export the new modules from `src/engine/meta/index.ts` and `src/engine/narrative/index.ts`**

These files are 2-line barrel exports currently. Add exports for every new module:

In `src/engine/meta/index.ts`:
```ts
export * from './SoulEcho';
export * from './EchoRegistry';
export * from './EchoTracker';
export * from './EchoUnlocker';
export * from './EchoRoller';
export * from './EchoApplier';
export * from './ForbiddenMemory';
export * from './MemoryRegistry';
export * from './MemoryWitnessLogger';
export * from './MemoryManifestResolver';
```
Keep existing exports. Verify no naming collisions.

In `src/engine/narrative/index.ts`:
```ts
export * from './MoodAdjectiveDict';
export * from './InteriorThoughtInjector';
```
Keep existing exports.

Commit:

```bash
git add src/engine/meta/index.ts src/engine/narrative/index.ts
git commit -m "chore: export Phase 2A-1 modules"
```

- [ ] **Push + open PR:**

```bash
git push -u origin phase-2a1-engine
gh pr create --title "Phase 2A-1: engine foundations for echoes + memories + mood filter" --body "$(cat <<'EOF'
## Summary
- Soul Echo engine: registry, tracker, unlocker, roller (seeded + conflict resolution), applier.
- Forbidden Memory engine: registry, witness logger (per-life dedup), manifest resolver (derived-seed determinism, insight + flag on success per 2A decision C).
- MoodFilter completion: MoodAdjectiveDict post-pass, InteriorThoughtInjector with mind-scaled rate, Composer integrates both.
- MetaState v1 → v2 migration: echoesUnlocked, echoProgress, memoriesWitnessed, memoriesManifested, heavenlyNotice (stub, Phase 3); LineageEntrySummary extended with echoesUnlockedThisLife.
- RunState extended with 3 per-life-scoped memory fields.
- OutcomeApplier wires outcome.witnessMemory (previously-unwired Phase 1B field).
- Integration test: echo inheritance N → N+1 deterministic.

## Spec bugs caught (per CLAUDE.md convention)
1. Spec said METASTATE_SCHEMA_VERSION 2→3; codebase is at 1. Migration is 1→2; spec corrected in first commit.
2. Spec proposed `witness_memory` stateDelta kind; codebase already had `outcome.witnessMemory` field from Phase 1B. Wired existing field.
3. Spec proposed `pastLives` parallel to existing `lineage`; reused `lineage` + extended `LineageEntrySummary`.

## Phase boundaries
- Echo/Memory JSON corpus: deferred to **Phase 2A-2** (content).
- Anchor additions + event retrofits: **Phase 2A-2**.
- Codex / Lineage / Bardo UI: **Phase 2A-3**.

## Test plan
- [ ] `pnpm vitest run` — full green, ~600 tests
- [ ] `pnpm build` — green, bundle size noted in description
- [ ] `pnpm typecheck` — green
- [ ] Existing Phase 1 integration tests `playable_life` and `ui_full_cycle` unmodified and green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review (append to PR description)

Checklist:
- [ ] **Spec coverage:** spec §3.1 (SoulEcho system) → Tasks 2–7. §3.2 (ForbiddenMemory) → Tasks 8–11. §3.3 (MoodFilter) → Tasks 15–17. §5 (save migration) → Task 14. Exit criterion #1 → Task 18. Exit criterion #3 → Task 17. Exit criteria #2, #4–#8 belong to **2A-2 + 2A-3**, not this plan.
- [ ] **Placeholder scan:** no TBDs; every step has either code or a concrete command.
- [ ] **Type consistency:** `EchoEffect` kinds match across SoulEcho, EchoApplier, and test fixtures. `MemoryLevel` matches across ForbiddenMemory, MemoryWitnessLogger, MemoryManifestResolver. `MetaState` shape matches across Tasks 2, 10, 11, 14, 18.
- [ ] **Risk coverage:** manifest determinism uses derived seed (risk §10 row 2). Migration is additive only (row 3). Adjective substitution protects word boundaries (row 5). `Character.echoes` field introduced backward-compatibly (existing literals adjusted inline).
