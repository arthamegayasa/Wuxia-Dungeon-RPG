# Phase 2B-3: UI + Tribulation I + Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface 2B-1/2B-2 engine work to the player via UI: inventory panel, technique list, core-path badge, region indicator, Bardo/Lineage/Codex extensions for techniques + corePath, and the Tribulation I 4-phase pillar UI. Wire `runTribulationIPillar` into the `qc9_to_foundation` outcome path and surface results to the UI. Closes Phase 2B exit criteria #5, #6, #8 (full), #9.

**Architecture:** All UI work flows through `engineBridge` which already exposes the engine state. Bridge gets new payload fields (`region`, `corePath`, `corePathRevealedThisTurn`, `learnedTechniques`, `inventory`, optional `tribulation`) on `TurnPreview`, and new fields (`corePath`, `techniquesLearnedThisLife`) on `BardoPayload` / `LineageEntryView`. Tribulation I runs synchronously inside `OutcomeApplier`'s `qc9_to_foundation` branch and the result is stashed on `RunState.pendingTribulationResult`; `engineBridge.resolveChoice` lifts it into `TurnPreview.tribulation`, App.tsx routes to a new `TribulationPanel` component that renders the 4-phase reveal, then dismisses on continue. No new `GamePhase` enum value is needed — Tribulation is an inline PlayScreen overlay.

**Tech Stack:** React 19 + TypeScript 5.8 + Vite 6 + Vitest 4 + @testing-library/react. All new components use Tailwind classes consistent with existing screens (`bg-ink-950`, `text-jade-300`, `border-parchment-700`, etc.).

---

## File Structure

**Create:**
- `src/components/InventoryPanel.tsx` — overlay panel listing items grouped by type
- `src/components/InventoryPanel.test.tsx`
- `src/components/TechniqueList.tsx` — char-sheet section listing learned techniques + bonus summary
- `src/components/TechniqueList.test.tsx`
- `src/components/CorePathBadge.tsx` — inline badge with reveal shimmer
- `src/components/CorePathBadge.test.tsx`
- `src/components/CharSheetPanel.tsx` — overlay container holding TechniqueList + CorePathBadge + open meridians
- `src/components/CharSheetPanel.test.tsx`
- `src/components/TribulationPanel.tsx` — 4-phase scripted reveal
- `src/components/TribulationPanel.test.tsx`
- `tests/integration/playable_life_2b.test.tsx` — full 3-life UI loop covering Sect Initiate unlock + Tribulation I
- `tests/integration/tribulation_i_ui.test.tsx` — focused Tribulation flow test

**Modify:**
- `src/services/engineBridge.ts` — extend `TurnPreview`, `BardoPayload`, `LineageEntryView`, `CodexSnapshot`; add `CodexTechniqueEntry` + `RevealedTechnique` + `TribulationPayload` types; populate new fields in `buildTurnPreview` / `buildBardoPayload` / `getLineageSnapshot` / `getCodexSnapshot`; lift tribulation result from RunState
- `src/components/PlayScreen.tsx` — add region indicator to header, Inventory + Char Sheet toggle buttons, render TribulationPanel when `preview.tribulation` is set
- `src/components/PlayScreen.test.tsx` — assertions for new UI affordances
- `src/components/BardoPanel.tsx` — add "Techniques learned this life" + "Core Path" reveal sections
- `src/components/BardoPanel.test.tsx`
- `src/components/LineageScreen.tsx` — LifeCard shows corePath + technique count
- `src/components/LineageScreen.test.tsx`
- `src/components/CodexScreen.tsx` — add "Techniques" tab (4-tab layout: memories / echoes / anchors / techniques)
- `src/components/CodexScreen.test.tsx`
- `src/engine/events/RunState.ts` — add `pendingTribulationResult?: PendingTribulationResult` field
- `src/engine/events/RunState.test.ts` — defaults assertion
- `src/engine/events/OutcomeApplier.ts` — replace `qc9_to_foundation` flag-only stub with `runTribulationIPillar` + result storage
- `src/engine/events/OutcomeApplier.test.ts` — Tribulation invocation test
- `src/engine/meta/MetaState.ts` — extend `LineageEntrySummary.techniquesLearned` extraction to BardoFlow (verify already done; if not, wire it)
- `src/engine/bardo/BardoFlow.ts` — populate `corePath` + `techniquesLearned` on the new lineage entry from RunState
- `src/engine/bardo/BardoFlow.test.ts`

**Test:**
- All new `*.test.tsx` files alongside their components (Vitest + @testing-library/react)
- Two `tests/integration/*.tsx` files for end-to-end UI flow

---

## Task 1: Extend engineBridge — TurnPreview region + corePath + technique/inventory fields

**Files:**
- Modify: `src/services/engineBridge.ts:151-162` (TurnPreview interface) and `src/services/engineBridge.ts:396-415` (buildTurnPreview)
- Test: `src/services/engineBridge.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/services/engineBridge.test.ts`:

```ts
describe('Phase 2B-3: TurnPreview surfaces region + corePath + techniques + inventory', () => {
  it('exposes region label, corePath, learnedTechniques, inventory on every preview', async () => {
    const sm = createInMemorySaveManager();
    const engine = createEngineBridge({ saveManager: sm, now: () => 7 });
    await engine.loadOrInit();
    await engine.beginLife('peasant_farmer', 'Test One');
    const preview = await engine.peekNextEvent();
    expect(preview.region).toBe('yellow_plains');
    expect(preview.regionName).toMatch(/yellow plains/i);
    expect(preview.corePath).toBeNull();
    expect(preview.corePathRevealedThisTurn).toBe(false);
    expect(preview.learnedTechniques).toEqual([]);
    expect(preview.inventory).toEqual([]);
    expect(preview.openMeridians).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/engineBridge.test.ts -t "Phase 2B-3"`
Expected: FAIL with type error or missing properties.

- [ ] **Step 3: Extend the TurnPreview interface**

In `src/services/engineBridge.ts`, replace the `TurnPreview` interface (around line 151) with:

```ts
export interface TurnPreviewTechnique {
  id: string;
  name: string;
}

export interface TurnPreviewItem {
  id: string;
  name: string;
  count: number;
  itemType: 'pill' | 'manual' | 'weapon' | 'armor' | 'talisman' | 'misc';
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
  // Phase 2B-3 additions
  region: string;
  regionName: string;
  corePath: string | null;
  /** True only on the turn the 3rd meridian opened. UI uses for shimmer animation. */
  corePathRevealedThisTurn: boolean;
  learnedTechniques: ReadonlyArray<TurnPreviewTechnique>;
  inventory: ReadonlyArray<TurnPreviewItem>;
  openMeridians: ReadonlyArray<number>;
  /** Set only by resolveChoice when the resolved outcome triggered a Tribulation pillar. */
  tribulation?: TribulationPayload;
}
```

(Add a placeholder `TribulationPayload` interface above for now — full shape lands in Task 14.)

```ts
export interface TribulationPayload {
  pillarId: 'tribulation_i';
  phases: ReadonlyArray<{
    phaseId: string;
    success: boolean;
    chance: number;
    roll: number;
  }>;
  fatal: boolean;
}
```

- [ ] **Step 4: Update buildTurnPreview to populate the new fields**

Replace `buildTurnPreview` in `src/services/engineBridge.ts:396` with:

```ts
function buildTurnPreview(
  narrative: string,
  choices: Array<{ id: string; label: string }>,
  tribulation?: TribulationPayload,
): TurnPreview {
  const gs = useGameStore.getState();
  if (!gs.runState) throw new Error('buildTurnPreview: no runState in store');
  const rs = gs.runState;
  const regionDef = REGION_REGISTRY.current.byId(rs.region);
  const learnedTechniques: TurnPreviewTechnique[] = rs.learnedTechniques.flatMap((id) => {
    const t = TECHNIQUE_REGISTRY.byId(id);
    return t ? [{ id, name: t.name }] : [];
  });
  const inventory: TurnPreviewItem[] = rs.inventory.flatMap((slot) => {
    const def = ITEM_REGISTRY.byId(slot.id);
    if (!def) return [];
    return [{ id: slot.id, name: def.name, count: slot.count, itemType: def.itemType }];
  });
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
    region: rs.region,
    regionName: regionDef?.name ?? rs.region,
    corePath: rs.character.corePath,
    corePathRevealedThisTurn: gs.corePathRevealedThisTurn ?? false,
    learnedTechniques,
    inventory,
    openMeridians: rs.character.openMeridians,
    tribulation,
  };
}
```

(`gs.corePathRevealedThisTurn` is set by Task 2; for now write `false` literal until Task 2 lands.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/services/engineBridge.test.ts -t "Phase 2B-3"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/engineBridge.ts src/services/engineBridge.test.ts
git commit -m "feat(bridge): TurnPreview surfaces region/corePath/techniques/inventory"
```

---

## Task 2: gameStore tracks corePath reveal flag (one-turn shimmer signal)

**Files:**
- Modify: `src/state/gameStore.ts` (add `corePathRevealedThisTurn: boolean` slice + `markCorePathRevealed` + `clearCorePathRevealed`)
- Test: `src/state/gameStore.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/state/gameStore.test.ts`:

```ts
describe('Phase 2B-3: corePathRevealedThisTurn flag', () => {
  it('starts false', () => {
    expect(useGameStore.getState().corePathRevealedThisTurn).toBe(false);
  });
  it('markCorePathRevealed flips to true', () => {
    useGameStore.getState().markCorePathRevealed();
    expect(useGameStore.getState().corePathRevealedThisTurn).toBe(true);
  });
  it('clearCorePathRevealed flips back to false', () => {
    useGameStore.getState().markCorePathRevealed();
    useGameStore.getState().clearCorePathRevealed();
    expect(useGameStore.getState().corePathRevealedThisTurn).toBe(false);
  });
  it('resetRun clears the flag', () => {
    useGameStore.getState().markCorePathRevealed();
    useGameStore.getState().resetRun();
    expect(useGameStore.getState().corePathRevealedThisTurn).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/gameStore.test.ts -t "Phase 2B-3"`
Expected: FAIL with `markCorePathRevealed is not a function`.

- [ ] **Step 3: Add the slice to gameStore**

In `src/state/gameStore.ts`, locate the existing state interface (likely `GameStoreState`) and add:

```ts
corePathRevealedThisTurn: boolean;
markCorePathRevealed: () => void;
clearCorePathRevealed: () => void;
```

In the `create<...>(...)` body, add to the initial state:

```ts
corePathRevealedThisTurn: false,
markCorePathRevealed: () => set({ corePathRevealedThisTurn: true }),
clearCorePathRevealed: () => set({ corePathRevealedThisTurn: false }),
```

In the `resetRun` action body, add `corePathRevealedThisTurn: false`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/gameStore.test.ts -t "Phase 2B-3"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/gameStore.ts src/state/gameStore.test.ts
git commit -m "feat(state): corePathRevealedThisTurn flag for shimmer signal"
```

---

## Task 3: Bridge wires corePathRevealed hook → gameStore + clears on next peek

**Files:**
- Modify: `src/services/engineBridge.ts` (in `resolveChoice` after `applyPostOutcomeHooks`, in `doPeek` at the start)
- Test: `src/services/engineBridge.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/services/engineBridge.test.ts`:

```ts
describe('Phase 2B-3: corePathRevealed → gameStore wiring', () => {
  it('marks corePathRevealedThisTurn after the resolveChoice that opens the 3rd meridian', async () => {
    // Construct a run with 2 meridians already open + an event whose chosen outcome
    // emits a meridian_open delta. Use the test harness from existing engineBridge tests.
    const { engine, runState } = await setupRunWithTwoMeridiansAndMeridianOpenEvent();
    expect(useGameStore.getState().corePathRevealedThisTurn).toBe(false);
    await engine.resolveChoice('meridian_open_choice');
    expect(useGameStore.getState().corePathRevealedThisTurn).toBe(true);
  });
  it('clears corePathRevealedThisTurn at the start of the next peek', async () => {
    useGameStore.getState().markCorePathRevealed();
    const engine = createEngineBridge({ saveManager: createInMemorySaveManager(), now: () => 7 });
    await engine.loadOrInit();
    await engine.beginLife('peasant_farmer', 'X');
    await engine.peekNextEvent();
    expect(useGameStore.getState().corePathRevealedThisTurn).toBe(false);
  });
});
```

(Define `setupRunWithTwoMeridiansAndMeridianOpenEvent` as a local helper that constructs a minimal run state with 2 meridians open, injects a single event into ALL_EVENTS via the existing test fixture path used by other engineBridge tests.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/engineBridge.test.ts -t "corePathRevealed"`
Expected: FAIL — flag never set.

- [ ] **Step 3: Wire the hook in resolveChoice**

In `src/services/engineBridge.ts:824`, after the line `const nextEchoTracker = hooks.echoTracker;`, add:

```ts
if (hooks.corePathRevealed) {
  useGameStore.getState().markCorePathRevealed();
}
```

In `doPeek` (line 446), add at the very top of the function (before any logic):

```ts
useGameStore.getState().clearCorePathRevealed();
```

- [ ] **Step 4: Update buildTurnPreview to read the live flag**

Replace the `corePathRevealedThisTurn: gs.corePathRevealedThisTurn ?? false,` line written in Task 1 to read directly from the latest store state (it already does — Task 1 placeholder is now correct). No change needed if Task 1 already did this. Verify by re-reading.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/services/engineBridge.test.ts -t "corePathRevealed"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/engineBridge.ts src/services/engineBridge.test.ts
git commit -m "feat(bridge): wire corePathRevealed hook into gameStore + clear on peek"
```

---

## Task 4: Extend BardoPayload with corePath + techniquesLearnedThisLife

**Files:**
- Modify: `src/services/engineBridge.ts` (`BardoPayload` interface around line 177; `buildBardoPayload` around line 562)
- Test: `src/services/engineBridge.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/services/engineBridge.test.ts`:

```ts
describe('Phase 2B-3: BardoPayload surfaces corePath + techniques', () => {
  it('emits corePath + techniquesLearnedThisLife from the just-finished life', async () => {
    const engine = createEngineBridge({ saveManager: createInMemorySaveManager(), now: () => 7 });
    await engine.loadOrInit();
    await engine.beginLife('peasant_farmer', 'Death Walker');
    // Advance to death deterministically via the shared driver.
    await runUntilBardo(engine);
    const bardo = await engine.beginBardo();
    expect(bardo).toHaveProperty('corePath');
    expect(bardo).toHaveProperty('techniquesLearnedThisLife');
    expect(Array.isArray(bardo.techniquesLearnedThisLife)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/engineBridge.test.ts -t "Phase 2B-3: BardoPayload"`
Expected: FAIL.

- [ ] **Step 3: Extend BardoPayload + buildBardoPayload**

In `src/services/engineBridge.ts:177`, extend `BardoPayload`:

```ts
export interface RevealedTechnique {
  id: string;
  name: string;
  description: string;
}

export interface BardoPayload {
  // ... existing fields ...
  /** Phase 2B-3: core path locked this life (null if 3rd meridian never opened). */
  corePath: string | null;
  /** Phase 2B-3: techniques the player learned during this life. */
  techniquesLearnedThisLife: ReadonlyArray<RevealedTechnique>;
}
```

In `buildBardoPayload` (line 562), append:

```ts
const techniquesLearnedThisLife: RevealedTechnique[] = (rs.learnedTechniques ?? []).flatMap((id) => {
  const t = TECHNIQUE_REGISTRY.byId(id);
  return t ? [{ id, name: t.name, description: t.description }] : [];
});

return {
  // ... existing fields ...
  corePath: rs.character.corePath,
  techniquesLearnedThisLife,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/engineBridge.test.ts -t "Phase 2B-3: BardoPayload"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/engineBridge.ts src/services/engineBridge.test.ts
git commit -m "feat(bridge): BardoPayload surfaces corePath + techniquesLearnedThisLife"
```

---

## Task 5: BardoFlow populates LineageEntrySummary.{corePath,techniquesLearned}

**Files:**
- Modify: `src/engine/bardo/BardoFlow.ts` (find the `LineageEntrySummary` build site and populate the new fields from `runState.character.corePath` + `runState.learnedTechniques`)
- Test: `src/engine/bardo/BardoFlow.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/engine/bardo/BardoFlow.test.ts`:

```ts
describe('Phase 2B-3: lineage entry captures corePath + techniquesLearned', () => {
  it('writes character.corePath and runState.learnedTechniques into the new lineage entry', () => {
    const character = makeCharacterWithCorePath('iron_mountain');
    const runState = { ...makeDeadRunState(character), learnedTechniques: ['iron_body_fist'] };
    const meta = createEmptyMetaState();
    const result = runBardoFlow(runState, meta, 1.0, EchoRegistry.fromList([]));
    const entry = result.meta.lineage[result.meta.lineage.length - 1]!;
    expect(entry.corePath).toBe('iron_mountain');
    expect(entry.techniquesLearned).toEqual(['iron_body_fist']);
  });
});
```

(Add small helpers `makeCharacterWithCorePath` + `makeDeadRunState` in the test file using the existing fixture builders.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/bardo/BardoFlow.test.ts -t "Phase 2B-3"`
Expected: FAIL — entry.corePath is `null`, techniquesLearned is `[]`.

- [ ] **Step 3: Update BardoFlow to populate the fields**

In `src/engine/bardo/BardoFlow.ts`, locate the lineage-entry build (search for `lifeIndex:` or `birthYear:`). Add:

```ts
corePath: runState.character.corePath,
techniquesLearned: runState.learnedTechniques,
```

If the entry is built via a helper, update the helper signature.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/bardo/BardoFlow.test.ts -t "Phase 2B-3"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/bardo/BardoFlow.ts src/engine/bardo/BardoFlow.test.ts
git commit -m "feat(bardo): populate lineage entry corePath + techniquesLearned"
```

---

## Task 6: Extend LineageEntryView + getLineageSnapshot — corePath + techniqueCount

**Files:**
- Modify: `src/services/engineBridge.ts` (`LineageEntryView` interface line 258; `getLineageSnapshot` line 943)
- Test: `src/services/engineBridge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('Phase 2B-3: LineageEntryView surfaces corePath + techniqueCount', () => {
  it('reads corePath and techniquesLearned.length from the lineage entry', () => {
    seedMetaWithLineageEntry({ corePath: 'iron_mountain', techniquesLearned: ['a', 'b'] });
    const engine = createEngineBridge({ saveManager: createInMemorySaveManager() });
    const snap = engine.getLineageSnapshot();
    expect(snap.entries[0].corePath).toBe('iron_mountain');
    expect(snap.entries[0].techniqueCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/engineBridge.test.ts -t "LineageEntryView surfaces"`
Expected: FAIL.

- [ ] **Step 3: Extend LineageEntryView + getLineageSnapshot**

In `LineageEntryView`:

```ts
export interface LineageEntryView {
  // ... existing fields ...
  corePath: string | null;
  techniqueCount: number;
}
```

In `getLineageSnapshot`'s `entries.map`, add:

```ts
corePath: entry.corePath,
techniqueCount: entry.techniquesLearned.length,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/engineBridge.test.ts -t "LineageEntryView surfaces"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/engineBridge.ts src/services/engineBridge.test.ts
git commit -m "feat(bridge): LineageEntryView includes corePath + techniqueCount"
```

---

## Task 7: Extend CodexSnapshot with techniques tab + seenTechniques wiring

**Files:**
- Modify: `src/services/engineBridge.ts` (`CodexSnapshot` line 252; `getCodexSnapshot` line 969)
- Test: `src/services/engineBridge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('Phase 2B-3: CodexSnapshot surfaces a techniques tab', () => {
  it('emits a CodexTechniqueEntry per technique with seen/learned distinction', async () => {
    await __loadGameplayContent();
    const engine = createEngineBridge({ saveManager: createInMemorySaveManager() });
    const snap = engine.getCodexSnapshot();
    expect(Array.isArray(snap.techniques)).toBe(true);
    expect(snap.techniques.length).toBeGreaterThan(0);
    const sample = snap.techniques[0]!;
    expect(sample).toHaveProperty('id');
    expect(sample).toHaveProperty('name');
    expect(sample).toHaveProperty('seen');
    expect(sample).toHaveProperty('learned');
    expect(sample).toHaveProperty('grade');
    expect(sample).toHaveProperty('description');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/engineBridge.test.ts -t "CodexSnapshot surfaces"`
Expected: FAIL.

- [ ] **Step 3: Add CodexTechniqueEntry + extend CodexSnapshot**

```ts
export interface CodexTechniqueEntry {
  id: string;
  name: string;
  description: string;
  grade: 'mortal' | 'yellow' | 'profound' | 'earth' | 'heaven' | 'immortal';
  seen: boolean;
  learned: boolean;
}

export interface CodexSnapshot {
  // ... existing ...
  techniques: ReadonlyArray<CodexTechniqueEntry>;
}
```

In `getCodexSnapshot`, after the existing `anchors` build, add:

```ts
const seenTech = new Set(meta.seenTechniques);
// "learned" reflects current life if any; if no live run, fall back to lineage's most-recent entry's techniquesLearned.
const learnedSet = new Set<string>(
  useGameStore.getState().runState?.learnedTechniques
  ?? (meta.lineage.length > 0 ? meta.lineage[meta.lineage.length - 1]!.techniquesLearned : []),
);
const techniques = TECHNIQUE_REGISTRY.all().map<CodexTechniqueEntry>((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  grade: t.grade,
  seen: seenTech.has(t.id) || learnedSet.has(t.id),
  learned: learnedSet.has(t.id),
}));

return { echoes, memories, anchors, techniques };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/engineBridge.test.ts -t "CodexSnapshot surfaces"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/engineBridge.ts src/services/engineBridge.test.ts
git commit -m "feat(bridge): CodexSnapshot adds techniques tab data"
```

---

## Task 8: PlayScreen — region indicator in header

**Files:**
- Modify: `src/components/PlayScreen.tsx`
- Test: `src/components/PlayScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Replace the existing PlayScreen test or add to it:

```tsx
import { render, screen } from '@testing-library/react';
import { PlayScreen } from './PlayScreen';

const baseProps = {
  preview: {
    narrative: 'A still afternoon.',
    name: 'Lin Wei',
    ageYears: 14,
    hpCurrent: 30, hpMax: 30, qiCurrent: 0, qiMax: 0,
    realm: 'BODY_TEMPERING', insight: 5,
    choices: [{ id: 'c1', label: 'Sit and breathe' }],
    region: 'azure_peaks',
    regionName: 'Azure Peaks',
    corePath: null,
    corePathRevealedThisTurn: false,
    learnedTechniques: [],
    inventory: [],
    openMeridians: [],
  },
  onChoose: () => {},
};

describe('Phase 2B-3: PlayScreen region indicator', () => {
  it('renders the region name in the header', () => {
    render(<PlayScreen {...baseProps} />);
    expect(screen.getByText(/azure peaks/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PlayScreen.test.tsx -t "Phase 2B-3: PlayScreen region"`
Expected: FAIL — text not present.

- [ ] **Step 3: Add the region span to PlayScreen header**

In `src/components/PlayScreen.tsx`, modify the header div (around line 21-32) to add a region indicator after the realm:

```tsx
<header className="border-b border-parchment-800 bg-ink-900 px-6 py-3 flex justify-between items-center text-sm">
  <div className="flex items-center gap-3">
    <span className="text-jade-300">{preview.name}</span>
    <span className="text-parchment-400">age {preview.ageYears}</span>
    <span className="text-parchment-500">· {preview.regionName}</span>
  </div>
  <div className="flex gap-4 text-parchment-300">
    <span>HP {preview.hpCurrent} / {preview.hpMax}</span>
    <span>Qi {preview.qiCurrent} / {preview.qiMax}</span>
    <span>Insight {preview.insight}</span>
    <span className="uppercase text-parchment-500">{preview.realm}</span>
  </div>
</header>
```

Update `PlayScreenProps.preview` type to include the new fields (region/regionName/corePath/etc. — the additive shape from Task 1).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/PlayScreen.test.tsx -t "Phase 2B-3: PlayScreen region"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PlayScreen.tsx src/components/PlayScreen.test.tsx
git commit -m "feat(ui): PlayScreen header shows region name"
```

---

## Task 9: InventoryPanel component (overlay)

**Files:**
- Create: `src/components/InventoryPanel.tsx`
- Create: `src/components/InventoryPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InventoryPanel } from './InventoryPanel';

describe('InventoryPanel', () => {
  it('renders an empty-state message when no items', () => {
    render(<InventoryPanel items={[]} onClose={() => {}} />);
    expect(screen.getByText(/empty/i)).toBeInTheDocument();
  });
  it('groups items by itemType with headings', () => {
    render(
      <InventoryPanel
        items={[
          { id: 'minor_healing_pill', name: 'Minor Healing Pill', count: 3, itemType: 'pill' },
          { id: 'iron_will_manual', name: 'Iron Will Manual',    count: 1, itemType: 'manual' },
          { id: 'silver_pouch',     name: 'Silver Pouch',        count: 5, itemType: 'misc' },
        ]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/pills/i)).toBeInTheDocument();
    expect(screen.getByText(/manuals/i)).toBeInTheDocument();
    expect(screen.getByText(/misc/i)).toBeInTheDocument();
    expect(screen.getByText(/minor healing pill/i)).toBeInTheDocument();
    expect(screen.getByText(/×3/)).toBeInTheDocument();
  });
  it('fires onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(<InventoryPanel items={[]} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/InventoryPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement InventoryPanel**

```tsx
import type { TurnPreviewItem } from '@/services/engineBridge';

const TYPE_HEADINGS: Record<TurnPreviewItem['itemType'], string> = {
  pill: 'Pills',
  manual: 'Manuals',
  weapon: 'Weapons',
  armor: 'Armor',
  talisman: 'Talismans',
  misc: 'Misc',
};

const TYPE_ORDER: ReadonlyArray<TurnPreviewItem['itemType']> =
  ['pill', 'manual', 'weapon', 'armor', 'talisman', 'misc'];

export interface InventoryPanelProps {
  items: ReadonlyArray<TurnPreviewItem>;
  onClose: () => void;
}

export function InventoryPanel({ items, onClose }: InventoryPanelProps) {
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: items.filter((i) => i.itemType === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="fixed inset-0 bg-ink-950/80 flex items-center justify-center z-40 font-serif">
      <div className="bg-ink-900 border border-parchment-700 rounded p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl text-jade-300">Inventory</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 border border-parchment-700 rounded hover:border-parchment-500"
          >
            Close
          </button>
        </div>
        {grouped.length === 0 ? (
          <p className="text-parchment-500 italic">Inventory is empty.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {grouped.map((g) => (
              <section key={g.type}>
                <h4 className="text-sm uppercase tracking-wide text-parchment-500 mb-1">
                  {TYPE_HEADINGS[g.type]}
                </h4>
                <ul className="flex flex-col gap-1">
                  {g.items.map((it) => (
                    <li key={it.id} className="flex justify-between text-parchment-200">
                      <span>{it.name}</span>
                      <span className="text-parchment-500">×{it.count}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/InventoryPanel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/InventoryPanel.tsx src/components/InventoryPanel.test.tsx
git commit -m "feat(ui): InventoryPanel overlay with grouped item types"
```

---

## Task 10: CorePathBadge component (with shimmer)

**Files:**
- Create: `src/components/CorePathBadge.tsx`
- Create: `src/components/CorePathBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { CorePathBadge } from './CorePathBadge';

describe('CorePathBadge', () => {
  it('renders "Wandering" when corePath is null', () => {
    render(<CorePathBadge corePath={null} revealedThisTurn={false} />);
    expect(screen.getByText(/wandering/i)).toBeInTheDocument();
  });
  it('renders the path name when set', () => {
    render(<CorePathBadge corePath="iron_mountain" revealedThisTurn={false} />);
    expect(screen.getByText(/iron mountain/i)).toBeInTheDocument();
  });
  it('applies shimmer class when revealedThisTurn is true', () => {
    const { container } = render(<CorePathBadge corePath="severing_edge" revealedThisTurn />);
    const badge = container.querySelector('[data-testid="core-path-badge"]')!;
    expect(badge.className).toMatch(/animate-pulse/);
    expect(badge.className).toMatch(/ring/);
  });
  it('does not apply shimmer when revealedThisTurn is false', () => {
    const { container } = render(<CorePathBadge corePath="severing_edge" revealedThisTurn={false} />);
    const badge = container.querySelector('[data-testid="core-path-badge"]')!;
    expect(badge.className).not.toMatch(/animate-pulse/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CorePathBadge.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement CorePathBadge**

```tsx
const PATH_LABELS: Record<string, string> = {
  iron_mountain: 'Iron Mountain',
  severing_edge: 'Severing Edge',
  still_water: 'Still Water',
  howling_storm: 'Howling Storm',
  blood_ember: 'Blood Ember',
  root_and_bough: 'Root and Bough',
  thousand_mirrors: 'Thousand Mirrors',
  hollow_vessel: 'Hollow Vessel',
  shattered_path: 'Shattered Path',
};

export interface CorePathBadgeProps {
  corePath: string | null;
  revealedThisTurn: boolean;
}

export function CorePathBadge({ corePath, revealedThisTurn }: CorePathBadgeProps) {
  const label = corePath ? (PATH_LABELS[corePath] ?? corePath) : 'Wandering';
  const shimmer = revealedThisTurn ? 'animate-pulse ring-1 ring-jade-400/60' : '';
  return (
    <div
      data-testid="core-path-badge"
      className={`inline-flex items-center gap-2 px-3 py-1 border border-jade-700 rounded text-sm text-jade-300 ${shimmer}`}
    >
      <span className="uppercase text-xs text-parchment-500">Path</span>
      <span>{label}</span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/CorePathBadge.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/CorePathBadge.tsx src/components/CorePathBadge.test.tsx
git commit -m "feat(ui): CorePathBadge with reveal-on-3rd-meridian shimmer"
```

---

## Task 11: TechniqueList component

**Files:**
- Create: `src/components/TechniqueList.tsx`
- Create: `src/components/TechniqueList.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { TechniqueList } from './TechniqueList';

describe('TechniqueList', () => {
  it('renders an empty-state message when none', () => {
    render(<TechniqueList techniques={[]} />);
    expect(screen.getByText(/no techniques learned/i)).toBeInTheDocument();
  });
  it('lists technique names with id keys', () => {
    render(
      <TechniqueList
        techniques={[
          { id: 'iron_body_fist', name: 'Iron Body Fist' },
          { id: 'still_water_breath', name: 'Still Water Breath' },
        ]}
      />,
    );
    expect(screen.getByText(/iron body fist/i)).toBeInTheDocument();
    expect(screen.getByText(/still water breath/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/TechniqueList.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement TechniqueList**

```tsx
import type { TurnPreviewTechnique } from '@/services/engineBridge';

export interface TechniqueListProps {
  techniques: ReadonlyArray<TurnPreviewTechnique>;
}

export function TechniqueList({ techniques }: TechniqueListProps) {
  if (techniques.length === 0) {
    return (
      <div className="text-parchment-500 italic text-sm">No techniques learned.</div>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {techniques.map((t) => (
        <li key={t.id} className="text-parchment-200">
          · {t.name}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/TechniqueList.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/TechniqueList.tsx src/components/TechniqueList.test.tsx
git commit -m "feat(ui): TechniqueList component"
```

---

## Task 12: CharSheetPanel overlay (CorePathBadge + TechniqueList + open meridians)

**Files:**
- Create: `src/components/CharSheetPanel.tsx`
- Create: `src/components/CharSheetPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharSheetPanel } from './CharSheetPanel';

const baseProps = {
  corePath: 'iron_mountain',
  corePathRevealedThisTurn: false,
  techniques: [{ id: 'iron_body_fist', name: 'Iron Body Fist' }],
  openMeridians: [1, 4, 7],
  onClose: () => {},
};

describe('CharSheetPanel', () => {
  it('renders core path badge, technique list, and open meridian count', () => {
    render(<CharSheetPanel {...baseProps} />);
    expect(screen.getByText(/iron mountain/i)).toBeInTheDocument();
    expect(screen.getByText(/iron body fist/i)).toBeInTheDocument();
    expect(screen.getByText(/3 meridians open/i)).toBeInTheDocument();
  });
  it('fires onClose on close button click', async () => {
    const onClose = vi.fn();
    render(<CharSheetPanel {...baseProps} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CharSheetPanel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement CharSheetPanel**

```tsx
import { CorePathBadge } from './CorePathBadge';
import { TechniqueList } from './TechniqueList';
import type { TurnPreviewTechnique } from '@/services/engineBridge';

export interface CharSheetPanelProps {
  corePath: string | null;
  corePathRevealedThisTurn: boolean;
  techniques: ReadonlyArray<TurnPreviewTechnique>;
  openMeridians: ReadonlyArray<number>;
  onClose: () => void;
}

export function CharSheetPanel(props: CharSheetPanelProps) {
  return (
    <div className="fixed inset-0 bg-ink-950/80 flex items-center justify-center z-40 font-serif">
      <div className="bg-ink-900 border border-parchment-700 rounded p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl text-jade-300">Character</h3>
          <button
            type="button"
            onClick={props.onClose}
            className="px-3 py-1 border border-parchment-700 rounded hover:border-parchment-500"
          >
            Close
          </button>
        </div>

        <section className="mb-4">
          <CorePathBadge
            corePath={props.corePath}
            revealedThisTurn={props.corePathRevealedThisTurn}
          />
        </section>

        <section className="mb-4">
          <h4 className="text-sm uppercase tracking-wide text-parchment-500 mb-1">Meridians</h4>
          <p className="text-parchment-300 text-sm">
            {props.openMeridians.length} meridians open
          </p>
        </section>

        <section>
          <h4 className="text-sm uppercase tracking-wide text-parchment-500 mb-1">Techniques</h4>
          <TechniqueList techniques={props.techniques} />
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/CharSheetPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CharSheetPanel.tsx src/components/CharSheetPanel.test.tsx
git commit -m "feat(ui): CharSheetPanel overlay (core path + meridians + techniques)"
```

---

## Task 13: PlayScreen integrates Inventory + CharSheet toggles

**Files:**
- Modify: `src/components/PlayScreen.tsx`
- Modify: `src/components/PlayScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/PlayScreen.test.tsx`:

```tsx
describe('Phase 2B-3: PlayScreen overlay toggles', () => {
  it('toggles inventory panel visibility via header button', async () => {
    render(<PlayScreen {...baseProps} preview={{ ...baseProps.preview, inventory: [{ id: 'p', name: 'Pill', count: 2, itemType: 'pill' }] }} />);
    expect(screen.queryByRole('heading', { name: /^inventory$/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /inventory/i }));
    expect(screen.getByRole('heading', { name: /^inventory$/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('heading', { name: /^inventory$/i })).not.toBeInTheDocument();
  });
  it('toggles character sheet visibility via header button', async () => {
    render(<PlayScreen {...baseProps} />);
    await userEvent.click(screen.getByRole('button', { name: /character/i }));
    expect(screen.getByRole('heading', { name: /^character$/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PlayScreen.test.tsx -t "Phase 2B-3: PlayScreen overlay"`
Expected: FAIL.

- [ ] **Step 3: Wire toggles + render overlays**

In `src/components/PlayScreen.tsx`, replace the function with:

```tsx
import { useState } from 'react';
import { InventoryPanel } from './InventoryPanel';
import { CharSheetPanel } from './CharSheetPanel';
import type { TurnPreview } from '@/services/engineBridge';

export interface PlayScreenProps {
  preview: TurnPreview;
  onChoose: (choiceId: string) => void | Promise<void>;
  isLoading?: boolean;
}

export function PlayScreen({ preview, onChoose, isLoading }: PlayScreenProps) {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [charSheetOpen, setCharSheetOpen] = useState(false);

  return (
    <div className="min-h-screen bg-ink-950 text-parchment-100 flex flex-col font-serif">
      <header className="border-b border-parchment-800 bg-ink-900 px-6 py-3 flex justify-between items-center text-sm">
        <div className="flex items-center gap-3">
          <span className="text-jade-300">{preview.name}</span>
          <span className="text-parchment-400">age {preview.ageYears}</span>
          <span className="text-parchment-500">· {preview.regionName}</span>
        </div>
        <div className="flex gap-3 items-center text-parchment-300">
          <span>HP {preview.hpCurrent} / {preview.hpMax}</span>
          <span>Qi {preview.qiCurrent} / {preview.qiMax}</span>
          <span>Insight {preview.insight}</span>
          <span className="uppercase text-parchment-500">{preview.realm}</span>
          <button
            type="button"
            onClick={() => setCharSheetOpen(true)}
            className="px-2 py-1 border border-parchment-700 rounded hover:border-parchment-500"
          >
            Character
          </button>
          <button
            type="button"
            onClick={() => setInventoryOpen(true)}
            className="px-2 py-1 border border-parchment-700 rounded hover:border-parchment-500"
          >
            Inventory
          </button>
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

      {inventoryOpen && (
        <InventoryPanel
          items={preview.inventory}
          onClose={() => setInventoryOpen(false)}
        />
      )}
      {charSheetOpen && (
        <CharSheetPanel
          corePath={preview.corePath}
          corePathRevealedThisTurn={preview.corePathRevealedThisTurn}
          techniques={preview.learnedTechniques}
          openMeridians={preview.openMeridians}
          onClose={() => setCharSheetOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/PlayScreen.test.tsx`
Expected: PASS (all PlayScreen tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/PlayScreen.tsx src/components/PlayScreen.test.tsx
git commit -m "feat(ui): PlayScreen wires Inventory + CharSheet overlays"
```

---

## Task 14: OutcomeApplier wires runTribulationIPillar into qc9_to_foundation

**Files:**
- Modify: `src/engine/events/RunState.ts` (add `pendingTribulationResult` field)
- Modify: `src/engine/events/OutcomeApplier.ts` (replace flag-only stub with real Tribulation invocation)
- Modify: `src/engine/events/OutcomeApplier.test.ts`
- Modify: `src/engine/events/RunState.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/engine/events/OutcomeApplier.test.ts`:

```ts
import { runTribulationIPillar } from '@/engine/cultivation/TribulationI';

describe('Phase 2B-3: qc9_to_foundation runs Tribulation I and stores result', () => {
  it('stores phase results on runState.pendingTribulationResult (non-fatal default)', () => {
    const rs = makeRunStateAtQc9();
    const outcome: Outcome = { tier: 'success', stateDeltas: [{ kind: 'attempt_realm_crossing', transition: 'qc9_to_foundation' }] };
    const next = applyOutcome(rs, outcome, { rng: createRng(42) });
    expect(next.pendingTribulationResult).toBeDefined();
    expect(next.pendingTribulationResult!.pillarId).toBe('tribulation_i');
    expect(next.pendingTribulationResult!.phases).toHaveLength(4);
    expect(next.pendingTribulationResult!.fatal).toBe(false);
    expect(next.deathCause).toBeNull();   // non-fatal mode never kills in 2B
  });
  it('matches direct runTribulationIPillar output (deterministic)', () => {
    const rs = makeRunStateAtQc9();
    const outcome: Outcome = { tier: 'success', stateDeltas: [{ kind: 'attempt_realm_crossing', transition: 'qc9_to_foundation' }] };
    const next = applyOutcome(rs, outcome, { rng: createRng(42) });
    const direct = runTribulationIPillar(rs.character, { rng: createRng(42), tribulationMode: 'non_fatal' });
    expect(next.pendingTribulationResult!.phases.map((p) => p.phaseId)).toEqual(direct.phaseResults.map((p) => p.phaseId));
  });
});
```

In `src/engine/events/RunState.test.ts`:

```ts
it('createRunState defaults pendingTribulationResult to undefined', () => {
  const rs = createRunState({ ...baseArgs });
  expect(rs.pendingTribulationResult).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/events/OutcomeApplier.test.ts -t "Phase 2B-3: qc9_to_foundation"`
Expected: FAIL — `pendingTribulationResult` undefined after apply.

- [ ] **Step 3: Add field to RunState**

In `src/engine/events/RunState.ts`, append to the interface:

```ts
/** Phase 2B-3: Tribulation I result captured at qc9_to_foundation, consumed by UI. */
readonly pendingTribulationResult?: PendingTribulationResult;
```

Define above the interface:

```ts
export interface PendingTribulationResult {
  readonly pillarId: 'tribulation_i';
  readonly phases: ReadonlyArray<{
    readonly phaseId: string;
    readonly success: boolean;
    readonly chance: number;
    readonly roll: number;
  }>;
  readonly fatal: boolean;
}
```

(Default in `createRunState` stays implicit — `undefined`.)

- [ ] **Step 4: Wire Tribulation I into the qc9_to_foundation case**

In `src/engine/events/OutcomeApplier.ts`, replace the existing `qc9_to_foundation` branch with:

```ts
case 'qc9_to_foundation': {
  const result = runTribulationIPillar(rs.character, {
    rng: options.rng,
    tribulationMode: 'non_fatal',  // Phase 3 will flip via runtime flag
  });
  const pending: PendingTribulationResult = {
    pillarId: 'tribulation_i',
    phases: result.phaseResults,
    fatal: result.deathCause !== undefined,
  };
  return {
    ...rs,
    character: result.character,
    pendingTribulationResult: pending,
    deathCause: result.deathCause ?? rs.deathCause,
  };
}
```

Add the import: `import { runTribulationIPillar } from '@/engine/cultivation/TribulationI';` and `import type { PendingTribulationResult } from './RunState';`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/engine/events/OutcomeApplier.test.ts src/engine/events/RunState.test.ts -t "Phase 2B-3"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/events/RunState.ts src/engine/events/RunState.test.ts \
        src/engine/events/OutcomeApplier.ts src/engine/events/OutcomeApplier.test.ts
git commit -m "feat(cultivation): wire Tribulation I into qc9_to_foundation outcome"
```

---

## Task 15: Bridge surfaces Tribulation result on TurnPreview + clears pendingTribulationResult

**Files:**
- Modify: `src/services/engineBridge.ts` (in `resolveChoice` after `applyOutcome`)
- Modify: `src/services/engineBridge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('Phase 2B-3: bridge surfaces Tribulation result + clears pendingTribulationResult', () => {
  it('returns TurnPreview.tribulation when an outcome triggered Tribulation I', async () => {
    const { engine } = await setupRunAtQc9WithTribulationOutcomeChoice();
    const result = await engine.resolveChoice('attempt_foundation');
    if ('karmaEarned' in result) throw new Error('expected TurnPreview, got Bardo');
    expect(result.tribulation).toBeDefined();
    expect(result.tribulation!.pillarId).toBe('tribulation_i');
    expect(result.tribulation!.phases).toHaveLength(4);
  });
  it('clears pendingTribulationResult on the run state after surfacing', async () => {
    const { engine } = await setupRunAtQc9WithTribulationOutcomeChoice();
    await engine.resolveChoice('attempt_foundation');
    expect(useGameStore.getState().runState!.pendingTribulationResult).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/engineBridge.test.ts -t "Phase 2B-3: bridge surfaces Tribulation"`
Expected: FAIL.

- [ ] **Step 3: Lift result into TurnPreview, clear from RunState**

In `src/services/engineBridge.ts:780` (after the `applyOutcome` call returns `nextRunState`), add:

```ts
let tribulationPayload: TribulationPayload | undefined;
if (nextRunState.pendingTribulationResult) {
  tribulationPayload = {
    pillarId: nextRunState.pendingTribulationResult.pillarId,
    phases: nextRunState.pendingTribulationResult.phases,
    fatal: nextRunState.pendingTribulationResult.fatal,
  };
  // Clear so a subsequent peek/resolve doesn't re-emit it.
  nextRunState = { ...nextRunState, pendingTribulationResult: undefined };
}
```

Modify the `return doPeek();` at the bottom to instead build a preview that includes the tribulation:

```ts
// If a Tribulation just fired AND character survived, surface it on the next preview.
// (Death case still falls through to bardo via the existing nextRunState.deathCause guard.)
if (tribulationPayload && !nextRunState.deathCause) {
  // Get the next event preview, then attach the tribulation payload.
  const preview = await doPeek();
  return { ...preview, tribulation: tribulationPayload };
}
```

(Make sure this branch sits above `if (nextRunState.deathCause) { ... bardo ... }`. If death occurred, the bardo path takes over and Tribulation result is captured in lineage via Task 14's `result.character` mutation alone — no UI surfacing needed for the death branch in 2B since `tribulation_mode` is non-fatal.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/engineBridge.test.ts -t "Phase 2B-3: bridge surfaces Tribulation"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/engineBridge.ts src/services/engineBridge.test.ts
git commit -m "feat(bridge): lift Tribulation result onto TurnPreview + clear pending"
```

---

## Task 16: TribulationPanel component (4-phase reveal)

**Files:**
- Create: `src/components/TribulationPanel.tsx`
- Create: `src/components/TribulationPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TribulationPanel } from './TribulationPanel';

const samplePayload = {
  pillarId: 'tribulation_i' as const,
  phases: [
    { phaseId: 'heart_demon',    success: true,  chance: 70, roll: 22 },
    { phaseId: 'first_thunder',  success: true,  chance: 60, roll: 38 },
    { phaseId: 'second_thunder', success: false, chance: 45, roll: 88 },
    { phaseId: 'third_thunder',  success: false, chance: 30, roll: 99 },
  ],
  fatal: false,
};

describe('TribulationPanel', () => {
  it('renders all four phase rows with phase id, chance, roll, and success indicator', () => {
    render(<TribulationPanel payload={samplePayload} onContinue={() => {}} />);
    expect(screen.getByText(/heart demon/i)).toBeInTheDocument();
    expect(screen.getByText(/first thunder/i)).toBeInTheDocument();
    expect(screen.getByText(/second thunder/i)).toBeInTheDocument();
    expect(screen.getByText(/third thunder/i)).toBeInTheDocument();
    // Two successes, two failures rendered as visible markers.
    const successMarkers = screen.getAllByLabelText(/passed/i);
    const failMarkers = screen.getAllByLabelText(/failed/i);
    expect(successMarkers).toHaveLength(2);
    expect(failMarkers).toHaveLength(2);
  });
  it('shows "Tribulation Endured" for non-fatal outcome', () => {
    render(<TribulationPanel payload={samplePayload} onContinue={() => {}} />);
    expect(screen.getByText(/tribulation endured/i)).toBeInTheDocument();
  });
  it('fires onContinue on button click', async () => {
    const onContinue = vi.fn();
    render(<TribulationPanel payload={samplePayload} onContinue={onContinue} />);
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/TribulationPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement TribulationPanel**

```tsx
import type { TribulationPayload } from '@/services/engineBridge';

const PHASE_LABELS: Record<string, string> = {
  heart_demon: 'Heart Demon',
  first_thunder: 'First Thunder',
  second_thunder: 'Second Thunder',
  third_thunder: 'Third Thunder',
};

export interface TribulationPanelProps {
  payload: TribulationPayload;
  onContinue: () => void;
}

export function TribulationPanel({ payload, onContinue }: TribulationPanelProps) {
  return (
    <div className="fixed inset-0 bg-ink-950/90 flex items-center justify-center z-50 font-serif">
      <div className="bg-ink-900 border border-jade-700 rounded p-8 w-full max-w-2xl">
        <h2 className="text-3xl text-jade-300 mb-2 text-center">The Heavens Stir</h2>
        <p className="text-center text-parchment-400 mb-6 italic">
          Foundation refining begins. Four trials must be endured.
        </p>

        <ol className="flex flex-col gap-3 mb-6">
          {payload.phases.map((p) => (
            <li
              key={p.phaseId}
              className={`border rounded p-4 ${
                p.success ? 'border-jade-700 bg-ink-900' : 'border-rose-700 bg-ink-900/60'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-lg text-parchment-100">
                  {PHASE_LABELS[p.phaseId] ?? p.phaseId}
                </span>
                {p.success ? (
                  <span aria-label="Passed" className="text-jade-300 text-xl">✓</span>
                ) : (
                  <span aria-label="Failed" className="text-rose-300 text-xl">✗</span>
                )}
              </div>
              <div className="text-xs text-parchment-500 mt-1">
                rolled {p.roll} vs chance {p.chance}
              </div>
            </li>
          ))}
        </ol>

        <p className="text-center mb-6">
          {payload.fatal ? (
            <span className="text-rose-300 text-xl">The body shatters.</span>
          ) : (
            <span className="text-jade-300 text-xl">Tribulation Endured.</span>
          )}
        </p>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={onContinue}
            className="px-6 py-3 bg-jade-600 text-ink-950 rounded hover:bg-jade-500"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/TribulationPanel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/TribulationPanel.tsx src/components/TribulationPanel.test.tsx
git commit -m "feat(ui): TribulationPanel 4-phase scripted reveal"
```

---

## Task 17: PlayScreen renders TribulationPanel inline + dismiss flow

**Files:**
- Modify: `src/components/PlayScreen.tsx` (render TribulationPanel when `preview.tribulation` is set)
- Modify: `src/components/PlayScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
describe('Phase 2B-3: PlayScreen renders TribulationPanel inline', () => {
  it('shows TribulationPanel when preview.tribulation is present', async () => {
    render(
      <PlayScreen
        {...baseProps}
        preview={{
          ...baseProps.preview,
          tribulation: {
            pillarId: 'tribulation_i',
            phases: [
              { phaseId: 'heart_demon', success: true, chance: 70, roll: 22 },
              { phaseId: 'first_thunder', success: true, chance: 60, roll: 38 },
              { phaseId: 'second_thunder', success: true, chance: 45, roll: 11 },
              { phaseId: 'third_thunder', success: true, chance: 30, roll: 4 },
            ],
            fatal: false,
          },
        }}
      />
    );
    expect(screen.getByText(/the heavens stir/i)).toBeInTheDocument();
  });
  it('hides TribulationPanel after the user clicks Continue', async () => {
    render(
      <PlayScreen
        {...baseProps}
        preview={{
          ...baseProps.preview,
          tribulation: {
            pillarId: 'tribulation_i',
            phases: [{ phaseId: 'heart_demon', success: true, chance: 70, roll: 22 }],
            fatal: false,
          } as any,
        }}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.queryByText(/the heavens stir/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PlayScreen.test.tsx -t "TribulationPanel inline"`
Expected: FAIL.

- [ ] **Step 3: Render TribulationPanel inline**

In `src/components/PlayScreen.tsx`, add at the top of the component body:

```tsx
const [tribulationDismissed, setTribulationDismissed] = useState(false);
const showTribulation = !!preview.tribulation && !tribulationDismissed;
```

Reset dismissed when preview.tribulation changes:

```tsx
useEffect(() => {
  setTribulationDismissed(false);
}, [preview.tribulation]);
```

(Add `useEffect` to the React import.)

After the existing overlay renders, add:

```tsx
{showTribulation && preview.tribulation && (
  <TribulationPanel
    payload={preview.tribulation}
    onContinue={() => setTribulationDismissed(true)}
  />
)}
```

Add `import { TribulationPanel } from './TribulationPanel';` near the top.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/PlayScreen.test.tsx -t "TribulationPanel inline"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PlayScreen.tsx src/components/PlayScreen.test.tsx
git commit -m "feat(ui): PlayScreen renders TribulationPanel inline + dismiss"
```

---

## Task 18: BardoPanel reveals techniques learned + core path

**Files:**
- Modify: `src/components/BardoPanel.tsx`
- Modify: `src/components/BardoPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/BardoPanel.test.tsx`:

```tsx
describe('Phase 2B-3: BardoPanel reveals techniques + core path', () => {
  it('shows the learned techniques list when techniquesLearnedThisLife is non-empty', () => {
    render(<BardoPanel {...basePropsWith({
      techniquesLearnedThisLife: [
        { id: 'iron_body_fist', name: 'Iron Body Fist', description: 'Hardens the dantian wall.' },
      ],
    })} />);
    expect(screen.getByText(/techniques learned/i)).toBeInTheDocument();
    expect(screen.getByText(/iron body fist/i)).toBeInTheDocument();
  });
  it('shows the locked core path when corePath is set', () => {
    render(<BardoPanel {...basePropsWith({ corePath: 'iron_mountain' })} />);
    expect(screen.getByText(/core path/i)).toBeInTheDocument();
    expect(screen.getByText(/iron mountain/i)).toBeInTheDocument();
  });
  it('omits the core path section when corePath is null', () => {
    render(<BardoPanel {...basePropsWith({ corePath: null })} />);
    expect(screen.queryByText(/^core path$/i)).not.toBeInTheDocument();
  });
});
```

(Define `basePropsWith` as a helper that spreads the existing `basePayload` from the file's other tests.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BardoPanel.test.tsx -t "Phase 2B-3"`
Expected: FAIL.

- [ ] **Step 3: Add the two reveal sections to BardoPanel**

In `src/components/BardoPanel.tsx`, update `BardoPanelProps.payload` to include `corePath: string | null` and `techniquesLearnedThisLife: ReadonlyArray<RevealedTechnique>` (import the type from `engineBridge`).

After the existing 10c "Echoes unlocked" section, before the "Karma breakdown" section, add:

```tsx
{/* 2B-3: Techniques learned this life */}
{payload.techniquesLearnedThisLife.length > 0 && (
  <section className="w-full max-w-2xl bg-ink-900 border border-jade-700 rounded p-6 mb-6">
    <h3 className="text-xl mb-3 text-jade-300">Techniques learned</h3>
    <ul className="flex flex-col gap-2">
      {payload.techniquesLearnedThisLife.map((t) => (
        <li key={t.id} className="text-parchment-200">
          <div className="text-lg">{t.name}</div>
          <div className="text-xs text-parchment-500 italic">{t.description}</div>
        </li>
      ))}
    </ul>
  </section>
)}

{/* 2B-3: Core path locked this life */}
{payload.corePath && (
  <section className="w-full max-w-2xl bg-ink-900 border border-jade-700 rounded p-6 mb-6">
    <h3 className="text-xl mb-3 text-jade-300">Core Path</h3>
    <p className="text-parchment-200">
      {payload.corePath.replace(/_/g, ' ')}
    </p>
  </section>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/BardoPanel.test.tsx -t "Phase 2B-3"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/BardoPanel.tsx src/components/BardoPanel.test.tsx
git commit -m "feat(ui): BardoPanel reveals techniques + core path"
```

---

## Task 19: LineageScreen LifeCard shows corePath + techniqueCount

**Files:**
- Modify: `src/components/LineageScreen.tsx`
- Modify: `src/components/LineageScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
describe('Phase 2B-3: LineageScreen shows corePath + techniqueCount', () => {
  it('renders core path and technique count on each LifeCard', () => {
    const snap = {
      entries: [
        {
          lifeIndex: 1, name: 'Lin Wei', anchorId: 'sect_initiate', anchorName: 'Sect Initiate',
          birthYear: 100, deathYear: 145, yearsLived: 45,
          realmReached: 'qi_condensation', deathCause: 'old age',
          karmaEarned: 12, echoesUnlockedThisLife: [],
          corePath: 'iron_mountain', techniqueCount: 3,
        },
      ],
    };
    render(<LineageScreen snapshot={snap} onBack={() => {}} />);
    expect(screen.getByText(/iron mountain/i)).toBeInTheDocument();
    expect(screen.getByText(/3 techniques/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LineageScreen.test.tsx -t "Phase 2B-3"`
Expected: FAIL.

- [ ] **Step 3: Update LifeCard to render the new fields**

In `src/components/LineageScreen.tsx`, in the `LifeCard` body, after the existing `<dl>...</dl>` block, add:

```tsx
{(entry.corePath || entry.techniqueCount > 0) && (
  <div className="mt-2 text-xs text-parchment-400 flex gap-3">
    {entry.corePath && <span>Path: {entry.corePath.replace(/_/g, ' ')}</span>}
    {entry.techniqueCount > 0 && <span>{entry.techniqueCount} techniques</span>}
  </div>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LineageScreen.test.tsx -t "Phase 2B-3"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LineageScreen.tsx src/components/LineageScreen.test.tsx
git commit -m "feat(ui): LineageScreen LifeCard shows corePath + techniqueCount"
```

---

## Task 20: CodexScreen — add Techniques tab (4-tab layout)

**Files:**
- Modify: `src/components/CodexScreen.tsx`
- Modify: `src/components/CodexScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
describe('Phase 2B-3: CodexScreen Techniques tab', () => {
  it('shows the Techniques tab in the tablist', () => {
    const snap = { echoes: [], memories: [], anchors: [], techniques: [] };
    render(<CodexScreen snapshot={snap} onBack={() => {}} />);
    expect(screen.getByRole('tab', { name: /techniques/i })).toBeInTheDocument();
  });
  it('renders an empty-state message when no techniques in registry', async () => {
    const snap = { echoes: [], memories: [], anchors: [], techniques: [] };
    render(<CodexScreen snapshot={snap} onBack={() => {}} />);
    await userEvent.click(screen.getByRole('tab', { name: /techniques/i }));
    expect(screen.getByText(/no techniques catalogued/i)).toBeInTheDocument();
  });
  it('lists each technique with seen / learned distinction', async () => {
    const snap = {
      echoes: [], memories: [], anchors: [],
      techniques: [
        { id: 'iron_body_fist', name: 'Iron Body Fist', description: 'Hardens the dantian.', grade: 'mortal', seen: true, learned: true },
        { id: 'still_water_breath', name: 'Still Water Breath', description: 'Slows the breath.', grade: 'yellow', seen: true, learned: false },
        { id: 'severing_edge_form', name: 'Severing Edge Form', description: '—', grade: 'yellow', seen: false, learned: false },
      ],
    };
    render(<CodexScreen snapshot={snap} onBack={() => {}} />);
    await userEvent.click(screen.getByRole('tab', { name: /techniques/i }));
    expect(screen.getByText(/iron body fist/i)).toBeInTheDocument();
    expect(screen.getByText(/learned/i)).toBeInTheDocument();
    expect(screen.getByText(/still water breath/i)).toBeInTheDocument();
    expect(screen.getByText(/^seen$/i)).toBeInTheDocument();
    // Unseen technique renders as "— locked —"
    const lockedItems = screen.getAllByText(/— locked —/i);
    expect(lockedItems.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CodexScreen.test.tsx -t "Phase 2B-3"`
Expected: FAIL.

- [ ] **Step 3: Add the techniques tab**

In `src/components/CodexScreen.tsx`:

1. Update `Tab` type: `type Tab = 'memories' | 'echoes' | 'anchors' | 'techniques';`
2. Update tablist iteration: `(['memories', 'echoes', 'anchors', 'techniques'] as Tab[])`
3. Add the conditional render: `{tab === 'techniques' && <TechniquesTab techniques={snapshot.techniques} />}`
4. Add the component:

```tsx
import type { CodexTechniqueEntry } from '@/services/engineBridge';

function TechniquesTab({ techniques }: { techniques: ReadonlyArray<CodexTechniqueEntry> }) {
  if (techniques.length === 0) {
    return <p className="text-parchment-500 italic">No techniques catalogued.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {techniques.map((t) => (
        <li
          key={t.id}
          className={`border rounded p-4 ${
            t.seen ? 'border-parchment-700 bg-ink-900' : 'border-ash-800 bg-ink-900/40 text-ash-500'
          }`}
        >
          {t.seen ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-lg text-jade-300">{t.name}</span>
                <span className="text-xs uppercase tracking-wide text-parchment-500">
                  {t.grade} · {t.learned ? 'learned' : 'seen'}
                </span>
              </div>
              <div className="text-sm text-parchment-300 mt-1">{t.description}</div>
            </>
          ) : (
            <>
              <div className="text-lg italic">— locked —</div>
              <div className="text-xs">A technique not yet seen by the soul.</div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/CodexScreen.test.tsx -t "Phase 2B-3"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CodexScreen.tsx src/components/CodexScreen.test.tsx
git commit -m "feat(ui): CodexScreen adds Techniques tab"
```

---

## Task 21: Verify Sect Initiate locked silhouette on CreationScreen

**Files:**
- Modify: `src/components/CreationScreen.test.tsx` (add Sect Initiate-specific assertions)

This task is verification-only — the existing CreationScreen anchor render already supports locked silhouettes from 2A-3. We just confirm Sect Initiate behaves correctly.

- [ ] **Step 1: Write the test**

Add to `src/components/CreationScreen.test.tsx`:

```tsx
describe('Phase 2B-3: Sect Initiate anchor renders correctly', () => {
  const sectInitiateLocked: CreationAnchorView = {
    id: 'sect_initiate',
    name: 'Sect Initiate',
    description: 'You spawn at age 10 within Azure Peaks Sect.',
    locked: true,
    unlockHint: 'Reach Qi Sensing in any past life',
    freshlyUnlocked: false,
  };
  const sectInitiateUnlocked: CreationAnchorView = { ...sectInitiateLocked, locked: false };

  it('renders Sect Initiate as locked silhouette when meta has not unlocked it', () => {
    render(<CreationScreen anchors={[sectInitiateLocked]} onBegin={() => {}} onBack={() => {}} />);
    expect(screen.getByText(/reach qi sensing in any past life/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /locked/i })).toBeDisabled();
  });
  it('renders Sect Initiate as selectable when unlocked', () => {
    render(<CreationScreen anchors={[sectInitiateUnlocked]} onBegin={() => {}} onBack={() => {}} />);
    expect(screen.getByText(/sect initiate/i)).toBeInTheDocument();
    expect(screen.queryByText(/locked/i)).not.toBeInTheDocument();
  });
  it('applies fresh-unlock shimmer when freshlyUnlocked is true', () => {
    const { container } = render(
      <CreationScreen
        anchors={[{ ...sectInitiateUnlocked, freshlyUnlocked: true }]}
        onBegin={() => {}} onBack={() => {}}
      />,
    );
    const shimmerNode = container.querySelector('.shimmer, .animate-pulse');
    expect(shimmerNode).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it passes immediately**

Run: `npx vitest run src/components/CreationScreen.test.tsx -t "Phase 2B-3: Sect Initiate"`
Expected: PASS (verifies existing behavior covers Sect Initiate).

If a test fails, the existing CreationScreen logic needs a minor tweak — fix and re-run.

- [ ] **Step 3: Commit**

```bash
git add src/components/CreationScreen.test.tsx
git commit -m "test(ui): verify Sect Initiate locked silhouette + shimmer"
```

---

## Task 22: Tribulation I focused UI integration test

**Files:**
- Create: `tests/integration/tribulation_i_ui.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App, __resetEngineSingleton, __setEngineOverride } from '@/App';
import { createEngineBridge } from '@/services/engineBridge';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';
import { GamePhase } from '@/engine/core/Types';

describe('Phase 2B-3: Tribulation I UI fires + dismisses', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
    __resetEngineSingleton();
  });

  it('fires the TribulationPanel when player triggers qc9_to_foundation outcome', async () => {
    // Construct a saved run state at QC9 with a single event whose first choice
    // emits the qc9_to_foundation delta. Inject via test bridge.
    const engine = createEngineBridge({ now: () => 7 });
    __setEngineOverride(engine);

    // Use the bridge's test-only seeding helper to force a QC9 character.
    // (If no helper exists, write one in this test file as a direct gameStore mutation
    //  + custom Event injection into ALL_EVENTS via a __testInsertEvent hook.)
    await __seedRunAtQc9WithFoundationChoice(engine);

    render(<App />);
    await waitFor(() => expect(useGameStore.getState().phase).toBe(GamePhase.PLAYING));

    // Click the Foundation attempt button (label set on the seeded event).
    await userEvent.click(screen.getByRole('button', { name: /attempt foundation/i }));

    // Tribulation panel must appear.
    await waitFor(() => expect(screen.getByText(/the heavens stir/i)).toBeInTheDocument());
    // Four phase rows must render.
    expect(screen.getByText(/heart demon/i)).toBeInTheDocument();
    expect(screen.getByText(/first thunder/i)).toBeInTheDocument();
    expect(screen.getByText(/second thunder/i)).toBeInTheDocument();
    expect(screen.getByText(/third thunder/i)).toBeInTheDocument();

    // Dismiss.
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.queryByText(/the heavens stir/i)).not.toBeInTheDocument();

    // Game continues — character is alive (non-fatal in 2B).
    expect(useGameStore.getState().runState!.deathCause).toBeNull();
  });
});
```

(Implement `__seedRunAtQc9WithFoundationChoice` either as a helper exported by `engineBridge.ts` under `__` prefix, or inlined as direct `useGameStore.getState().seedRun(...)` + a one-shot event push into `ALL_EVENTS` via a new exported `__testInsertEvent` helper. Choose whichever is least invasive.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/tribulation_i_ui.test.tsx`
Expected: FAIL — helper not yet defined.

- [ ] **Step 3: Add the test seeding helper to engineBridge**

In `src/services/engineBridge.ts`, append:

```ts
/** Test-only: inject a synthetic event into the global pool. Used by 2B-3 integration tests. */
export function __testInsertEvent(event: EventDef): void {
  ALL_EVENTS = [...ALL_EVENTS, event];
}

/** Test-only: seed a fully-formed run at QC9 with an event whose first choice triggers Tribulation I. */
export async function __seedRunAtQc9WithFoundationChoice(engine: EngineBridge): Promise<void> {
  await engine.loadOrInit();
  await engine.beginLife('peasant_farmer', 'Tribulation Test');
  // Mutate runState to QC9 directly via gameStore.
  const gs = useGameStore.getState();
  const rs = gs.runState!;
  const c = rs.character;
  const next = {
    ...rs,
    character: {
      ...c,
      realm: 'qi_condensation',
      qiCondensationLayer: 9,
      cultivationProgress: 100,
    } as typeof c,
  };
  gs.updateRun(next, gs.streak!, gs.nameRegistry!);

  // Inject the test event with a single Foundation-attempt choice.
  __testInsertEvent({
    id: 'test_qc9_foundation_event',
    category: 'training',
    weight: 9999,
    repeatable: 'never',
    title: 'A Trial',
    body: 'You stand at the edge.',
    choices: [
      {
        id: 'attempt_foundation',
        label: 'Attempt Foundation',
        outcomes: [
          {
            tier: 'success',
            stateDeltas: [{ kind: 'attempt_realm_crossing', transition: 'qc9_to_foundation' }],
          },
        ],
      },
    ],
  } as unknown as EventDef);
}
```

(The exact `EventDef` shape may need a couple of additional fields — `regions: ['yellow_plains']`, `minAge: 0`, etc. Run the test, observe the Zod parse error, fill in required fields.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/tribulation_i_ui.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/engineBridge.ts tests/integration/tribulation_i_ui.test.tsx
git commit -m "test(integration): Tribulation I UI fires and dismisses"
```

---

## Task 23: Full multi-life UI integration — playable_life_2b

**Files:**
- Create: `tests/integration/playable_life_2b.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App, __resetEngineSingleton, __setEngineOverride } from '@/App';
import { createEngineBridge } from '@/services/engineBridge';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';
import { GamePhase } from '@/engine/core/Types';

describe('Phase 2B-3: full UI 3-life loop covers Sect Initiate unlock + technique reveal', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
    __resetEngineSingleton();
  });

  it('runs 3 lives, sees a Bardo techniques reveal, and verifies Codex Techniques tab + Lineage corePath', { timeout: 180000 }, async () => {
    const engine = createEngineBridge({ now: () => 2 });
    __setEngineOverride(engine);
    render(<App />);

    await waitFor(() => expect(screen.getByText(/thousand deaths/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /new life/i }));

    for (let life = 1; life <= 3; life++) {
      await waitFor(() => expect(screen.getByText(/choose your birth/i)).toBeInTheDocument());
      // Pick the first non-locked anchor (peasant_farmer or sect_initiate when unlocked).
      const anchorButtons = screen.queryAllByRole('button')
        .filter((b) => !(b as HTMLButtonElement).disabled
          && /peasant farmer|sect initiate|martial family|scholar|outer disciple/i.test(b.textContent ?? ''));
      await userEvent.click(anchorButtons[0]!);

      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
      if (nameInput.value === '') await userEvent.type(nameInput, `Soul${life}`);
      await userEvent.click(screen.getByRole('button', { name: /begin life/i }));

      // Run choices to death, dismissing Tribulation panels along the way.
      for (let i = 0; i < 1500; i++) {
        if (useGameStore.getState().phase === GamePhase.BARDO) break;
        // Continue past Tribulation panel if visible.
        const continueBtn = screen.queryByRole('button', { name: /^continue$/i });
        if (continueBtn) {
          await userEvent.click(continueBtn);
          continue;
        }
        const buttons = screen.queryAllByRole('button')
          .filter((b) => !(b as HTMLButtonElement).disabled
            && !/inventory|character|codex|lineage/i.test(b.textContent ?? ''));
        if (buttons.length === 0) continue;
        await userEvent.click(buttons[0]!);
      }
      expect(useGameStore.getState().phase).toBe(GamePhase.BARDO);
      await waitFor(() => expect(screen.getByText(/the bardo/i)).toBeInTheDocument());

      // Open Codex Techniques tab.
      await userEvent.click(screen.getByRole('button', { name: /codex/i }));
      await waitFor(() => expect(screen.getByText(/^Codex$/)).toBeInTheDocument());
      await userEvent.click(screen.getByRole('tab', { name: /techniques/i }));
      // Some technique label or "no techniques catalogued" must be present.
      const techPanelHasContent = !!screen.queryByText(/iron body fist|still water breath|severing edge|no techniques catalogued/i);
      expect(techPanelHasContent).toBe(true);
      await userEvent.click(screen.getByRole('button', { name: /back/i }));

      // Open Lineage and verify life shows up.
      await userEvent.click(screen.getByRole('button', { name: /lineage/i }));
      await waitFor(() => expect(screen.getByText(/^Lineage$/)).toBeInTheDocument());
      expect(screen.getByText(new RegExp(`Soul${life}`))).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /back/i }));

      // Reincarnate.
      await userEvent.click(screen.getByRole('button', { name: /reincarnate/i }));
    }

    // Final assertions: lineage has 3 entries.
    const snap = engine.getLineageSnapshot();
    expect(snap.entries).toHaveLength(3);
    // All 3 lives ran cleanly.
    expect(useMetaStore.getState().lifeCount).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/integration/playable_life_2b.test.tsx`
Expected: PASS. (May need to bump the inner loop iteration cap if death is slow.)

- [ ] **Step 3: Commit**

```bash
git add tests/integration/playable_life_2b.test.tsx
git commit -m "test(integration): Phase 2B-3 full 3-life UI loop"
```

---

## Task 24: Bundle audit — confirm main ≤450 KB raw

**Files:**
- Modify: `vite.config.ts` (only if a tweak is needed)

- [ ] **Step 1: Run the build and inspect chunk sizes**

Run: `npm run build`
Expected output: list of chunks. The `assets/index-*.js` chunk (main) must be ≤ 450 KB raw.

- [ ] **Step 2: If main exceeds 450 KB, move offending UI into the lazy chunk**

If the new InventoryPanel + CharSheetPanel + TribulationPanel etc. push main over budget:

1. Convert the heavy components (TribulationPanel + InventoryPanel + CharSheetPanel) to lazy imports in `PlayScreen.tsx`:
   ```tsx
   const InventoryPanel = lazy(() => import('./InventoryPanel').then((m) => ({ default: m.InventoryPanel })));
   ```
2. Wrap the renders in `<Suspense fallback={null}>...</Suspense>`.
3. Re-run `npm run build` and confirm.

- [ ] **Step 3: If under budget, no code change required**

Just record the actual bytes in the commit message of the next step.

- [ ] **Step 4: Commit (if any code changed)**

```bash
git add vite.config.ts src/components/PlayScreen.tsx
git commit -m "build: keep main bundle under 450 KB after 2B-3 UI additions"
```

If no code changed, skip this commit and report bundle size in the PR description.

---

## Task 25: Run full test suite + typecheck + record metrics

- [ ] **Step 1: Run vitest**

Run: `npx vitest run --reporter=dot`
Expected: All tests pass. Record total count.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds. Record main + lazy chunk sizes.

- [ ] **Step 4: Note results** (in PR body when opening, not as a commit)

Format:
```
Tests: <prev> → <new> (+<delta>)
Build: <main raw> KB raw / <main gzip> KB gzip main + <lazy raw> KB raw / <lazy gzip> KB gzip lazy
```

---

## Self-Review

**Spec coverage check:**

- ✅ InventoryPanel + integration into PlayScreen — Tasks 9, 13
- ✅ TechniqueList char-sheet section — Tasks 11, 12, 13
- ✅ CorePathBadge with reveal-on-3rd-meridian shimmer — Tasks 2, 3, 10, 12
- ✅ Region indicator on PlayScreen header — Task 8
- ✅ BardoPanel extensions (techniques + core path reveal) — Task 18
- ✅ LineageScreen LifeCards show corePath + technique count — Task 19
- ✅ CodexScreen new "Techniques" tab — Tasks 7, 20
- ✅ CreationScreen Sect Initiate locked silhouette — Task 21 (verification of pre-existing behavior)
- ✅ Tribulation I UI — scripted pillar 4-phase reveal — Tasks 14, 15, 16, 17
- ✅ Full multi-life UI integration test — Task 23
- ✅ Bundle audit — Task 24

**Type consistency:** `TurnPreview`, `BardoPayload`, `LineageEntryView`, `CodexSnapshot`, `RevealedTechnique`, `CodexTechniqueEntry`, `TribulationPayload`, `PendingTribulationResult`, `TurnPreviewTechnique`, `TurnPreviewItem`, `CharSheetPanelProps`, `CorePathBadgeProps`, `InventoryPanelProps`, `TechniqueListProps`, `TribulationPanelProps` — all defined exactly once and re-imported by name across tasks.

**Placeholder scan:** None. Every task has concrete code.

**Risks captured:**
- Task 22 + 23 may need `EventDef` Zod-schema fixups when constructing test events; budget includes time to inspect schema errors and fill required fields.
- Task 24 may require lazy-import refactor if main bundle grows past 450 KB. Headroom is 0.76 KB before this work.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-26-phase-2b3-ui-tribulation-integration.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch with checkpoints

Which approach?
