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

The spec defines 6 major phases (0–5). Each ships a standalone playable build with an explicit exit criterion. Phases 0 + 1 are **complete** (7 PRs merged). Phases 2–5 remain.

| Phase | Title | Deliverable | Status |
|-------|-------|-------------|--------|
| **0** | Foundation | Engine skeleton, RNG, SaveManager, TitleScreen, CI | ✅ merged (see 1D-1 table below for full breakdown) |
| **1** | The Mortal's Burden | Vertical slice: Peasant Farmer anchor, Yellow Plains, Body Tempering, 50 events, karma cycle | ✅ **complete** — delivered across 1A/1B/1C/1D-1/1D-2/1D-3 |
| **2** | The Wheel Turns | Meta-progression real: Echoes + Memories + +3 anchors + Azure Peaks region + Qi Sensing/Condensation realms + MoodFilter + Codex/Lineage UI | 🚧 **in progress** — 2A split into 2A-1 (engine) + 2A-2 (content + integration) + 2A-3 (reveal UI); 2B (Azure Peaks + techniques + core paths) pending |
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

## Phase 2A progress

Phase 2 brainstormed 2026-04-23 and split into **2A** (inheritance + reveal) and **2B** (Azure Peaks + techniques + core paths). 2A further split into three sub-phases. Spec of record: [`docs/superpowers/specs/2026-04-23-phase-2a-inheritance-and-reveal-design.md`](docs/superpowers/specs/2026-04-23-phase-2a-inheritance-and-reveal-design.md).

| Sub-phase | Scope | Tests | PR / Commit |
|-----------|-------|-------|-------------|
| 2A-1 | Engine foundations: SoulEcho (registry/tracker/unlocker/roller/applier), ForbiddenMemory (registry/witness-logger/manifest-resolver), MoodFilter post-passes (adjective dict + interior-thought injector), MetaState v2 schema + v1→v2 migrator, `witness_memory` stateDelta, `meditation` event tag wiring, integration test echo_inheritance | +71 | [#9](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/9) → `f1efa86` |
| 2A-2 | Content authoring + engine integration: 10 canonical echoes + 5 memories JSON + 3 new anchors (Martial Family / Scholar's Son / Outer Disciple), `AnchorResolver` targetRegion/spawnRegionFallback, `characterFromAnchor` echo roll+apply at spawn, `BardoFlow` witness commit + echo unlock + lineage annotation, `GameLoop.runTurn` + `resolveChoice` threaded via shared `PostOutcomeHooks` (tracker increment + meditation manifest roll), `witnessMemory` retrofit on 10 YP events, 6 anchor-bridging events, 3 meditation events, 18 reflection/anchor-opener snippets, integration tests for memory manifest N→N+5 + mood filter variance | +124 | [#10](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/pull/10) → `337f315` |
| 2A-3 | Reveal UI: Codex screen (Memories / Echoes / Anchors tabs), Lineage screen (LifeCards), enhanced BardoPanel (reveal steps 10a/10b/10c), enhanced CreationScreen (locked-anchor silhouettes + shimmer), TitleScreen entry points, `engineBridge` snapshot APIs, full-cycle UI integration test | ⏳ pending | — |

**Test count on main after 2A-2:** 651 (across 98 files). Build: 420.78 KB raw / 118.14 KB gzip (Phase 3 budget 450 KB).

**Phase 2A exit criteria proven so far** (spec §2):
1. ✅ Echo inheritance N → N+1 deterministic (`tests/integration/echo_inheritance.test.ts`, 2A-1)
2. ✅ Memory witnessed N → manifest N+5 (`tests/integration/memory_manifestation.test.ts`, 2A-2)
3. ✅ MoodFilter variance (`tests/integration/mood_filter_variance.test.ts`, 2A-2)
4. ✅ All 5 anchors selectable + produce distinct starting states (`Anchor.test.ts`, 2A-2)
5. ⏳ Codex screen renders real accumulated data (2A-3)
6. ⏳ Lineage screen lists past lives (2A-3)
7. ✅ MetaState v1 → v2 migration preserves karma + defaults new fields (`Migrator.v1_to_v2.test.ts`, 2A-1)
8. ⚠ Partial — memory mechanic proven at N+5 horizon; full runtime 5-life UI-driven loop deferred to 2A-3

## Resuming work — next action

**Next: Phase 2A-3 (reveal UI).** Spec covers this in §6 (Codex/Lineage/Bardo/Creation UI) and §9.3 (plan split). No new brainstorming needed — go straight to `superpowers:writing-plans`.

**Exact first steps for a new session:**

```bash
cd "D:/Claude Code/Wuxia RPG"
git status                           # confirm clean, on main
git log --oneline -5                 # confirm 337f315 is tip
```

Then invoke `superpowers:writing-plans` with the spec §6 + §9.3 as input. Expected output: `docs/superpowers/plans/YYYY-MM-DD-phase-2a3-reveal-ui.md` driving a new branch `phase-2a3-ui` from main.

After 2A-3 merges, Phase 2A is complete. Then brainstorm **Phase 2B** (Azure Peaks region + technique registry + core-path detection + realm expansion) as its own spec.

## Known lingering items

**Phase 1 carry-overs (still open):**

- **Cached-peek narrative drift**: `peekNextEvent` uses `cursor+1` for local RNG, `resolveChoice` uses `cursor`. Phase 2A did NOT address this; still open.
- **`onContinue` consumes a turn on resume**: calls `peekNextEvent`, which runs the selector and advances turn state. Still open.
- **Event flags unconsumed**: Phase 1D-3 events set ~20 flags that no current event gates on. Phase 2A-2's bridge events consume a few (`from_martial_family`, `literate`, `outer_sect_member`) but most Phase 1 flags still unused.
- **Item registry absent**: items still opaque strings. Deferred past Phase 2A; expected in Phase 2B or later.
- **Technique registry absent**: `technique_learn` stateDelta still no-op. Phase 2B owns this.

**Phase 2A-2 trade-offs (accepted; don't re-fix mid-flight):**

- **Dormant echo effects**: 8 of 12 `EchoEffect` kinds (`body_cultivation_rate_pct`, `resolver_bonus`, `heal_efficacy_pct`, `mood_swing_pct`, `stat_mod_pct`, `event_weight`, `old_age_death_roll_pct`, `imprint_encounter_rate_pct`) fall through `EchoApplier`'s default branch. Effects validate + ship in the canonical roster but are no-ops until Phase 2B/2C (resolver/cultivation/event-weight wiring) or Phase 3 (imprints). In-tree comment at `src/engine/meta/EchoApplier.ts:42-48`.
- **`ghost_in_mirror` echo unreachable**: `BardoFlow.computeRegionStreak` stubs to `{[region]: 1}` because `LineageEntrySummary` has no `regionOfDeath` field. The `died_in_same_region_streak` unlock condition can never fire under current code. Phase 3 Imprints work extends lineage + unblocks this.
- **Memory `requirements` gate dormant**: `mem.requirements.minMeridians` / `minRealm` authored on each memory but NOT checked at manifest time. 2A grants insight + flag on probability roll alone. Phase 2B adds the gate when technique registry lands. In-tree comment at `src/engine/meta/MemoryManifestResolver.ts:81-84`.
- **Anchor unlock evaluator deferred**: All 5 anchors (including `martial_family` / `scholars_son` / `outer_disciple`) are selectable without earning their unlock. Unlock strings (`reach_body_tempering_5`, `read_ten_tomes_one_life`, `befriend_sect_disciple`) are opaque. Phase 2A-3 Codex screen will wire the gate.
- **`anchor.spawn.regions` deprecated but retained**: `@deprecated` JSDoc on the field; `AnchorResolver` ignores it (uses `targetRegion` + `spawnRegionFallback` instead). Kept for backward-compat on content-loader schema. Delete in Phase 3 if no new consumers appear.
- **Pack-version schema inconsistency**: `AnchorPackSchema.version` + `EventPackSchema.version` use `z.literal(1)`; new `EchoPackSchema.version` + `MemoryPackSchema.version` use `z.number().int().positive()`. Cheap follow-up cleanup for any future sub-phase.
- **EchoTracker not persisted to disk**: Lives in Zustand `gameStore.echoTracker` only, nulled on session reset. Mid-life reload after Phase 1 save/load loses within-life counters. `beginBardo` fallback uses empty tracker (conservative — no false unlocks). Consider disk-persistence when Phase 2A-3 touches the save envelope.
- **`EchoDef`/`MemoryDef` → `SoulEcho`/`ForbiddenMemory` casts in `engineBridge`**: Content-schema-derived vs engine types are structurally identical today. Casts documented inline. Phase 2B may broaden `EchoRegistry.fromList<T extends SoulEcho>` to eliminate both.
- **`anchorThisLife` flag-string extraction repeated 3×**: `flags.find(f => f.startsWith('anchor:'))?.slice(7) ?? 'unknown'` appears in `BardoFlow.ts` + `engineBridge.ts` (2 sites). Extract `getAnchorFromFlags(flags)` helper in a Phase 2B polish commit, or store `anchorId` directly on `RunState`/`Character`.

**Bundle growth:** 420.78 KB raw / 118.14 KB gzip after 2A-2 (was 388/110 after 1D-3). Phase 3 budget is 450 KB raw — re-audit at the start of 2A-3 + 2B.

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
- **`peekNextEvent` rng uses `cursor + 1`**: to avoid mutating the resolver's seed trajectory. Acceptable Phase 1 compromise; Phase 2 should redesign peek/resolve RNG streams.

## Don't do

- Don't rewrite history. Commits on main are final.
- Don't modify files in other phase-locked subsystems unless your current task requires it (and the plan permits it).
- Don't add runtime dependencies beyond the locked set in `package.json` without explicit user approval.
- Don't regress Phase 1 exit criterion — the `tests/integration/playable_life.test.ts` and `tests/integration/ui_full_cycle.test.tsx` must stay green.
- Don't regress Phase 2A-2 exit criteria — `tests/integration/echo_inheritance.test.ts`, `memory_manifestation.test.ts`, `mood_filter_variance.test.ts`, `life_cycle_with_bardo.test.ts` must stay green.
- Don't replace `peasant_farmer` / `true_random` anchor defaults — Phase 2 adds new anchors, doesn't replace.
- Don't delete the Yellow Plains content — Phase 2 authors a second region (Azure Peaks) alongside, doesn't replace.
- Don't add meridian/realm gating to `MemoryManifestResolver.rollManifest` — the `requirements` field is deliberately dormant in 2A. Phase 2B adds the gate.
- Don't delete `anchor.spawn.regions` — `@deprecated` but still validated by the content loader. Phase 3 can remove.
