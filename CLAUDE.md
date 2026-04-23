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
| **2** | The Wheel Turns | Meta-progression real: Echoes + Memories + +3 anchors + Azure Peaks region + Qi Sensing/Condensation realms + MoodFilter + Codex/Lineage UI | 🧠 needs brainstorming to split into 2A/2B/2C |
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

## Resuming work — next action

**Phase 1 is complete.** The game is playable end-to-end: Title → anchor pick → named character → real Yellow Plains life (50 events, 80 snippets) → eventual death → bardo summary + karma breakdown + upgrade shop → reincarnate.

The next step is to **brainstorm Phase 2 scope** via the `superpowers:brainstorming` skill. Phase 2 is the largest so far; recommend splitting into 2-3 sub-phases.

**Phase 2 candidate decomposition (to refine in brainstorming):**

- **Phase 2A — Cross-life inheritance:** Echo system (§7.2, 10 echoes with conflict resolution), Forbidden Memory system (§7.3, witness logging + manifestation roll), MoodFilter narrative tweaks (§6.4), +3 anchors (Martial Family / Scholar's Son / Outer Disciple), store + save-envelope changes.
- **Phase 2B — Codex + Lineage UI:** Codex screen (§11.4 — Memories/Echoes/Anchors tabs), Lineage screen (§11.5 — drill into past lives from bardo), unlock-animation polish.
- **Phase 2C — Second region + techniques + core paths:** Azure Peaks region + content authoring (events + snippets), technique registry + 10 basic techniques integrated with choice resolver (`technique_learn` stateDelta + `techniqueBonusCategory` checks), core-path detection + bonus application, realm expansion (Qi Sensing + Qi Condensation 1-9), 200-leaf snippet library target.

**Phase 2 exit criteria** (§13):
1. A Life N+1 character inherits echoes from Life N in a reproducible way.
2. Forbidden Memory witnessed in Life N can manifest in Life N+5.
3. Core Path detection affects at least 5 choice resolvers.

**Exact first steps for a new session:**

```bash
cd "D:/Claude Code/Wuxia RPG"
git status                           # confirm clean, on main
```

Then invoke `superpowers:brainstorming` to explore Phase 2 scope. Expected output: 2-3 separate sub-plan specs (e.g., `docs/superpowers/specs/YYYY-MM-DD-phase-2a-echoes-memories.md`, etc.), each driving its own implementation plan written via `superpowers:writing-plans`.

## Known lingering items (from Phase 1)

These are accepted Phase-1 trade-offs that Phase 2 should address, documented so they aren't re-fixed mid-flight:

- **Cached-peek narrative drift**: `peekNextEvent` uses `cursor+1` for local RNG, `resolveChoice` uses `cursor`. Repeated peeks without resolving return the same event/choices but slightly varied narrative. Phase 2 should split peek/resolve RNG streams cleanly.
- **`onContinue` consumes a turn on resume**: calls `peekNextEvent`, which runs the selector and advances turn state. Phase 2 can add a `getCurrentPendingPreview()` path that re-renders the stored `pendingEventId` without running the selector.
- **Event flags unconsumed**: Phase 1D-3 events set ~20 flags (e.g., `married`, `friend_of_elder`, `apprentice`, `has_child`) that no current event gates on. Phase 2 authors follow-up events that branch on these.
- **Item registry absent**: events reference `spiritual_stone`, `minor_healing_pill`, `silver_pouch` via `item_add` deltas. No central item registry yet — items are opaque strings. Phase 2 introduces a registry so items can affect checks and show in inventory.
- **Technique registry absent**: `technique_learn` stateDelta is supported but no technique corpus ships. Phase 2C adds 10 basic techniques + registry + check bonus wiring.
- **Bundle growth budget**: 388 KB raw / 110 KB gzip after 1D-3. Spec §13 allows growth through Phase 3 (450 KB raw target); audit size at each phase boundary.

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
- Don't replace `peasant_farmer` / `true_random` anchor defaults — Phase 2 adds new anchors, doesn't replace.
- Don't delete the Yellow Plains content — Phase 2 authors a second region (Azure Peaks) alongside, doesn't replace.
