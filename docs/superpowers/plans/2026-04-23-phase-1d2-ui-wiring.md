# Phase 1D-2 — UI Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Phase 1D-1 engine (Anchor → runTurn → BardoFlow → reincarnate) to the React UI. After this phase: user can click **New Life** on the Title screen, pick an anchor, play turns until death, see a Bardo summary, spend karma on upgrades, reincarnate, and continue the cycle — all with autosave/resume.

**Architecture:** Extend `gameStore` to hold the engine's per-run state (`runState`, `streak`, `nameRegistry`, `lifetimeSeenEvents`, last `turnResult`, last `bardoResult`) and the current `phase`. The `engineBridge` becomes the one-way adapter from UI actions → `GameLoop.runTurn` / `BardoFlow.runBardoFlow` / `MetaState` mutations, with `SaveManager` persistence on every non-trivial boundary. Three new screens (`CreationScreen`, `PlayScreen`, `BardoPanel`) consume store slices and dispatch bridge calls. `App.tsx` renders the screen matching `store.phase`.

**Tech stack:** React 19, TypeScript 5.8 (strict), Zustand 5, Vitest 4, `@testing-library/react` 16, `@testing-library/user-event` 14, Zod 4. No new runtime deps.

**Source of truth:** `docs/spec/design.md` §2 (two-loop game model), §11 (UI screens), §10 (persistence), §7 (meta-progression).

**Scope boundaries:**
- ✅ **In:** anchor picker, play screen (narrative + choice buttons + status strip), bardo screen (life summary + karma breakdown + upgrade shop + reincarnate), phase routing in `App.tsx`, `engineBridge` full implementation, store extension with save/load sync, anchor content loader, minimal event fixture loader, **realm-karma formula fix** (§7.1 cumulative interpretation), legacy Phase-0 component replacement/deletion, component + integration tests.
- ❌ **Out:** Real event corpus — Phase 1D-3 (~50 Yellow Plains events). Codex screen — Phase 2. Lineage detail screen — Phase 2. Heavenly Notice scaling UI — Phase 2. Echo / Memory display — Phase 2. Settings screen UI beyond what exists — Phase 2. Multi-region spawning — Phase 2.

---

## Task Map

1. **Realm karma formula fix** — `KarmicInsightRules.computeKarma` switches from flat `realmIndex × 10` to cumulative `sum(i × 10 for i in 1..realmIndex)` per spec §7.1. Add test for `realmIndex ≥ 2` where the two interpretations diverge.
2. **Content loaders** — `loadAnchorPack` (reads `src/content/anchors/defaults.json` + validates) and `loadEventFixture` (returns a small in-code corpus for Phase 1D-2 playtest; replaced by full JSON loader in 1D-3).
3. **Store extension + persistence sync** — Extend `gameStore` to hold engine state (phase, runState, streak, nameRegistry, lifetimeSeenEvents, turnResult, bardoResult) and a `library` reference. Hydrate `metaStore` from `MetaState` on init; persist on karma/upgrade/lineage change. Add `resetRun()` helper for Bardo→Creation transition.
4. **engineBridge — loadOrInit + beginLife** — `loadOrInit` hydrates stores from `SaveManager`. `beginLife(anchorId, name)` resolves anchor, creates character, seeds store, autosaves, returns a `TurnData`-shaped preview.
5. **engineBridge — chooseAction** — Builds `TurnContext` from store, calls `runTurn`, updates store, autosaves. If `nextRunState.deathCause` is set, advances phase to `BARDO`. Otherwise returns new narrative + choices + status.
6. **engineBridge — beginBardo + spendKarma + reincarnate** — `beginBardo` calls `runBardoFlow`, persists MetaState, stores `bardoResult`. `spendKarma(upgradeId)` calls `purchaseUpgrade`, persists, refreshes bardoResult. `reincarnate` clears run save + advances phase to `CREATION`.
7. **CreationScreen component** — Anchor picker (reads `DEFAULT_ANCHORS`), name entry, "Begin Life" button. On submit, calls `engine.beginLife` via a passed-in handler.
8. **PlayScreen component** — Reads `store.turnResult` + `store.runState`. Renders narrative + choice buttons (from `turnResult.event.choices`) + status strip (HP/Qi/age/realm/insight). Click → `engine.chooseAction`.
9. **BardoPanel component** — Reads `store.bardoResult` + `metaStore`. Renders life summary card, karma breakdown, upgrade shop (grid of `DEFAULT_UPGRADES` with buy buttons gated by requires/cost), reincarnate button.
10. **App.tsx phase routing + legacy cleanup + integration test** — Replace App's single-screen render with a phase switch. Delete legacy `SetupScreen.tsx`, `StatusPanel.tsx`, `StoryPanel.tsx`. Add `tests/integration/ui_full_cycle.test.tsx` exercising Title → Creation → Play (few turns) → Bardo → Reincarnate → Creation.

---

## Prerequisite Reading

Before you start, skim these files so the references in later tasks make sense:

- `src/engine/core/GameLoop.ts` — `TurnContext`, `TurnResult`, `runTurn`.
- `src/engine/bardo/BardoFlow.ts` — `BardoResult`, `runBardoFlow`.
- `src/engine/meta/MetaState.ts` — `saveMeta`, `loadMeta`, `purchaseUpgrade`, `addKarma`, `incrementLifeCount`, `appendLineageEntry`, `createEmptyMetaState`.
- `src/engine/meta/Anchor.ts` — `AnchorSchema`, `DEFAULT_ANCHORS`, `getAnchorById`.
- `src/engine/meta/AnchorResolver.ts` — `resolveAnchor`.
- `src/engine/meta/characterFromAnchor.ts` — `characterFromAnchor({ resolved, name, runSeed, rng })`.
- `src/engine/meta/KarmicUpgrade.ts` — `DEFAULT_UPGRADES`, `getUpgradeById`.
- `src/engine/persistence/SaveManager.ts` — `createSaveManager`, `save`, `load`, `clear`.
- `src/engine/persistence/RunSave.ts` — `saveRun`, `loadRun`, `clearRun`.
- `src/engine/narrative/SnippetLibrary.ts`, `NameRegistry.ts`, `Mood.ts` — factories used when building `TurnContext`.
- `src/services/engineBridge.ts` — current Phase-0 stubs; types (`TurnData`, `BardoPayload`, `CreationPayload`, etc.) we will reshape.
- `src/state/gameStore.ts`, `src/state/metaStore.ts` — current Zustand stores.
- `src/App.tsx` — entry point currently only wiring `TitleScreen`.
- `src/components/TitleScreen.tsx` + `.test.tsx` — reference pattern for new component tests.
- `tests/setup.ts`, `vitest.config.ts` — confirm `jsdom` env + `@testing-library/jest-dom/vitest` global matchers.

Spec sections:
- §2 (game loop, phases)
- §7.1 (karmic insight earn + spend)
- §10 (persistence envelopes)
- §11 (UI screens — Title, Creation, Play, Bardo)

---

## Task 1: Realm-karma formula fix (cumulative per §7.1)

**Files:**
- Modify: `src/engine/meta/KarmicInsightRules.ts` — change `realmKarma` computation.
- Modify: `src/engine/meta/KarmicInsightRules.test.ts` — add tests for `realmIndex ≥ 2` where cumulative ≠ flat. Update the existing test's comment to document the cumulative interpretation.

**Rationale:** Phase 1D-1 reviewer flagged: spec §7.1 says `+10 × realm index (per realm)`. The "per realm" wording implies cumulative — reaching realm 3 earns `10+20+30 = 60`, not `30`. The Phase 1D-1 tests only exercised `realmIndex ∈ {0, 1}` where flat (`realmIndex × 10`) and cumulative (`5 × N × (N+1)` for `N ≥ 1`) both yield `10` — so the divergence was invisible. See the "Known accepted deviations" note in `CLAUDE.md`.

**Cumulative closed form:** `sum(i × 10 for i in 1..N) = 10 × N × (N+1) / 2 = 5 × N × (N+1)` where `N = realmIndex`.

| realmIndex | flat | cumulative |
|------------|------|------------|
| 0 (Mortal) | 0    | 0          |
| 1          | 10   | 10         |
| 2          | 20   | 30         |
| 3          | 30   | 60         |
| 4          | 40   | 100        |

- [ ] **Step 1: Add failing tests first (TDD)**

Open `src/engine/meta/KarmicInsightRules.test.ts`. Add the following `it()` block inside the existing `describe('computeKarma', () => { ... })` — place it immediately AFTER the existing test `'reaching a realm adds 10 × realm-index per realm entered'`:

```ts
  it('realm karma is cumulative — sum of (index × 10) for each realm entered', () => {
    // realmIndex 2 → 10 + 20 = 30
    const r2 = computeKarma(baseSummary({
      yearsLived: 0, deathCause: 'old_age',
      realmReached: Realm.QI_GATHERING,
    }));
    expect(r2.breakdown.realm).toBe(30);
    expect(r2.total).toBe(5 /* old_age */ + 30 /* cumulative realm */);

    // realmIndex 3 → 10 + 20 + 30 = 60
    const r3 = computeKarma(baseSummary({
      yearsLived: 0, deathCause: 'old_age',
      realmReached: Realm.FOUNDATION,
    }));
    expect(r3.breakdown.realm).toBe(60);

    // realmIndex 4 → 10 + 20 + 30 + 40 = 100
    const r4 = computeKarma(baseSummary({
      yearsLived: 0, deathCause: 'old_age',
      realmReached: Realm.CORE_FORMATION,
    }));
    expect(r4.breakdown.realm).toBe(100);
  });
```

**Important:** This test imports `Realm` and uses `Realm.QI_GATHERING`, `Realm.FOUNDATION`, `Realm.CORE_FORMATION`. Before writing the test, open `src/engine/core/Types.ts` around line 18 and confirm those enum values exist and that their order in `REALM_ORDER` places them at indexes 2, 3, 4 respectively. If the enum values have different names (e.g., `Realm.QI_GATHERING` vs `Realm.QI`), use whatever the actual identifiers are. The test must assert the behavior of `REALM_ORDER.indexOf(x)`, so the cumulative assertion is seeded off the actual index positions.

- [ ] **Step 2: Run the tests → expect RED (new test fails, existing ones still pass)**

```bash
npm test -- KarmicInsightRules
```

Expected: 11 pass (existing) + 1 fail (new cumulative test). The existing test at index 1 still passes because `5 × 1 × 2 = 10`.

- [ ] **Step 3: Change the formula**

Open `src/engine/meta/KarmicInsightRules.ts`. Find the line (around line 65):

```ts
  const realmKarma = realmIndex > 0 ? realmIndex * 10 : 0;
```

Replace with:

```ts
  // Spec §7.1: "+10 × realm index (per realm)" — cumulative over realms entered.
  // Closed form of sum(i × 10 for i in 1..N) where N = realmIndex.
  const realmKarma = realmIndex > 0 ? 5 * realmIndex * (realmIndex + 1) : 0;
```

- [ ] **Step 4: Run tests → expect GREEN**

```bash
npm test -- KarmicInsightRules
```

Expected: 12 passing.

Also run the full suite sanity-check since Task 4 of 1D-1 flowed karma into MetaState tests and integration tests — the cumulative formula can change integration expectations. Verify:

```bash
npm test
```

Expected: full suite still green. In particular, `tests/integration/life_cycle_with_bardo.test.ts` asserts `bardo.karmaEarned > 0` (loose) and `bardo.meta.karmaBalance === bardo.karmaEarned` (exact mirror, unaffected by formula). Peasant_farmer Phase-1D-1 playtest should not reach realm ≥ 2 in practice (no cultivation events in the fixture), so `realmKarma` remains 0 there.

If any test breaks, read the failure and decide: is it asserting the flat value? If so, update it to the cumulative value and note in the commit message.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/engine/meta/KarmicInsightRules.ts src/engine/meta/KarmicInsightRules.test.ts
git commit -m "fix(meta): realm karma cumulative per §7.1 (was flat)"
```

- [ ] **Step 6: Update CLAUDE.md**

Open `CLAUDE.md`. Under "Known spec quirks & accepted deviations", **remove** the "Realm karma — flat vs cumulative (pending fix in 1D-2)" bullet (no longer a deviation — the fix landed).

Commit as part of the same PR or separately:

```bash
git add CLAUDE.md
git commit -m "docs: remove realm-karma deviation (resolved in 1D-2)"
```

---

## Task 2: Content loaders (anchors + event fixture)

**Files:**
- Create: `src/content/anchors/loader.ts`
- Create: `src/content/anchors/loader.test.ts`
- Create: `src/content/events/fixture.ts` — minimal in-code event corpus for Phase 1D-2 playtest. Phase 1D-3 will replace this with a JSON loader.
- Create: `src/content/events/fixture.test.ts`

**Rationale:**
- The `DEFAULT_ANCHORS` array is hardcoded in `Anchor.ts`. A loader that reads `src/content/anchors/defaults.json` and validates via `AnchorSchema` gives us the pattern Phase 1D-3 will reuse for events.
- `GameLoop.runTurn` needs an `events: EventDef[]` pool. Phase 1D-3 authors ~50 real Yellow Plains events; for 1D-2 we need a small fixture (≥ 3 events) just so the UI actually progresses.

**Anchor loader — API:**

```ts
export function loadAnchors(raw: unknown): ReadonlyArray<AnchorDef>;
```

**Event fixture — API:**

```ts
export const FIXTURE_EVENTS: ReadonlyArray<EventDef>;
```

(Phase 1D-3 will replace this module with `loadEvents(raw: unknown): ReadonlyArray<EventDef>`.)

- [ ] **Step 1: Anchor loader — failing test first**

Create `src/content/anchors/loader.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadAnchors } from './loader';
import defaultsJson from './defaults.json';

describe('loadAnchors', () => {
  it('parses the committed defaults.json', () => {
    const anchors = loadAnchors(defaultsJson);
    expect(anchors.length).toBeGreaterThanOrEqual(2);
    expect(anchors.map((a) => a.id)).toContain('true_random');
    expect(anchors.map((a) => a.id)).toContain('peasant_farmer');
  });

  it('returns fully validated AnchorDef objects (zod-parsed)', () => {
    const anchors = loadAnchors(defaultsJson);
    for (const a of anchors) {
      expect(typeof a.id).toBe('string');
      expect(a.spawn.regions.length).toBeGreaterThan(0);
      expect(a.karmaMultiplier).toBeGreaterThan(0);
    }
  });

  it('throws on an envelope without an anchors array', () => {
    expect(() => loadAnchors({ version: 1 })).toThrow(/anchors/i);
  });

  it('throws on an anchor with an invalid familyTier', () => {
    const bad = {
      version: 1,
      anchors: [{
        id: 'x', name: 'X', description: '.', unlock: 'default',
        spawn: {
          regions: [{ id: 'r', weight: 1 }],
          era: { minYear: 0, maxYear: 100 },
          age: { min: 10, max: 14 },
          familyTier: 'god_emperor',
          attributeModifiers: {},
          startingItems: [],
          startingFlags: [],
        },
        karmaMultiplier: 1.0,
      }],
    };
    expect(() => loadAnchors(bad)).toThrow();
  });
});
```

- [ ] **Step 2: Confirm red**

```bash
npm test -- anchors/loader
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement `loadAnchors`**

Create `src/content/anchors/loader.ts`:

```ts
// Validated loader for anchor content packs. Source: docs/spec/design.md §9.
import { z } from 'zod';
import { AnchorDef, AnchorSchema } from '@/engine/meta/Anchor';

const AnchorPackSchema = z.object({
  version: z.literal(1),
  anchors: z.array(AnchorSchema).min(1),
});

export function loadAnchors(raw: unknown): ReadonlyArray<AnchorDef> {
  const parsed = AnchorPackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`loadAnchors: invalid anchor pack — ${parsed.error.message}`);
  }
  return parsed.data.anchors;
}
```

- [ ] **Step 4: Configure JSON import (if needed)**

Vite handles JSON imports natively. Vitest (via Vite) should too. If the `import defaultsJson from './defaults.json'` line errors under `tsc`, add to `tsconfig.json` → `"resolveJsonModule": true`. It may already be set; only modify if the build or typecheck complains.

- [ ] **Step 5: Run tests → GREEN**

```bash
npm test -- anchors/loader
```

Expected: 4 passing.

- [ ] **Step 6: Event fixture — failing test first**

Create `src/content/events/fixture.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FIXTURE_EVENTS } from './fixture';
import { EventSchema } from '@/content/schema';

describe('FIXTURE_EVENTS', () => {
  it('has at least 3 events', () => {
    expect(FIXTURE_EVENTS.length).toBeGreaterThanOrEqual(3);
  });

  it('every fixture event validates against EventSchema', () => {
    for (const ev of FIXTURE_EVENTS) {
      const res = EventSchema.safeParse(ev);
      expect(res.success).toBe(true);
    }
  });

  it('at least one event can produce a non-fatal outcome and at least one can cause death', () => {
    const hasFatal = FIXTURE_EVENTS.some((ev) =>
      ev.choices.some((c) =>
        Object.values(c.outcomes).some((o: any) => o.deathCause != null),
      ),
    );
    expect(hasFatal).toBe(true);
  });

  it('all fixture events declare yellow_plains in regions', () => {
    for (const ev of FIXTURE_EVENTS) {
      expect(ev.conditions?.regions).toContain('yellow_plains');
    }
  });
});
```

Check `src/content/schema.ts` for the exact name of the event schema export (likely `EventSchema`; if it's `EventDefSchema` or similar, update the import).

- [ ] **Step 7: Confirm red**

```bash
npm test -- events/fixture
```

Expected: FAIL (module missing).

- [ ] **Step 8: Implement `FIXTURE_EVENTS`**

Create `src/content/events/fixture.ts`:

```ts
// Phase 1D-2 play-testing fixture. Phase 1D-3 will replace this with a real
// JSON-backed corpus of ~50 Yellow Plains events.
//
// Three minimal events so the play loop can actually exercise:
//   1. A benign "walk on" event (insight +1 / hp -1 on fail).
//   2. A training event (stat check, reward on success).
//   3. A dangerous encounter that can kill the character.

import { EventDef } from '@/content/schema';

export const FIXTURE_EVENTS: ReadonlyArray<EventDef> = [
  {
    id: 'FX_BENIGN_DAY',
    category: 'life.daily',
    version: 1,
    weight: 100,
    conditions: { regions: ['yellow_plains'] },
    timeCost: 'SHORT',
    text: {
      intro: ['Another dawn over the plains. $[CHAR_NAME] tends the millet.'],
      body: [],
      outro: [],
    },
    choices: [{
      id: 'ch_work',
      label: 'Work the field.',
      timeCost: 'SHORT',
      outcomes: {
        SUCCESS: { narrativeKey: 'ok', stateDeltas: [{ kind: 'insight_delta', amount: 1 }] },
        FAILURE: { narrativeKey: 'tired', stateDeltas: [{ kind: 'hp_delta', amount: -2 }] },
      },
    }],
    repeat: 'unlimited',
  },
  {
    id: 'FX_TRAIN_BODY',
    category: 'training.body',
    version: 1,
    weight: 40,
    conditions: { regions: ['yellow_plains'] },
    timeCost: 'MEDIUM',
    text: {
      intro: ['$[CHAR_NAME] finds a crude stone and lifts it, again and again.'],
      body: [],
      outro: [],
    },
    choices: [{
      id: 'ch_train',
      label: 'Push through the burn.',
      timeCost: 'MEDIUM',
      check: { base: 20, stats: { Body: 1 }, difficulty: 40, category: 'endurance' },
      outcomes: {
        CRIT_SUCCESS: { narrativeKey: 'peak', stateDeltas: [{ kind: 'attribute_delta', stat: 'Body', amount: 2 }] },
        SUCCESS: { narrativeKey: 'solid', stateDeltas: [{ kind: 'attribute_delta', stat: 'Body', amount: 1 }] },
        PARTIAL: { narrativeKey: 'sore', stateDeltas: [] },
        FAILURE: { narrativeKey: 'strain', stateDeltas: [{ kind: 'hp_delta', amount: -3 }] },
        CRIT_FAILURE: { narrativeKey: 'injury', stateDeltas: [{ kind: 'hp_delta', amount: -8 }] },
      },
    }],
    repeat: 'unlimited',
  },
  {
    id: 'FX_BANDIT',
    category: 'life.danger',
    version: 1,
    weight: 10,
    conditions: { regions: ['yellow_plains'] },
    timeCost: 'INSTANT',
    text: {
      intro: ['A bandit steps from the millet with a knife. No time to think.'],
      body: [],
      outro: [],
    },
    choices: [{
      id: 'ch_fight',
      label: 'Fight back.',
      timeCost: 'INSTANT',
      check: { base: 20, stats: { Body: 1 }, difficulty: 75, category: 'brute_force' },
      outcomes: {
        SUCCESS: { narrativeKey: 'escape', stateDeltas: [{ kind: 'hp_delta', amount: -2 }] },
        FAILURE: { narrativeKey: 'killed', deathCause: 'combat_melee' },
        CRIT_FAILURE: { narrativeKey: 'killed', deathCause: 'combat_melee' },
      },
    }],
    repeat: 'unlimited',
  },
];
```

**Before writing this file, read `src/content/schema.ts` to confirm:**
- The exact shape of `EventDef`. Field names may differ from the sketch above (e.g., `weight` vs `baseWeight`, `conditions.regions` vs `regions`).
- Whether `check` requires a `category` and what the valid `CheckCategory` values are (`src/engine/core/Types.ts:157+`).
- Whether `text.intro` is string array or object.

Adjust the literal to match the real schema. The test in step 6 parses every fixture event through `EventSchema`, so the test is the source of truth — if it fails, the fixture shape is wrong.

- [ ] **Step 9: Run tests → GREEN**

```bash
npm test -- events/fixture
```

Expected: 4 passing.

- [ ] **Step 10: Typecheck + commit**

```bash
npm run typecheck
git add src/content/anchors/loader.ts src/content/anchors/loader.test.ts \
        src/content/events/fixture.ts src/content/events/fixture.test.ts
git commit -m "feat(content): anchor loader + event fixture for 1D-2 playtest"
```

---

## Task 3: Store extension + persistence sync

**Files:**
- Modify: `src/state/gameStore.ts` — add engine-state fields + setters.
- Modify: `src/state/metaStore.ts` — add `hydrateFromMetaState` and `toMetaState` helpers.
- Create: `src/state/gameStore.test.ts`
- Modify: `src/state/metaStore.test.ts` if it exists; otherwise create it.

**Rationale:**
- The current `gameStore` holds only `phase + isLoading + error`. The engine's per-run state (RunState, StreakState, NameRegistry, lifetimeSeenEvents, turnResult, bardoResult, SnippetLibrary) is what the UI must read from. Putting it in the store makes React-renders deterministic and testable, and gives the bridge one place to write to.
- `metaStore` currently mirrors `MetaState` fields ad-hoc. We add a round-trip helper so `SaveManager` is the only source of truth across sessions. UI-facing selectors stay the same shape; only the bridge touches the round-trip functions.

- [ ] **Step 1: Failing tests for `gameStore`**

Create `src/state/gameStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GamePhase } from '@/engine/core/Types';
import { useGameStore } from './gameStore';

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('starts in TITLE phase with no runState', () => {
    const s = useGameStore.getState();
    expect(s.phase).toBe(GamePhase.TITLE);
    expect(s.runState).toBeNull();
    expect(s.streak).toBeNull();
    expect(s.nameRegistry).toBeNull();
    expect(s.turnResult).toBeNull();
    expect(s.bardoResult).toBeNull();
  });

  it('setPhase updates the phase', () => {
    useGameStore.getState().setPhase(GamePhase.CREATION);
    expect(useGameStore.getState().phase).toBe(GamePhase.CREATION);
  });

  it('seedRun populates runState, streak, nameRegistry, lifetimeSeenEvents', () => {
    const dummyRun = { turn: 0 } as any;
    const dummyStreak = { consecutiveFailures: 0 } as any;
    const dummyRegistry = { names: new Map() } as any;
    useGameStore.getState().seedRun({
      runState: dummyRun,
      streak: dummyStreak,
      nameRegistry: dummyRegistry,
      lifetimeSeenEvents: ['EV_X'],
    });
    const s = useGameStore.getState();
    expect(s.runState).toBe(dummyRun);
    expect(s.streak).toBe(dummyStreak);
    expect(s.nameRegistry).toBe(dummyRegistry);
    expect(s.lifetimeSeenEvents).toEqual(['EV_X']);
  });

  it('setTurnResult stores the last turn output', () => {
    const tr = { narrative: 'hi', eventId: 'EV', nextRunState: {} as any } as any;
    useGameStore.getState().setTurnResult(tr);
    expect(useGameStore.getState().turnResult).toBe(tr);
  });

  it('setBardoResult stores the bardo output', () => {
    const br = { karmaEarned: 42, meta: {} as any } as any;
    useGameStore.getState().setBardoResult(br);
    expect(useGameStore.getState().bardoResult).toBe(br);
  });

  it('resetRun clears run-scoped fields but keeps phase untouched', () => {
    useGameStore.getState().setPhase(GamePhase.CREATION);
    useGameStore.getState().seedRun({
      runState: { turn: 1 } as any,
      streak: {} as any,
      nameRegistry: {} as any,
      lifetimeSeenEvents: ['x'],
    });
    useGameStore.getState().setTurnResult({ narrative: 'n' } as any);
    useGameStore.getState().setBardoResult({ karmaEarned: 1 } as any);

    useGameStore.getState().resetRun();

    const s = useGameStore.getState();
    expect(s.phase).toBe(GamePhase.CREATION); // unchanged
    expect(s.runState).toBeNull();
    expect(s.streak).toBeNull();
    expect(s.nameRegistry).toBeNull();
    expect(s.lifetimeSeenEvents).toEqual([]);
    expect(s.turnResult).toBeNull();
    expect(s.bardoResult).toBeNull();
  });

  it('reset brings the store back to initial state', () => {
    useGameStore.getState().setPhase(GamePhase.PLAYING);
    useGameStore.getState().setError('boom');
    useGameStore.getState().reset();
    const s = useGameStore.getState();
    expect(s.phase).toBe(GamePhase.TITLE);
    expect(s.error).toBeNull();
  });
});
```

- [ ] **Step 2: Confirm red**

```bash
npm test -- gameStore
```

Expected: FAIL (new actions + fields missing).

- [ ] **Step 3: Extend `gameStore`**

Open `src/state/gameStore.ts` and replace its content with:

```ts
import { create } from 'zustand';
import { GamePhase } from '@/engine/core/Types';
import { RunState } from '@/engine/events/RunState';
import { StreakState } from '@/engine/choices/StreakTracker';
import { NameRegistry } from '@/engine/narrative/NameRegistry';
import { TurnResult } from '@/engine/core/GameLoop';
import { BardoResult } from '@/engine/bardo/BardoFlow';

export interface SeedRunArgs {
  runState: RunState;
  streak: StreakState;
  nameRegistry: NameRegistry;
  lifetimeSeenEvents: ReadonlyArray<string>;
}

interface GameStoreState {
  phase: GamePhase;
  isLoading: boolean;
  error: string | null;

  // Per-run engine state. Null when no active run.
  runState: RunState | null;
  streak: StreakState | null;
  nameRegistry: NameRegistry | null;
  lifetimeSeenEvents: ReadonlyArray<string>;

  // Last outputs — consumed by UI for rendering.
  turnResult: TurnResult | null;
  bardoResult: BardoResult | null;

  // Actions
  setPhase: (p: GamePhase) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  seedRun: (a: SeedRunArgs) => void;
  updateRun: (rs: RunState, s: StreakState, nr: NameRegistry) => void;
  setTurnResult: (tr: TurnResult | null) => void;
  setBardoResult: (br: BardoResult | null) => void;
  appendSeenEvent: (eventId: string) => void;
  resetRun: () => void;
  reset: () => void;
}

const INITIAL: Pick<GameStoreState,
  'phase' | 'isLoading' | 'error' | 'runState' | 'streak' |
  'nameRegistry' | 'lifetimeSeenEvents' | 'turnResult' | 'bardoResult'
> = {
  phase: GamePhase.TITLE,
  isLoading: false,
  error: null,
  runState: null,
  streak: null,
  nameRegistry: null,
  lifetimeSeenEvents: [],
  turnResult: null,
  bardoResult: null,
};

export const useGameStore = create<GameStoreState>((set) => ({
  ...INITIAL,

  setPhase: (phase) => set({ phase }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  seedRun: ({ runState, streak, nameRegistry, lifetimeSeenEvents }) =>
    set({ runState, streak, nameRegistry, lifetimeSeenEvents }),

  updateRun: (runState, streak, nameRegistry) =>
    set({ runState, streak, nameRegistry }),

  setTurnResult: (turnResult) => set({ turnResult }),
  setBardoResult: (bardoResult) => set({ bardoResult }),

  appendSeenEvent: (eventId) => set((prev) => ({
    lifetimeSeenEvents: prev.lifetimeSeenEvents.includes(eventId)
      ? prev.lifetimeSeenEvents
      : [...prev.lifetimeSeenEvents, eventId],
  })),

  resetRun: () => set({
    runState: null,
    streak: null,
    nameRegistry: null,
    lifetimeSeenEvents: [],
    turnResult: null,
    bardoResult: null,
  }),

  reset: () => set(INITIAL),
}));
```

- [ ] **Step 4: Run tests → GREEN**

```bash
npm test -- gameStore
```

Expected: 7 passing.

- [ ] **Step 5: Failing tests for `metaStore` hydrate/toMetaState**

Open `src/state/metaStore.test.ts` (create if missing). Add:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useMetaStore } from './metaStore';
import { createEmptyMetaState, MetaState } from '@/engine/meta/MetaState';

describe('metaStore', () => {
  beforeEach(() => useMetaStore.getState().reset());

  it('hydrateFromMetaState replaces the store slice with MetaState fields', () => {
    const meta: MetaState = {
      ...createEmptyMetaState(),
      karmaBalance: 150,
      lifeCount: 3,
      ownedUpgrades: ['awakened_soul_1'],
      unlockedAnchors: ['true_random', 'peasant_farmer', 'outer_disciple'],
    };
    useMetaStore.getState().hydrateFromMetaState(meta);
    const s = useMetaStore.getState();
    expect(s.karmicInsight).toBe(150);
    expect(s.lifeCount).toBe(3);
    expect(s.unlockedAnchors).toContain('outer_disciple');
  });

  it('toMetaState round-trips hydrate output as an equivalent MetaState', () => {
    const meta = {
      ...createEmptyMetaState(),
      karmaBalance: 80,
      lifeCount: 2,
      ownedUpgrades: ['awakened_soul_1'],
    };
    useMetaStore.getState().hydrateFromMetaState(meta);
    const round = useMetaStore.getState().toMetaState();
    expect(round.karmaBalance).toBe(80);
    expect(round.lifeCount).toBe(2);
    expect(round.ownedUpgrades).toContain('awakened_soul_1');
  });
});
```

- [ ] **Step 6: Confirm red**

```bash
npm test -- metaStore
```

Expected: FAIL (new helpers missing).

- [ ] **Step 7: Extend `metaStore`**

Open `src/state/metaStore.ts`. Add at the top of the interface and in the `create` body:

```ts
import { create } from 'zustand';
import {
  createEmptyMetaState, LineageEntrySummary, MetaState,
} from '@/engine/meta/MetaState';

interface MetaStoreState {
  karmicInsight: number;
  heavenlyNotice: number;
  unlockedEchoes: string[];
  unlockedMemories: string[];
  unlockedAnchors: string[];
  ownedUpgrades: string[];
  lifeCount: number;
  lineage: LineageEntrySummary[];
  lifetimeSeenEvents: string[];

  addKarma: (n: number) => void;
  spendKarma: (n: number) => boolean;
  addNotice: (n: number) => void;
  unlockEcho: (id: string) => void;
  unlockMemory: (id: string) => void;
  unlockAnchor: (id: string) => void;
  incrementLifeCount: () => void;
  reset: () => void;

  hydrateFromMetaState: (m: MetaState) => void;
  toMetaState: () => MetaState;
}

const INITIAL_META = createEmptyMetaState();

const INITIAL: Omit<MetaStoreState,
  'addKarma' | 'spendKarma' | 'addNotice' | 'unlockEcho' | 'unlockMemory' |
  'unlockAnchor' | 'incrementLifeCount' | 'reset' | 'hydrateFromMetaState' | 'toMetaState'
> = {
  karmicInsight: INITIAL_META.karmaBalance,
  heavenlyNotice: 0,
  unlockedEchoes: [],
  unlockedMemories: [],
  unlockedAnchors: [...INITIAL_META.unlockedAnchors],
  ownedUpgrades: [...INITIAL_META.ownedUpgrades],
  lifeCount: INITIAL_META.lifeCount,
  lineage: [...INITIAL_META.lineage],
  lifetimeSeenEvents: [...INITIAL_META.lifetimeSeenEvents],
};

export const useMetaStore = create<MetaStoreState>((set, get) => ({
  ...INITIAL,

  addKarma: (n) => set((s) => ({ karmicInsight: s.karmicInsight + Math.max(0, n) })),
  spendKarma: (n) => {
    const s = get();
    if (s.karmicInsight < n) return false;
    set({ karmicInsight: s.karmicInsight - n });
    return true;
  },
  addNotice: (n) => set((s) => ({ heavenlyNotice: Math.max(0, s.heavenlyNotice + n) })),
  unlockEcho: (id) => set((s) => s.unlockedEchoes.includes(id)
    ? s : { unlockedEchoes: [...s.unlockedEchoes, id] }),
  unlockMemory: (id) => set((s) => s.unlockedMemories.includes(id)
    ? s : { unlockedMemories: [...s.unlockedMemories, id] }),
  unlockAnchor: (id) => set((s) => s.unlockedAnchors.includes(id)
    ? s : { unlockedAnchors: [...s.unlockedAnchors, id] }),
  incrementLifeCount: () => set((s) => ({ lifeCount: s.lifeCount + 1 })),
  reset: () => set(INITIAL),

  hydrateFromMetaState: (m) => set({
    karmicInsight: m.karmaBalance,
    unlockedAnchors: [...m.unlockedAnchors],
    ownedUpgrades: [...m.ownedUpgrades],
    lifeCount: m.lifeCount,
    lineage: [...m.lineage],
    lifetimeSeenEvents: [...m.lifetimeSeenEvents],
  }),

  toMetaState: (): MetaState => {
    const s = get();
    return {
      karmaBalance: s.karmicInsight,
      lifeCount: s.lifeCount,
      ownedUpgrades: [...s.ownedUpgrades],
      unlockedAnchors: [...s.unlockedAnchors],
      lineage: [...s.lineage],
      lifetimeSeenEvents: [...s.lifetimeSeenEvents],
    };
  },
}));
```

**Note:** If the existing `metaStore` has a field shape that differs (e.g., `karmicInsight` named differently), preserve any existing field names used by UI components — but make sure `hydrateFromMetaState` and `toMetaState` map correctly between the two vocabularies. This plan uses `karmicInsight` ↔ `karmaBalance` as the translation key; keep both until the UI in Task 9 settles.

- [ ] **Step 8: Run tests → GREEN**

```bash
npm test -- metaStore
```

Expected: pass (both old and new).

- [ ] **Step 9: Typecheck + commit**

```bash
npm run typecheck
git add src/state/gameStore.ts src/state/gameStore.test.ts \
        src/state/metaStore.ts src/state/metaStore.test.ts
git commit -m "feat(state): extend gameStore with engine state; MetaState hydration"
```

---

## Task 4: `engineBridge.loadOrInit` + `beginLife`

**Files:**
- Modify: `src/services/engineBridge.ts` — real implementations, reshape payload types.
- Create: `src/services/engineBridge.test.ts`

**Rationale:** This is the first bridge task that actually touches the engine. `loadOrInit` hydrates stores from persisted saves (if any) and decides the initial phase. `beginLife` resolves an anchor → creates a character → seeds stores → autosaves → returns something the UI can display.

### New payload shapes

Reshape `TurnData`, `BardoPayload`, `CreationPayload` to match what the actual engine produces.

New type in `engineBridge.ts`:

```ts
export interface TurnPreview {
  narrative: string;
  // Minimal status strip inputs:
  name: string;
  ageYears: number;
  hpCurrent: number;
  hpMax: number;
  qiCurrent: number;
  qiMax: number;
  realm: string;
  insight: number;
  // Choices for the *next* turn — the event selector runs inside chooseAction,
  // so beginLife exposes the choices of the first selected event.
  choices: Array<{ id: string; label: string }>;
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
}

export interface CreationPayload {
  availableAnchors: ReadonlyArray<{ id: string; name: string; description: string }>;
}
```

(Delete the old `TurnData` export in this file if unused — but keep `GameChoice`, `CharacterStatus` in `core/Types.ts` in case PR #6 still imports them; remove usages in this file only.)

- [ ] **Step 1: Failing test first**

Create `src/services/engineBridge.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createSaveManager } from '@/engine/persistence/SaveManager';
import { createEngineBridge } from './engineBridge';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';
import { GamePhase } from '@/engine/core/Types';

describe('engineBridge.loadOrInit', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('returns TITLE phase when no save exists', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm });
    const result = await engine.loadOrInit();
    expect(result.phase).toBe(GamePhase.TITLE);
    expect(result.hasSave).toBe(false);
  });

  it('hydrates meta and reports a save when wdr.meta exists', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    // Pre-populate a saved meta state
    sm.save('wdr.meta', {
      karmaBalance: 120,
      lifeCount: 2,
      ownedUpgrades: ['awakened_soul_1'],
      unlockedAnchors: ['true_random', 'peasant_farmer'],
      lineage: [],
      lifetimeSeenEvents: [],
    }, 1);
    const engine = createEngineBridge({ saveManager: sm });
    const result = await engine.loadOrInit();
    expect(result.hasSave).toBe(true);
    expect(useMetaStore.getState().karmicInsight).toBe(120);
    expect(useMetaStore.getState().lifeCount).toBe(2);
  });
});

describe('engineBridge.beginLife', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('throws if the anchorId is unknown', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm });
    await expect(engine.beginLife('not_an_anchor', 'Test Name'))
      .rejects.toThrow(/unknown anchor/i);
  });

  it('spawns a character, seeds the store, and returns a TurnPreview', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm });
    const tp = await engine.beginLife('peasant_farmer', 'Lin Wei');

    expect(tp.name).toBe('Lin Wei');
    expect(tp.ageYears).toBeGreaterThanOrEqual(10);
    expect(tp.ageYears).toBeLessThanOrEqual(14);
    expect(tp.hpMax).toBeGreaterThan(0);
    expect(typeof tp.narrative).toBe('string');
    expect(tp.choices.length).toBeGreaterThan(0);

    const gs = useGameStore.getState();
    expect(gs.runState).not.toBeNull();
    expect(gs.streak).not.toBeNull();
    expect(gs.phase).toBe(GamePhase.PLAYING);
  });

  it('autosaves the run after beginLife', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm });
    await engine.beginLife('peasant_farmer', 'Lin Wei');
    expect(sm.load('wdr.run')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Confirm red**

```bash
npm test -- engineBridge
```

Expected: FAIL (the bridge still throws `NOT_IMPLEMENTED`, `createEngineBridge` doesn't accept `{ saveManager }`).

- [ ] **Step 3: Replace `engineBridge.ts` implementation**

Rewrite `src/services/engineBridge.ts`. Keep the existing pure-data types (`MetaSnapshot`, `LineageEntry`, `CodexSnapshot`) but add the new payloads and inject dependencies:

```ts
// Real engineBridge — adapter from UI → engine. Source: docs/spec/design.md §2, §11.

import { GamePhase } from '@/engine/core/Types';
import { SaveManager, createSaveManager } from '@/engine/persistence/SaveManager';
import { loadRun, saveRun, clearRun } from '@/engine/persistence/RunSave';
import {
  MetaState, loadMeta, saveMeta, addKarma as metaAddKarma,
  purchaseUpgrade, appendLineageEntry, incrementLifeCount, createEmptyMetaState,
  LineageEntrySummary,
} from '@/engine/meta/MetaState';
import { getAnchorById, DEFAULT_ANCHORS, AnchorDef } from '@/engine/meta/Anchor';
import { resolveAnchor } from '@/engine/meta/AnchorResolver';
import { characterFromAnchor } from '@/engine/meta/characterFromAnchor';
import { DEFAULT_UPGRADES, getUpgradeById, KarmicUpgrade } from '@/engine/meta/KarmicUpgrade';
import { runTurn } from '@/engine/core/GameLoop';
import { runBardoFlow } from '@/engine/bardo/BardoFlow';
import { createRng } from '@/engine/core/RNG';
import { createStreakState } from '@/engine/choices/StreakTracker';
import { createSnippetLibrary, SnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { createNameRegistry } from '@/engine/narrative/NameRegistry';
import { computeDominantMood, zeroMoodInputs } from '@/engine/narrative/Mood';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';
import { FIXTURE_EVENTS } from '@/content/events/fixture';

export interface LoadOrInitResult {
  phase: GamePhase;
  hasSave: boolean;
}

export interface TurnPreview {
  narrative: string;
  name: string;
  ageYears: number;
  hpCurrent: number;
  hpMax: number;
  qiCurrent: number;
  qiMax: number;
  realm: string;
  insight: number;
  choices: Array<{ id: string; label: string }>;
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
}

export interface CreationPayload {
  availableAnchors: ReadonlyArray<{ id: string; name: string; description: string }>;
}

export interface MetaSnapshot {
  karmicInsight: number;
  heavenlyNotice: number;
  lifeCount: number;
  unlockedEchoes: readonly string[];
  unlockedMemories: readonly string[];
  unlockedAnchors: readonly string[];
}

export interface LineageEntry extends LineageEntrySummary {}
export interface CodexSnapshot {
  memories: readonly string[];
  echoes: readonly string[];
  anchors: readonly string[];
}

export interface EngineBridge {
  loadOrInit(): Promise<LoadOrInitResult>;
  beginLife(anchorId: string, chosenName: string): Promise<TurnPreview>;
  chooseAction(choiceId: string): Promise<TurnPreview | BardoPayload>;
  beginBardo(): Promise<BardoPayload>;
  spendKarma(upgradeId: string): Promise<BardoPayload>;
  reincarnate(): Promise<CreationPayload>;
  listAnchors(): CreationPayload;
  getMetaSummary(): MetaSnapshot;
  getLineage(): ReadonlyArray<LineageEntry>;
  getCodex(): CodexSnapshot;
}

interface BridgeOpts {
  saveManager?: SaveManager;
  library?: SnippetLibrary;
  now?: () => number;   // for deterministic test seeds
}

export function createEngineBridge(opts: BridgeOpts = {}): EngineBridge {
  const sm = opts.saveManager ?? createSaveManager({
    storage: () => localStorage, gameVersion: '0.1.0',
  });
  const library = opts.library ?? createSnippetLibrary({});
  const now = opts.now ?? (() => Date.now());

  // ---- helpers ----

  function anchorMultiplierFor(anchorId: string): number {
    return getAnchorById(anchorId)?.karmaMultiplier ?? 1.0;
  }

  function currentMetaState(): MetaState {
    return useMetaStore.getState().toMetaState();
  }

  function hydrateMeta(meta: MetaState) {
    useMetaStore.getState().hydrateFromMetaState(meta);
  }

  function buildTurnPreview(narrative: string, choices: Array<{ id: string; label: string }>): TurnPreview {
    const gs = useGameStore.getState();
    if (!gs.runState) throw new Error('buildTurnPreview: no runState in store');
    const rs = gs.runState;
    return {
      narrative,
      name: rs.character.name,
      ageYears: Math.floor(rs.character.ageDays / 365),
      hpCurrent: rs.character.hp,
      hpMax: rs.character.hpMax,
      qiCurrent: rs.character.qi,
      qiMax: rs.character.qiMax,
      realm: rs.character.realm,
      insight: rs.character.insight,
      choices,
    };
  }

  function decorateUpgrades(meta: MetaState): BardoPayload['availableUpgrades'] {
    return DEFAULT_UPGRADES.map((u) => {
      const owned = meta.ownedUpgrades.includes(u.id);
      const requirementsMet = u.requires.every((r) => meta.ownedUpgrades.includes(r));
      const affordable = meta.karmaBalance >= u.cost;
      return {
        id: u.id, name: u.name, description: u.description, cost: u.cost,
        affordable, requirementsMet, owned,
      };
    });
  }

  function buildBardoPayload(): BardoPayload {
    const gs = useGameStore.getState();
    const meta = currentMetaState();
    if (!gs.bardoResult) throw new Error('buildBardoPayload: no bardoResult in store');
    const br = gs.bardoResult;
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
    };
  }

  // ---- API ----

  return {
    async loadOrInit() {
      const meta = loadMeta(sm);
      hydrateMeta(meta);
      const runEnvelope = loadRun(sm);
      const hasSave = !!runEnvelope;

      if (hasSave) {
        // Phase 1D-2 simplification: resume straight into PLAYING. Full state-machine
        // restoration (CREATION vs BARDO mid-flow) is deferred to Phase 2.
        useGameStore.getState().setPhase(GamePhase.PLAYING);
      } else {
        useGameStore.getState().setPhase(GamePhase.TITLE);
      }

      return {
        phase: useGameStore.getState().phase,
        hasSave,
      };
    },

    async beginLife(anchorId, chosenName) {
      const anchor = getAnchorById(anchorId);
      if (!anchor) throw new Error(`beginLife: unknown anchor ${anchorId}`);

      // Seed an RNG deterministically off now(). Phase 2 may want to persist this seed.
      const spawnRng = createRng(now() & 0xffffffff);
      const resolved = resolveAnchor(anchor, spawnRng);
      const runSeed = Math.floor(Math.random() * 0x7fffffff);
      const { character, runState } = characterFromAnchor({
        resolved, name: chosenName, runSeed, rng: spawnRng,
      });

      // Tag the character with anchor:<id> so BardoFlow picks it up for lineage.
      const taggedCharacter = {
        ...character,
        flags: [...character.flags, `anchor:${anchor.id}`],
      };
      const taggedRun = { ...runState, character: taggedCharacter };

      useGameStore.getState().seedRun({
        runState: taggedRun,
        streak: createStreakState(),
        nameRegistry: createNameRegistry(),
        lifetimeSeenEvents: [...useMetaStore.getState().lifetimeSeenEvents],
      });
      useGameStore.getState().setPhase(GamePhase.PLAYING);
      saveRun(sm, taggedRun);

      // Render a first-turn preview by actually running the event selector and composer,
      // but DO NOT resolve a check — the player hasn't chosen yet. We produce a "peek"
      // using the same selectEvent + composer pipeline and surface the choices.
      // For Phase 1D-2 simplicity: just return a short intro narrative.
      return buildTurnPreview(
        `${chosenName} steps into the world. The dust of the plains is in the air.`,
        [], // First "preview" has no choices; UI should immediately call chooseAction with a dummy — see PlayScreen design in Task 8.
      );
    },

    async chooseAction(_choiceId) {
      throw new Error('chooseAction: implemented in Task 5');
    },
    async beginBardo() { throw new Error('beginBardo: implemented in Task 6'); },
    async spendKarma(_upgradeId) { throw new Error('spendKarma: implemented in Task 6'); },
    async reincarnate() { throw new Error('reincarnate: implemented in Task 6'); },

    listAnchors() {
      const meta = currentMetaState();
      const available = DEFAULT_ANCHORS.filter((a) =>
        a.unlock === 'default' || meta.unlockedAnchors.includes(a.id),
      );
      return {
        availableAnchors: available.map((a) => ({
          id: a.id, name: a.name, description: a.description,
        })),
      };
    },

    getMetaSummary() {
      const m = useMetaStore.getState();
      return {
        karmicInsight: m.karmicInsight,
        heavenlyNotice: m.heavenlyNotice,
        lifeCount: m.lifeCount,
        unlockedEchoes: m.unlockedEchoes,
        unlockedMemories: m.unlockedMemories,
        unlockedAnchors: m.unlockedAnchors,
      };
    },

    getLineage() {
      return useMetaStore.getState().lineage;
    },

    getCodex() {
      const m = useMetaStore.getState();
      return {
        memories: m.unlockedMemories,
        echoes: m.unlockedEchoes,
        anchors: m.unlockedAnchors,
      };
    },
  };
}
```

**Important deviations from Phase 0 bridge types:**
- `loadOrInit` returns `{ phase, hasSave }` instead of `{ phase, turn? }`.
- `chooseAction` return changed to `TurnPreview | BardoPayload` (returns bardo if death triggered).
- `createEngineBridge` now takes `{ saveManager, library?, now? }` — callers in `App.tsx` and tests pass their own save manager.

Update the bridge file to export the new types and remove the Phase 0 `NOT_IMPLEMENTED` helper.

- [ ] **Step 4: Run tests → GREEN**

```bash
npm test -- engineBridge
```

Expected: 5 passing (3 loadOrInit + 2 beginLife). **Note**: `beginLife` is expected to return a preview with empty `choices` for Task 4 — the UI's first click on the play screen will trigger `chooseAction`, which Task 5 implements. That's OK.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Fix any type errors surfaced by the new bridge shape (especially `TurnData` → `TurnPreview` renames if they propagate into `App.tsx`). For Task 4 the only existing caller of the bridge is `App.tsx`; it doesn't unpack `TurnData` yet, so the compiler should be quiet. If `App.tsx` imports `TurnData` from `engineBridge`, change it to `TurnPreview`.

- [ ] **Step 6: Commit**

```bash
git add src/services/engineBridge.ts src/services/engineBridge.test.ts
git commit -m "feat(bridge): loadOrInit + beginLife wired to engine + SaveManager"
```

---

## Task 5: `engineBridge.chooseAction` (+ death → BARDO transition)

**Files:**
- Modify: `src/services/engineBridge.ts` — implement `chooseAction`.
- Modify: `src/services/engineBridge.test.ts` — add chooseAction tests.

**Rationale:** Player clicks a choice button → bridge consults `store.runState`, builds a `TurnContext`, calls `GameLoop.runTurn`, writes the result back to the store, autosaves, and returns either a `TurnPreview` (alive) or triggers a transition to the BARDO phase (dead).

- [ ] **Step 1: Failing tests**

Append to `src/services/engineBridge.test.ts`:

```ts
describe('engineBridge.chooseAction', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('throws if called without an active run', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm });
    await expect(engine.chooseAction('ch_walk')).rejects.toThrow(/no active run/i);
  });

  it('advances the turn and returns a TurnPreview when alive', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 1 });
    await engine.beginLife('peasant_farmer', 'Lin');

    // Task 5 uses the first selectable fixture event's first choice id
    // (either FX_BENIGN_DAY.ch_work, FX_TRAIN_BODY.ch_train, or FX_BANDIT.ch_fight
    // depending on selector). We loop through both safe choices so the test is
    // robust across which event fires.
    let result;
    for (const choiceId of ['ch_work', 'ch_train', 'ch_fight']) {
      try {
        result = await engine.chooseAction(choiceId);
        break;
      } catch (e: any) {
        if (!/choice.*not found/i.test(e.message)) throw e;
      }
    }
    expect(result).toBeDefined();
    // If alive, result has a `narrative` and `choices`.
    // If died (unlikely on turn 1 with these stats), it's a BardoPayload.
    if ('narrative' in result!) {
      expect(typeof result.narrative).toBe('string');
      expect(useGameStore.getState().runState!.turn).toBe(1);
    } else {
      expect(useGameStore.getState().phase).toBe(GamePhase.BARDO);
    }
  });
});
```

- [ ] **Step 2: Confirm red**

```bash
npm test -- engineBridge
```

Expected: FAIL on the new `chooseAction` tests.

- [ ] **Step 3: Implement `chooseAction` in `engineBridge.ts`**

Replace the `async chooseAction(_choiceId) { throw ... }` stub with:

```ts
    async chooseAction(choiceId) {
      const gs = useGameStore.getState();
      if (!gs.runState || !gs.streak || !gs.nameRegistry) {
        throw new Error('chooseAction: no active run in store');
      }

      // Seeded off the runState's rng cursor for determinism.
      const rng = createRng(
        (gs.runState.rngState?.cursor ?? gs.runState.runSeed) & 0xffffffff,
      );

      const tr = runTurn(
        {
          runState: gs.runState,
          streak: gs.streak,
          events: FIXTURE_EVENTS,
          library,
          nameRegistry: gs.nameRegistry,
          lifetimeSeenEvents: gs.lifetimeSeenEvents,
          dominantMood: computeDominantMood(zeroMoodInputs()),
        },
        choiceId,
        rng,
      );

      useGameStore.getState().updateRun(tr.nextRunState, tr.nextStreak, tr.nextNameRegistry);
      useGameStore.getState().setTurnResult(tr);
      useGameStore.getState().appendSeenEvent(tr.eventId);
      saveRun(sm, tr.nextRunState);

      // Death check — transition to BARDO.
      if (tr.nextRunState.deathCause) {
        const anchorFlag = tr.nextRunState.character.flags.find((f) => f.startsWith('anchor:'));
        const anchorId = anchorFlag ? anchorFlag.slice(7) : 'unknown';
        const mult = anchorMultiplierFor(anchorId);
        const bardo = runBardoFlow(tr.nextRunState, currentMetaState(), mult);
        useGameStore.getState().setBardoResult(bardo);
        hydrateMeta(bardo.meta);
        saveMeta(sm, bardo.meta);
        useGameStore.getState().setPhase(GamePhase.BARDO);
        return buildBardoPayload();
      }

      // Still alive — build a preview for the next turn's choices.
      // The UI shows the narrative that just happened plus the choices of whatever
      // the selector returns NEXT. We peek at the next selection by *not* re-selecting
      // here — instead, the PlayScreen (Task 8) simply renders `turnResult.narrative`
      // and the choices from the event just fired. The "next event" selection happens
      // inside the NEXT chooseAction call.
      //
      // For this preview, we surface the CURRENT event's choices so the player can
      // continue engaging with the active event (most fixture events are
      // repeat: 'unlimited'). Real event corpus in 1D-3 will drive this more naturally.
      const activeEvent = FIXTURE_EVENTS.find((e) => e.id === tr.eventId)!;
      return buildTurnPreview(
        tr.narrative,
        activeEvent.choices.map((c) => ({ id: c.id, label: c.label })),
      );
    },
```

**Note on the choices loop:** Phase 1D-2 shows the choices of the event that just fired — which for the three fixture events are all single-choice, so the player keeps clicking until either the event is no-longer-selectable or death triggers. This is the minimum viable play loop. Phase 1D-3 will add `selectEvent` peek ahead + richer UI.

- [ ] **Step 4: Run tests → GREEN**

```bash
npm test -- engineBridge
```

Expected: all previous passing + 2 new passing.

- [ ] **Step 5: Full suite sanity**

```bash
npm test
npm run typecheck
```

Expected: green. Phase 1D-1 integration test (`life_cycle_with_bardo`) should still pass — it tests the engine directly, not the bridge.

- [ ] **Step 6: Commit**

```bash
git add src/services/engineBridge.ts src/services/engineBridge.test.ts
git commit -m "feat(bridge): chooseAction calls runTurn + auto-transitions to BARDO on death"
```

---

## Task 6: `engineBridge.beginBardo` + `spendKarma` + `reincarnate`

**Files:**
- Modify: `src/services/engineBridge.ts` — implement remaining three methods.
- Modify: `src/services/engineBridge.test.ts` — add tests.

**Rationale:** Close the life cycle.
- `beginBardo` is mostly a no-op in this phase because `chooseAction` already triggers the bardo on death. It exists for the UI to call if the player navigates manually, and for load/resume scenarios. Idempotent: if `bardoResult` is already in the store, return its derived payload.
- `spendKarma` calls `purchaseUpgrade` on MetaState, re-hydrates the store, persists, and returns a refreshed `BardoPayload`.
- `reincarnate` clears the run save, resets the store's run slice, advances phase to `CREATION`.

- [ ] **Step 1: Failing tests**

Append to `src/services/engineBridge.test.ts`:

```ts
describe('engineBridge.beginBardo (manual)', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('returns the existing BardoPayload if chooseAction already transitioned', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 2 });

    await engine.beginLife('peasant_farmer', 'Lin');
    // Force a death by running many turns. We use ch_fight which is unforgiving.
    // Loop until BARDO or a cap.
    let transitioned = false;
    for (let i = 0; i < 100 && !transitioned; i++) {
      for (const c of ['ch_fight', 'ch_work', 'ch_train']) {
        try {
          const r = await engine.chooseAction(c);
          if ('karmaEarned' in r) { transitioned = true; break; }
        } catch (e: any) {
          if (!/choice.*not found/i.test(e.message)) throw e;
        }
      }
    }
    expect(transitioned).toBe(true);

    const bardo = await engine.beginBardo();
    expect(bardo.karmaEarned).toBeGreaterThanOrEqual(0);
    expect(bardo.availableUpgrades.length).toBe(5);
  });

  it('throws if there is no active bardo and no death', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm });
    await engine.beginLife('peasant_farmer', 'Lin');
    await expect(engine.beginBardo()).rejects.toThrow(/no bardo/i);
  });
});

describe('engineBridge.spendKarma', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('purchases an affordable unblocked upgrade and refreshes the payload', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    // Seed a MetaState with enough karma for awakened_soul_1 (80).
    sm.save('wdr.meta', {
      karmaBalance: 500, lifeCount: 1, ownedUpgrades: [],
      unlockedAnchors: ['true_random', 'peasant_farmer'],
      lineage: [{
        lifeIndex: 1, name: 'Ancestor', anchorId: 'peasant_farmer',
        yearsLived: 40, realmReached: 'mortal', deathCause: 'old_age', karmaEarned: 500,
      }],
      lifetimeSeenEvents: [],
    }, 1);
    const engine = createEngineBridge({ saveManager: sm });
    await engine.loadOrInit();

    // We need a bardoResult to be in the store for spendKarma to return a payload.
    // Synthesize one by running one life to completion.
    await engine.beginLife('peasant_farmer', 'Lin');
    for (let i = 0; i < 200 && useGameStore.getState().phase !== GamePhase.BARDO; i++) {
      for (const c of ['ch_fight', 'ch_work', 'ch_train']) {
        try { await engine.chooseAction(c); break; }
        catch (e: any) { if (!/choice.*not found/i.test(e.message)) throw e; }
      }
    }
    expect(useGameStore.getState().phase).toBe(GamePhase.BARDO);

    const payload = await engine.spendKarma('awakened_soul_1');
    expect(payload.ownedUpgrades).toContain('awakened_soul_1');
    expect(useMetaStore.getState().karmicInsight).toBeLessThan(500); // deducted
    // Save persisted:
    expect(sm.load('wdr.meta')).not.toBeNull();
  });

  it('rejects with a useful error when upgrade unknown / locked / unaffordable', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm });
    await engine.beginLife('peasant_farmer', 'Lin');
    // Force bardo as above
    for (let i = 0; i < 200 && useGameStore.getState().phase !== GamePhase.BARDO; i++) {
      for (const c of ['ch_fight', 'ch_work', 'ch_train']) {
        try { await engine.chooseAction(c); break; }
        catch (e: any) { if (!/choice.*not found/i.test(e.message)) throw e; }
      }
    }
    await expect(engine.spendKarma('not_an_upgrade'))
      .rejects.toThrow(/unknown.*upgrade|cannot purchase/i);
  });
});

describe('engineBridge.reincarnate', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('clears the run save and advances phase to CREATION', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm });
    await engine.beginLife('peasant_farmer', 'Lin');
    expect(sm.load('wdr.run')).not.toBeNull();

    // Force bardo by any means — not strictly required for reincarnate, but realistic.
    const result = await engine.reincarnate();
    expect(sm.load('wdr.run')).toBeNull();
    expect(useGameStore.getState().phase).toBe(GamePhase.CREATION);
    expect(result.availableAnchors.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Confirm red**

```bash
npm test -- engineBridge
```

Expected: FAIL on the new tests.

- [ ] **Step 3: Implement the three methods**

Replace the corresponding stubs in `engineBridge.ts`:

```ts
    async beginBardo() {
      const gs = useGameStore.getState();
      if (gs.bardoResult) {
        return buildBardoPayload();
      }
      // Compute from runState if character is dead but chooseAction didn't trigger
      // (e.g., after a save that captured death mid-frame). Rare path.
      if (gs.runState?.deathCause) {
        const anchorFlag = gs.runState.character.flags.find((f) => f.startsWith('anchor:'));
        const anchorId = anchorFlag ? anchorFlag.slice(7) : 'unknown';
        const mult = anchorMultiplierFor(anchorId);
        const bardo = runBardoFlow(gs.runState, currentMetaState(), mult);
        useGameStore.getState().setBardoResult(bardo);
        hydrateMeta(bardo.meta);
        saveMeta(sm, bardo.meta);
        useGameStore.getState().setPhase(GamePhase.BARDO);
        return buildBardoPayload();
      }
      throw new Error('beginBardo: no bardo state — character is still alive');
    },

    async spendKarma(upgradeId) {
      const gs = useGameStore.getState();
      if (!gs.bardoResult) {
        throw new Error('spendKarma: no active bardo session');
      }
      const upgrade = getUpgradeById(upgradeId);
      if (!upgrade) throw new Error(`spendKarma: unknown upgrade ${upgradeId}`);

      const meta = currentMetaState();
      const next = purchaseUpgrade(meta, upgradeId);
      if (!next) {
        throw new Error(`spendKarma: cannot purchase ${upgradeId} (locked, unaffordable, or already owned)`);
      }
      hydrateMeta(next);
      saveMeta(sm, next);
      return buildBardoPayload();
    },

    async reincarnate() {
      clearRun(sm);
      useGameStore.getState().resetRun();
      useGameStore.getState().setPhase(GamePhase.CREATION);
      return {
        availableAnchors: DEFAULT_ANCHORS
          .filter((a) => a.unlock === 'default'
            || useMetaStore.getState().unlockedAnchors.includes(a.id))
          .map((a) => ({ id: a.id, name: a.name, description: a.description })),
      };
    },
```

- [ ] **Step 4: Run tests → GREEN**

```bash
npm test -- engineBridge
npm test
npm run typecheck
```

Expected: all green. The `spendKarma` test relies on the character actually reaching the bardo state — if the `ch_fight` loop doesn't kill within the cap on some seeds, the test might miss the assertion. If it fails flakily, replace the loop with a shorter deterministic-death path:
- Spawn a character, force `runState.character.hp = 0` via store mutation just before asserting `phase === BARDO`.

Do not commit with a flaky test. If the loop approach needs hardening, extract a small helper `forceLifeToEnd(engine)` in the test file.

- [ ] **Step 5: Commit**

```bash
git add src/services/engineBridge.ts src/services/engineBridge.test.ts
git commit -m "feat(bridge): beginBardo + spendKarma + reincarnate close the life cycle"
```

---

## Task 7: `CreationScreen` component

**Files:**
- Create: `src/components/CreationScreen.tsx`
- Create: `src/components/CreationScreen.test.tsx`

**Rationale:** Screen 2 in the phase flow. User picks an anchor and types a name; clicking "Begin Life" invokes the callback that `App.tsx` will wire to `engine.beginLife`. Pure presentational component, no store reads (the anchors come via props so the test can mock the list cleanly).

### Props

```ts
export interface CreationScreenProps {
  anchors: ReadonlyArray<{ id: string; name: string; description: string }>;
  defaultName?: string;
  onBegin: (anchorId: string, name: string) => void | Promise<void>;
  onBack: () => void;
  isLoading?: boolean;
}
```

- [ ] **Step 1: Failing test**

Create `src/components/CreationScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreationScreen } from './CreationScreen';

const ANCHORS = [
  { id: 'peasant_farmer', name: 'Peasant Farmer', description: 'Born to the soil.' },
  { id: 'true_random', name: 'True Random', description: 'Let the Heavens decide.' },
];

describe('CreationScreen', () => {
  it('renders every available anchor', () => {
    render(<CreationScreen anchors={ANCHORS} onBegin={() => {}} onBack={() => {}} />);
    expect(screen.getByText('Peasant Farmer')).toBeInTheDocument();
    expect(screen.getByText('True Random')).toBeInTheDocument();
  });

  it('disables Begin Life until an anchor is selected and a name entered', async () => {
    render(<CreationScreen anchors={ANCHORS} onBegin={() => {}} onBack={() => {}} />);
    const begin = screen.getByRole('button', { name: /begin life/i });
    expect(begin).toBeDisabled();

    await userEvent.click(screen.getByText('Peasant Farmer'));
    // Name still empty
    expect(begin).toBeDisabled();

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.type(nameInput, 'Lin Wei');
    expect(begin).not.toBeDisabled();
  });

  it('calls onBegin with the selected anchor and trimmed name', async () => {
    const onBegin = vi.fn();
    render(<CreationScreen anchors={ANCHORS} onBegin={onBegin} onBack={() => {}} />);
    await userEvent.click(screen.getByText('Peasant Farmer'));
    await userEvent.type(screen.getByLabelText(/name/i), '  Lin Wei  ');
    await userEvent.click(screen.getByRole('button', { name: /begin life/i }));
    expect(onBegin).toHaveBeenCalledWith('peasant_farmer', 'Lin Wei');
  });

  it('calls onBack when the back button is clicked', async () => {
    const onBack = vi.fn();
    render(<CreationScreen anchors={ANCHORS} onBegin={() => {}} onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows a loading state and disables inputs when isLoading=true', () => {
    render(<CreationScreen anchors={ANCHORS} onBegin={() => {}} onBack={() => {}} isLoading />);
    expect(screen.getByRole('button', { name: /begin life/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Confirm red**

```bash
npm test -- CreationScreen
```

Expected: FAIL (component missing).

- [ ] **Step 3: Implement the component**

Create `src/components/CreationScreen.tsx`:

```tsx
import { useState } from 'react';

export interface CreationScreenProps {
  anchors: ReadonlyArray<{ id: string; name: string; description: string }>;
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
        {props.anchors.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setSelectedAnchor(a.id)}
            disabled={props.isLoading}
            className={`text-left px-4 py-3 border rounded transition
              ${selectedAnchor === a.id
                ? 'border-jade-400 bg-ink-800'
                : 'border-parchment-700 hover:border-parchment-500'}`}
          >
            <div className="text-xl text-jade-300">{a.name}</div>
            <div className="text-sm text-parchment-400">{a.description}</div>
          </button>
        ))}
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
          className="w-full px-3 py-2 bg-ink-900 border border-parchment-700 rounded
                     text-parchment-100 focus:border-jade-400 focus:outline-none"
          placeholder="Lin Wei"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={props.onBack}
          className="px-4 py-2 border border-parchment-700 rounded hover:border-parchment-500"
        >
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

- [ ] **Step 4: Run tests → GREEN**

```bash
npm test -- CreationScreen
```

Expected: 5 passing.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/components/CreationScreen.tsx src/components/CreationScreen.test.tsx
git commit -m "feat(ui): CreationScreen (anchor picker + name entry)"
```

---

## Task 8: `PlayScreen` component

**Files:**
- Create: `src/components/PlayScreen.tsx`
- Create: `src/components/PlayScreen.test.tsx`

**Rationale:** Screen 3. Reads the current `TurnPreview` + `runState` and renders a narrative panel + a row of choice buttons + a status strip. Click → callback. Again, pure props — no store coupling inside the component.

### Props

```ts
export interface PlayScreenProps {
  preview: {
    narrative: string;
    name: string;
    ageYears: number;
    hpCurrent: number;
    hpMax: number;
    qiCurrent: number;
    qiMax: number;
    realm: string;
    insight: number;
    choices: Array<{ id: string; label: string }>;
  };
  onChoose: (choiceId: string) => void | Promise<void>;
  isLoading?: boolean;
}
```

- [ ] **Step 1: Failing test**

Create `src/components/PlayScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayScreen } from './PlayScreen';

const PREVIEW = {
  narrative: 'A crow landed on the fence post.',
  name: 'Lin Wei',
  ageYears: 12,
  hpCurrent: 50,
  hpMax: 60,
  qiCurrent: 10,
  qiMax: 20,
  realm: 'mortal',
  insight: 3,
  choices: [
    { id: 'ch_walk', label: 'Walk on.' },
    { id: 'ch_chase', label: 'Chase it.' },
  ],
};

describe('PlayScreen', () => {
  it('renders the narrative', () => {
    render(<PlayScreen preview={PREVIEW} onChoose={() => {}} />);
    expect(screen.getByText(/crow landed/i)).toBeInTheDocument();
  });

  it('renders the status strip', () => {
    render(<PlayScreen preview={PREVIEW} onChoose={() => {}} />);
    expect(screen.getByText(/lin wei/i)).toBeInTheDocument();
    expect(screen.getByText(/age 12/i)).toBeInTheDocument();
    expect(screen.getByText(/50 *\/ *60/i)).toBeInTheDocument();
    expect(screen.getByText(/mortal/i)).toBeInTheDocument();
  });

  it('renders every choice as a button', () => {
    render(<PlayScreen preview={PREVIEW} onChoose={() => {}} />);
    expect(screen.getByRole('button', { name: /walk on/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /chase it/i })).toBeInTheDocument();
  });

  it('calls onChoose with the choice id when a button is clicked', async () => {
    const onChoose = vi.fn();
    render(<PlayScreen preview={PREVIEW} onChoose={onChoose} />);
    await userEvent.click(screen.getByRole('button', { name: /chase it/i }));
    expect(onChoose).toHaveBeenCalledWith('ch_chase');
  });

  it('disables all choices when isLoading', () => {
    render(<PlayScreen preview={PREVIEW} onChoose={() => {}} isLoading />);
    for (const btn of screen.getAllByRole('button')) {
      expect(btn).toBeDisabled();
    }
  });

  it('shows a hint when the preview has zero choices (transitional state)', () => {
    render(
      <PlayScreen
        preview={{ ...PREVIEW, choices: [] }}
        onChoose={() => {}}
      />,
    );
    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Confirm red**

```bash
npm test -- PlayScreen
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement the component**

Create `src/components/PlayScreen.tsx`:

```tsx
export interface PlayScreenProps {
  preview: {
    narrative: string;
    name: string;
    ageYears: number;
    hpCurrent: number;
    hpMax: number;
    qiCurrent: number;
    qiMax: number;
    realm: string;
    insight: number;
    choices: Array<{ id: string; label: string }>;
  };
  onChoose: (choiceId: string) => void | Promise<void>;
  isLoading?: boolean;
}

export function PlayScreen({ preview, onChoose, isLoading }: PlayScreenProps) {
  return (
    <div className="min-h-screen bg-ink-950 text-parchment-100 flex flex-col font-serif">
      <header className="border-b border-parchment-800 bg-ink-900 px-6 py-3 flex justify-between items-center text-sm">
        <div>
          <span className="text-jade-300 mr-3">{preview.name}</span>
          <span className="text-parchment-400">age {preview.ageYears}</span>
        </div>
        <div className="flex gap-4 text-parchment-300">
          <span>HP {preview.hpCurrent} / {preview.hpMax}</span>
          <span>Qi {preview.qiCurrent} / {preview.qiMax}</span>
          <span>Insight {preview.insight}</span>
          <span className="uppercase text-parchment-500">{preview.realm}</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-8 max-w-3xl mx-auto w-full">
        <p className="text-lg leading-relaxed mb-8 whitespace-pre-line">
          {preview.narrative}
        </p>

        <div className="w-full flex flex-col gap-2">
          {preview.choices.length === 0 ? (
            <p className="text-parchment-500 italic text-center">Waiting for the world to move…</p>
          ) : (
            preview.choices.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={isLoading}
                onClick={() => onChoose(c.id)}
                className="px-4 py-3 border border-parchment-700 rounded text-left hover:border-jade-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {c.label}
              </button>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run tests → GREEN**

```bash
npm test -- PlayScreen
```

Expected: 6 passing.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/components/PlayScreen.tsx src/components/PlayScreen.test.tsx
git commit -m "feat(ui): PlayScreen (narrative + choices + status strip)"
```

---

## Task 9: `BardoPanel` component

**Files:**
- Create: `src/components/BardoPanel.tsx`
- Create: `src/components/BardoPanel.test.tsx`

**Rationale:** Screen 4. Shows the life summary card, karma breakdown, upgrade shop, and reincarnate button.

### Props

```ts
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
  };
  onBuyUpgrade: (upgradeId: string) => void | Promise<void>;
  onReincarnate: () => void | Promise<void>;
  isLoading?: boolean;
}
```

- [ ] **Step 1: Failing test**

Create `src/components/BardoPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BardoPanel } from './BardoPanel';

const PAYLOAD = {
  lifeIndex: 1,
  years: 42,
  realm: 'mortal',
  deathCause: 'old_age',
  karmaEarned: 14,
  karmaBreakdown: {
    yearsLived: 4,
    realm: 0,
    deathCause: 5,
    vows: 0,
    diedProtecting: 0,
    achievements: 5,
    inLifeDelta: 0,
  },
  karmaBalance: 14,
  ownedUpgrades: [],
  availableUpgrades: [
    { id: 'awakened_soul_1', name: 'Awakened Soul I', description: '10% re-roll',
      cost: 80, affordable: false, requirementsMet: true, owned: false },
    { id: 'heavenly_patience_1', name: 'Heavenly Patience I', description: 'Insight cap +20',
      cost: 100, affordable: false, requirementsMet: true, owned: false },
  ],
};

describe('BardoPanel', () => {
  it('renders the life summary card', () => {
    render(<BardoPanel payload={PAYLOAD} onBuyUpgrade={() => {}} onReincarnate={() => {}} />);
    expect(screen.getByText(/life 1/i)).toBeInTheDocument();
    expect(screen.getByText(/42 years/i)).toBeInTheDocument();
    expect(screen.getByText(/old_age/i)).toBeInTheDocument();
    expect(screen.getByText(/mortal/i)).toBeInTheDocument();
  });

  it('shows the karma earned and karma balance', () => {
    render(<BardoPanel payload={PAYLOAD} onBuyUpgrade={() => {}} onReincarnate={() => {}} />);
    expect(screen.getByText(/karma earned/i)).toBeInTheDocument();
    expect(screen.getByText(/14/)).toBeInTheDocument();
  });

  it('lists every available upgrade with an affordability indicator', () => {
    render(<BardoPanel payload={PAYLOAD} onBuyUpgrade={() => {}} onReincarnate={() => {}} />);
    expect(screen.getByText(/awakened soul i/i)).toBeInTheDocument();
    expect(screen.getByText(/heavenly patience i/i)).toBeInTheDocument();
  });

  it('disables the purchase button when unaffordable', () => {
    render(<BardoPanel payload={PAYLOAD} onBuyUpgrade={() => {}} onReincarnate={() => {}} />);
    const btn = screen.getByRole('button', { name: /awakened soul i/i });
    expect(btn).toBeDisabled();
  });

  it('enables the purchase button when affordable + requirements met', () => {
    const affordable = {
      ...PAYLOAD,
      karmaBalance: 200,
      availableUpgrades: [{ ...PAYLOAD.availableUpgrades[0], affordable: true }],
    };
    render(<BardoPanel payload={affordable} onBuyUpgrade={() => {}} onReincarnate={() => {}} />);
    const btn = screen.getByRole('button', { name: /awakened soul i/i });
    expect(btn).not.toBeDisabled();
  });

  it('calls onBuyUpgrade with the id when a purchase button is clicked', async () => {
    const onBuy = vi.fn();
    const affordable = {
      ...PAYLOAD,
      availableUpgrades: [{ ...PAYLOAD.availableUpgrades[0], affordable: true }],
    };
    render(<BardoPanel payload={affordable} onBuyUpgrade={onBuy} onReincarnate={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /awakened soul i/i }));
    expect(onBuy).toHaveBeenCalledWith('awakened_soul_1');
  });

  it('calls onReincarnate when the reincarnate button is clicked', async () => {
    const onRe = vi.fn();
    render(<BardoPanel payload={PAYLOAD} onBuyUpgrade={() => {}} onReincarnate={onRe} />);
    await userEvent.click(screen.getByRole('button', { name: /reincarnate/i }));
    expect(onRe).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Confirm red**

```bash
npm test -- BardoPanel
```

Expected: FAIL.

- [ ] **Step 3: Implement the component**

Create `src/components/BardoPanel.tsx`:

```tsx
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
  };
  onBuyUpgrade: (upgradeId: string) => void | Promise<void>;
  onReincarnate: () => void | Promise<void>;
  isLoading?: boolean;
}

export function BardoPanel({ payload, onBuyUpgrade, onReincarnate, isLoading }: BardoPanelProps) {
  return (
    <div className="min-h-screen bg-ink-950 text-parchment-100 flex flex-col items-center py-12 font-serif">
      <h2 className="text-3xl mb-8 text-jade-300">The Bardo</h2>

      {/* Life summary card */}
      <section className="w-full max-w-2xl bg-ink-900 border border-parchment-800 rounded p-6 mb-6">
        <h3 className="text-xl mb-2">Life {payload.lifeIndex}</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-parchment-300">
          <dt>Years lived</dt><dd>{payload.years} years</dd>
          <dt>Final realm</dt><dd>{payload.realm}</dd>
          <dt>Cause of death</dt><dd>{payload.deathCause}</dd>
        </dl>
      </section>

      {/* Karma breakdown */}
      <section className="w-full max-w-2xl bg-ink-900 border border-parchment-800 rounded p-6 mb-6">
        <h3 className="text-xl mb-4">Karma earned: <span className="text-jade-300">{payload.karmaEarned}</span></h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-parchment-400 text-sm">
          {Object.entries(payload.karmaBreakdown).map(([k, v]) => (
            <>
              <dt key={`dt-${k}`}>{k}</dt>
              <dd key={`dd-${k}`}>{v}</dd>
            </>
          ))}
        </dl>
        <p className="mt-4 text-parchment-300">
          Current balance: <span className="text-jade-300">{payload.karmaBalance}</span>
        </p>
      </section>

      {/* Upgrade shop */}
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

      {/* Reincarnate */}
      <button
        type="button"
        disabled={isLoading}
        onClick={onReincarnate}
        className="px-6 py-3 bg-jade-600 text-ink-950 rounded hover:bg-jade-500 disabled:opacity-40"
      >
        Reincarnate
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests → GREEN**

```bash
npm test -- BardoPanel
```

Expected: 7 passing.

**Quirk:** the `<dt>`/`<dd>` mapping uses `<>` fragment with `key` on children — React 19 accepts this, but some lint configurations warn. If TS or the test complains about missing keys on a fragment wrapper, switch to explicit `<React.Fragment key={k}>…</React.Fragment>`. Either way, tests must pass.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/components/BardoPanel.tsx src/components/BardoPanel.test.tsx
git commit -m "feat(ui): BardoPanel (summary + karma breakdown + upgrade shop)"
```

---

## Task 10: App.tsx phase routing + legacy cleanup + integration test

**Files:**
- Modify: `src/App.tsx` — add phase switch; wire all three new screens.
- Delete: `src/components/SetupScreen.tsx`, `src/components/SetupScreen.test.tsx` (if exists), `src/components/StatusPanel.tsx`, `src/components/StatusPanel.test.tsx` (if exists), `src/components/StoryPanel.tsx`, `src/components/StoryPanel.test.tsx` (if exists).
- Modify: `src/engine/core/Types.ts` — remove `TurnData`, `GameChoice`, `CharacterStatus` if they were only consumed by legacy components. **Check usage first** with `grep -rn "TurnData\|GameChoice\|CharacterStatus" src/`. Do not remove if still referenced outside legacy.
- Create: `tests/integration/ui_full_cycle.test.tsx`

**Rationale:** Close the loop. App renders the correct screen based on `store.phase`. Legacy Phase-0 Gemini-era UI (SetupScreen / StatusPanel / StoryPanel) gets deleted — Phase 1D-2 replaces them. An end-to-end integration test clicks through: Title → Creation → Play → Bardo → Reincarnate → Creation.

- [ ] **Step 1: Failing test — end-to-end UI cycle**

Create `tests/integration/ui_full_cycle.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';
import { GamePhase } from '@/engine/core/Types';

describe('UI integration: full cycle', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('flows from Title → Creation → Play → Bardo → Creation via clicks', async () => {
    render(<App />);

    // Title → New Life
    await waitFor(() => expect(screen.getByText(/thousand deaths/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /new life/i }));

    // Creation → pick anchor + name + Begin
    await waitFor(() => expect(screen.getByText(/choose your birth/i)).toBeInTheDocument());
    await userEvent.click(screen.getByText(/peasant farmer/i));
    await userEvent.type(screen.getByLabelText(/name/i), 'Lin Wei');
    await userEvent.click(screen.getByRole('button', { name: /begin life/i }));

    // Play — status strip should show Lin Wei
    await waitFor(() => expect(screen.getByText(/lin wei/i)).toBeInTheDocument());

    // Spam choices until the character dies (phase transitions to BARDO).
    // Cap iterations to avoid an infinite loop on edge seeds.
    for (let i = 0; i < 400; i++) {
      if (useGameStore.getState().phase === GamePhase.BARDO) break;
      const buttons = screen.queryAllByRole('button');
      const choiceBtn = buttons.find((b) =>
        b.textContent && !/back|new life|continue|codex/i.test(b.textContent),
      );
      if (!choiceBtn) continue;
      await userEvent.click(choiceBtn);
    }

    expect(useGameStore.getState().phase).toBe(GamePhase.BARDO);

    // Bardo → Reincarnate
    await waitFor(() => expect(screen.getByText(/the bardo/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /reincarnate/i }));

    // Back at Creation
    await waitFor(() => expect(screen.getByText(/choose your birth/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Confirm red**

```bash
npm test -- ui_full_cycle
```

Expected: FAIL (App still renders Title placeholder only, no Creation/Play/Bardo hookup).

- [ ] **Step 3: Delete legacy components**

```bash
# Check first: is TurnData/GameChoice/CharacterStatus still referenced anywhere except legacy?
grep -rn "TurnData\|GameChoice\|CharacterStatus" src/ tests/
```

If only legacy + engineBridge use them, remove the legacy files:

```bash
rm -f src/components/SetupScreen.tsx src/components/SetupScreen.test.tsx
rm -f src/components/StatusPanel.tsx src/components/StatusPanel.test.tsx
rm -f src/components/StoryPanel.tsx src/components/StoryPanel.test.tsx
```

If `TurnData` and friends are now unreferenced, also delete them from `src/engine/core/Types.ts`:
- Lines ~93-103: `interface GameChoice`, `interface TurnData` — remove.
- Lines ~76-91: `interface CharacterStatus` — remove.

Otherwise leave them (non-blocking).

- [ ] **Step 4: Rewrite `src/App.tsx`**

Replace its contents:

```tsx
import { useEffect, useState } from 'react';
import { GamePhase } from '@/engine/core/Types';
import { createEngineBridge, EngineBridge, TurnPreview, BardoPayload } from '@/services/engineBridge';
import { useGameStore } from '@/state/gameStore';
import { TitleScreen } from '@/components/TitleScreen';
import { CreationScreen } from '@/components/CreationScreen';
import { PlayScreen } from '@/components/PlayScreen';
import { BardoPanel } from '@/components/BardoPanel';

let engineSingleton: EngineBridge | null = null;
function getEngine(): EngineBridge {
  if (!engineSingleton) engineSingleton = createEngineBridge();
  return engineSingleton;
}

export function App() {
  const phase = useGameStore((s) => s.phase);
  const [hasSave, setHasSave] = useState(false);
  const [preview, setPreview] = useState<TurnPreview | null>(null);
  const [bardoPayload, setBardoPayload] = useState<BardoPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [anchors, setAnchors] = useState<
    ReadonlyArray<{ id: string; name: string; description: string }>
  >([]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const engine = getEngine();
      const init = await engine.loadOrInit();
      setHasSave(init.hasSave);
      setAnchors(engine.listAnchors().availableAnchors);
      setIsLoading(false);
    })();
  }, []);

  async function onNewGame() {
    useGameStore.getState().setPhase(GamePhase.CREATION);
    setAnchors(getEngine().listAnchors().availableAnchors);
  }

  async function onContinue() {
    // Phase 1D-2: resume jumps to PLAYING with whatever was in runState; real resume UX is Phase 2.
    useGameStore.getState().setPhase(GamePhase.PLAYING);
  }

  async function onBegin(anchorId: string, name: string) {
    setIsLoading(true);
    try {
      const p = await getEngine().beginLife(anchorId, name);
      // If beginLife returned empty choices (Phase 1D-2 preview behavior), kick off
      // the first real turn by picking the first fixture event's default choice.
      if (p.choices.length === 0) {
        const next = await getEngine().chooseAction('ch_work');
        if ('karmaEarned' in next) {
          setBardoPayload(next);
        } else {
          setPreview(next);
        }
      } else {
        setPreview(p);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function onChoose(choiceId: string) {
    setIsLoading(true);
    try {
      const next = await getEngine().chooseAction(choiceId);
      if ('karmaEarned' in next) {
        setBardoPayload(next);
      } else {
        setPreview(next);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function onBuyUpgrade(upgradeId: string) {
    setIsLoading(true);
    try {
      const p = await getEngine().spendKarma(upgradeId);
      setBardoPayload(p);
    } finally {
      setIsLoading(false);
    }
  }

  async function onReincarnate() {
    setIsLoading(true);
    try {
      const p = await getEngine().reincarnate();
      setAnchors(p.availableAnchors);
      setPreview(null);
      setBardoPayload(null);
    } finally {
      setIsLoading(false);
    }
  }

  if (phase === GamePhase.TITLE) {
    return (
      <TitleScreen
        hasSave={hasSave}
        onNewGame={onNewGame}
        onContinue={onContinue}
        onOpenCodex={() => {}}
      />
    );
  }
  if (phase === GamePhase.CREATION) {
    return (
      <CreationScreen
        anchors={anchors}
        onBegin={onBegin}
        onBack={() => useGameStore.getState().setPhase(GamePhase.TITLE)}
        isLoading={isLoading}
      />
    );
  }
  if (phase === GamePhase.PLAYING && preview) {
    return <PlayScreen preview={preview} onChoose={onChoose} isLoading={isLoading} />;
  }
  if (phase === GamePhase.BARDO && bardoPayload) {
    return (
      <BardoPanel
        payload={bardoPayload}
        onBuyUpgrade={onBuyUpgrade}
        onReincarnate={onReincarnate}
        isLoading={isLoading}
      />
    );
  }

  // Loading / transitional fallback.
  return (
    <div className="min-h-screen bg-ink-950 text-parchment-400 flex items-center justify-center font-serif">
      <span>…</span>
    </div>
  );
}

export default App;
```

**Note on the `ch_work` kickoff in `onBegin`:** Phase 1D-2 uses a fixture with three events. The first `chooseAction('ch_work')` may fail with "choice not found" if the selector picks `FX_TRAIN_BODY` or `FX_BANDIT` first. For the integration test this is handled by the spam-all-buttons loop. For real gameplay, `App.tsx` tries `ch_work` and, on failure, sequentially tries `ch_train` then `ch_fight`. Refine:

```ts
// onBegin, after beginLife:
for (const choiceId of ['ch_work', 'ch_train', 'ch_fight']) {
  try {
    const next = await getEngine().chooseAction(choiceId);
    if ('karmaEarned' in next) setBardoPayload(next);
    else setPreview(next);
    break;
  } catch (e: any) {
    if (!/choice.*not found/i.test(e.message)) throw e;
  }
}
```

- [ ] **Step 5: Run the integration test → GREEN**

```bash
npm test -- ui_full_cycle
```

Expected: 1 pass. May take several seconds due to the spam-click loop driving a character to death.

- [ ] **Step 6: Full suite + typecheck + build**

```bash
npm test
npm run typecheck
npm run build
```

Expected: everything green, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx \
        tests/integration/ui_full_cycle.test.tsx
# Also add any deletions that git noticed
git add -u
git commit -m "feat(ui): phase routing in App + delete legacy Phase-0 components; integration test"
```

---

## Exit Criteria Checklist

- [ ] All Task 1–10 commits on branch `phase-1d2-ui-wiring`.
- [ ] `npm test` passes. Phase 1D-2 adds ~50 new tests (cumulative realm-karma + loaders + stores + bridge + three components + integration).
- [ ] `npm run typecheck` clean.
- [ ] `npm run build` success; bundle size does not explode (< 250 KB raw).
- [ ] CI green on PR.
- [ ] No legacy Phase-0 component files remain in `src/components/` except `TitleScreen.*`.
- [ ] `CLAUDE.md`'s "Known spec quirks" block no longer contains the realm-karma deviation (removed in Task 1).
- [ ] Manual smoke via `npm run dev` → click New Life → pick Peasant Farmer → type name → click Begin Life → observe narrative + choices → play a few turns → die → see Bardo → buy an upgrade (if karma ≥ 80) → click Reincarnate → see Creation again.

---

## Self-Review Notes

**Spec coverage (§11 UI screens):**
- §11.1 Title — already shipped in Phase 0. Phase 1D-2 wires "Continue" to resume path in `loadOrInit`.
- §11.2 Creation — Task 7 (CreationScreen).
- §11.3 Play — Task 8 (PlayScreen).
- §11.6 Bardo — Task 9 (BardoPanel).
- §11.4 Codex — deferred to Phase 2.
- §11.5 Lineage detail — deferred to Phase 2.

**Type consistency:**
- `TurnPreview` (Task 4) consumed by `PlayScreen` (Task 8). Shapes match.
- `BardoPayload` (Task 4) consumed by `BardoPanel` (Task 9). Shapes match.
- `CreationPayload.availableAnchors` (Task 4) consumed by `CreationScreen` (Task 7). Shapes match.
- `MetaState` ↔ `metaStore` translation pinned in Task 3.

**Determinism notes:**
- `beginLife` uses `now()` → seed. Phase 2 should persist seed for replay.
- `chooseAction` seeds RNG off `runState.rngState.cursor` to keep turn-to-turn replay deterministic given a saved run. Not yet tested explicitly; add a test in Phase 2 if desired.

**Placeholder scan:** none. Every step has code.

**Phase 1D-3 handoff:**
- `src/content/events/fixture.ts` is a placeholder. 1D-3 replaces it with `src/content/events/loader.ts` + real JSON corpus.
- `ch_work` kickoff hack in `App.onBegin` becomes unnecessary once the event corpus guarantees a "default starter event" for new characters, per 1D-3 authoring conventions.

**Gaps vs 1D-2 scope:** none intentional. Codex, Lineage-detail, Heavenly-Notice UI, Echo/Memory flow, and settings polish are explicit non-goals per "Scope boundaries" at the top.
