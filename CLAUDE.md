# Wuxia Dungeon RPG v2 — Working Context

This file orients Claude Code for any session. Read it first.

## What this project is

A rebuild of a browser-based text RPG ("Wuxia Dungeon RPG") into a deterministic, LLM-free reincarnation roguelike. Code name: **The Thousand Deaths of a Would-Be Immortal**.

- **Stack:** React 19 + TypeScript 5.8 + Vite 6 + Vitest 4 + Zustand 5 + Zod 4 + idb 8
- **Design spec (source of truth):** [`docs/spec/design.md`](docs/spec/design.md) — 2,344 lines, 14 sections. Read §1 (pillars), then relevant section for whatever phase you're implementing.
- **Pure client-side.** No backend. No LLM. Deterministic via seeded Mulberry32 RNG in every decision.

## Working methodology — MUST follow

Every phase follows this loop:

1. **Plan** written via `superpowers:writing-plans` skill → `docs/superpowers/plans/YYYY-MM-DD-<phase>.md`
2. **Branch** created from main (`phase-XX-<name>`)
3. **Plan doc committed** on the branch as first commit
4. **Tasks executed** via `superpowers:subagent-driven-development` skill:
   - Implementer subagent (TDD: red → green → commit) per task
   - Spec + quality reviewer subagent per task
5. **Push** branch, open PR to main, wait for CI green, merge with `--merge` + `--delete-branch`
6. `git checkout main && git pull --ff-only && git fetch --prune`

For **large phases** (e.g., Phase 2+), brainstorm first via `superpowers:brainstorming` to split into sub-phases, then plan each sub-phase independently.

**Non-negotiable rules:**
- Never implement directly on `main`. Always branch.
- TDD: write failing test → verify fail → implement minimum → verify pass → commit. One commit per task.
- Every module has a `*.test.ts`. No untested production code.
- Every random decision goes through `IRng` (never `Math.random`).
- Every state mutation returns a new record (immutable).
- All content JSON is zod-validated at load time.
- Commits use Conventional Commits: `feat(area): ...`, `fix: ...`, `test: ...`, `docs: ...`, `chore: ...`, `build: ...`, `ci: ...`, `refactor: ...`.

## Full roadmap (from spec §13)

The spec defines 6 major phases (0–5). Each ships a standalone playable build with an explicit exit criterion. Phases 0, 1, 2A, and Phase 2B sub-phases 2B-1+2B-2 are **complete** (15 PRs merged). Phase 2B-3 + 3-5 remain.

| Phase | Title | Deliverable | Status |
|-------|-------|-------------|--------|
| **0** | Foundation | Engine skeleton, RNG, SaveManager, TitleScreen, CI | ✅ merged (see Phase 1 table below for full breakdown) |
| **1** | The Mortal's Burden | Vertical slice: Peasant Farmer anchor, Yellow Plains, Body Tempering, 50 events, karma cycle | ✅ **complete** — delivered across 1A/1B/1C/1D-1/1D-2/1D-3 |
| **2** | The Wheel Turns | Meta-progression real: Echoes + Memories + +3 anchors + Azure Peaks region + Qi Sensing/Condensation realms + MoodFilter + Codex/Lineage UI | 🟡 2A ✅ complete (inheritance + reveal UI, 4 PRs); 2B-1 ✅ + 2B-2 ✅ (engine + content, 4 PRs); **2B-3 pending** (Inventory/Technique/CorePath UI + Tribulation I UI + integration) |
| **3** | The Heavens Notice | Heavenly Notice system + Karmic Imprints + Karmic Hunters + Tribulations I-II + Foundation/Core realms + Bone Marshes + cross-life Threads + world map | ⏳ pending |
| **4** | Mind Benders | Pillar puzzles + NPC persistence + faction state + Imperial Capital + Northern Wastes + Nascent Soul realms + Tribulations III-IV | ⏳ pending |
| **5** | Ascension | Sunken Isles + Void Refinement + Immortal realms + Tribulations V-IX + 5 true endings + PWA | ⏳ pending |

## Phase 1 completion — detailed

Phase 1 was split into 7 sub-phases executed between 2026-04-21 and 2026-04-23.

| Sub-phase | Scope | Tests | PR / Commit |
|-----------|-------|-------|-------------|
| 0 | Engine scaffold: RNG, EventBus, StateMachine, SaveManager envelope + tmp-swap, Migrator, Zustand stores, content loader stub, TitleScreen, CI (GitHub Actions) | ~180 | [#1](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/1) → `32c2b60` |
| 1A | Character Foundation: 6 attributes, spirit roots (full table + tier rolls), 12 meridians, core paths (5), realm metadata + cultivation progress + sub-layer breakthrough, old-age death ticker | +90 | [#2](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/2) → `8f6b2fa` |
| 1B | Choice-Event Engine: event/choice/outcome Zod schemas, condition evaluator, event selector with weight + repeat gates, §5.3 probability resolver (5-tier), outcome resolver + applier (16 stateDelta kinds), streak tracker with buff, age tick with TimeCost brackets | +80 | [#3](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/3) → `802b1bb` |
| 1C | Narrative Composer MVP: mood system (6 moods + tie-break), SnippetLibrary with tag bias, TemplateExpander (`$[KEY]` + `[VAR]`), NameGenerator + NameRegistry + name caching, Composer orchestrator | +50 | [#4](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/4) → `467b55c` |
| 1D-1 | Engine Glue: Anchor schema + 2 defaults (true_random, peasant_farmer), AnchorResolver, characterFromAnchor, KarmicInsightRules (per-life earn table), KarmicUpgrade (5 defaults: Awakened Soul L1-L3 + Heavenly Patience L1-L2), MetaState record + SaveManager integration, RunSave, BardoFlow, GameLoop.runTurn, life-cycle integration test | +67 | [#5](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/5) → `cc71795` |
| 1D-2 | UI Wiring: real `engineBridge` (loadOrInit, beginLife, chooseAction, beginBardo, spendKarma, reincarnate), CreationScreen, PlayScreen, BardoPanel, App.tsx phase routing, realm-karma cumulative fix (§7.1 correction), legacy Gemini-era component deletion (SetupScreen/StatusPanel/StoryPanel), full click-through integration test | +42 | [#6](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/6) → `e6fc239` |
| 1D-3 | Content Authoring: loadEvents + loadSnippets JSON loaders, 50 Yellow Plains events (12 daily + 10 training + 10 social + 8 danger + 8 opportunity + 2 transition), 80-leaf × 240-variant snippet library, 3× expanded name pools (53 family / 82 syllables / 23 sect adj / 23 sect obj / 12 sect suffix / 17 place prefix / 17 place feature), bridge peek/resolve refactor + retry-shim removal, playable-life integration test | +61 | [#7](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/7) → `2e61259` |

**Phase 1 aggregate:** 7 PRs, 527 tests on main (from 0), 23,500+ lines, ~3 days elapsed.

**Phase 1 exit criterion** (§13, PR #7 proves): ✅ *"Player can: start → peasant life → die → bardo → spend karma → reborn → another life. Karma earned and spent affects the next life (provable by test)."*

**Test count on main**: 527 (across 74 files). Build: 388 KB JS / 110 KB gzip.

**Branch tags**: `phase-0-complete` at commit `e25a969`. **Phase 1 complete** at merge commit `2e61259`.

## Phase 2A completion — detailed

Phase 2A was rescoped during brainstorming (PR #8): the original 2A (inheritance engine) + 2B (Codex/Lineage UI) were merged into a single sub-phase delivered as 2A-1 / 2A-2 / 2A-3 so echoes/memories ship with their reveal UI. The old 2C (Azure Peaks + techniques + core paths + realm expansion) was rescoped as the new **Phase 2B**. Executed 2026-04-23 → 2026-04-25.

| Sub-phase | Scope | Tests | PR / Commit |
|-----------|-------|-------|-------------|
| 2A spec + 2A-1 plan | Docs-only: Phase 2A spec (490 lines, `docs/superpowers/specs/2026-04-23-phase-2a-inheritance-and-reveal-design.md`) + 2A-1 plan (2829 lines). Locks 2A-1/2A-2/2A-3 decomposition; rescopes old 2C → new 2B. | +0 | [#8](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/8) → `83a196c` |
| 2A-1 | Engine foundations: Soul Echo engine (types + `EchoRegistry` + `EchoTracker` + `EchoUnlocker` w/ 10 unlock-condition kinds + `EchoRoller` w/ conflict resolution + `EchoApplier` + `Character.echoes`), Forbidden Memory engine (`memoryLevelOf` fragment/partial/complete + `MemoryRegistry` + `MemoryWitnessLogger` per-life dedup + `MemoryManifestResolver` §7.3 formula w/ derived-seed RNG isolated from resolver stream, max 3 attempts/life), MoodFilter completion (`MoodAdjectiveDict` 20×6 word-boundary substitution + `InteriorThoughtInjector` Mind×mood-bias w/ derived-seed + snippet fallback chain), MetaState v1→v2 migration (fixture-tested), `engineBridge` v2 awareness, Composer `renderEvent` wires both post-passes | +71 | [#9](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/9) → `f1efa86` |
| 2A-2 | Content + engine wiring: 10 canonical echoes (§3.1 roster) + 5 forbidden memories (§3.2) + 3 new anchors (Martial Family / Scholar's Son / Outer Disciple) + 18 narrative post-pass snippets (reflection + anchor openers) + 10 witness-memory retrofits on Yellow Plains events + 6 anchor-bridging events + 3 meditation events. Engine wiring: echo roll + apply at spawn (`characterFromAnchor`), witness commit + echo-unlock evaluation + lineage annotation in `runBardoFlow`, `EchoTracker` threaded through `runTurn`/`resolveChoice` via shared `PostOutcomeHooks` helper, meditation-event manifestation roll via same helper. Closes exit #2/3/4/7. | +53 | [#10](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/10) → `337f315` |
| 2A-3 | Reveal UI: `CodexScreen` (Memories/Echoes/Anchors tabs w/ rich snapshots), `LineageScreen` (LifeCards w/ year range + anchor + realm + cause + echoes-this-life), `BardoPanel` reveal sections (manifested memories / witnessed memories / echoes unlocked) + Codex/Lineage entry buttons, `CreationScreen` locked-anchor silhouettes + shimmer on fresh-unlock, `TitleScreen` Lineage entry point. Bridge: `getCodexSnapshot`, `getLineageSnapshot`, extended `BardoPayload` reveal arrays, `locked-anchors` in `CreationPayload`. `AnchorUnlockEvaluator` wired at `runBardoFlow` (closes 2A-2 anchor-unlock-evaluator-deferred trade-off). `MetaState` v2→v3 adds `birthYear`/`deathYear` to `LineageEntrySummary`. `GamePhase.LINEAGE` added + routed in App.tsx. Full 5-life UI integration test. Closes exit #5/6/8. | +43 | [#12](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/12) → `59155d9` |

**Phase 2A aggregate:** 4 PRs (1 docs-only + 3 implementation), 527 → 694 tests on main (+167, across 74 → 102 test files), ~3 days elapsed.

**Phase 2A exit criteria** (all ✅):

1. ✅ Echo inheritance Life N → Life N+1 deterministic (`tests/integration/echo_inheritance.test.ts`)
2. ✅ Forbidden Memory witnessed in Life N can manifest in Life N+5 (`tests/integration/memory_manifestation.test.ts`)
3. ✅ MoodFilter adjective + interior-thought variance (`tests/integration/mood_filter_variance.test.ts`)
4. ✅ 5 distinct anchors registered (`Anchor.test.ts` — `true_random` + `peasant_farmer` + 3 new)
5. ✅ Codex surfaces real Memories/Echoes/Anchors data (`playable_life_2a.test.tsx` test 1)
6. ✅ Lineage shows year range / anchor / realm / cause / echoes-this-life per past life (`playable_life_2a.test.tsx` test 1)
7. ✅ MetaState v1→v2 save migration preserves Phase 1 karma + upgrades (`Migrator.v1_to_v2.test.ts`)
8. ✅ Full 5-life UI-driven integration loop (`playable_life_2a.test.tsx` test 2)

**Test count on main**: 694 (across 102 files). Build: 434.76 KB raw / 120.99 KB gzip. Phase 3 budget 450 KB raw — 15 KB headroom.

**Branch tag (suggested)**: `phase-2a-complete` at merge commit `59155d9`.

## Phase 2B partial completion — 2B-1 + 2B-2 detailed

Phase 2B was split during spec-writing into 2B-1 (engine) / 2B-2 (content + wiring) / 2B-3 (UI + Tribulation I + integration). 2B-1 and 2B-2 shipped between 2026-04-25 and 2026-04-26; **2B-3 is the only remaining sub-phase**.

| Sub-phase | Scope | Tests | PR / Commit |
|-----------|-------|-------|-------------|
| 2B spec + 2B-1 plan | 605-line design doc ([`docs/superpowers/specs/2026-04-25-phase-2b-techniques-paths-azure-peaks-design.md`](docs/superpowers/specs/2026-04-25-phase-2b-techniques-paths-azure-peaks-design.md)) covering tech registry / item registry / Azure Peaks / Qi Sensing+Condensation / Tribulation I stub / Sect Initiate anchor + 2B-1/2B-2/2B-3 decomposition. Plus 2B-1 implementation plan. | +0 | [#14](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/14) → `421507c` |
| 2B-1 | Engine foundations: `TechniqueSchema` + `TechniqueRegistry` (canLearn gating w/ specific-meridians support), `TechniqueEffect` extended with 3 new kinds (`mood_modifier`, `unlock_choice`, `cultivation_multiplier_pct`) + `CoreAffinityToken`, `affinityMultiplier` (1.0 on-path / 0.5 off-path), `resolveTechniqueBonusWithAffinity` (corePath-aware) wired at both turn call sites, `ItemSchema` + `ItemRegistry` + `Manual` discriminated subtype, partial-manual deviation-risk formula + tier resolver, `computeCultivationMultiplier` from active techniques, `Character.qiCondensationLayer` field, polymorphic `attemptSublayerBreakthrough` by realm, `attemptQiSensingAwakening` (BT9 → QS) + `attemptQiCondensationEntry` (QS → QC1), `meridian_open` outcome-applier routes through `withOpenedMeridian` (closes 1A bug), `PostOutcomeHooks.corePathRevealed` + `preRunState`, `TribulationI` scripted 4-phase pillar engine (non-fatal in 2B), `MetaState` v3 → v4 migration, **peek/resolve RNG stream split via `derivedRng`** (closes Phase 1 lingering item). | +93 | [#15](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/15) → `580efa9` |
| 2B-2 plan | 2B-2 content + engine wiring implementation plan. | +0 | [#16](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/16) → `befc78b` |
| 2B-2 | Content + engine wiring: `RegionSchema` + `RegionRegistry` + `loadRegions`, **Azure Peaks region** (qiDensity 1.5×) + namePool, `loadTechniques` + 10 canonical techniques (mortal/yellow tier), `loadItems` + 20-item corpus (6 pills + 6 manuals + 5 wpn/armor/tal + 3 misc), Sect Initiate anchor + `startingMeridians` wiring, `LifeSummary.maxRealm` + `life_reached_qi_sensing` unlock rule, registries hydrated from JSON via `engineBridge`, **forward notes wired**: `mood_modifier` → `dominantMood`, `unlock_choice` → choice rendering, `meditation_progress` StateDelta. **Azure Peaks events**: 8 daily + 6 sect-training + 6 sect-social + 5 danger + 5 opportunity + 5 realm-gate + 5 region-transition (40 total). +50 Azure Peaks snippet leaves. Phase 1 item-id backfill regression test. **Lazy-load Azure Peaks chunk via dynamic import** (spec §8.6 mitigation — Azure Peaks content + gameplay registries split into `azure-peaks.js` chunk loaded on first AP life). Integration test: Azure Peaks playable life closes exit #1 + #4. | +181 | [#17](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/17) → `25df368` |

**Phase 2B-1 + 2B-2 aggregate:** 4 PRs (1 spec + 1 engine + 1 plan + 1 content), 694 → 968 tests on main (+274, across 102 → 133 test files), ~2 days elapsed.

**Phase 2B exit criteria status** (§2 of 2B spec):

1. ✅ Azure Peaks life playable end-to-end via Sect Initiate (`tests/integration/azure_peaks_playable_life.test.ts`)
2. ✅ ≥10 techniques registered, learnable via `technique_learn` / `Manual`-read, modify ≥5 distinct later checks (`technique_bonus_resolution.test.ts`)
3. ✅ Core Path on-path full / off-path ×0.5 split in `ChoiceResolver` (resolver unit tests)
4. ✅ Qi Sensing awakening + QC progression reachable (`azure_peaks_playable_life.test.ts`; full BT1 → QC9 reachability is 2B-3 verification)
5. ⏳ **2B-3** — Inventory + Technique list UI integration tests
6. ⏳ **2B-3** — `BardoPanel` techniques+corePath / `LineageScreen` corePath+techniqueCount / `CodexScreen` Techniques tab
7. ✅ `MetaState` v3 → v4 migration (`Migrator.v3_to_v4.test.ts`)
8. 🟡 Tribulation I engine ships (non-fatal, scripted 4-phase); **UI deferred to 2B-3**
9. ✅ Bundle constraint — main 449.24 KB raw / 125.43 KB gzip (under 450 KB Phase 3 budget) + Azure Peaks lazy chunk 110.44 KB raw / 23.95 KB gzip on first-AP-life-only

**Test count on main**: 968 (across 133 files). Build: 449.24 KB raw / 125.43 KB gzip main + 110.44 KB raw / 23.95 KB gzip lazy `azure-peaks.js` chunk + 5× ~0.35 KB loader chunks. Phase 3 budget 450 KB raw — **main bundle holds 0.76 KB headroom**; Azure Peaks content already isolated to lazy chunk.

**Branch tag (suggested)**: none yet — wait for 2B complete after 2B-3 merges.

## Resuming work — next action

**Phase 2B-1 + 2B-2 are complete.** The game now ships the Azure Peaks region (lazy-loaded), 10 techniques, 20 items including 6 partial manuals, the Sect Initiate anchor (unlocks via `life_reached_qi_sensing`), Qi Sensing → Qi Condensation realms with awakening/entry helpers, the on-path/off-path technique-bonus split, and the Tribulation I scripted 4-phase pillar engine (non-fatal). Peek/resolve RNG streams are now split (closes Phase 1 lingering item).

The next step is to **write the Phase 2B-3 plan** via `superpowers:writing-plans` at `docs/superpowers/plans/2026-04-26-phase-2b3-ui-tribulation-integration.md`. Spec source: [`docs/superpowers/specs/2026-04-25-phase-2b-techniques-paths-azure-peaks-design.md`](docs/superpowers/specs/2026-04-25-phase-2b-techniques-paths-azure-peaks-design.md) §7 (search "Phase 2B-3"). 2B-3 closes the only-UI-and-final-integration gap; engine work is fully shipped.

**Phase 2B-3 scope** (from spec §7 sub-phase decomposition):

- `InventoryPanel` component + integration into PlayScreen overlay
- `TechniqueList` char-sheet section
- `CorePathBadge` with reveal-on-3rd-meridian shimmer (`corePathRevealed` post-outcome hook already firing from 2B-1)
- Region indicator on PlayScreen header
- `BardoPanel` extensions (techniques learned + core path reveal sections)
- `LineageScreen` LifeCards show corePath + technique count
- `CodexScreen` new "Techniques" tab (seen-in-world vs learned distinction)
- `CreationScreen` Sect Initiate locked silhouette until unlock (consistent with 2A-3 anchor lock UI)
- Tribulation I UI — scripted 4-phase pillar with per-phase check feedback (engine already ships; UI is the gap)
- Full multi-life UI integration test: `tests/integration/playable_life_2b.test.tsx` (3-life loop where Sect Initiate unlocks and is then used)

**Phase 2B-3 exit criteria** (closes spec §2 #5, #6, #8 full, plus bundle re-audit):

1. UI integration tests assert DOM for InventoryPanel + TechniqueList + CorePathBadge + region indicator
2. `BardoPanel` reveals this-life techniques + core path; `LineageScreen` LifeCards show both; Codex "Techniques" tab lists seen + learned
3. Tribulation I UI fires at QC9 → Foundation breakthrough attempt, runs 4-phase pillar, returns non-fatal fail (Phase 3 will flip to fatal + Heavenly Notice scaling via the existing `tribulation_mode` runtime flag)
4. Full 3-life UI loop works (`playable_life_2b.test.tsx`)
5. Bundle re-audit: main bundle stays ≤ 450 KB raw (currently 449.24 KB — UI additions must offset elsewhere or move into the lazy chunk)

**Target test count**: ~50 added → ~1018 total.

**Exact first steps for a new session:**

```bash
cd "D:/Claude Code/Wuxia RPG"
git status                           # confirm clean, on main
git pull --ff-only                   # pick up any merged work
```

Then invoke `superpowers:writing-plans` to draft 2B-3 plan, branch from main as `phase-2b3-ui-tribulation`, commit plan as first commit, then drive implementation via `superpowers:subagent-driven-development`.

## Known lingering items (Phase 1 + 2A + 2B-1/2B-2)

These are accepted trade-offs from prior phases that later phases should address, documented so they aren't re-fixed mid-flight:

- ~~**Cached-peek narrative drift**~~ (Phase 1, **closed** in 2B-1): `peekNextEvent` and `resolveChoice` now share a clean `derivedRng` split (`fix(rng): split peek/resolve RNG streams via derivedRng` → `5d33dca`). Repeated peeks no longer drift narrative.
- **`onContinue` consumes a turn on resume** (Phase 1): calls `peekNextEvent`, which runs the selector and advances turn state. **Explicitly deferred** by 2B spec §2 ("out of scope: `getCurrentPendingPreview` non-advancing resume") — re-evaluate Phase 3+ when world-map UI lands.
- **Event flags unconsumed** (Phase 1): Phase 1D-3 events set ~20 flags (e.g., `married`, `friend_of_elder`, `apprentice`, `has_child`) that no current event gates on. 2A-2 wired witness-memory + anchor-bridging events; 2B-2 added Sect Initiate transition events. **Still partial** — exhaustive flag-consumption retrofit was explicitly deferred by 2B spec; Phase 3 content authoring should branch on them naturally.
- ~~**Item registry absent**~~ (Phase 1, **closed** in 2B-1/2B-2): `ItemSchema` + `ItemRegistry` + `Manual` discriminated subtype shipped in 2B-1; 20-item corpus + Phase 1D-3 opaque-id backfill shipped in 2B-2.
- ~~**Technique registry absent**~~ (Phase 1, **closed** in 2B-1/2B-2): `TechniqueSchema` + `TechniqueRegistry` + on-path/off-path bonus split shipped in 2B-1; 10-technique corpus shipped in 2B-2 + wired at both turn call sites.
- ~~**Anchor-unlock evaluator not wired**~~ (Phase 2A-2, **closed** in 2A-3): 2A-2 shipped the evaluator class but did not wire it into `runBardoFlow`. 2A-3 wired it (`feat(meta): anchor unlock evaluator wired at bardo` → `b03365c`) so `meta.unlockedAnchors` now grows through play.
- **`meridian_open` outcome-applier polymorphism** (Phase 1A bug, **closed** in 2B-1): `OutcomeApplier` now routes `meridian_open` deltas through `Character.withOpenedMeridian` so `detectCorePath` fires correctly when the third meridian opens via event outcome (was previously direct push into `openMeridians`, bypassing the detector).
- **Bundle growth budget**: 449.24 KB raw / 125.43 KB gzip after 2B-2 (main chunk only). Phase 3 budget is 450 KB raw — **0.76 KB headroom remaining on the main bundle**. Azure Peaks content + gameplay registries are isolated to a `azure-peaks.js` lazy chunk (110.44 KB raw / 23.95 KB gzip) loaded on first AP-life only. Phase 2B-3 UI additions must either offset elsewhere on main or move into the lazy chunk.
- **Tribulation I `tribulation_mode` runtime flag** (Phase 2B-1): engine ships with `tribulation_mode: 'non_fatal' | 'fatal'` defaulting to `'non_fatal'`. Phase 3 flips the default to `'fatal'` and layers Heavenly Notice scaling on top of the same 4-phase pillar engine — do **not** rewrite the engine in Phase 3, only flip the flag and add the Notice multiplier.

## Tone & communication preferences

- **Mixed Indonesian / English is fine.** User is Indonesian (arthamail@gmail.com, GitHub: arthamegayasa). User mostly writes Indonesian ("lanjutkan", "setuju"); replies should match that register, with English technical terms as needed.
- **Terse reports, bullet points.** After each task, show: status, suite count, commit SHA, files changed. Do not re-explain the plan.
- **Flag plan bugs transparently.** The user expects the implementer/reviewer subagents to catch and fix small inconsistencies in the plan (wrong test expectations, wrong formula pseudocode, zod v4 quirks, wrong enum names, etc.). Call these out in commit messages and PR descriptions. Phase 1 caught and documented 15+ such bugs.
- **Don't push without user confirmation on destructive operations.** Pushing feature branches and merging PRs has been pre-authorised for this workflow. Pushing force, resetting main, rewriting history — always ask first.

## Key design-doc sections per subsystem

When working on a subsystem, re-read the relevant spec section first:

| Subsystem | Spec section |
|-----------|--------------|
| Character & attributes | §3 |
| Cultivation, realms, breakthroughs | §4 |
| Choice-event resolver (THE formula) | §5 (especially §5.3 and §14.5) |
| Narrative composition | §6 |
| Meta-progression (karma, anchors, echoes, memories, notice, imprints, lineage, threads) | §7 |
| World, regions, era, factions | §8 |
| Content schemas (JSON shapes) | §9 |
| Persistence (SaveManager, Migrator) | §10 |
| UI screens | §11 |
| File architecture | §12 |
| Implementation phase plan | §13 |
| Canonical formulas, sample data, edge cases | §14 |

## Known spec quirks & accepted deviations (do not re-fix)

- **`fumbleFloor` boundary**: spec §5.3 pseudocode says `roll >= 100 - fumbleFloor` (6-roll window for fumbleFloor=5), but §14.5 canonical table says 5% window. Implementation uses `roll >= 100 - fumbleFloor + 1` = 5 rolls. Canonical behaviour wins over pseudocode.
- **`pillBonus` is pre-scaled**: `Breakthrough.attemptSublayerBreakthrough` treats `pillBonus` as an already-multiplied additive value. Callers compute `pillCount × 5` upstream.
- **Zod v4 `z.record(enum, value)` quirk**: treats enum keys as exhaustive. Fix applied: `z.record(enum, value.optional())`. Consumers (`ConditionEvaluator`, `ChoiceResolver`) explicitly guard `undefined` in iteration. Three call-sites in `src/content/schema.ts`.
- **`$[KEY]` variable fallback**: `TemplateExpander` falls back to `variables[key]` when the snippet library has no entry. Allows `$[weather.$[SEASON].heavy]` nested form to resolve the inner variable.
- **Mood baseline**: `computeDominantMood(zeroMoodInputs())` returns `'serenity'` via explicit early-return — plan's priority loop alone would return `melancholy`. Test expectations win.
- **`MeridianId` is numeric 1-12** (not string ids like `'heart_meridian'`). Events using `meridian_open` stateDelta pass integer ids.
- **`DeathCause` enum includes `drowning`, `beast`, `childbirth`** — not all causes fit the obvious categories. Check `src/engine/core/Types.ts` before assuming a cause needs to be mapped to `disease`.
- **`peekNextEvent` and `resolveChoice` use a `derivedRng` split** (Phase 2B-1, replaces the old `cursor+1` workaround). Don't fold them back into a single shared stream — the `derivedRng` ensures peek doesn't perturb resolver seed trajectory while keeping repeated peeks deterministic.
- **`MetaState` schema version is `4`** (Phase 2B-1 bump). `v1 → v2` added echo/memory/unlocks/v2 fields; `v2 → v3` added `birthYear`/`deathYear` to `LineageEntrySummary`; `v3 → v4` added `corePath` + `techniquesLearned[]` to `LineageEntrySummary`. Migrations are cumulative — don't drop prior fields.
- **`GamePhase` is an exhaustive `Record<GamePhase, ...>` keyed map in `StateMachine.ts`**. Adding a new `GamePhase` value (e.g., Phase 2A-3's `LINEAGE`) will NOT break the test suite — the tsc `--noEmit` check is the only signal. `npm run typecheck` is a **required** gate, not optional.
- **`MemoryManifestResolver` uses a derived-seed RNG** (isolated from the resolver stream). Don't refactor it to share the turn-level `IRng` without re-validating the determinism integration tests.
- **`affinityMultiplier` is 1.0 on-path / 0.5 off-path** (Phase 2B-1, spec §3.6). Don't introduce a third "neutral" tier — the binary split is intentional per spec. Detection is exclusive (a character has exactly one Core Path or none-yet).
- **`tribulation_mode` runtime flag defaults to `'non_fatal'`** (Phase 2B-1). Phase 3 flips the default; do not hardcode either branch — keep the flag plumbed through.
- **Azure Peaks lazy-load chunk has 2 dynamic-import warnings** (`loader.ts` for events + snippets). Both `loader.ts` files are also statically imported by `engineBridge`, so Vite cannot relocate them into the lazy chunk. Accepted trade-off — chunking still saves ~110 KB on cold start. Don't try to "fix" this by removing the static imports; it would break the synchronous Yellow Plains spawn path.

## Don't do

- Don't rewrite history. Commits on main are final.
- Don't modify files in other phase-locked subsystems unless your current task requires it (and the plan permits it).
- Don't add runtime dependencies beyond the locked set in `package.json` without explicit user approval.
- Don't regress Phase 1, Phase 2A, or Phase 2B-1/2B-2 exit criteria — `tests/integration/playable_life.test.ts`, `ui_full_cycle.test.tsx`, `echo_inheritance.test.ts`, `memory_manifestation.test.ts`, `mood_filter_variance.test.ts`, `life_cycle_with_bardo.test.ts`, `playable_life_2a.test.tsx`, `azure_peaks_playable_life.test.ts`, and `technique_bonus_resolution.test.ts` must all stay green.
- Don't replace `peasant_farmer` / `true_random` / `martial_family` / `scholars_son` / `outer_disciple` / `sect_initiate` anchor defaults — Phase 2B-3 + Phase 3 may add more, doesn't replace.
- Don't delete the Yellow Plains or Azure Peaks content — Phase 3 authors new regions alongside, doesn't replace either.
- Don't downgrade `MetaState` schema version (currently `4`). Migrators are cumulative (`v1 → v2 → v3 → v4`); any future bump is additive and must preserve all prior fields.
- Don't break the `azure-peaks.js` lazy-chunk boundary. Static imports of Azure Peaks content from non-bridge code will collapse the chunk back into main and blow the bundle budget. If unsure, run `npm run build` and confirm the `azure-peaks-*.js` chunk is still ~110 KB.
