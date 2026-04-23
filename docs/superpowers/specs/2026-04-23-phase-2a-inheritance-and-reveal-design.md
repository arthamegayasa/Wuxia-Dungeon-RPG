# Phase 2A — Cross-Life Inheritance & Reveal

**Status:** Design spec (brainstormed 2026-04-23)
**Supersedes:** CLAUDE.md "Phase 2 candidate decomposition"
**Next step:** Write implementation plans (2A-1 / 2A-2 / 2A-3)

---

## 1. Context

Phase 1 shipped a complete single-life vertical slice: anchor → named character → Yellow Plains life (50 events) → death → bardo → karma shop → reincarnate. What's missing is everything that makes this a *reincarnation* game and not a single-life roguelike.

Phase 2 as specified in [`docs/spec/design.md`](../../../docs/spec/design.md) §13 covers: Soul Echoes, Forbidden Memories, MoodFilter completion, +3 anchors, Azure Peaks region, Qi Sensing/Condensation realms, technique registry, core-path detection, Codex/Lineage UI. This is too large for one plan.

**Decomposition (brainstormed 2026-04-23):**

- **Phase 2A (this spec) — Cross-Life Inheritance & Reveal:** echoes + memories + MoodFilter + +3 anchors + Codex + Lineage + enhanced Bardo/Creation. Engine + reveal UI shipped together so inheritance is *felt*, not just stored.
- **Phase 2B (future spec) — Region & Progression Breadth:** Azure Peaks content, technique registry + 10 techniques, core-path detection, Qi Sensing/Condensation realms, expanded snippet corpus.

**North star for 2A:** every play feels distinct (anchors + echoes change opening/outcomes), every reincarnation feels earned (Codex/Lineage show accumulated state, Bardo reveals unlocks with ceremony).

## 2. Scope & exit criteria

### In scope
- Soul Echo system (§7.2)
- Forbidden Memory system (§7.3)
- MoodFilter extension (§6.4) — adjective-substitution dict + interior-thought injection rate
- +3 anchors: Martial Family, Scholar's Son, Outer Disciple (§7.4)
- Codex screen (§11.8) — 3 populated tabs: Memories, Echoes, Anchors
- Lineage screen (§11.7) — basic card-per-life layout
- Enhanced Bardo (§11.6) — echo reveal + memory witness reveal + manifestation moment
- Enhanced Creation — anchor picker with unlock state + hint
- Save migration: `MetaState` v2 → v3

### Exit criteria (all must pass to merge 2A)
1. A Life N+1 character inherits a specific echo from Life N, deterministically, given the same seed (proven by unit test).
2. A Forbidden Memory witnessed in Life N can manifest in Life N+5 (proven by 5-life integration test).
3. MoodFilter adjective substitution and interior-thought injection rate both active (proven by snapshot test showing same template emits different text under two different moods).
4. All 5 anchors (True Random, Peasant Farmer, Martial Family, Scholar's Son, Outer Disciple) selectable and produce different starting states (distinct `Character` attributes or starting flags).
5. Codex screen renders actual accumulated data after ≥2 lives (not placeholder).
6. Lineage screen lists past lives with year range, anchor, realm, cause, echoes unlocked that life.
7. A Phase 1 save file (MetaState v2) loads and upgrades cleanly to v3 with existing karma preserved and empty echo/memory state.
8. Full 5-life headless integration test passes.

### Explicitly out of scope (deferred)
- Technique registry and technique-learning (→ 2B)
- Azure Peaks, Imperial Capital regions (→ 2B / Phase 3)
- Core paths detection (→ 2B)
- New realms Qi Sensing / Qi Condensation 1-9 (→ 2B)
- Heavenly Notice (§7.5), Karmic Hunters, Karmic Imprints (§7.6) (→ Phase 3)
- Codex tabs: Regions, Factions, Threads, People, Techniques, Items (→ later phases when data exists)
- Cross-life Threads marginalia on Lineage cards (→ Phase 3)

## 3. Engine subsystems

### 3.1 Soul Echoes (§7.2)

**Data shapes:**

```ts
// src/engine/meta/SoulEcho.ts
interface SoulEcho {
  id: string;
  name: string;
  description: string;
  tier: 'fragment' | 'partial' | 'full';
  unlockCondition: UnlockCondition;
  effects: EchoEffect[];
  conflicts: string[];           // ids of incompatible echoes
  reveal: 'birth' | 'trigger';   // when player learns they have it
}

type UnlockCondition =
  | { kind: 'reach_realm'; realm: Realm; sublayer?: number }
  | { kind: 'choice_category_count'; category: ChoiceCategory; count: number }
  | { kind: 'outcome_count'; outcomeKind: string; count: number }
  | { kind: 'lives_as_anchor_max_age'; anchor: AnchorId; lives: number }
  | { kind: 'died_with_flag'; flag: string }
  | { kind: 'flag_set'; flag: string };

type EchoEffect =
  | { kind: 'stat_mod'; stat: AttributeKind; delta: number }
  | { kind: 'stat_mod_pct'; stat: AttributeKind; pct: number }
  | { kind: 'resolver_bonus'; category: ChoiceCategory; bonus: number }
  | { kind: 'event_weight'; eventTag: string; mult: number }
  | { kind: 'starting_flag'; flag: string }
  | { kind: 'heal_efficacy_pct'; pct: number }
  | { kind: 'hp_mult'; mult: number }
  | { kind: 'mood_swing_pct'; pct: number }
  | { kind: 'body_cultivation_rate_pct'; pct: number }
  | { kind: 'insight_cap_bonus'; bonus: number }
  | { kind: 'old_age_death_roll_pct'; pct: number }
  | { kind: 'imprint_encounter_rate_pct'; pct: number };  // stub in 2A (imprints are Phase 3)
```

**Modules:**

- `EchoRegistry` (`src/engine/meta/EchoRegistry.ts`) — immutable map of all known echoes. Loaded from `src/content/echoes/echoes.json` via zod-validated loader.
- `EchoTracker` (`src/engine/meta/EchoTracker.ts`) — life-scoped counters. Tracks progress toward unlock conditions during a life (e.g., sword-category choice count, heal events performed, resisted temptations). Committed to `MetaState.echoProgress` on death.
- `EchoUnlocker` (`src/engine/meta/EchoUnlocker.ts`) — on death, evaluates each locked echo's `unlockCondition` against the finalized life state + accumulated `MetaState.echoProgress`. Newly unlocked echoes added to `MetaState.echoesUnlocked[]`.
- `EchoRoller` (`src/engine/meta/EchoRoller.ts`) — at birth, picks `slotCount` echoes from unlocked pool using seeded RNG. Conflict resolution: drop later-rolled if it conflicts with earlier-rolled, re-roll.
- `EchoApplier` (`src/engine/meta/EchoApplier.ts`) — applies rolled echoes' effects to `Character` post-construction. Stat mods stack; `stat_mod_pct` applied after flat `stat_mod`.

**Slot count (2A formula):**

```
echoSlots = 1                                           // baseline
          + karmicUpgradeLevel('carry_the_weight')      // +0 / +1 / +2
          // + floor(heavenlyNotice / 25)               // DEFERRED TO PHASE 3
```

Hard cap: 6.

**Canonical echo roster (10, 2A):**

| id | name | unlock condition | key effect |
|----|------|------------------|------------|
| `iron_body` | Iron Body | Reached Body Tempering 5 (1 life) | +20% HP, +10% body cultivation rate |
| `sword_memory` | Sword Memory | 100+ sword-category choices across lives | +15 melee, unlock sword intuition check |
| `doctors_hands` | Doctor's Hands | 50+ heal events performed across lives | +30% heal efficacy, +5 herb lore |
| `cold_resolve` | Cold Resolve | Resisted 10 temptations across lives | -10% mood swing amplitude |
| `regret_unspoken` | Regret of the Unspoken | Died with `unfulfilled_vow` flag | +15 Charm, +10 starting insight |
| `farmers_eye` | Farmer's Eye | 5+ lives as Peasant reaching max age | +20% survival checks, weather omens |
| `hollow_teacher` | Hollow Teacher | Reached Foundation with zero techniques learned | +25% meridian-opening insight |
| `patience_of_stone` | Patience of Stone | Lived ≥ 90 years in a single life | -20% old-age death roll |
| `vessel_understanding` | Vessel of Understanding | Hit insight cap in 3 lives | Insight cap +50 |
| `ghost_in_mirror` | Ghost in the Mirror | Died in same region 3 consecutive lives | +100% Karmic Imprint encounter rate (effect stub in 2A — Imprints are Phase 3; echo slot is still consumed) |

**Conflicts (2A pool):** none. `cold_resolve` ↔ `wildfire_heart` pair from spec §7.2 deferred because `wildfire_heart` is not in the 2A roster. `EchoRoller.resolveConflicts` is still implemented + unit-tested with a fabricated conflict pair to prove the logic; the content-facing `conflicts` field stays empty in all 10 echoes until Phase 3 expands the roster. Spec §7.2 authoring tag: "noted, deferred".

**Rejected for 2A (documented for reviewer transparency):**
- `demonic_whisper` — unlock requires "survived cult encounter" (cult content is Phase 3). Would be authored dead-code in 2A; defer to Phase 3 with cult content.
- `blood_remembers` — unlock requires death to a Karmic Hunter (Phase 3). Same reasoning.

### 3.2 Forbidden Memories (§7.3)

**Data shapes:**

```ts
// src/engine/meta/ForbiddenMemory.ts
interface ForbiddenMemory {
  id: string;                   // also the techniqueId placeholder (no registry in 2A)
  name: string;
  description: string;
  element: 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'void';
  witnessFlavour: Record<MemoryLevel, string>;         // snippet keys
  manifestFlavour: string;                              // snippet key
  manifestInsightBonus: number;                         // insight granted on successful manifest
  manifestFlag: string;                                 // flag set on successful manifest: e.g. 'remembered_frost_palm'
  requirements: MemoryRequirements;                     // used by 2B when techniques land
}

type MemoryLevel = 'fragment' | 'partial' | 'complete';

interface MemoryRequirements {
  minMeridians?: number;
  minRealm?: Realm;
}
```

**Modules:**

- `MemoryRegistry` (`src/engine/meta/MemoryRegistry.ts`) — loaded from `src/content/memories/memories.json`.
- `MemoryWitnessLogger` (`src/engine/meta/MemoryWitnessLogger.ts`) — exposes `logWitness(runState, techniqueId)`. Dedupes per-life (once per life per memory). On death, increments lifetime witness counter in `MetaState.memoriesWitnessed[techniqueId]`.
- `MemoryLevelCalc` — utility: `levelOf(lifetimeWitnesses)`:
  - `1-2` → `fragment`
  - `3-6` → `partial`
  - `≥7` → `complete`
- `MemoryManifestResolver` (`src/engine/meta/MemoryManifestResolver.ts`) — called on meditation events (new event tag `meditation`). Per life, max 3 attempts. Formula (§7.3):

  ```
  manifestChance = 2
                + character.mind * 0.1
                + character.insight * 0.01
                + memoryLevel * 5                 // fragment=1, partial=2, complete=3
                + karmicUpgradeLevel('student_of_the_wheel') * 25
                // - notice_suppression          // DEFERRED (no Notice in 2A)
  manifestChance = clamp(manifestChance, 1, 60)
  ```

  Rolled per witnessed memory, random ordering. On success: appends memory id to `MetaState.memoriesManifested[]`, grants `character.insight += manifestInsightBonus`, sets `runState.flags[manifestFlag] = true`, emits `MemoryManifestEvent` for UI.

  **`requirements` field in 2A:** `minMeridians` / `minRealm` in the Memory schema are authored now for 2B readiness but **not checked** at manifest time in 2A. In 2A, manifestation always succeeds-or-fails purely on the probability roll — the insight bonus + flag are granted regardless of meridian/realm. 2B adds the requirements check that gates the flag → usable-technique conversion.

**New choice-event outcome kind:**

```ts
// src/engine/choice/StateDelta.ts
| { kind: 'witness_memory'; techniqueId: string }
```

Integrated into `OutcomeApplier` — calls `MemoryWitnessLogger.logWitness`. Zod schema updated.

**New event tag:** `meditation`. Events tagged this way trigger `MemoryManifestResolver` after normal outcome application.

**Authored memories (5, 2A):**

| id | name | element | requirements (2A unused, 2B-ready) |
|----|------|---------|------------------------------------|
| `frost_palm_severing` | Frost Palm Severing | water | minMeridians: 3 |
| `crimson_spear_river` | Crimson Spear That Crosses the River | fire | minRealm: Qi Condensation |
| `silent_waters_scripture` | Scripture of the Silent Waters | water | minMeridians: 1 |
| `iron_bamboo_stance` | Iron Bamboo Stance | wood | minMeridians: 2 |
| `hollow_mountain_breath` | Hollow Mountain Breath | earth | minRealm: Foundation |

### 3.3 MoodFilter extension (§6.4)

Phase 1C shipped mood detection and snippet tag-bias. 2A adds the remaining two §6.4 mechanisms:

**Adjective substitution:**
- `src/narrative/MoodAdjectiveDict.ts` — exports `substitute(text, mood): string`. Post-pass applied after `TemplateExpander.expand()` in `Composer`.
- Dictionary seed: ~20 adjective keys × 6 moods (120 substitutions). Examples: `warm` → `{ melancholy: 'lonely', rage: 'stifling', serenity: 'gentle' }`. Unmatched moods leave word untouched.
- Word-boundary regex substitution; case preserved.

**Interior-thought injection:**
- `src/narrative/InteriorThoughtInjector.ts` — decides whether to inject a reflective sentence after an event's main narration.
- Rate: `injectRate = 0.30 × (character.mind / 50) × moodLyricalBias`, clamped `[0, 0.6]`. Mood biases: melancholy 1.2, serenity 1.0, sorrow 1.1, resolve 0.9, rage 0.6, paranoia 0.7.
- Injected text template: `"$[reflection.$[MOOD].$[REALM].1]"` (snippet key). If no snippet exists for `$[REALM]`, fall back to `$[reflection.$[MOOD].mortal.1]`.
- Uses derived seed `hash(runSeed, turnIndex, 'interior')` for determinism.

**Determinism:** both passes deterministic given `(runState, seed)`. Covered by `Composer.determinism.test.ts`.

## 4. Anchors (§7.4)

**+3 anchors authored in 2A:**

| id | display name | unlock condition | target region | 2A spawn region (fallback) | starting age | karma mult |
|----|--------------|------------------|---------------|----------------------------|--------------|------------|
| `martial_family` | Martial Family | Reached Body Tempering 5 in any life | `yellow_plains` | `yellow_plains` | 8 | 0.9 |
| `scholars_son` | Scholar's Son | Read ≥10 tomes in one life | `imperial_capital` | `yellow_plains` | 10 | 0.9 |
| `outer_disciple` | Outer Disciple | Flag `befriended_sect_disciple` set | `azure_peaks` | `yellow_plains` | 15 | 0.8 |

**Placeholder-region pattern:** anchor schema adds `targetRegion: RegionId` and `spawnRegionFallback?: RegionId`. Resolution: if `targetRegion` is in `loadedRegions` set, use it; otherwise use `spawnRegionFallback`. No user-facing "placeholder" text — the character simply spawns in Yellow Plains with the anchor's starting conditions intact (family flags, attribute bases, starting age/items).

**Starting attribute bases (from §3 + anchor flavour):**

| anchor | body | mind | soul | heart | fate | will |
|--------|------|------|------|-------|------|------|
| peasant_farmer (existing) | +2 | 0 | 0 | 0 | 0 | +1 |
| martial_family | +3 | 0 | 0 | 0 | 0 | +2 |
| scholars_son | 0 | +4 | 0 | 0 | +1 | 0 |
| outer_disciple | +1 | +1 | +1 | 0 | +2 | 0 |
| true_random (existing) | 0 | 0 | 0 | 0 | 0 | 0 |

**Starting flags:**
- `martial_family`: `{from_martial_family: true, parent_is_fighter: true}`
- `scholars_son`: `{literate: true, family_has_library: true}`
- `outer_disciple`: `{outer_sect_member: true, sect_id: 'placeholder_sect'}`

Unlock conditions authored to fire from existing Phase 1 Yellow Plains events (training for `martial_family`, study events for `scholars_son`, social for `outer_disciple`).

## 5. Content authoring

### 5.1 Echoes corpus
10 entries in `src/content/echoes/echoes.json`. Zod-validated via new `EchoSchema` (`src/content/schema.ts`).

### 5.2 Memories corpus
5 entries in `src/content/memories/memories.json`. Zod-validated via new `MemorySchema`. Includes witness and manifest snippet-key references; corresponding snippets added to `src/content/snippets.json`.

### 5.3 Event retrofits (~20 events)
Existing 50 Yellow Plains events in `src/content/events/` retrofitted with new outcome metadata. **No narrative copy changes.** Two categories:

- **Echo-trigger hooks (~10 events):** add outcomes that increment `EchoTracker` counters (e.g., training events → `sword_category_count++`, healing events → `heal_count++`). Hooks are implicit — handled by categorising the event's existing tags, not adding new outcome kinds.
- **Witness hooks (~10 events):** add `{kind: 'witness_memory', techniqueId: 'X'}` to one outcome branch. E.g., "Village Duel" event's "Watch the Fight" outcome witnesses `iron_bamboo_stance`.

### 5.4 New events (5-10 anchor-bridging events)
Each new anchor gets 2-3 opening-beat events for its first year. Fires only if `startingAnchor === X`. Examples:

- `martial_family_morning_drill` (age 8-9): father drills the child; choice (push harder / take it easy / try a new form). Sets flag `martial_training_started`.
- `scholars_son_library` (age 10-11): discover father's book on arrays; choice (study seriously / memorize by rote / daydream). Sets flag `first_formation_concept`.
- `outer_disciple_chores` (age 15-16): inner disciple assigns menial work; choice (obey / quiet rebellion / find a workaround). Sets flag `seen_sect_hierarchy`.

No new regions / locales needed — all events use Yellow Plains locale strings.

### 5.5 New meditation events
2-3 new events tagged `meditation`, triggering `MemoryManifestResolver`. Gated by minimum `Mind` or specific flag (e.g., `apprentice`, `literate`).

### 5.6 Snippet additions
- ~40 new snippet leaves in `src/content/snippets.json`:
  - `reflection.{mood}.{realm}.*` (6 moods × 3 realms present in 2A × 2 variants = 36)
  - `memory.witness.{id}.*` (5 memories × 2 variants = 10)
  - `memory.manifest.{id}.*` (5 memories × 2 variants = 10)
  - anchor-specific opener snippets
- Stays well under Phase 2 target of ~200 leaves (most of the 200 target falls to 2B Azure Peaks).

## 6. UI

### 6.1 Codex (§11.8, 3 tabs)

**File:** `src/ui/screens/CodexScreen.tsx`. Top-level tab bar (Memories / Echoes / Anchors). Selected tab persists in local component state only.

- **Memories tab:** lists all memories in `MemoryRegistry`. Each entry shows name + element icon. Unwitnessed → silhouette + hint text "Seen nowhere yet." Witnessed → current level badge (Fragment / Partial / Complete) + description. Manifested → "Recalled" badge + list of lives it manifested in.
- **Echoes tab:** lists all echoes in `EchoRegistry`. Unlocked → name + description + effect summary. Locked → silhouette + unlock hint (derived from `unlockCondition`, human-readable).
- **Anchors tab:** lists all anchors in `AnchorRegistry`. Unlocked → name + description + karma multiplier. Locked → silhouette + unlock hint.

Styling: parchment palette, serif headings, jade highlights for unlocked entries, ash for locked silhouettes.

**Entry point:** new "Codex" button on TitleScreen and BardoPanel.

### 6.2 Lineage (§11.7)

**File:** `src/ui/screens/LineageScreen.tsx`. Scroll container; one `LifeCard` per entry in `MetaState.pastLives[]`, reverse chronological (most recent first).

`LifeCard` shape:
```
┌─────────────────────────────────────┐
│  III — Lin Wei (Year 783 – 812)     │
│  Anchor: Peasant Farmer             │
│  Realm: Body Tempering 4            │
│  Cause: Qi deviation                │
│  Epitaph: "..."  (if set)           │
│  + Echo unlocked this life: Iron Body │
└─────────────────────────────────────┘
```

No Threads marginalia (Phase 3).

**Entry point:** "Lineage" button on TitleScreen and BardoPanel.

**Data source:** `MetaState.pastLives: LineageEntry[]` — pushed on death (in `BardoFlow`), one entry per completed life, containing `{runId, index, name, yearStart, yearEnd, anchorId, finalRealm, deathCause, epitaph?, echoesUnlockedThisLife: string[]}`.

### 6.3 Enhanced Bardo (§11.6 step 10 + insertions)

Existing `BardoPanel` (Phase 1D-2) extended. Reveal sequence additions:

- **Step 10a (new):** if any memory manifested this life, show "You remembered…" card with memory name and manifest flavour snippet, one per manifestation.
- **Step 10b (new):** memories *witnessed* this life listed compactly — "You saw: Frost Palm Severing (+witness)". No per-memory card animation — a single compact block.
- **Step 10c (new, replaces existing 10):** echoes *unlocked this life* appear one by one, jade-card animation. Echoes already unlocked before this life are not re-revealed.

Reveal runs even if the player dies in childhood (§14, edge-case row).

### 6.4 Enhanced Creation

Existing `CreationScreen` (Phase 1D-2) extended:

- Anchor picker shows all 5 anchors.
- Unlocked anchors render full; locked anchors render as silhouette card + hint text (e.g., "Reach Body Tempering 5 in a past life").
- Anchors unlocked in the most recent life get a subtle shimmer animation on their card for one creation cycle (first time after unlock).

## 7. Save migration

### 7.1 Schema bump

`MetaState` version: `2 → 3`.

**Additions:**

```ts
interface MetaStateV3 extends MetaStateV2 {
  schemaVersion: 3;                                         // bumped from 2

  // Echoes
  echoesUnlocked: string[];                                 // ids
  echoProgress: Record<string, number>;                     // echoId → progress counter

  // Memories
  memoriesWitnessed: Record<string, number>;                // techniqueId → lifetime witness count
  memoriesManifested: string[];                             // techniqueIds that have manifested ≥1 time across all lives

  // Lineage
  pastLives: LineageEntry[];

  // Reserved for Phase 3
  heavenlyNotice: number;                                   // always 0 in 2A
}
```

### 7.2 Migrator.migrate(v2 → v3)

Fills new fields with defaults:
```ts
{
  schemaVersion: 3,
  echoesUnlocked: [],
  echoProgress: {},
  memoriesWitnessed: {},
  memoriesManifested: [],
  pastLives: [],
  heavenlyNotice: 0,
  ...v2,  // karma + karmicUpgrades preserved
}
```

Test: `Migrator.v2_to_v3.test.ts` — load Phase 1 save fixture, migrate, assert karma preserved + new fields defaulted.

### 7.3 Content-loader impact

`loadEvents` and `loadSnippets` remain backward-compatible. New loaders: `loadEchoes`, `loadMemories`. All loaders validate via zod.

## 8. Integration tests

### 8.1 `tests/integration/echo_inheritance.test.ts`
- Seeded RNG, fresh `MetaState`.
- Life N: anchor = martial_family, force character through Body Tempering 5 breakthrough → on death, assert `iron_body` in `echoesUnlocked`.
- Life N+1: same MetaState, anchor = martial_family, same seed → assert `character.echoes` includes `iron_body` with stat mods applied.

### 8.2 `tests/integration/memory_manifestation.test.ts`
- 5-life headless playthrough, seeded.
- Life 1: witness `frost_palm_severing` via scripted event.
- Lives 2-4: characters don't witness it.
- Life 5: character has high Mind + karmic upgrade `student_of_the_wheel` L1; force 3 meditation events.
- Assert: `memoriesManifested` contains `frost_palm_severing` at least once AND flag `remembered_frost_palm_severing` set on at least one turn in Life 5's `runState`.

### 8.3 `tests/integration/mood_filter_variance.test.ts`
- Same event, same seed, two different mood states (melancholy vs rage).
- Render both via `Composer`.
- Assert: adjective substitution changed at least one word; interior-thought injection differs (presence or content).

### 8.4 `tests/integration/playable_life_2a.test.ts`
Extension of Phase 1D-3's `playable_life.test.ts`:
- Uses new anchor `martial_family`.
- Plays to death.
- Asserts Codex/Lineage data populated correctly.
- Reincarnates with a rolled echo, verifies character attributes show echo effect.

All existing Phase 1 integration tests must continue to pass unmodified.

## 9. Implementation plan split

Three separate plans, three PRs, matching the Phase 1D cadence:

### 9.1 Phase 2A-1 — Engine foundations
- SoulEcho types, registry, tracker, unlocker, roller, applier (+ unit tests)
- ForbiddenMemory types, registry, witness logger, level calc, manifest resolver (+ unit tests)
- `witness_memory` stateDelta + `meditation` event tag wiring
- MoodFilter: adjective substitution + interior-thought injection (+ unit tests, composer determinism test)
- `MetaState` v3 schema + `Migrator.v2_to_v3` (+ test with Phase 1 save fixture)
- `EchoRoller` conflict resolution + slot-count util (+ determinism test)
- `tests/integration/echo_inheritance.test.ts` (engine-level only — no UI)
- **Exit:** all new engine modules green; save migration round-trip works; no UI changes yet; Phase 1 suite unbroken.

### 9.2 Phase 2A-2 — Content authoring
- `src/content/echoes/echoes.json` — 10 canonical echoes
- `src/content/memories/memories.json` — 5 memories
- `src/content/anchors/anchors.json` — 3 new anchors (extend existing loader)
- Anchor schema: add `targetRegion` + `spawnRegionFallback` fields, resolver updated
- Retrofit ~20 Yellow Plains events with echo counter hooks + witness outcomes (no narrative changes)
- 5-10 new anchor-bridging events + 2-3 meditation events
- ~40 new snippets (reflection + memory witness/manifest + anchor openers)
- `tests/integration/memory_manifestation.test.ts`
- `tests/integration/mood_filter_variance.test.ts`
- **Exit:** all 10 echoes + 5 memories valid under schema; all 3 new anchors selectable headlessly; memory-manifestation integration test green.

### 9.3 Phase 2A-3 — Reveal UI + final integration
- `CodexScreen.tsx` (Memories, Echoes, Anchors tabs)
- `LineageScreen.tsx` (card layout, data from `MetaState.pastLives`)
- Enhanced `BardoPanel` (new reveal steps 10a / 10b / 10c)
- Enhanced `CreationScreen` (locked-anchor silhouettes, hint text, shimmer)
- TitleScreen Codex + Lineage entry points
- App.tsx phase routing updates for Codex/Lineage
- `engineBridge` additions: `getCodexSnapshot`, `getLineageSnapshot`
- `tests/integration/playable_life_2a.test.ts` — full 2A playthrough incl. UI interactions
- UI smoke tests (`tests/ui/Codex.test.tsx`, `tests/ui/Lineage.test.tsx`)
- **Exit:** all exit criteria (§2 above) pass; build + lint + test suite green; bundle growth documented.

## 10. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Echo effects silently stacking incorrectly (flat+pct order, multiple echoes same stat) | Unit test per effect kind + combined-effects property test. Explicit application order documented in `EchoApplier`. |
| Memory manifest RNG consuming seed unexpectedly and drifting Phase 1 determinism | `MemoryManifestResolver` uses its own derived seed (`hash(runSeed, turnIndex, 'manifest')`). No shared stream with choice resolver. |
| Save-migration data loss | Dedicated fixture test. Migrator is additive only (never removes existing fields). |
| Placeholder-region anchor confuses user | Silently fall back; no "coming soon" text. Fallback mapping logged dev-only. |
| MoodFilter adjective substitution mangles proper nouns / names | Word-boundary regex; `NameRegistry` output treated as protected tokens (do not substitute within `[CHARACTER]` expansions). Covered by test. |
| Codex tab count change (Phase 3 adds Regions/etc.) breaks layout | Tab container sized by content, not fixed; adding tabs later is additive. |
| Integration test for Life N+5 manifest too flaky due to RNG | Force-seed the scenario + force `student_of_the_wheel L1` to boost manifest chance; assert on manifestation within Life 5, not earlier. |

## 11. Known Phase 1 carry-overs (explicit non-goals for 2A)

These Phase 1 trade-offs (per CLAUDE.md) remain accepted:
- `peekNextEvent` / `resolveChoice` RNG stream split — NOT addressed in 2A.
- `onContinue` consuming a turn on resume — NOT addressed in 2A.
- Item registry — NOT addressed in 2A (still opaque strings).

Any of these can be picked up as a standalone small plan if they bite; they are not blockers for 2A.

## 12. Spec bug-flag convention

Per CLAUDE.md, plans for Phase 2A should continue the Phase 1 convention of implementer/reviewer subagents flagging spec or plan bugs transparently in commit messages and PR descriptions. Any divergence from this spec during implementation must be called out, not silently resolved.

## 13. Open questions (deferred to plan-writing)

- Exact `EchoTracker` counter keys and which existing Phase 1 events map to which counters — to be enumerated in 2A-2 plan.
- Exact snippet text for 40 new snippet leaves — drafted during 2A-2 implementation.
- Codex screen navigation (tabs vs. breadcrumb) final pick — to be decided in 2A-3 plan with a quick mockup check.
- Whether Codex/Lineage entry points on TitleScreen should be disabled until ≥1 life completed — UX call, to decide in 2A-3.

---

**Spec status:** ready for plan-writing. Next: invoke `superpowers:writing-plans` to produce three implementation plans (2A-1 / 2A-2 / 2A-3), each on its own branch, each with its own PR, following Phase 1's methodology.
