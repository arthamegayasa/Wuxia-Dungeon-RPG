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

The spec defines 6 major phases (0–5). Each ships a standalone playable build with an explicit exit criterion. Phases 0, 1, and 2A are **complete** (11 PRs merged). Phase 2B–5 remain.

| Phase | Title | Deliverable | Status |
|-------|-------|-------------|--------|
| **0** | Foundation | Engine skeleton, RNG, SaveManager, TitleScreen, CI | ✅ merged (see Phase 1 table below for full breakdown) |
| **1** | The Mortal's Burden | Vertical slice: Peasant Farmer anchor, Yellow Plains, Body Tempering, 50 events, karma cycle | ✅ **complete** — delivered across 1A/1B/1C/1D-1/1D-2/1D-3 |
| **2** | The Wheel Turns | Meta-progression real: Echoes + Memories + +3 anchors + Azure Peaks region + Qi Sensing/Condensation realms + MoodFilter + Codex/Lineage UI | 🟡 2A ✅ complete (inheritance + reveal UI, 4 PRs) — 2B pending (Azure Peaks + techniques + core paths + realm expansion) |
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

## Resuming work — next action

**Phase 2A is complete.** On top of Phase 1's playable life, the game now rolls Soul Echoes at spawn from unlocks earned in past lives, logs Forbidden Memory witnesses that can manifest 1-5 lives later, applies MoodFilter to narrative output, unlocks anchors through play (4 of 5 unlocked by repeating 5-life loop), and surfaces all of it via Codex + Lineage + enhanced Bardo + enhanced Creation.

The next step is to **brainstorm Phase 2B scope** via the `superpowers:brainstorming` skill. Phase 2B (the rescoped old 2C) is itself a substantial sub-phase; recommend splitting into 2-3 sub-sub-phases.

**Phase 2B candidate scope (to refine in brainstorming):**

- **Azure Peaks region** — second region per spec §8, with content authoring: ~30-50 events (transition from Yellow Plains + region-specific daily/training/social/danger/opportunity), snippet additions aiming for 200-leaf total library.
- **Technique registry** — central registry so `technique_learn` stateDelta maps to real techniques; 10 basic techniques (mortal / Body Tempering / Qi Sensing tier); integrate into choice resolver via `techniqueBonusCategory` checks; inventory / character-sheet surfacing.
- **Core Path detection + bonus application** — per spec §3.6, 5 paths (Martial / Sword / Body / Alchemy / Array), detection from attribute/meridian/event-history pattern, bonus application affecting at least 5 choice resolvers (exit criterion).
- **Realm expansion** — Qi Sensing 1-9 + Qi Condensation 1-9 on top of existing Body Tempering 1-9, sub-layer breakthrough content and gating on Azure Peaks progression.
- **Item registry** — central registry so Phase 1D-3 opaque items (`spiritual_stone`, `minor_healing_pill`, `silver_pouch`) become real and can affect checks / inventory UI.
- **Phase 1 lingering fixes** (optional, bundle permitting) — peek/resolve RNG stream split, `getCurrentPendingPreview` non-advancing resume path, unconsumed event flags (`married`, `apprentice`, etc.) wired into follow-up events.

**Phase 2B exit criteria** (§13 — the three unsatisfied Phase 2 criteria plus the implicit ones from spec):

1. Player can play a life fully set in Azure Peaks (not Yellow Plains) with region-appropriate events.
2. At least 10 basic techniques are learnable via choice outcomes and meaningfully modify later checks.
3. Core Path detection fires in-life and affects at least 5 choice resolvers reproducibly.
4. Qi Sensing 1 → Qi Condensation 9 progression is reachable and testable.

**Exact first steps for a new session:**

```bash
cd "D:/Claude Code/Wuxia RPG"
git status                           # confirm clean, on main
git pull --ff-only                   # pick up any merged work
```

Then invoke `superpowers:brainstorming` to explore Phase 2B scope. Expected output: 1 spec doc at `docs/superpowers/specs/YYYY-MM-DD-phase-2b-azure-peaks-techniques-paths.md` + 2-3 sub-phase plan files (e.g., `2B-1 technique + path engine`, `2B-2 Azure Peaks content`, `2B-3 realm expansion + integration`), each driving its own implementation via `superpowers:subagent-driven-development` + `superpowers:writing-plans`.

## Known lingering items (Phase 1 + 2A)

These are accepted trade-offs from prior phases that later phases should address, documented so they aren't re-fixed mid-flight:

- **Cached-peek narrative drift** (Phase 1): `peekNextEvent` uses `cursor+1` for local RNG, `resolveChoice` uses `cursor`. Repeated peeks without resolving return the same event/choices but slightly varied narrative. Phase 2B should split peek/resolve RNG streams cleanly.
- **`onContinue` consumes a turn on resume** (Phase 1): calls `peekNextEvent`, which runs the selector and advances turn state. Phase 2B can add a `getCurrentPendingPreview()` path that re-renders the stored `pendingEventId` without running the selector.
- **Event flags unconsumed** (Phase 1): Phase 1D-3 events set ~20 flags (e.g., `married`, `friend_of_elder`, `apprentice`, `has_child`) that no current event gates on. Phase 2A-2 added witness-memory + anchor-bridging events but did not exhaustively wire these; Phase 2B content authoring should branch on them.
- **Item registry absent** (Phase 1): events reference `spiritual_stone`, `minor_healing_pill`, `silver_pouch` via `item_add` deltas. No central item registry yet — items are opaque strings. Phase 2B introduces a registry so items can affect checks and show in inventory.
- **Technique registry absent** (Phase 1): `technique_learn` stateDelta is supported but no technique corpus ships. Phase 2B adds 10 basic techniques + registry + check bonus wiring.
- ~~**Anchor-unlock evaluator not wired**~~ (Phase 2A-2, **closed** in 2A-3): 2A-2 shipped the evaluator class but did not wire it into `runBardoFlow`. 2A-3 wired it (`feat(meta): anchor unlock evaluator wired at bardo` → `b03365c`) so `meta.unlockedAnchors` now grows through play.
- **Bundle growth budget**: 434.76 KB raw / 120.99 KB gzip after 2A-3. Spec §13 allows growth through Phase 3 (450 KB raw target) — **15 KB headroom remaining**. Phase 2B must audit carefully; Azure Peaks content + technique registry + realm expansion will push close to the budget.

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
- **`peekNextEvent` rng uses `cursor + 1`**: to avoid mutating the resolver's seed trajectory. Acceptable Phase 1 compromise; Phase 2B should redesign peek/resolve RNG streams.
- **`MetaState` schema version is `3`** (Phase 2A-3 bump). `v1 → v2` added echo/memory/unlocks/v2 fields; `v2 → v3` added `birthYear`/`deathYear` to `LineageEntrySummary`. Future bumps are cumulative — don't drop prior fields.
- **`GamePhase` is an exhaustive `Record<GamePhase, ...>` keyed map in `StateMachine.ts`**. Adding a new `GamePhase` value (e.g., Phase 2A-3's `LINEAGE`) will NOT break the test suite — the tsc `--noEmit` check is the only signal. `npm run typecheck` is a **required** gate, not optional.
- **`MemoryManifestResolver` uses a derived-seed RNG** (isolated from the resolver stream). Don't refactor it to share the turn-level `IRng` without re-validating the determinism integration tests.

## Don't do

- Don't rewrite history. Commits on main are final.
- Don't modify files in other phase-locked subsystems unless your current task requires it (and the plan permits it).
- Don't add runtime dependencies beyond the locked set in `package.json` without explicit user approval.
- Don't regress Phase 1 or Phase 2A exit criteria — `tests/integration/playable_life.test.ts`, `ui_full_cycle.test.tsx`, `echo_inheritance.test.ts`, `memory_manifestation.test.ts`, `mood_filter_variance.test.ts`, `life_cycle_with_bardo.test.ts`, and `playable_life_2a.test.tsx` must all stay green.
- Don't replace `peasant_farmer` / `true_random` / `martial_family` / `scholars_son` / `outer_disciple` anchor defaults — Phase 2B may add more, doesn't replace.
- Don't delete the Yellow Plains content — Phase 2B authors Azure Peaks alongside, doesn't replace.
- Don't downgrade `MetaState` schema version (currently `3`). Migrators are cumulative (`v1 → v2 → v3`); any future bump is additive and must preserve all prior fields.
