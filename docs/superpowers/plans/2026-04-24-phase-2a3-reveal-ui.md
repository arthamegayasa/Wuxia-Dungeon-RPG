# Phase 2A-3 Reveal UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the reveal UI surface for Phase 2A — Codex screen (Memories / Echoes / Anchors), Lineage screen (LifeCards), enhanced Bardo (manifest + witness + echo-unlock reveals), enhanced Creation (locked-anchor silhouettes + shimmer), TitleScreen entry points, anchor-unlock evaluator wired at Bardo, plus full-cycle integration test. Closes Phase 2A exit criteria #5, #6, #8 from [`docs/superpowers/specs/2026-04-23-phase-2a-inheritance-and-reveal-design.md`](../specs/2026-04-23-phase-2a-inheritance-and-reveal-design.md) §2.

**Architecture:** UI-heavy phase. Three new screens (`CodexScreen`, `LineageScreen`, untouched-but-extended `CreationScreen` + `BardoPanel` + `TitleScreen`), three new bridge methods (`getCodexSnapshot`, `getLineageSnapshot`, extended `BardoPayload`), one schema bump (`LineageEntrySummary` gains `birthYear`/`deathYear`; `MetaState` v2 → v3) so Lineage cards can show year ranges per spec §6.2 mockup. Anchor-unlock evaluator added at `runBardoFlow` to populate `meta.unlockedAnchors` after each life — this closes the Phase 2A-2 trade-off "Anchor unlock evaluator deferred". One pure-engine module (`AnchorUnlockEvaluator`), one schema migration, one new `GamePhase` value (`LINEAGE` — `CODEX` already exists), no new runtime dependencies.

**Tech Stack:** React 19 + TypeScript 5.8 + Vite 6 + Vitest 4 + Zustand 5 + Zod 4 + idb 8 + @testing-library/react.

---

## Architecture: data flow at a glance

```
TitleScreen ──┬─ "Codex"  ──► App.tsx sets phase=CODEX  ──► CodexScreen reads engine.getCodexSnapshot()
              ├─ "Lineage"──► App.tsx sets phase=LINEAGE──► LineageScreen reads engine.getLineageSnapshot()
              ├─ "New"    ──► CreationScreen (now consumes anchors[].locked + unlockHint)
              └─ "Continue"──► PlayScreen (unchanged)

PlayScreen ──► resolveChoice → may transition to BARDO
BardoPanel reads BardoPayload (now extended with manifestedThisLife / witnessedThisLife / echoesUnlockedThisLife)
            └─ "Codex" / "Lineage" buttons → same screens, "Back" returns to BARDO

CodexScreen / LineageScreen "Back" returns to whichever phase opened them (TITLE | BARDO).
```

The `engineBridge` is the single boundary; both new screens are pure components driven by snapshot props.

---

## File structure

**New files:**
- `src/components/CodexScreen.tsx` + `.test.tsx`
- `src/components/LineageScreen.tsx` + `.test.tsx`
- `src/engine/meta/AnchorUnlockEvaluator.ts` + `.test.ts`
- `tests/integration/playable_life_2a.test.tsx`

**Modified files:**
- `src/engine/core/Types.ts` — add `LINEAGE` to `GamePhase`
- `src/engine/meta/MetaState.ts` — bump `METASTATE_SCHEMA_VERSION` 2→3, extend `LineageEntrySummary` with `birthYear`/`deathYear`, append v2→v3 migration to `metaStateMigrations`
- `src/engine/events/RunState.ts` — add `birthYear: number` field
- `src/engine/meta/characterFromAnchor.ts` — set `runState.birthYear` from `resolved.year - startingAgeYears`
- `src/engine/bardo/BardoFlow.ts` — emit `birthYear`/`deathYear` on lineage entry, call `evaluateAnchorUnlocks`
- `src/services/engineBridge.ts` — add `getCodexSnapshot` + `getLineageSnapshot`; extend `BardoPayload` + `CreationPayload`; expose all anchors with locked state
- `src/components/TitleScreen.tsx` + `.test.tsx` — wire Codex + Lineage buttons (Codex prop already exists; add `onOpenLineage`)
- `src/components/CreationScreen.tsx` + `.test.tsx` — accept `anchors: ReadonlyArray<{id; name; description; locked; unlockHint; freshlyUnlocked}>`, render locked silhouettes + shimmer
- `src/components/BardoPanel.tsx` + `.test.tsx` — render reveal sections 10a/10b/10c, add Codex + Lineage buttons
- `src/App.tsx` — handle `CODEX` and `LINEAGE` phases, route Back-button targets
- `tests/integration/ui_full_cycle.test.tsx` — keep green (anchor list shape change is the only break)

**Files explicitly NOT touched:**
- The Phase 2A-1/2A-2 engine modules (echo registry/tracker/applier, memory registry/witness-logger/manifest-resolver, mood filter passes). Their tests must stay green throughout.
- Phase 1 content JSON (no new events authored in 2A-3 — UI surface only).
- `src/engine/core/PostOutcomeHooks.ts` — already correct, unchanged.

---

## Sub-skill checklist before starting

- [ ] Confirm worktree path: this plan is being executed inside `D:/Claude Code/Wuxia RPG/.claude/worktrees/<...>` (a Phase-2A-3 worktree). If not, abort and create one.
- [ ] Confirm branch: must be `phase-2a3-ui` branched from `origin/main` (tip `337f315`).
- [ ] Confirm clean git status: `git status` returns nothing or only this plan file.
- [ ] Confirm `npm test -- --run` against `origin/main` is green at 651/98 before any changes (sanity check on the worktree).

---

## Task 0: Plan commit

**Files:**
- This plan: `docs/superpowers/plans/2026-04-24-phase-2a3-reveal-ui.md`

- [ ] **Step 1: Commit the plan as the first commit on the branch**

```bash
git add docs/superpowers/plans/2026-04-24-phase-2a3-reveal-ui.md
git commit -m "docs(plan): phase 2A-3 reveal UI implementation plan"
```

Expected: HEAD on `phase-2a3-ui` advances by one commit; `git log --oneline -1` shows the plan commit.

- [ ] **Step 2: Verify clean tree**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

---

## Task 1: GamePhase.LINEAGE

**Files:**
- Modify: `src/engine/core/Types.ts`
- Test: `src/engine/core/Types.test.ts` (create if missing — append to existing if present)

- [ ] **Step 1: Locate the existing enum**

Read `src/engine/core/Types.ts` and find:

```ts
export enum GamePhase {
  TITLE = 'TITLE',
  CREATION = 'CREATION',
  PLAYING = 'PLAYING',
  BARDO = 'BARDO',
  CODEX = 'CODEX',
  GAME_OVER_FINAL = 'GAME_OVER_FINAL',
}
```

- [ ] **Step 2: Write the failing test**

Append to `src/engine/core/Types.test.ts` (or create the file — if missing, scaffold with `import { describe, it, expect } from 'vitest'; import { GamePhase } from './Types';`):

```ts
describe('GamePhase enum', () => {
  it('contains LINEAGE for the lineage screen route', () => {
    expect(GamePhase.LINEAGE).toBe('LINEAGE');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --run src/engine/core/Types.test.ts`
Expected: TypeScript error "Property 'LINEAGE' does not exist on type 'typeof GamePhase'" or runtime FAIL.

- [ ] **Step 4: Add the enum value**

Edit `src/engine/core/Types.ts`:

```ts
export enum GamePhase {
  TITLE = 'TITLE',
  CREATION = 'CREATION',
  PLAYING = 'PLAYING',
  BARDO = 'BARDO',
  CODEX = 'CODEX',
  LINEAGE = 'LINEAGE',
  GAME_OVER_FINAL = 'GAME_OVER_FINAL',
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --run src/engine/core/Types.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/core/Types.ts src/engine/core/Types.test.ts
git commit -m "feat(types): add GamePhase.LINEAGE for lineage screen route"
```

---

## Task 2: RunState.birthYear

**Files:**
- Modify: `src/engine/events/RunState.ts`
- Modify: `src/engine/meta/characterFromAnchor.ts`
- Test: `src/engine/meta/characterFromAnchor.test.ts` (extend)

- [ ] **Step 1: Read context**

Read `src/engine/events/RunState.ts` (35-line file, holds the `RunState` interface + `createRunState`). Read `src/engine/meta/characterFromAnchor.ts` (the spawn helper). Note: `resolved.year` is the spawn-year; `resolved.ageDays` is starting age in days.

- [ ] **Step 2: Write the failing test (extend characterFromAnchor.test.ts)**

Append (or insert into the existing `describe`) in `src/engine/meta/characterFromAnchor.test.ts`:

```ts
it('sets runState.birthYear = spawn year minus starting age years', () => {
  const rng = createRng(42);
  // Resolve a real anchor with deterministic seed; assert the math.
  const anchor = DEFAULT_ANCHORS.find((a) => a.id === 'peasant_farmer')!;
  const resolved = resolveAnchor(anchor, rng);

  const meta = createEmptyMetaState();
  const result = characterFromAnchor({
    resolved, name: 'Lin Wei', runSeed: 1, rng: createRng(7),
    meta, echoRegistry: EMPTY_ECHO_REGISTRY,
  });

  const startingAgeYears = Math.floor(resolved.ageDays / 365);
  expect(result.runState.birthYear).toBe(resolved.year - startingAgeYears);
});
```

Required imports (add at top of test file if missing):

```ts
import { DEFAULT_ANCHORS } from '@/engine/meta/Anchor';
import { resolveAnchor } from '@/engine/meta/AnchorResolver';
import { createEmptyMetaState } from '@/engine/meta/MetaState';
import { EMPTY_ECHO_REGISTRY } from '@/engine/meta/EchoRegistry';
import { createRng } from '@/engine/core/RNG';
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --run src/engine/meta/characterFromAnchor.test.ts`
Expected: FAIL — "Property 'birthYear' does not exist on type 'RunState'" or `runState.birthYear === undefined`.

- [ ] **Step 4: Add `birthYear` to RunState**

Edit `src/engine/events/RunState.ts`:

```ts
export interface RunState {
  readonly character: Character;
  readonly turn: number;
  readonly runSeed: number;
  readonly rngState: RngState;
  readonly worldFlags: ReadonlyArray<string>;
  readonly thisLifeSeenEvents: ReadonlyArray<string>;
  readonly learnedTechniques: ReadonlyArray<string>;
  readonly inventory: ReadonlyArray<{ id: string; count: number }>;
  readonly region: string;
  readonly locale: string;
  readonly year: number;
  /** Phase 2A-3 Task 2: the year the character was born. Set once at
   *  characterFromAnchor; never advanced. Distinct from `year` which tracks
   *  the current calendar year as turns advance. Lineage card uses this. */
  readonly birthYear: number;
  readonly season: Season;
  readonly heavenlyNotice: number;
  readonly karmaEarnedBuffer: number;
  readonly deathCause: string | null;
  readonly pendingEventId?: string;
  readonly memoriesWitnessedThisLife: ReadonlyArray<string>;
  readonly memoriesManifestedThisLife: ReadonlyArray<string>;
  readonly manifestAttemptsThisLife: number;
}
```

Update `createRunState` to require `birthYear` in its args. Find:

```ts
export interface CreateRunStateArgs {
  character: Character;
  runSeed: number;
  region: string;
  // ... existing fields
}
```

Add `birthYear: number;` to the args interface and to the returned object literal in `createRunState`.

- [ ] **Step 5: Set `birthYear` in characterFromAnchor**

Edit `src/engine/meta/characterFromAnchor.ts`. In the function body where `runState` is built:

```ts
const startingAgeYears = Math.floor(resolved.ageDays / 365);
const runState = {
  ...createRunState({
    character, runSeed, region: resolved.region,
    year: resolved.year, season,
    birthYear: resolved.year - startingAgeYears,
  }),
  inventory: [...resolved.startingItems],
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- --run src/engine/meta/characterFromAnchor.test.ts`
Expected: PASS.

- [ ] **Step 7: Run full suite to catch fan-out breaks**

Run: `npm test -- --run`
Expected: any test that constructs a `RunState` directly without `birthYear` will fail. Fix each by passing `birthYear: 1000` (or whatever year the test uses). Common test files needing fix: `src/engine/events/RunState.test.ts`, anything in `src/engine/events/*.test.ts`, integration tests.

- [ ] **Step 8: Commit**

```bash
git add src/engine/events/RunState.ts src/engine/meta/characterFromAnchor.ts \
        src/engine/meta/characterFromAnchor.test.ts
# Plus any test files updated in step 7:
git add src/engine/events/RunState.test.ts  # if needed
git commit -m "feat(runstate): add birthYear field, set at characterFromAnchor"
```

---

## Task 3: LineageEntrySummary.birthYear / deathYear + MetaState v3 migration

**Files:**
- Modify: `src/engine/meta/MetaState.ts`
- Modify: `src/engine/bardo/BardoFlow.ts`
- Test: `src/engine/meta/MetaState.test.ts` (extend) — covers migration v2 → v3
- Test: `src/engine/bardo/BardoFlow.test.ts` (extend) — covers BardoFlow now writing both year fields

- [ ] **Step 1: Write the failing migration test**

Append to `src/engine/meta/MetaState.test.ts`:

```ts
describe('MetaState v2 → v3 migration', () => {
  it('migrates v2 lineage entries to v3 with default birthYear=0, deathYear=yearsLived', () => {
    const v2 = {
      schemaVersion: 2,
      karmaBalance: 100,
      lifeCount: 1,
      ownedUpgrades: [],
      unlockedAnchors: ['true_random', 'peasant_farmer'],
      lineage: [{
        lifeIndex: 1,
        name: 'Old Hu',
        anchorId: 'peasant_farmer',
        yearsLived: 47,
        realmReached: 'Mortal',
        deathCause: 'old_age',
        karmaEarned: 30,
        echoesUnlockedThisLife: ['iron_body'],
      }],
      lifetimeSeenEvents: [],
      heavenlyNotice: 0,
      echoesUnlocked: ['iron_body'],
      echoProgress: { 'choice_cat.life.training': 5 },
      memoriesWitnessed: {},
      memoriesManifested: [],
    };

    const migration = metaStateMigrations.find((m) => m.from === 2 && m.to === 3);
    expect(migration).toBeDefined();
    const v3 = migration!.transform(v2) as MetaState;

    // Year fields backfilled
    expect(v3.lineage[0].birthYear).toBe(0);
    expect(v3.lineage[0].deathYear).toBe(47);  // = yearsLived
    // Other fields preserved
    expect(v3.karmaBalance).toBe(100);
    expect(v3.echoesUnlocked).toEqual(['iron_body']);
    expect(v3.lineage[0].echoesUnlockedThisLife).toEqual(['iron_body']);
  });

  it('METASTATE_SCHEMA_VERSION is 3', () => {
    expect(METASTATE_SCHEMA_VERSION).toBe(3);
  });
});
```

Required imports (add if missing): `metaStateMigrations`, `METASTATE_SCHEMA_VERSION`, `MetaState`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/engine/meta/MetaState.test.ts`
Expected: FAIL — `METASTATE_SCHEMA_VERSION` is 2 and no v2→v3 migration exists.

- [ ] **Step 3: Extend `LineageEntrySummary`**

Edit `src/engine/meta/MetaState.ts`:

```ts
export interface LineageEntrySummary {
  lifeIndex: number;
  name: string;
  anchorId: string;
  /** Phase 2A-3 Task 3: absolute calendar year of birth. 0 for entries from
   *  pre-v3 saves (rendered as "Years lived: N" instead of "(Year X – Y)"). */
  birthYear: number;
  /** Phase 2A-3 Task 3: absolute calendar year of death = birthYear + yearsLived. */
  deathYear: number;
  yearsLived: number;
  realmReached: string;
  deathCause: string;
  karmaEarned: number;
  echoesUnlockedThisLife: ReadonlyArray<string>;
}
```

- [ ] **Step 4: Bump schema version + add v2→v3 migration**

Edit `src/engine/meta/MetaState.ts`:

```ts
export const METASTATE_SCHEMA_VERSION = 3;
```

Append to `metaStateMigrations`:

```ts
export const metaStateMigrations: ReadonlyArray<Migration> = [
  {
    from: 1,
    to: 2,
    transform: /* unchanged from Phase 2A-1 */,
  },
  {
    from: 2,
    to: 3,
    transform: (old: any): MetaState => ({
      ...old,
      schemaVersion: 3,
      lineage: (old.lineage ?? []).map((entry: any) => ({
        ...entry,
        birthYear: entry.birthYear ?? 0,
        deathYear: entry.deathYear ?? entry.yearsLived ?? 0,
      })),
    }),
  },
];
```

The pre-existing v1→v2 migration's `transform` body needs to also default `birthYear`/`deathYear` so a v1-direct → v3 chain works through the migrator. Add to the v1→v2 lineage-mapper:

```ts
lineage: (old.lineage ?? []).map((entry: any) => ({
  ...entry,
  echoesUnlockedThisLife: entry.echoesUnlockedThisLife ?? [],
  birthYear: entry.birthYear ?? 0,
  deathYear: entry.deathYear ?? entry.yearsLived ?? 0,
})),
```

(This makes v1→v2 idempotent w.r.t. v3 fields. The v2→v3 step still runs and is a no-op for v1-origin data.)

- [ ] **Step 5: Run migration test**

Run: `npm test -- --run src/engine/meta/MetaState.test.ts`
Expected: PASS.

- [ ] **Step 6: Update `BardoFlow.runBardoFlow` to emit year fields**

Edit `src/engine/bardo/BardoFlow.ts`. In the `LineageEntrySummary entry = { ... }` literal:

```ts
const entry: LineageEntrySummary = {
  lifeIndex: nextMeta.lifeCount + 1,
  name: rs.character.name,
  anchorId: anchorThisLife,
  birthYear: rs.birthYear,
  deathYear: rs.birthYear + summary.yearsLived,
  yearsLived: summary.yearsLived,
  realmReached: summary.realmReached,
  deathCause: summary.deathCause,
  karmaEarned: karma.total,
  echoesUnlockedThisLife: [...newlyUnlocked],
};
```

- [ ] **Step 7: Add a BardoFlow test asserting year fields**

Append to `src/engine/bardo/BardoFlow.test.ts`:

```ts
it('emits birthYear and deathYear on the new lineage entry', () => {
  const rs = makeRunStateForBardo({ birthYear: 950, ageDaysAtDeath: 30 * 365 });
  // ^ helper or inline literal — ensure rs.birthYear=950, rs.character.ageDays=30*365.
  const meta = createEmptyMetaState();
  const result = runBardoFlow(rs, meta, 1.0, EMPTY_ECHO_REGISTRY);
  const entry = result.meta.lineage[result.meta.lineage.length - 1];
  expect(entry.birthYear).toBe(950);
  expect(entry.deathYear).toBe(980);
  expect(entry.yearsLived).toBe(30);
});
```

If a `makeRunStateForBardo` helper doesn't exist in this test file, write the runState inline using `createRunState({ ... birthYear: 950 ... })` with the character age set via `createCharacter`.

- [ ] **Step 8: Run test**

Run: `npm test -- --run src/engine/bardo/BardoFlow.test.ts`
Expected: PASS.

- [ ] **Step 9: Run full suite**

Run: `npm test -- --run`
Expected: all green. Existing 651 tests stay green; new tests are additive. The metaStore's `toMetaState` projection is unchanged (it doesn't carry birthYear because it derives MetaState from the store; lineage entries flow through verbatim).

- [ ] **Step 10: Commit**

```bash
git add src/engine/meta/MetaState.ts src/engine/meta/MetaState.test.ts \
        src/engine/bardo/BardoFlow.ts src/engine/bardo/BardoFlow.test.ts
git commit -m "feat(meta): bump MetaState v2->v3, add lineage birthYear/deathYear"
```

---

## Task 4: AnchorUnlockEvaluator

**Files:**
- Create: `src/engine/meta/AnchorUnlockEvaluator.ts`
- Create: `src/engine/meta/AnchorUnlockEvaluator.test.ts`
- Modify: `src/engine/bardo/BardoFlow.ts` (call evaluator, add unlocks to `meta.unlockedAnchors`)
- Test: `src/engine/bardo/BardoFlow.test.ts` (extend)

- [ ] **Step 1: Write the failing evaluator unit test**

Create `src/engine/meta/AnchorUnlockEvaluator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { evaluateAnchorUnlocks } from './AnchorUnlockEvaluator';
import { createEmptyMetaState } from './MetaState';
import { LifeSummary } from './KarmicInsightRules';
import { Realm, DeathCause } from '@/engine/core/Types';

const summary = (overrides: Partial<LifeSummary> = {}): LifeSummary => ({
  yearsLived: 30,
  realmReached: 'Mortal' as Realm,
  maxBodyTemperingLayer: 0,
  deathCause: 'old_age' as DeathCause,
  vowsUnfulfilled: 0,
  diedProtectingOther: false,
  firstTimeFlags: [],
  anchorMultiplier: 1.0,
  inLifeKarmaDelta: 0,
  ...overrides,
});

describe('evaluateAnchorUnlocks', () => {
  it('returns ["martial_family"] when summary.maxBodyTemperingLayer >= 5', () => {
    const meta = createEmptyMetaState();
    const out = evaluateAnchorUnlocks({
      meta,
      summary: summary({ maxBodyTemperingLayer: 5 }),
      diedThisLifeFlags: [],
    });
    expect(out).toContain('martial_family');
  });

  it('does not unlock martial_family when BT layer is 4', () => {
    const out = evaluateAnchorUnlocks({
      meta: createEmptyMetaState(),
      summary: summary({ maxBodyTemperingLayer: 4 }),
      diedThisLifeFlags: [],
    });
    expect(out).not.toContain('martial_family');
  });

  it('returns ["scholars_son"] when flag read_ten_tomes_one_life is set', () => {
    const out = evaluateAnchorUnlocks({
      meta: createEmptyMetaState(),
      summary: summary(),
      diedThisLifeFlags: ['read_ten_tomes_one_life'],
    });
    expect(out).toContain('scholars_son');
  });

  it('returns ["outer_disciple"] when flag befriended_sect_disciple is set', () => {
    const out = evaluateAnchorUnlocks({
      meta: createEmptyMetaState(),
      summary: summary(),
      diedThisLifeFlags: ['befriended_sect_disciple'],
    });
    expect(out).toContain('outer_disciple');
  });

  it('does not double-list anchors already unlocked', () => {
    const meta = { ...createEmptyMetaState(), unlockedAnchors: ['true_random', 'peasant_farmer', 'martial_family'] };
    const out = evaluateAnchorUnlocks({
      meta,
      summary: summary({ maxBodyTemperingLayer: 5 }),
      diedThisLifeFlags: [],
    });
    expect(out).not.toContain('martial_family');
  });

  it('returns the empty array when no anchor unlocks fire', () => {
    const out = evaluateAnchorUnlocks({
      meta: createEmptyMetaState(),
      summary: summary(),
      diedThisLifeFlags: [],
    });
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --run src/engine/meta/AnchorUnlockEvaluator.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the evaluator**

Create `src/engine/meta/AnchorUnlockEvaluator.ts`:

```ts
// Anchor unlock evaluator. Closes the Phase 2A-2 trade-off "Anchor unlock
// evaluator deferred". Called by runBardoFlow at end-of-life so that the
// player's `meta.unlockedAnchors` list grows when the criteria from
// `AnchorDef.unlock` are satisfied.
//
// Scope (Phase 2A-3):
//   - reach_body_tempering_5  → summary.maxBodyTemperingLayer >= 5
//   - read_ten_tomes_one_life → flag `read_ten_tomes_one_life` was set this life
//   - befriend_sect_disciple  → flag `befriended_sect_disciple` was set this life
//
// The two flag-gated unlocks are AUTHORED-FROM-CONTENT contracts: events that
// satisfy them set those flags via `flag_set` outcomes. Phase 2A-2 did not
// retrofit existing events to set these flags — that's content work for 2B.
// In practice, in 2A-3 only `reach_body_tempering_5` will fire from gameplay
// against the current Yellow Plains corpus; the others are exercised by tests
// only. This is the accepted limitation; do NOT add starting-flag gates here
// (e.g. `literate` from scholars_son anchor) because they would auto-unlock
// the anchor on the player's first scholars_son life.

import { MetaState } from './MetaState';
import { LifeSummary } from './KarmicInsightRules';

export interface AnchorUnlockContext {
  readonly meta: MetaState;
  readonly summary: LifeSummary;
  readonly diedThisLifeFlags: ReadonlyArray<string>;
}

interface UnlockRule {
  readonly anchorId: string;
  readonly check: (ctx: AnchorUnlockContext) => boolean;
}

const RULES: ReadonlyArray<UnlockRule> = [
  {
    anchorId: 'martial_family',
    check: (ctx) => ctx.summary.maxBodyTemperingLayer >= 5,
  },
  {
    anchorId: 'scholars_son',
    check: (ctx) => ctx.diedThisLifeFlags.includes('read_ten_tomes_one_life'),
  },
  {
    anchorId: 'outer_disciple',
    check: (ctx) => ctx.diedThisLifeFlags.includes('befriended_sect_disciple'),
  },
];

export function evaluateAnchorUnlocks(ctx: AnchorUnlockContext): ReadonlyArray<string> {
  const owned = new Set(ctx.meta.unlockedAnchors);
  const newly: string[] = [];
  for (const rule of RULES) {
    if (owned.has(rule.anchorId)) continue;
    if (rule.check(ctx)) newly.push(rule.anchorId);
  }
  return newly;
}
```

- [ ] **Step 4: Run unit test**

Run: `npm test -- --run src/engine/meta/AnchorUnlockEvaluator.test.ts`
Expected: PASS (6 cases).

- [ ] **Step 5: Wire into BardoFlow**

Edit `src/engine/bardo/BardoFlow.ts`. At the top, import:

```ts
import { evaluateAnchorUnlocks } from '@/engine/meta/AnchorUnlockEvaluator';
```

In `runBardoFlow`, after the `evaluateUnlocks` echo block and BEFORE the `entry` literal:

```ts
const newlyUnlockedAnchors = evaluateAnchorUnlocks({
  meta: nextMeta,
  summary,
  diedThisLifeFlags: rs.character.flags,
});
if (newlyUnlockedAnchors.length > 0) {
  nextMeta = {
    ...nextMeta,
    unlockedAnchors: [...nextMeta.unlockedAnchors, ...newlyUnlockedAnchors],
  };
}
```

- [ ] **Step 6: Add a BardoFlow integration assertion**

Append to `src/engine/bardo/BardoFlow.test.ts`:

```ts
it('appends martial_family to meta.unlockedAnchors when BT layer 5+', () => {
  const rs = makeRunStateAtBardo({
    bodyTemperingLayer: 5, // expose through the test helper / inline
    birthYear: 950,
    ageDaysAtDeath: 40 * 365,
  });
  const meta = createEmptyMetaState();
  const result = runBardoFlow(rs, meta, 1.0, EMPTY_ECHO_REGISTRY);
  expect(result.meta.unlockedAnchors).toContain('martial_family');
});
```

(If the existing helper doesn't expose `bodyTemperingLayer`, build the runState/character inline.)

- [ ] **Step 7: Run BardoFlow tests**

Run: `npm test -- --run src/engine/bardo/BardoFlow.test.ts`
Expected: PASS.

- [ ] **Step 8: Run the full suite**

Run: `npm test -- --run`
Expected: all green. The previously-merged Phase 2A-2 `Anchor.test.ts` already verified the data shape of all 5 anchors; this new evaluator is additive.

- [ ] **Step 9: Commit**

```bash
git add src/engine/meta/AnchorUnlockEvaluator.ts \
        src/engine/meta/AnchorUnlockEvaluator.test.ts \
        src/engine/bardo/BardoFlow.ts src/engine/bardo/BardoFlow.test.ts
git commit -m "feat(meta): anchor unlock evaluator wired at bardo (closes 2A-2 deferral)"
```

---

## Task 5: Bridge — extend BardoPayload with reveal arrays

**Files:**
- Modify: `src/services/engineBridge.ts`
- Test: `src/services/engineBridge.test.ts` (extend)

- [ ] **Step 1: Read the existing BardoPayload shape**

Open `src/services/engineBridge.ts`. Find:

```ts
export interface BardoPayload {
  lifeIndex: number;
  years: number;
  realm: string;
  deathCause: string;
  karmaEarned: number;
  karmaBreakdown: Record<string, number>;
  karmaBalance: number;
  ownedUpgrades: ReadonlyArray<string>;
  availableUpgrades: ReadonlyArray<{
    id: string; name: string; description: string; cost: number;
    affordable: boolean; requirementsMet: boolean; owned: boolean;
  }>;
}
```

- [ ] **Step 2: Write the failing test**

Append to `src/services/engineBridge.test.ts`:

```ts
describe('BardoPayload reveal fields', () => {
  it('exposes manifestedThisLife / witnessedThisLife / echoesUnlockedThisLife after death', async () => {
    // Set up a deterministic engine, run a life to death.
    const sm = createSaveManager({ storage: () => makeMemoryStorage(), gameVersion: 'test' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 2 });
    await engine.loadOrInit();
    await engine.beginLife('peasant_farmer', 'Hu');
    // Pump turns until BARDO transition.
    for (let i = 0; i < 600; i++) {
      const next = await engine.peekNextEvent().catch(() => null);
      if (!next) break;
      const choiceId = next.choices[0]?.id;
      if (!choiceId) break;
      const result = await engine.resolveChoice(choiceId);
      if ('karmaEarned' in result) {
        // Bardo reached.
        expect(result).toHaveProperty('manifestedThisLife');
        expect(result).toHaveProperty('witnessedThisLife');
        expect(result).toHaveProperty('echoesUnlockedThisLife');
        expect(Array.isArray(result.manifestedThisLife)).toBe(true);
        expect(Array.isArray(result.witnessedThisLife)).toBe(true);
        expect(Array.isArray(result.echoesUnlockedThisLife)).toBe(true);
        return;
      }
    }
    throw new Error('did not reach bardo within 600 turns');
  }, 30000);
});
```

(`makeMemoryStorage` is the existing in-memory `Storage` shim; if absent in the test file, copy the small stub from `engineBridge.test.ts`'s top.)

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- --run src/services/engineBridge.test.ts`
Expected: FAIL — bardo result lacks the three new arrays.

- [ ] **Step 4: Extend BardoPayload + buildBardoPayload**

Edit `src/services/engineBridge.ts`:

Extend the interface:

```ts
export interface RevealedMemory {
  id: string;
  name: string;
  level: 'fragment' | 'partial' | 'complete';
  manifestFlavour?: string;  // present iff manifested this life (the snippet key)
}

export interface RevealedEcho {
  id: string;
  name: string;
  description: string;
}

export interface BardoPayload {
  lifeIndex: number;
  years: number;
  realm: string;
  deathCause: string;
  karmaEarned: number;
  karmaBreakdown: Record<string, number>;
  karmaBalance: number;
  ownedUpgrades: ReadonlyArray<string>;
  availableUpgrades: ReadonlyArray<{
    id: string; name: string; description: string; cost: number;
    affordable: boolean; requirementsMet: boolean; owned: boolean;
  }>;
  /** Phase 2A-3: memories that manifested this life (10a reveal). */
  manifestedThisLife: ReadonlyArray<RevealedMemory>;
  /** Phase 2A-3: memories witnessed this life (10b reveal). Compact list. */
  witnessedThisLife: ReadonlyArray<RevealedMemory>;
  /** Phase 2A-3: echoes whose unlock condition fired this life (10c reveal). */
  echoesUnlockedThisLife: ReadonlyArray<RevealedEcho>;
}
```

In `buildBardoPayload`:

```ts
function buildBardoPayload(): BardoPayload {
  const gs = useGameStore.getState();
  const meta = currentMetaState();
  if (!gs.bardoResult) throw new Error('buildBardoPayload: no bardoResult in store');
  const br = gs.bardoResult;
  const rs = gs.runState!;

  const witnessedIds = rs.memoriesWitnessedThisLife;
  const manifestedIds = rs.memoriesManifestedThisLife;

  const witnessedThisLife: RevealedMemory[] = witnessedIds.map((id) => {
    const m = MEMORY_REGISTRY.get(id);
    const lifetimeCount = meta.memoriesWitnessed[id] ?? 0;
    const level = lifetimeCount > 0 ? memoryLevelOf(lifetimeCount) : 'fragment';
    return { id, name: m?.name ?? id, level };
  });

  const manifestedThisLife: RevealedMemory[] = manifestedIds.map((id) => {
    const m = MEMORY_REGISTRY.get(id);
    const lifetimeCount = meta.memoriesWitnessed[id] ?? 1;
    const level = memoryLevelOf(Math.max(1, lifetimeCount));
    return {
      id, name: m?.name ?? id, level,
      manifestFlavour: m?.manifestFlavour,
    };
  });

  // The just-pushed lineage entry is the last one; pull echo ids from there.
  const lastEntry = meta.lineage[meta.lineage.length - 1];
  const echoesUnlockedThisLife: RevealedEcho[] = (lastEntry?.echoesUnlockedThisLife ?? []).map((id) => {
    const e = ECHO_REGISTRY.get(id);
    return { id, name: e?.name ?? id, description: e?.description ?? '' };
  });

  return {
    lifeIndex: meta.lifeCount,
    years: br.summary.yearsLived,
    realm: br.summary.realmReached,
    deathCause: br.summary.deathCause,
    karmaEarned: br.karmaEarned,
    karmaBreakdown: {
      yearsLived: br.karmaBreakdown.yearsLived,
      realm: br.karmaBreakdown.realm,
      deathCause: br.karmaBreakdown.deathCause,
      vows: br.karmaBreakdown.vows,
      diedProtecting: br.karmaBreakdown.diedProtecting,
      achievements: br.karmaBreakdown.achievements,
      inLifeDelta: br.karmaBreakdown.inLifeDelta,
    },
    karmaBalance: meta.karmaBalance,
    ownedUpgrades: meta.ownedUpgrades,
    availableUpgrades: decorateUpgrades(meta),
    manifestedThisLife,
    witnessedThisLife,
    echoesUnlockedThisLife,
  };
}
```

Add the import: `import { memoryLevelOf } from '@/engine/meta/ForbiddenMemory';`

- [ ] **Step 5: Run test to verify pass**

Run: `npm test -- --run src/services/engineBridge.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full suite**

Run: `npm test -- --run`
Expected: all green; existing BardoPanel tests pass because they don't read the new fields.

- [ ] **Step 7: Commit**

```bash
git add src/services/engineBridge.ts src/services/engineBridge.test.ts
git commit -m "feat(bridge): extend BardoPayload with manifest/witness/echo reveal arrays"
```

---

## Task 6: Bridge — getCodexSnapshot

**Files:**
- Modify: `src/services/engineBridge.ts`
- Test: `src/services/engineBridge.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `src/services/engineBridge.test.ts`:

```ts
describe('getCodexSnapshot', () => {
  it('returns all 10 echoes, all 5 memories, all 5 anchors with locked/unlocked flags', () => {
    const sm = createSaveManager({ storage: () => makeMemoryStorage(), gameVersion: 'test' });
    const engine = createEngineBridge({ saveManager: sm });
    const snap = engine.getCodexSnapshot();

    expect(snap.echoes).toHaveLength(10);
    expect(snap.memories).toHaveLength(5);
    expect(snap.anchors).toHaveLength(5);

    // Default state: no echoes/memories unlocked, only `true_random` + `peasant_farmer` anchors.
    expect(snap.echoes.every((e) => !e.unlocked)).toBe(true);
    expect(snap.memories.every((m) => m.level === 'unseen')).toBe(true);
    expect(snap.anchors.find((a) => a.id === 'peasant_farmer')!.unlocked).toBe(true);
    expect(snap.anchors.find((a) => a.id === 'true_random')!.unlocked).toBe(true);
    expect(snap.anchors.find((a) => a.id === 'martial_family')!.unlocked).toBe(false);

    // Each echo and memory entry has a name + description.
    for (const e of snap.echoes) {
      expect(e.name).toBeTruthy();
      expect(e.description).toBeTruthy();
      expect(typeof e.unlockHint).toBe('string');
    }
    for (const m of snap.memories) {
      expect(m.name).toBeTruthy();
      expect(m.description).toBeTruthy();
    }
  });

  it('reflects unlocked echo and witnessed memory state after meta hydration', () => {
    const sm = createSaveManager({ storage: () => makeMemoryStorage(), gameVersion: 'test' });
    const engine = createEngineBridge({ saveManager: sm });
    // Hydrate meta directly via the store.
    useMetaStore.getState().hydrateFromMetaState({
      ...createEmptyMetaState(),
      echoesUnlocked: ['iron_body'],
      memoriesWitnessed: { 'frost_palm_severing': 4 },  // 4 → partial
      memoriesManifested: ['frost_palm_severing'],
      unlockedAnchors: ['true_random', 'peasant_farmer', 'martial_family'],
    });
    const snap = engine.getCodexSnapshot();

    expect(snap.echoes.find((e) => e.id === 'iron_body')!.unlocked).toBe(true);
    const mem = snap.memories.find((m) => m.id === 'frost_palm_severing')!;
    expect(mem.level).toBe('partial');
    expect(mem.manifested).toBe(true);
    expect(snap.anchors.find((a) => a.id === 'martial_family')!.unlocked).toBe(true);
  });
});
```

(Imports: `useMetaStore`, `createEmptyMetaState`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --run src/services/engineBridge.test.ts`
Expected: FAIL — `getCodexSnapshot` doesn't exist.

- [ ] **Step 3: Implement the snapshot types and method**

Edit `src/services/engineBridge.ts`. Add types near the top (after `MetaSnapshot`):

```ts
export interface CodexEchoEntry {
  id: string;
  name: string;
  description: string;
  tier: 'fragment' | 'partial' | 'full';
  unlocked: boolean;
  unlockHint: string;        // human-readable; e.g. "Reach Body Tempering 5 in any life"
  effectsSummary: string;    // human-readable; e.g. "+20% HP · +10% body cultivation rate"
}

export interface CodexMemoryEntry {
  id: string;
  name: string;
  description: string;
  element: string;
  level: 'unseen' | 'fragment' | 'partial' | 'complete';
  witnessFlavour: string | null;   // current-level snippet KEY (UI may render via Composer in 2B; in 2A we surface the raw key)
  manifested: boolean;
  manifestFlavour: string | null;
}

export interface CodexAnchorEntry {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockHint: string;
  karmaMultiplier: number;
}

export interface CodexSnapshot {
  echoes: ReadonlyArray<CodexEchoEntry>;
  memories: ReadonlyArray<CodexMemoryEntry>;
  anchors: ReadonlyArray<CodexAnchorEntry>;
}
```

Replace the existing `getCodex(): CodexSnapshot` thin shim with `getCodexSnapshot(): CodexSnapshot` (rich snapshot). Keep the old `getCodex` returning `{memories, echoes, anchors}` of strings if any caller depends on it — search the codebase first; if no callers, delete it.

Add the helpers (free functions inside `engineBridge.ts`):

```ts
function describeUnlockCondition(c: import('@/engine/meta/SoulEcho').UnlockCondition): string {
  switch (c.kind) {
    case 'reach_realm':
      return `Reach ${c.realm}${c.sublayer != null ? ` ${c.sublayer}` : ''}`;
    case 'choice_category_count':
      return `Make ${c.count}+ ${c.category} choices across lives`;
    case 'outcome_count':
      return `Trigger ${c.outcomeKind} ${c.count}+ times across lives`;
    case 'lives_as_anchor_max_age':
      return `Live ${c.lives}+ full lives as ${c.anchor}`;
    case 'died_with_flag':
      return `Die with the mark of ${c.flag.replace(/_/g, ' ')}`;
    case 'flag_set':
      return `Carry the flag ${c.flag.replace(/_/g, ' ')}`;
    case 'died_in_same_region_streak':
      return `Die in ${c.region} ${c.streak} lives running`;
    case 'reached_insight_cap_lives':
      return `Hit the insight cap in ${c.lives} lives`;
    case 'lived_min_years_in_single_life':
      return `Live ${c.years}+ years in a single life`;
    case 'reached_realm_without_techniques':
      return `Reach ${c.realm} without learning a technique`;
    default:
      return 'Hidden condition';
  }
}

function summarizeEffects(effects: ReadonlyArray<import('@/engine/meta/SoulEcho').EchoEffect>): string {
  return effects.map((e) => {
    switch (e.kind) {
      case 'stat_mod':       return `${e.delta >= 0 ? '+' : ''}${e.delta} ${e.stat}`;
      case 'stat_mod_pct':   return `${e.pct >= 0 ? '+' : ''}${e.pct}% ${e.stat}`;
      case 'hp_mult':        return `×${e.mult.toFixed(2)} HP`;
      case 'heal_efficacy_pct': return `${e.pct >= 0 ? '+' : ''}${e.pct}% heal efficacy`;
      case 'body_cultivation_rate_pct': return `${e.pct >= 0 ? '+' : ''}${e.pct}% body cultivation`;
      case 'mood_swing_pct': return `${e.pct >= 0 ? '+' : ''}${e.pct}% mood swing`;
      case 'old_age_death_roll_pct': return `${e.pct >= 0 ? '+' : ''}${e.pct}% old-age death roll`;
      case 'insight_cap_bonus': return `+${e.bonus} insight cap`;
      case 'starting_flag':  return `Starts with ${e.flag.replace(/_/g, ' ')}`;
      case 'resolver_bonus': return `+${e.bonus} ${e.category}`;
      case 'event_weight':   return `×${e.mult.toFixed(2)} ${e.eventTag}`;
      case 'imprint_encounter_rate_pct': return `${e.pct >= 0 ? '+' : ''}${e.pct}% imprint rate`;
      default: return '';
    }
  }).filter(Boolean).join(' · ');
}

function describeAnchorUnlock(unlock: string): string {
  if (unlock === 'default') return 'Available from the start';
  switch (unlock) {
    case 'reach_body_tempering_5':   return 'Reach Body Tempering 5 in any past life';
    case 'read_ten_tomes_one_life':  return 'Read 10 tomes in one life';
    case 'befriend_sect_disciple':   return 'Befriend a sect disciple';
    default: return unlock.replace(/_/g, ' ');
  }
}
```

Implement the method (replace the old `getCodex`):

```ts
getCodexSnapshot(): CodexSnapshot {
  const meta = currentMetaState();
  const witnessed = meta.memoriesWitnessed;
  const manifested = new Set(meta.memoriesManifested);
  const unlockedEchoes = new Set(meta.echoesUnlocked);
  const unlockedAnchors = new Set(meta.unlockedAnchors);

  const echoes = ECHO_REGISTRY.all().map<CodexEchoEntry>((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    tier: e.tier,
    unlocked: unlockedEchoes.has(e.id),
    unlockHint: describeUnlockCondition(e.unlockCondition),
    effectsSummary: summarizeEffects(e.effects),
  }));

  const memories = MEMORY_REGISTRY.all().map<CodexMemoryEntry>((m) => {
    const count = witnessed[m.id] ?? 0;
    const level: CodexMemoryEntry['level'] = count <= 0
      ? 'unseen'
      : memoryLevelOf(count);
    const witnessFlavour = level === 'unseen' ? null : (m.witnessFlavour[level] ?? null);
    return {
      id: m.id,
      name: m.name,
      description: m.description,
      element: m.element,
      level,
      witnessFlavour,
      manifested: manifested.has(m.id),
      manifestFlavour: manifested.has(m.id) ? m.manifestFlavour : null,
    };
  });

  const anchors = DEFAULT_ANCHORS.map<CodexAnchorEntry>((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    unlocked: a.unlock === 'default' || unlockedAnchors.has(a.id),
    unlockHint: describeAnchorUnlock(a.unlock),
    karmaMultiplier: a.karmaMultiplier,
  }));

  return { echoes, memories, anchors };
},
```

Update the `EngineBridge` interface:

```ts
getCodexSnapshot(): CodexSnapshot;
```

And remove the old `getCodex` if no callers remain (run a project-wide grep first).

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- --run src/services/engineBridge.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `npm test -- --run`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/services/engineBridge.ts src/services/engineBridge.test.ts
git commit -m "feat(bridge): getCodexSnapshot returns rich echoes/memories/anchors view"
```

---

## Task 7: Bridge — getLineageSnapshot + extended CreationPayload

**Files:**
- Modify: `src/services/engineBridge.ts`
- Test: `src/services/engineBridge.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `src/services/engineBridge.test.ts`:

```ts
describe('getLineageSnapshot', () => {
  it('returns empty array on a fresh meta state', () => {
    const sm = createSaveManager({ storage: () => makeMemoryStorage(), gameVersion: 'test' });
    const engine = createEngineBridge({ saveManager: sm });
    const snap = engine.getLineageSnapshot();
    expect(snap.entries).toEqual([]);
  });

  it('resolves anchor names + carries year range and echo unlocks', () => {
    const sm = createSaveManager({ storage: () => makeMemoryStorage(), gameVersion: 'test' });
    const engine = createEngineBridge({ saveManager: sm });
    useMetaStore.getState().hydrateFromMetaState({
      ...createEmptyMetaState(),
      lifeCount: 1,
      lineage: [{
        lifeIndex: 1,
        name: 'Lin Wei',
        anchorId: 'peasant_farmer',
        birthYear: 950,
        deathYear: 980,
        yearsLived: 30,
        realmReached: 'Mortal',
        deathCause: 'sickness',
        karmaEarned: 25,
        echoesUnlockedThisLife: ['iron_body'],
      }],
    });
    const snap = engine.getLineageSnapshot();
    expect(snap.entries).toHaveLength(1);
    const e = snap.entries[0];
    expect(e.lifeIndex).toBe(1);
    expect(e.name).toBe('Lin Wei');
    expect(e.anchorName).toBe('Peasant Farmer');
    expect(e.birthYear).toBe(950);
    expect(e.deathYear).toBe(980);
    expect(e.yearsLived).toBe(30);
    expect(e.echoesUnlockedThisLife).toEqual([{ id: 'iron_body', name: 'Iron Body' }]);
  });

  it('returns most-recent-life-first ordering', () => {
    const sm = createSaveManager({ storage: () => makeMemoryStorage(), gameVersion: 'test' });
    const engine = createEngineBridge({ saveManager: sm });
    useMetaStore.getState().hydrateFromMetaState({
      ...createEmptyMetaState(),
      lifeCount: 3,
      lineage: [
        { lifeIndex: 1, name: 'A', anchorId: 'peasant_farmer', birthYear: 950, deathYear: 970, yearsLived: 20, realmReached: 'Mortal', deathCause: 'old_age', karmaEarned: 5, echoesUnlockedThisLife: [] },
        { lifeIndex: 2, name: 'B', anchorId: 'peasant_farmer', birthYear: 970, deathYear: 1000, yearsLived: 30, realmReached: 'Mortal', deathCause: 'old_age', karmaEarned: 10, echoesUnlockedThisLife: [] },
        { lifeIndex: 3, name: 'C', anchorId: 'peasant_farmer', birthYear: 1000, deathYear: 1010, yearsLived: 10, realmReached: 'Mortal', deathCause: 'sickness', karmaEarned: 2, echoesUnlockedThisLife: [] },
      ],
    });
    const snap = engine.getLineageSnapshot();
    expect(snap.entries.map((e) => e.lifeIndex)).toEqual([3, 2, 1]);
  });
});

describe('listAnchors / reincarnate include locked anchors with unlockHint', () => {
  it('returns all 5 anchors with locked flag', () => {
    const sm = createSaveManager({ storage: () => makeMemoryStorage(), gameVersion: 'test' });
    const engine = createEngineBridge({ saveManager: sm });
    const payload = engine.listAnchors();
    expect(payload.availableAnchors).toHaveLength(5);
    const farmer = payload.availableAnchors.find((a) => a.id === 'peasant_farmer')!;
    expect(farmer.locked).toBe(false);
    const martial = payload.availableAnchors.find((a) => a.id === 'martial_family')!;
    expect(martial.locked).toBe(true);
    expect(martial.unlockHint).toMatch(/body tempering/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --run src/services/engineBridge.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement getLineageSnapshot**

Edit `src/services/engineBridge.ts`:

```ts
export interface LineageEntryView {
  lifeIndex: number;
  name: string;
  anchorId: string;
  anchorName: string;
  birthYear: number;          // 0 means "absolute year unknown" (pre-v3 entries)
  deathYear: number;
  yearsLived: number;
  realmReached: string;
  deathCause: string;
  karmaEarned: number;
  echoesUnlockedThisLife: ReadonlyArray<{ id: string; name: string }>;
}

export interface LineageSnapshot {
  entries: ReadonlyArray<LineageEntryView>;
}
```

Add to the bridge object:

```ts
getLineageSnapshot(): LineageSnapshot {
  const meta = currentMetaState();
  const sorted = [...meta.lineage].sort((a, b) => b.lifeIndex - a.lifeIndex);
  const entries: LineageEntryView[] = sorted.map((entry) => {
    const anchor = getAnchorById(entry.anchorId);
    const echoes = entry.echoesUnlockedThisLife.map((id) => {
      const e = ECHO_REGISTRY.get(id);
      return { id, name: e?.name ?? id };
    });
    return {
      lifeIndex: entry.lifeIndex,
      name: entry.name,
      anchorId: entry.anchorId,
      anchorName: anchor?.name ?? entry.anchorId,
      birthYear: entry.birthYear,
      deathYear: entry.deathYear,
      yearsLived: entry.yearsLived,
      realmReached: entry.realmReached,
      deathCause: entry.deathCause,
      karmaEarned: entry.karmaEarned,
      echoesUnlockedThisLife: echoes,
    };
  });
  return { entries };
},
```

Add `getLineageSnapshot(): LineageSnapshot;` to the `EngineBridge` interface. Keep `getLineage()` as-is for any existing callers — it returns the raw `LineageEntrySummary[]`.

- [ ] **Step 4: Extend CreationPayload to include locked anchors**

Edit `CreationPayload`:

```ts
export interface CreationAnchorView {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  unlockHint: string;
  freshlyUnlocked: boolean;     // true iff anchorId is in the most recent lineage entry's freshly-unlocked set
}

export interface CreationPayload {
  availableAnchors: ReadonlyArray<CreationAnchorView>;
}
```

Replace `listAnchors` and the `reincarnate`'s payload construction with:

```ts
function buildCreationPayload(): CreationPayload {
  const meta = currentMetaState();
  const unlocked = new Set<string>(meta.unlockedAnchors);
  // Default-unlock anchors are always present.
  for (const a of DEFAULT_ANCHORS) {
    if (a.unlock === 'default') unlocked.add(a.id);
  }
  // Compute freshly-unlocked from the most recent lineage entry's lifeIndex
  // membership in `unlockedAnchors` introduced this life. The simplest proxy:
  // any anchor whose unlock string references the last life's
  // achievements would be freshly-unlocked. For 2A-3 we approximate by
  // marking as freshly-unlocked any anchor that appears in `meta.unlockedAnchors`
  // but did NOT appear in the second-to-last lineage entry's snapshot — which
  // we don't store. Instead we mark anchors as freshly-unlocked iff the
  // bardo result that just ran appended their id; the bardo result holds
  // `freshlyUnlockedAnchors` (Task 5b adds this — see below).
  const fresh = new Set<string>(useGameStore.getState().bardoResult?.freshlyUnlockedAnchors ?? []);
  return {
    availableAnchors: DEFAULT_ANCHORS.map((a) => {
      const isUnlocked = a.unlock === 'default' || unlocked.has(a.id);
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        locked: !isUnlocked,
        unlockHint: describeAnchorUnlock(a.unlock),
        freshlyUnlocked: fresh.has(a.id),
      };
    }),
  };
}
```

The `freshlyUnlockedAnchors` field on `BardoResult` is added in **Step 5**.

- [ ] **Step 5: Add `freshlyUnlockedAnchors` to BardoResult**

Edit `src/engine/bardo/BardoFlow.ts`:

```ts
export interface BardoResult {
  summary: LifeSummary;
  karmaEarned: number;
  karmaBreakdown: ReturnType<typeof computeKarma>['breakdown'];
  meta: MetaState;
  /** Phase 2A-3 Task 7: anchor ids freshly added by `evaluateAnchorUnlocks`. UI uses this for shimmer. */
  freshlyUnlockedAnchors: ReadonlyArray<string>;
}
```

Update `runBardoFlow` to return it. The value is the `newlyUnlockedAnchors` array computed in Task 4 step 5.

Add a one-liner unit test in `BardoFlow.test.ts`:

```ts
it('exposes freshlyUnlockedAnchors on the bardo result', () => {
  const rs = makeRunStateAtBardo({ bodyTemperingLayer: 5, birthYear: 950, ageDaysAtDeath: 40*365 });
  const out = runBardoFlow(rs, createEmptyMetaState(), 1.0, EMPTY_ECHO_REGISTRY);
  expect(out.freshlyUnlockedAnchors).toContain('martial_family');
});
```

- [ ] **Step 6: Wire reincarnate + listAnchors to the new payload builder**

Edit `engineBridge.ts`:

```ts
async reincarnate() {
  clearRun(sm);
  useGameStore.getState().resetRun();
  useGameStore.getState().setPhase(GamePhase.CREATION);
  return buildCreationPayload();
},

listAnchors() {
  return buildCreationPayload();
},
```

- [ ] **Step 7: Run tests**

Run: `npm test -- --run src/services/engineBridge.test.ts src/engine/bardo/BardoFlow.test.ts`
Expected: PASS.

- [ ] **Step 8: Run full suite**

Run: `npm test -- --run`
Expected: existing UI tests that consume `CreationPayload.availableAnchors` (ui_full_cycle, CreationScreen tests) **may fail** because `locked` / `unlockHint` / `freshlyUnlocked` are now present. They are additive fields — the consumer should not break unless it deep-equals the array. Inspect failures and fix only the assertion shape (no semantic change).

- [ ] **Step 9: Commit**

```bash
git add src/services/engineBridge.ts src/services/engineBridge.test.ts \
        src/engine/bardo/BardoFlow.ts src/engine/bardo/BardoFlow.test.ts
git commit -m "feat(bridge): getLineageSnapshot + locked-anchors in CreationPayload"
```

---

## Task 8: CodexScreen component

**Files:**
- Create: `src/components/CodexScreen.tsx`
- Create: `src/components/CodexScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/CodexScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodexScreen } from './CodexScreen';
import type { CodexSnapshot } from '@/services/engineBridge';

const EMPTY: CodexSnapshot = { echoes: [], memories: [], anchors: [] };

const POPULATED: CodexSnapshot = {
  echoes: [
    { id: 'iron_body', name: 'Iron Body', description: 'Your bones remember the forge.', tier: 'partial', unlocked: true, unlockHint: 'Reach Body Tempering 5', effectsSummary: '+20% HP · +10% body cultivation' },
    { id: 'sword_memory', name: 'Sword Memory', description: 'A blade you cannot recall.', tier: 'fragment', unlocked: false, unlockHint: 'Make 100+ sword choices across lives', effectsSummary: '+15 melee' },
  ],
  memories: [
    { id: 'frost_palm_severing', name: 'Frost Palm Severing', description: 'A cold edge.', element: 'water', level: 'partial', witnessFlavour: 'memory.witness.frost_palm_severing.partial', manifested: false, manifestFlavour: null },
    { id: 'silent_waters_scripture', name: 'Scripture of Silent Waters', description: 'Pages drift.', element: 'water', level: 'unseen', witnessFlavour: null, manifested: false, manifestFlavour: null },
  ],
  anchors: [
    { id: 'peasant_farmer', name: 'Peasant Farmer', description: 'Born to the soil.', unlocked: true, unlockHint: 'Available from the start', karmaMultiplier: 1.0 },
    { id: 'martial_family', name: 'Martial Family', description: 'Hard fists.', unlocked: false, unlockHint: 'Reach Body Tempering 5 in any past life', karmaMultiplier: 0.9 },
  ],
};

describe('CodexScreen', () => {
  it('renders three tabs: Memories, Echoes, Anchors', () => {
    render(<CodexScreen snapshot={EMPTY} onBack={() => {}} />);
    expect(screen.getByRole('tab', { name: /memories/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /echoes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /anchors/i })).toBeInTheDocument();
  });

  it('shows an empty-state hint on each tab when nothing is populated', () => {
    render(<CodexScreen snapshot={EMPTY} onBack={() => {}} />);
    // Default tab is Memories per spec.
    expect(screen.getByText(/seen nowhere yet/i)).toBeInTheDocument();
  });

  it('renders unlocked echoes with effect summary; locked echoes as silhouettes with hint', async () => {
    render(<CodexScreen snapshot={POPULATED} onBack={() => {}} />);
    await userEvent.click(screen.getByRole('tab', { name: /echoes/i }));
    expect(screen.getByText('Iron Body')).toBeInTheDocument();
    expect(screen.getByText(/\+20% HP · \+10% body cultivation/)).toBeInTheDocument();
    // Locked echo: name hidden, hint shown.
    expect(screen.queryByText('Sword Memory')).not.toBeInTheDocument();
    expect(screen.getByText(/100\+ sword choices/)).toBeInTheDocument();
  });

  it('renders memory tab with level badge and silhouettes for unseen memories', async () => {
    render(<CodexScreen snapshot={POPULATED} onBack={() => {}} />);
    // Default tab is Memories.
    expect(screen.getByText('Frost Palm Severing')).toBeInTheDocument();
    expect(screen.getByText(/partial/i)).toBeInTheDocument();
    // Unseen: name silhouetted.
    expect(screen.queryByText('Scripture of Silent Waters')).not.toBeInTheDocument();
  });

  it('renders anchors tab with unlock hint for locked anchors', async () => {
    render(<CodexScreen snapshot={POPULATED} onBack={() => {}} />);
    await userEvent.click(screen.getByRole('tab', { name: /anchors/i }));
    expect(screen.getByText('Peasant Farmer')).toBeInTheDocument();
    expect(screen.queryByText('Martial Family')).not.toBeInTheDocument();
    expect(screen.getByText(/body tempering 5 in any past life/i)).toBeInTheDocument();
  });

  it('calls onBack when the back button is clicked', async () => {
    const onBack = vi.fn();
    render(<CodexScreen snapshot={EMPTY} onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --run src/components/CodexScreen.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement CodexScreen**

Create `src/components/CodexScreen.tsx`:

```tsx
import { useState } from 'react';
import type { CodexSnapshot, CodexEchoEntry, CodexMemoryEntry, CodexAnchorEntry } from '@/services/engineBridge';

export interface CodexScreenProps {
  snapshot: CodexSnapshot;
  onBack: () => void;
}

type Tab = 'memories' | 'echoes' | 'anchors';

export function CodexScreen({ snapshot, onBack }: CodexScreenProps) {
  const [tab, setTab] = useState<Tab>('memories');

  return (
    <div className="min-h-screen bg-ink-950 text-parchment-100 flex flex-col items-center py-8 font-serif">
      <div className="w-full max-w-3xl px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl text-jade-300">Codex</h2>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 border border-parchment-700 rounded hover:border-parchment-500"
          >
            Back
          </button>
        </div>

        <div role="tablist" className="flex gap-2 mb-6 border-b border-parchment-800">
          {(['memories', 'echoes', 'anchors'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 capitalize transition border-b-2 -mb-px ${
                tab === t
                  ? 'border-jade-400 text-jade-300'
                  : 'border-transparent text-parchment-400 hover:text-parchment-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'memories' && <MemoriesTab memories={snapshot.memories} />}
        {tab === 'echoes' && <EchoesTab echoes={snapshot.echoes} />}
        {tab === 'anchors' && <AnchorsTab anchors={snapshot.anchors} />}
      </div>
    </div>
  );
}

function MemoriesTab({ memories }: { memories: ReadonlyArray<CodexMemoryEntry> }) {
  if (memories.length === 0 || memories.every((m) => m.level === 'unseen')) {
    return <p className="text-parchment-500 italic">Seen nowhere yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {memories.map((m) => (
        <li
          key={m.id}
          className={`border rounded p-4 ${
            m.level === 'unseen'
              ? 'border-ash-800 bg-ink-900/40 text-ash-500'
              : 'border-parchment-700 bg-ink-900'
          }`}
        >
          {m.level === 'unseen' ? (
            <>
              <div className="text-lg italic">— unseen —</div>
              <div className="text-xs">A memory the soul has not yet brushed against.</div>
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-lg text-jade-300">{m.name}</span>
                <span className="text-xs uppercase tracking-wide text-parchment-500">
                  {m.level}{m.manifested ? ' · recalled' : ''}
                </span>
              </div>
              <div className="text-sm text-parchment-300 mt-1">{m.description}</div>
              <div className="text-xs text-parchment-500 italic mt-2">Element: {m.element}</div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function EchoesTab({ echoes }: { echoes: ReadonlyArray<CodexEchoEntry> }) {
  if (echoes.length === 0) {
    return <p className="text-parchment-500 italic">No echoes catalogued.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {echoes.map((e) => (
        <li
          key={e.id}
          className={`border rounded p-4 ${
            e.unlocked ? 'border-jade-700 bg-ink-900' : 'border-ash-800 bg-ink-900/40 text-ash-500'
          }`}
        >
          {e.unlocked ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-lg text-jade-300">{e.name}</span>
                <span className="text-xs uppercase tracking-wide text-parchment-500">{e.tier}</span>
              </div>
              <div className="text-sm text-parchment-300 mt-1">{e.description}</div>
              <div className="text-xs text-parchment-500 italic mt-2">{e.effectsSummary}</div>
            </>
          ) : (
            <>
              <div className="text-lg italic">— locked —</div>
              <div className="text-xs">{e.unlockHint}</div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function AnchorsTab({ anchors }: { anchors: ReadonlyArray<CodexAnchorEntry> }) {
  if (anchors.length === 0) {
    return <p className="text-parchment-500 italic">No anchors known.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {anchors.map((a) => (
        <li
          key={a.id}
          className={`border rounded p-4 ${
            a.unlocked ? 'border-jade-700 bg-ink-900' : 'border-ash-800 bg-ink-900/40 text-ash-500'
          }`}
        >
          {a.unlocked ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-lg text-jade-300">{a.name}</span>
                <span className="text-xs text-parchment-500">×{a.karmaMultiplier.toFixed(2)} karma</span>
              </div>
              <div className="text-sm text-parchment-300 mt-1">{a.description}</div>
            </>
          ) : (
            <>
              <div className="text-lg italic">— locked —</div>
              <div className="text-xs">{a.unlockHint}</div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- --run src/components/CodexScreen.test.tsx`
Expected: PASS (6 cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/CodexScreen.tsx src/components/CodexScreen.test.tsx
git commit -m "feat(ui): CodexScreen with Memories/Echoes/Anchors tabs"
```

---

## Task 9: LineageScreen component

**Files:**
- Create: `src/components/LineageScreen.tsx`
- Create: `src/components/LineageScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/LineageScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LineageScreen } from './LineageScreen';
import type { LineageSnapshot } from '@/services/engineBridge';

const EMPTY: LineageSnapshot = { entries: [] };

const POPULATED: LineageSnapshot = {
  entries: [
    {
      lifeIndex: 2,
      name: 'Lin Wei',
      anchorId: 'martial_family',
      anchorName: 'Martial Family',
      birthYear: 1000,
      deathYear: 1040,
      yearsLived: 40,
      realmReached: 'Body Tempering 5',
      deathCause: 'tribulation',
      karmaEarned: 80,
      echoesUnlockedThisLife: [{ id: 'iron_body', name: 'Iron Body' }],
    },
    {
      lifeIndex: 1,
      name: 'Hu',
      anchorId: 'peasant_farmer',
      anchorName: 'Peasant Farmer',
      birthYear: 0,            // pre-v3 entry
      deathYear: 0,
      yearsLived: 30,
      realmReached: 'Mortal',
      deathCause: 'sickness',
      karmaEarned: 25,
      echoesUnlockedThisLife: [],
    },
  ],
};

describe('LineageScreen', () => {
  it('renders an empty-state hint when there are no past lives', () => {
    render(<LineageScreen snapshot={EMPTY} onBack={() => {}} />);
    expect(screen.getByText(/no lives yet/i)).toBeInTheDocument();
  });

  it('renders one card per lineage entry, most recent first', () => {
    render(<LineageScreen snapshot={POPULATED} onBack={() => {}} />);
    expect(screen.getByText(/Lin Wei/)).toBeInTheDocument();
    expect(screen.getByText(/Hu$/)).toBeInTheDocument();
    expect(screen.getByText(/Body Tempering 5/)).toBeInTheDocument();
  });

  it('shows year range when birthYear>0, falls back to "Years lived" otherwise', () => {
    render(<LineageScreen snapshot={POPULATED} onBack={() => {}} />);
    expect(screen.getByText(/1000.*1040/)).toBeInTheDocument();
    expect(screen.getByText(/Years lived: 30/)).toBeInTheDocument();
  });

  it('lists echoes unlocked this life when present', () => {
    render(<LineageScreen snapshot={POPULATED} onBack={() => {}} />);
    expect(screen.getByText(/iron body/i)).toBeInTheDocument();
  });

  it('calls onBack when the back button is clicked', async () => {
    const onBack = vi.fn();
    render(<LineageScreen snapshot={EMPTY} onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --run src/components/LineageScreen.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement LineageScreen**

Create `src/components/LineageScreen.tsx`:

```tsx
import type { LineageSnapshot, LineageEntryView } from '@/services/engineBridge';

export interface LineageScreenProps {
  snapshot: LineageSnapshot;
  onBack: () => void;
}

export function LineageScreen({ snapshot, onBack }: LineageScreenProps) {
  return (
    <div className="min-h-screen bg-ink-950 text-parchment-100 flex flex-col items-center py-8 font-serif">
      <div className="w-full max-w-3xl px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl text-jade-300">Lineage</h2>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 border border-parchment-700 rounded hover:border-parchment-500"
          >
            Back
          </button>
        </div>

        {snapshot.entries.length === 0 ? (
          <p className="text-parchment-500 italic">No lives yet. The wheel has not turned.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {snapshot.entries.map((e) => <LifeCard key={e.lifeIndex} entry={e} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function LifeCard({ entry }: { entry: LineageEntryView }) {
  const yearLine = entry.birthYear > 0
    ? `Year ${entry.birthYear} – ${entry.deathYear}`
    : `Years lived: ${entry.yearsLived}`;
  return (
    <li className="border border-parchment-700 bg-ink-900 rounded p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-lg text-jade-300">
          Life {entry.lifeIndex} — {entry.name}
        </span>
        <span className="text-xs text-parchment-500">{yearLine}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm text-parchment-300">
        <dt>Anchor</dt><dd>{entry.anchorName}</dd>
        <dt>Realm reached</dt><dd>{entry.realmReached}</dd>
        <dt>Cause of death</dt><dd>{entry.deathCause}</dd>
        <dt>Karma earned</dt><dd>{entry.karmaEarned}</dd>
      </dl>
      {entry.echoesUnlockedThisLife.length > 0 && (
        <div className="mt-2 text-xs text-jade-400">
          Echo unlocked this life: {entry.echoesUnlockedThisLife.map((e) => e.name).join(', ')}
        </div>
      )}
    </li>
  );
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- --run src/components/LineageScreen.test.tsx`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/LineageScreen.tsx src/components/LineageScreen.test.tsx
git commit -m "feat(ui): LineageScreen with year-range LifeCards"
```

---

## Task 10: TitleScreen — wire Codex + Lineage entry points

**Files:**
- Modify: `src/components/TitleScreen.tsx`
- Modify: `src/components/TitleScreen.test.tsx`

- [ ] **Step 1: Read existing TitleScreen**

Open `src/components/TitleScreen.tsx`. The Codex button already exists with an `onOpenCodex` prop wired to a no-op in App. Add `onOpenLineage`.

- [ ] **Step 2: Write the failing test**

Append to `src/components/TitleScreen.test.tsx`:

```tsx
it('calls onOpenLineage when the Lineage button is clicked', async () => {
  const onOpenLineage = vi.fn();
  render(<TitleScreen
    hasSave={false}
    onNewGame={() => {}}
    onContinue={() => {}}
    onOpenCodex={() => {}}
    onOpenLineage={onOpenLineage}
  />);
  await userEvent.click(screen.getByRole('button', { name: /lineage/i }));
  expect(onOpenLineage).toHaveBeenCalledOnce();
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- --run src/components/TitleScreen.test.tsx`
Expected: FAIL — `onOpenLineage` prop unrecognised.

- [ ] **Step 4: Add the Lineage button**

Edit `src/components/TitleScreen.tsx`:

```tsx
export interface TitleScreenProps {
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
  onOpenCodex: () => void;
  onOpenLineage: () => void;
}

export function TitleScreen({ hasSave, onNewGame, onContinue, onOpenCodex, onOpenLineage }: TitleScreenProps): React.JSX.Element {
  // ... existing top half
  // Inside the .flex.flex-col.gap-3 block, after the Codex button:
  <button
    type="button"
    onClick={onOpenLineage}
    className="py-3 px-6 border border-ash-700 text-ash-300 hover:bg-ash-900/30 transition"
  >
    Lineage
  </button>
  // ... existing bottom half
}
```

- [ ] **Step 5: Run test**

Run: `npm test -- --run src/components/TitleScreen.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/TitleScreen.tsx src/components/TitleScreen.test.tsx
git commit -m "feat(ui): TitleScreen Lineage entry point"
```

---

## Task 11: CreationScreen — locked-anchor silhouettes + shimmer

**Files:**
- Modify: `src/components/CreationScreen.tsx`
- Modify: `src/components/CreationScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Replace the `ANCHORS` constant in `src/components/CreationScreen.test.tsx` with the new shape and add cases:

```tsx
const ANCHORS = [
  { id: 'peasant_farmer', name: 'Peasant Farmer', description: 'Born to the soil.', locked: false, unlockHint: 'Available from the start', freshlyUnlocked: false },
  { id: 'true_random', name: 'True Random', description: 'Let the Heavens decide.', locked: false, unlockHint: 'Available from the start', freshlyUnlocked: false },
  { id: 'martial_family', name: 'Martial Family', description: 'Hard fists.', locked: true, unlockHint: 'Reach Body Tempering 5 in any past life', freshlyUnlocked: false },
  { id: 'scholars_son', name: "Scholar's Son", description: 'Books.', locked: true, unlockHint: 'Read 10 tomes in one life', freshlyUnlocked: false },
];

// All previously-existing tests use ANCHORS verbatim and should still pass; add three new ones:

it('renders locked anchors as silhouettes and disables their selection', async () => {
  render(<CreationScreen anchors={ANCHORS} onBegin={() => {}} onBack={() => {}} />);
  // Silhouette text appears.
  expect(screen.getByText(/reach body tempering 5 in any past life/i)).toBeInTheDocument();
  // Locked names are NOT in the document.
  expect(screen.queryByText('Martial Family')).not.toBeInTheDocument();
  // Click the silhouette: selection should not change. Find the locked card by hint.
  const lockedCard = screen.getByText(/reach body tempering 5/i).closest('button')!;
  expect(lockedCard).toBeDisabled();
});

it('renders freshly-unlocked anchors with a shimmer indicator', () => {
  const fresh = ANCHORS.map((a) =>
    a.id === 'martial_family' ? { ...a, locked: false, freshlyUnlocked: true } : a,
  );
  render(<CreationScreen anchors={fresh} onBegin={() => {}} onBack={() => {}} />);
  const card = screen.getByText('Martial Family').closest('button')!;
  expect(card.className).toMatch(/shimmer|animate-pulse/i);
});
```

- [ ] **Step 2: Run to verify failures**

Run: `npm test -- --run src/components/CreationScreen.test.tsx`
Expected: type errors on the prop shape change + new assertions failing.

- [ ] **Step 3: Update CreationScreen**

Edit `src/components/CreationScreen.tsx`:

```tsx
import { useState } from 'react';
import type { CreationAnchorView } from '@/services/engineBridge';

export interface CreationScreenProps {
  anchors: ReadonlyArray<CreationAnchorView>;
  defaultName?: string;
  onBegin: (anchorId: string, name: string) => void | Promise<void>;
  onBack: () => void;
  isLoading?: boolean;
}

export function CreationScreen(props: CreationScreenProps) {
  const [selectedAnchor, setSelectedAnchor] = useState<string | null>(null);
  const [name, setName] = useState(props.defaultName ?? '');

  const trimmed = name.trim();
  const canBegin = !!selectedAnchor && trimmed.length > 0 && !props.isLoading;

  return (
    <div className="min-h-screen bg-ink-950 text-parchment-100 flex flex-col items-center justify-center p-8 font-serif">
      <h2 className="text-3xl mb-2">Choose Your Birth</h2>
      <p className="text-parchment-300 mb-8 max-w-xl text-center">
        The soul you were is gone. Which womb receives it?
      </p>

      <div className="w-full max-w-2xl flex flex-col gap-3 mb-6">
        {props.anchors.map((a) => {
          if (a.locked) {
            return (
              <button
                key={a.id}
                type="button"
                disabled
                className="text-left px-4 py-3 border rounded transition border-ash-800 bg-ink-900/40 text-ash-500 cursor-not-allowed"
              >
                <div className="text-lg italic">— locked —</div>
                <div className="text-sm">{a.unlockHint}</div>
              </button>
            );
          }
          const shimmer = a.freshlyUnlocked ? 'animate-pulse ring-1 ring-jade-400/60 shimmer' : '';
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelectedAnchor(a.id)}
              disabled={props.isLoading}
              className={`text-left px-4 py-3 border rounded transition ${shimmer}
                ${selectedAnchor === a.id
                  ? 'border-jade-400 bg-ink-800'
                  : 'border-parchment-700 hover:border-parchment-500'}`}
            >
              <div className="text-xl text-jade-300">{a.name}</div>
              <div className="text-sm text-parchment-400">{a.description}</div>
            </button>
          );
        })}
      </div>

      <div className="w-full max-w-2xl mb-6">
        <label htmlFor="char-name" className="block text-sm text-parchment-400 mb-1">
          Name
        </label>
        <input
          id="char-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={props.isLoading}
          className="w-full px-3 py-2 bg-ink-900 border border-parchment-700 rounded text-parchment-100 focus:border-jade-400 focus:outline-none"
          placeholder="Lin Wei"
        />
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={props.onBack} className="px-4 py-2 border border-parchment-700 rounded hover:border-parchment-500">
          Back
        </button>
        <button
          type="button"
          disabled={!canBegin}
          onClick={() => props.onBegin(selectedAnchor!, trimmed)}
          className="px-6 py-2 bg-jade-600 text-ink-950 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-jade-500"
        >
          Begin Life
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run src/components/CreationScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full UI suite**

Run: `npm test -- --run src/components`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/components/CreationScreen.tsx src/components/CreationScreen.test.tsx
git commit -m "feat(ui): CreationScreen locked-anchor silhouettes + shimmer"
```

---

## Task 12: BardoPanel — reveal sections 10a/10b/10c + Codex/Lineage buttons

**Files:**
- Modify: `src/components/BardoPanel.tsx`
- Modify: `src/components/BardoPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `src/components/BardoPanel.test.tsx`:

```tsx
it('renders the manifested-memory reveal section when present', () => {
  render(<BardoPanel
    payload={{
      ...basePayload,    // existing fixture from this test file; if not present, build inline
      manifestedThisLife: [{ id: 'frost_palm_severing', name: 'Frost Palm Severing', level: 'partial', manifestFlavour: 'memory.manifest.frost_palm_severing.1' }],
      witnessedThisLife: [],
      echoesUnlockedThisLife: [],
    }}
    onBuyUpgrade={() => {}}
    onReincarnate={() => {}}
  />);
  expect(screen.getByText(/you remembered/i)).toBeInTheDocument();
  expect(screen.getByText('Frost Palm Severing')).toBeInTheDocument();
});

it('renders the witnessed-memory compact list', () => {
  render(<BardoPanel
    payload={{
      ...basePayload,
      manifestedThisLife: [],
      witnessedThisLife: [{ id: 'silent_waters_scripture', name: 'Scripture of Silent Waters', level: 'fragment' }],
      echoesUnlockedThisLife: [],
    }}
    onBuyUpgrade={() => {}}
    onReincarnate={() => {}}
  />);
  expect(screen.getByText(/you saw/i)).toBeInTheDocument();
  expect(screen.getByText(/scripture of silent waters/i)).toBeInTheDocument();
});

it('renders the echo-unlock cards for echoes unlocked this life', () => {
  render(<BardoPanel
    payload={{
      ...basePayload,
      manifestedThisLife: [],
      witnessedThisLife: [],
      echoesUnlockedThisLife: [{ id: 'iron_body', name: 'Iron Body', description: 'Your bones remember.' }],
    }}
    onBuyUpgrade={() => {}}
    onReincarnate={() => {}}
  />);
  expect(screen.getByText(/iron body/i)).toBeInTheDocument();
});

it('hides each reveal section when its array is empty', () => {
  render(<BardoPanel
    payload={{ ...basePayload, manifestedThisLife: [], witnessedThisLife: [], echoesUnlockedThisLife: [] }}
    onBuyUpgrade={() => {}}
    onReincarnate={() => {}}
  />);
  expect(screen.queryByText(/you remembered/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/you saw/i)).not.toBeInTheDocument();
});

it('renders Codex and Lineage entry buttons that fire callbacks', async () => {
  const onOpenCodex = vi.fn();
  const onOpenLineage = vi.fn();
  render(<BardoPanel
    payload={{ ...basePayload, manifestedThisLife: [], witnessedThisLife: [], echoesUnlockedThisLife: [] }}
    onBuyUpgrade={() => {}}
    onReincarnate={() => {}}
    onOpenCodex={onOpenCodex}
    onOpenLineage={onOpenLineage}
  />);
  await userEvent.click(screen.getByRole('button', { name: /codex/i }));
  await userEvent.click(screen.getByRole('button', { name: /lineage/i }));
  expect(onOpenCodex).toHaveBeenCalledOnce();
  expect(onOpenLineage).toHaveBeenCalledOnce();
});
```

If `basePayload` doesn't exist in the test file, define it at the top describing the existing payload shape (fields: lifeIndex, years, realm, ...) with sensible defaults.

- [ ] **Step 2: Run to verify failures**

Run: `npm test -- --run src/components/BardoPanel.test.tsx`
Expected: FAIL on missing reveal sections + missing buttons.

- [ ] **Step 3: Update BardoPanel**

Edit `src/components/BardoPanel.tsx`:

```tsx
import { Fragment } from 'react';
import type { RevealedMemory, RevealedEcho } from '@/services/engineBridge';

export interface BardoPanelProps {
  payload: {
    lifeIndex: number;
    years: number;
    realm: string;
    deathCause: string;
    karmaEarned: number;
    karmaBreakdown: Record<string, number>;
    karmaBalance: number;
    ownedUpgrades: ReadonlyArray<string>;
    availableUpgrades: ReadonlyArray<{
      id: string; name: string; description: string; cost: number;
      affordable: boolean; requirementsMet: boolean; owned: boolean;
    }>;
    manifestedThisLife: ReadonlyArray<RevealedMemory>;
    witnessedThisLife: ReadonlyArray<RevealedMemory>;
    echoesUnlockedThisLife: ReadonlyArray<RevealedEcho>;
  };
  onBuyUpgrade: (upgradeId: string) => void | Promise<void>;
  onReincarnate: () => void | Promise<void>;
  onOpenCodex?: () => void;
  onOpenLineage?: () => void;
  isLoading?: boolean;
}

export function BardoPanel({ payload, onBuyUpgrade, onReincarnate, onOpenCodex, onOpenLineage, isLoading }: BardoPanelProps) {
  return (
    <div className="min-h-screen bg-ink-950 text-parchment-100 flex flex-col items-center py-12 font-serif">
      <h2 className="text-3xl mb-8 text-jade-300">The Bardo</h2>

      {/* Life summary card (unchanged) */}
      <section className="w-full max-w-2xl bg-ink-900 border border-parchment-800 rounded p-6 mb-6">
        <h3 className="text-xl mb-2">Life {payload.lifeIndex}</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-parchment-300">
          <dt>Years lived</dt><dd>{payload.years} years</dd>
          <dt>Final realm</dt><dd>{payload.realm}</dd>
          <dt>Cause of death</dt><dd>{payload.deathCause}</dd>
        </dl>
      </section>

      {/* 10a — Manifested memories */}
      {payload.manifestedThisLife.length > 0 && (
        <section className="w-full max-w-2xl bg-ink-900 border border-jade-700 rounded p-6 mb-6">
          <h3 className="text-xl mb-3 text-jade-300">You remembered…</h3>
          <ul className="flex flex-col gap-2">
            {payload.manifestedThisLife.map((m) => (
              <li key={m.id} className="text-parchment-200">
                <div className="text-lg">{m.name}</div>
                {m.manifestFlavour && (
                  <div className="text-xs italic text-parchment-500">{m.manifestFlavour}</div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 10b — Witnessed memories (compact list) */}
      {payload.witnessedThisLife.length > 0 && (
        <section className="w-full max-w-2xl bg-ink-900 border border-parchment-800 rounded p-6 mb-6">
          <h3 className="text-xl mb-3">You saw:</h3>
          <ul className="text-parchment-300 text-sm">
            {payload.witnessedThisLife.map((m) => (
              <li key={m.id}>· {m.name} ({m.level})</li>
            ))}
          </ul>
        </section>
      )}

      {/* 10c — Echoes unlocked this life */}
      {payload.echoesUnlockedThisLife.length > 0 && (
        <section className="w-full max-w-2xl bg-ink-900 border border-jade-700 rounded p-6 mb-6">
          <h3 className="text-xl mb-3 text-jade-300">A new echo wakes</h3>
          <ul className="flex flex-col gap-3">
            {payload.echoesUnlockedThisLife.map((e) => (
              <li key={e.id} className="border border-jade-800 rounded p-3 bg-ink-900/60">
                <div className="text-lg text-jade-300">{e.name}</div>
                <div className="text-sm text-parchment-300 mt-1">{e.description}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Karma breakdown (unchanged) */}
      <section className="w-full max-w-2xl bg-ink-900 border border-parchment-800 rounded p-6 mb-6">
        <h3 className="text-xl mb-4">
          {`Karma earned: ${payload.karmaEarned} · Balance: ${payload.karmaBalance}`}
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-parchment-400 text-sm">
          {Object.entries(payload.karmaBreakdown).map(([k, v]) => (
            <Fragment key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </Fragment>
          ))}
        </dl>
      </section>

      {/* Upgrade shop (unchanged from Phase 1) */}
      <section className="w-full max-w-2xl bg-ink-900 border border-parchment-800 rounded p-6 mb-6">
        <h3 className="text-xl mb-4">Karmic Upgrades</h3>
        <div className="flex flex-col gap-2">
          {payload.availableUpgrades.map((u) => {
            const disabled = isLoading || u.owned || !u.affordable || !u.requirementsMet;
            return (
              <button
                key={u.id}
                type="button"
                disabled={disabled}
                onClick={() => onBuyUpgrade(u.id)}
                className={`text-left px-4 py-3 border rounded transition
                  ${u.owned
                    ? 'border-jade-600 bg-ink-800 opacity-60'
                    : disabled
                      ? 'border-parchment-800 opacity-40 cursor-not-allowed'
                      : 'border-parchment-700 hover:border-jade-400'}`}
              >
                <div className="flex justify-between">
                  <span className="text-jade-200">{u.name}</span>
                  <span className="text-parchment-500">
                    {u.owned ? 'owned' : !u.requirementsMet ? 'locked' : `${u.cost} karma`}
                  </span>
                </div>
                <div className="text-sm text-parchment-400">{u.description}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Codex / Lineage / Reincarnate */}
      <div className="flex gap-3">
        {onOpenCodex && (
          <button
            type="button"
            onClick={onOpenCodex}
            className="px-4 py-2 border border-parchment-700 rounded hover:border-parchment-500"
          >
            Codex
          </button>
        )}
        {onOpenLineage && (
          <button
            type="button"
            onClick={onOpenLineage}
            className="px-4 py-2 border border-parchment-700 rounded hover:border-parchment-500"
          >
            Lineage
          </button>
        )}
        <button
          type="button"
          disabled={isLoading}
          onClick={onReincarnate}
          className="px-6 py-3 bg-jade-600 text-ink-950 rounded hover:bg-jade-500 disabled:opacity-40"
        >
          Reincarnate
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run src/components/BardoPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/BardoPanel.tsx src/components/BardoPanel.test.tsx
git commit -m "feat(ui): BardoPanel reveal sections + Codex/Lineage buttons"
```

---

## Task 13: App.tsx — wire phase routing for CODEX and LINEAGE

**Files:**
- Modify: `src/App.tsx`
- Test: `tests/integration/ui_full_cycle.test.tsx` (extend — covered in Task 14)

- [ ] **Step 1: Read existing App.tsx**

Open `src/App.tsx`. The file routes phase → screen via early-return blocks.

- [ ] **Step 2: Add codex/lineage state and handlers**

Edit `src/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { GamePhase } from '@/engine/core/Types';
import { createEngineBridge, EngineBridge, TurnPreview, BardoPayload, CodexSnapshot, LineageSnapshot } from '@/services/engineBridge';
import { useGameStore } from '@/state/gameStore';
import { TitleScreen } from '@/components/TitleScreen';
import { CreationScreen } from '@/components/CreationScreen';
import { PlayScreen } from '@/components/PlayScreen';
import { BardoPanel } from '@/components/BardoPanel';
import { CodexScreen } from '@/components/CodexScreen';
import { LineageScreen } from '@/components/LineageScreen';

// ... engineSingleton / __resetEngineSingleton / __setEngineOverride unchanged ...

export function App() {
  const phase = useGameStore((s) => s.phase);
  const [hasSave, setHasSave] = useState(false);
  const [preview, setPreview] = useState<TurnPreview | null>(null);
  const [bardoPayload, setBardoPayload] = useState<BardoPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [anchors, setAnchors] = useState<ReadonlyArray<import('@/services/engineBridge').CreationAnchorView>>([]);
  const [codexSnap, setCodexSnap] = useState<CodexSnapshot | null>(null);
  const [lineageSnap, setLineageSnap] = useState<LineageSnapshot | null>(null);
  const [returnPhase, setReturnPhase] = useState<GamePhase>(GamePhase.TITLE);

  // ... existing useEffect / handlers unchanged through onBegin / onChoose / onBuyUpgrade ...

  function openCodex() {
    setReturnPhase(useGameStore.getState().phase);
    setCodexSnap(getEngine().getCodexSnapshot());
    useGameStore.getState().setPhase(GamePhase.CODEX);
  }

  function openLineage() {
    setReturnPhase(useGameStore.getState().phase);
    setLineageSnap(getEngine().getLineageSnapshot());
    useGameStore.getState().setPhase(GamePhase.LINEAGE);
  }

  function closeOverlay() {
    useGameStore.getState().setPhase(returnPhase);
    setCodexSnap(null);
    setLineageSnap(null);
  }

  // ... existing return blocks ...

  // Add CODEX route:
  if (phase === GamePhase.CODEX && codexSnap) {
    return <CodexScreen snapshot={codexSnap} onBack={closeOverlay} />;
  }
  if (phase === GamePhase.LINEAGE && lineageSnap) {
    return <LineageScreen snapshot={lineageSnap} onBack={closeOverlay} />;
  }

  // Update TitleScreen wiring:
  if (phase === GamePhase.TITLE) {
    return (
      <TitleScreen
        hasSave={hasSave}
        onNewGame={onNewGame}
        onContinue={onContinue}
        onOpenCodex={openCodex}
        onOpenLineage={openLineage}
      />
    );
  }

  // Update BardoPanel wiring:
  if (phase === GamePhase.BARDO && bardoPayload) {
    return (
      <BardoPanel
        payload={bardoPayload}
        onBuyUpgrade={onBuyUpgrade}
        onReincarnate={onReincarnate}
        onOpenCodex={openCodex}
        onOpenLineage={openLineage}
        isLoading={isLoading}
      />
    );
  }
}
```

The `setAnchors` callsites that read `engine.listAnchors()` already return the new shape automatically — no further change needed.

- [ ] **Step 3: Run UI tests**

Run: `npm test -- --run src/`
Expected: PASS. The previously-passing `ui_full_cycle.test.tsx` may need a minor update if it does deep-equality on anchors (it does not — it clicks by text). Still run to confirm.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): route CODEX + LINEAGE phases with overlay return"
```

---

## Task 14: Integration tests — full UI cycle + 5-life UI loop

**Files:**
- Create: `tests/integration/playable_life_2a.test.tsx`

- [ ] **Step 1: Write the integration test**

Create `tests/integration/playable_life_2a.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App, __resetEngineSingleton, __setEngineOverride } from '@/App';
import { createEngineBridge } from '@/services/engineBridge';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';
import { GamePhase } from '@/engine/core/Types';

describe('Phase 2A-3 full UI cycle: Title → Codex → Lineage → Life → Bardo (reveal) → Reincarnate', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
    __resetEngineSingleton();
  });

  it('opens Codex (empty), opens Lineage (empty), runs a life, sees Bardo reveal, returns to Creation', { timeout: 30000 }, async () => {
    const engine = createEngineBridge({ now: () => 2 });
    __setEngineOverride(engine);

    render(<App />);

    await waitFor(() => expect(screen.getByText(/thousand deaths/i)).toBeInTheDocument());

    // Open Codex (empty state).
    await userEvent.click(screen.getByRole('button', { name: /codex/i }));
    await waitFor(() => expect(screen.getByText(/^Codex$/)).toBeInTheDocument());
    expect(screen.getByText(/seen nowhere yet/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    await waitFor(() => expect(screen.getByText(/thousand deaths/i)).toBeInTheDocument());

    // Open Lineage (empty state).
    await userEvent.click(screen.getByRole('button', { name: /lineage/i }));
    await waitFor(() => expect(screen.getByText(/^Lineage$/)).toBeInTheDocument());
    expect(screen.getByText(/no lives yet/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    // Start a new life.
    await userEvent.click(screen.getByRole('button', { name: /new life/i }));
    await waitFor(() => expect(screen.getByText(/choose your birth/i)).toBeInTheDocument());

    // Locked anchors render as silhouettes.
    expect(screen.getByText(/reach body tempering 5 in any past life/i)).toBeInTheDocument();

    // Pick peasant farmer.
    await userEvent.click(screen.getByText(/peasant farmer/i));
    await userEvent.type(screen.getByLabelText(/name/i), 'Lin Wei');
    await userEvent.click(screen.getByRole('button', { name: /begin life/i }));

    await waitFor(() => expect(screen.getAllByText(/lin wei/i).length).toBeGreaterThan(0));

    // Run choices to death.
    for (let i = 0; i < 600; i++) {
      if (useGameStore.getState().phase === GamePhase.BARDO) break;
      const buttons = screen.queryAllByRole('button')
        .filter((b) => !(b as HTMLButtonElement).disabled);
      if (buttons.length === 0) continue;
      await userEvent.click(buttons[0]!);
    }
    expect(useGameStore.getState().phase).toBe(GamePhase.BARDO);

    await waitFor(() => expect(screen.getByText(/the bardo/i)).toBeInTheDocument());

    // Bardo: open Lineage, expect 1 entry now.
    await userEvent.click(screen.getByRole('button', { name: /lineage/i }));
    await waitFor(() => expect(screen.getByText(/^Lineage$/)).toBeInTheDocument());
    expect(screen.getByText(/Lin Wei/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    // Bardo: open Codex, expect at least one memory potentially witnessed (could be empty if RNG didn't hit).
    await userEvent.click(screen.getByRole('button', { name: /codex/i }));
    await waitFor(() => expect(screen.getByText(/^Codex$/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    // Reincarnate.
    await userEvent.click(screen.getByRole('button', { name: /reincarnate/i }));
    await waitFor(() => expect(screen.getByText(/choose your birth/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npm test -- --run tests/integration/playable_life_2a.test.tsx`
Expected: PASS within 30s.

- [ ] **Step 3: Add a 5-life UI loop to close exit criterion #8**

Append a second `it(...)` block to the same file (within the same `describe`):

```tsx
it('runs 5 successive lives through the UI and grows meta state monotonically', { timeout: 90000 }, async () => {
  const engine = createEngineBridge({ now: () => 2 });
  __setEngineOverride(engine);
  render(<App />);

  await waitFor(() => expect(screen.getByText(/thousand deaths/i)).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /new life/i }));

  for (let life = 1; life <= 5; life++) {
    await waitFor(() => expect(screen.getByText(/choose your birth/i)).toBeInTheDocument());
    await userEvent.click(screen.getByText(/peasant farmer/i));

    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
    if (nameInput.value === '') {
      await userEvent.type(nameInput, `Soul${life}`);
    }
    await userEvent.click(screen.getByRole('button', { name: /begin life/i }));

    // Run choices to death.
    for (let i = 0; i < 800; i++) {
      if (useGameStore.getState().phase === GamePhase.BARDO) break;
      const buttons = screen.queryAllByRole('button')
        .filter((b) => !(b as HTMLButtonElement).disabled);
      if (buttons.length === 0) continue;
      await userEvent.click(buttons[0]!);
    }
    expect(useGameStore.getState().phase).toBe(GamePhase.BARDO);
    await waitFor(() => expect(screen.getByText(/the bardo/i)).toBeInTheDocument());

    // Confirm lifeCount monotonically grows.
    expect(useMetaStore.getState().lifeCount).toBe(life);

    // Reincarnate (or back to creation if last life).
    await userEvent.click(screen.getByRole('button', { name: /reincarnate/i }));
  }

  // Final assertion: lineage has 5 entries, most recent first via the snapshot API.
  const snap = engine.getLineageSnapshot();
  expect(snap.entries).toHaveLength(5);
  expect(snap.entries[0].lifeIndex).toBe(5);
  expect(snap.entries[4].lifeIndex).toBe(1);
});
```

- [ ] **Step 4: Run the entire suite to confirm no regressions**

Run: `npm test -- --run`
Expected: all tests pass. Suite count should be ~660+ (651 baseline + ~10-15 new).

- [ ] **Step 5: Commit**

```bash
git add tests/integration/playable_life_2a.test.tsx
git commit -m "test(integration): full UI cycle + 5-life UI loop (exit criteria 5/6/8)"
```

---

## Task 15: Bundle audit + lint pass

**Files:**
- Read-only: `dist/` after `npm run build`

- [ ] **Step 1: Run lint**

Run: `npm run lint` (or `npm run typecheck` — match what CI runs; check `package.json`).
Expected: zero errors.

- [ ] **Step 2: Run build + check size**

Run: `npm run build`
Expected: build succeeds. Look at the output for `dist/assets/index-*.js` size.

- [ ] **Step 3: Verify against budget**

Phase 2A-2 baseline: 420.78 KB raw / 118.14 KB gzip. Phase 3 budget: 450 KB raw.

Document the actual size in the PR description. If raw exceeds 450 KB, do one of:
- Investigate import bloat (any new dependency?). The plan adds zero new deps; size growth should be ≤ 5 KB raw (mostly new component JSX).
- Document and ask the user to confirm before merging.

- [ ] **Step 4: Commit any cleanup if needed**

If you discover unused imports / dead code while building, clean up in a separate `chore:` commit.

---

## Task 16: PR description draft

**Files:**
- None (PR description, not in repo)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin phase-2a3-ui
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "Phase 2A-3: Reveal UI (Codex / Lineage / Bardo reveal / locked anchors)" --body "$(cat <<'EOF'
## Summary
Phase 2A-3 ships the reveal UI surface: `CodexScreen` (Memories / Echoes / Anchors tabs), `LineageScreen` (LifeCards with year ranges), enhanced `BardoPanel` with reveal sections (manifested memories, witnessed memories, echoes unlocked this life), and enhanced `CreationScreen` (locked-anchor silhouettes + shimmer for freshly-unlocked). Anchor-unlock evaluator wired at `runBardoFlow` to populate `meta.unlockedAnchors` (closes the Phase 2A-2 deferred trade-off). One schema bump: `MetaState v2 → v3` adds `birthYear`/`deathYear` to `LineageEntrySummary`. New `GamePhase.LINEAGE` value (`CODEX` already existed).

Closes Phase 2A exit criteria #5 (Codex shows real data), #6 (Lineage shows year range / anchor / realm / cause / echoes-this-life), #8 (full 5-life UI integration test). Phase 2A is now complete.

## Plan
[`docs/superpowers/plans/2026-04-24-phase-2a3-reveal-ui.md`](docs/superpowers/plans/2026-04-24-phase-2a3-reveal-ui.md) — 14 tasks, all green.

## Test plan
- [x] `npm test -- --run` — all tests pass (~660+)
- [x] `npm run build` — bundle within 450 KB raw budget
- [x] `tests/integration/playable_life_2a.test.tsx` — full Title → Codex → Lineage → Life → Bardo (reveal) → Reincarnate cycle
- [x] Phase 1 + 2A-1 + 2A-2 integration tests stay green (`echo_inheritance`, `memory_manifestation`, `mood_filter_variance`, `life_cycle_with_bardo`, `playable_life`, `ui_full_cycle`)

## Notable plan deviations / spec bug-flags
(Fill in during implementation. Examples to watch for: zod v4 strictness, store-projection edge cases, RNG reseeding around the new BardoResult.freshlyUnlockedAnchors field, any test-fixture updates needed for the RunState.birthYear addition.)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for CI green**

Monitor with: `gh pr checks <pr#>` until green.

- [ ] **Step 4: Merge with the standard squash-or-merge workflow**

```bash
gh pr merge <pr#> --merge --delete-branch
```

- [ ] **Step 5: Sync local main**

```bash
git checkout main
git pull --ff-only
git fetch --prune
```

---

## Self-review checklist

After all tasks are committed, before pushing:

- [ ] **Spec coverage:** every exit criterion in spec §2 (#5 Codex, #6 Lineage, #8 5-life integration) has a passing test referenced. Anchor unlock evaluator from spec §11.8 is wired (Task 4).
- [ ] **Migration safety:** `Migrator.v2_to_v3.test.ts` (Task 3) loads a v2 fixture and confirms karma + echoes + lineage preserved with year fields defaulted.
- [ ] **No silent narrative drift:** the only RNG-touching change is `runState.birthYear` initialization, which is computed once at spawn and never re-read by composer/selector. Confirmed by full suite green.
- [ ] **Bundle:** raw size documented in the PR. If > 450 KB, ask user before merge.
- [ ] **Carry-overs:** `CLAUDE.md` "Phase 2A-2 trade-offs" entry "Anchor unlock evaluator deferred" is now closed by Task 4 — call out in PR description so the next CLAUDE.md update can drop it from the list.
- [ ] **Plan bug-flags:** if the implementer/reviewer subagents find inconsistencies in this plan during execution (wrong test expectations, missing helper imports, zod quirks, prop-shape mismatches), call them out in the relevant commit message AND in the PR description "Notable plan deviations" section.
