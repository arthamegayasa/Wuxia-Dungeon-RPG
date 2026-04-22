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

**Non-negotiable rules:**
- Never implement directly on `main`. Always branch.
- TDD: write failing test → verify fail → implement minimum → verify pass → commit. One commit per task.
- Every module has a `*.test.ts`. No untested production code.
- Every random decision goes through `IRng` (never `Math.random`).
- Every state mutation returns a new record (immutable).
- All content JSON is zod-validated at load time.
- Commits use Conventional Commits: `feat(area): ...`, `fix: ...`, `test: ...`, `docs: ...`, `chore: ...`, `build: ...`, `ci: ...`, `refactor: ...`.

## Current status (last updated 2026-04-23)

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Foundation: engine scaffold, RNG, EventBus, StateMachine, SaveManager, Migrator, stores, content loader stub, TitleScreen, CI | ✅ merged (PR #1 → `32c2b60`) |
| 1A | Character Foundation: attributes, spirit roots, meridians, core paths, realm metadata, cultivation progress, sub-layer breakthrough, old-age death | ✅ merged (PR #2 → `8f6b2fa`) |
| 1B | Choice-Event Engine: event/choice/outcome schemas, condition evaluator, event selector, §5.3 probability resolver, outcome resolver + applier, streak tracker, age tick | ✅ merged (PR #3 → `802b1bb`) |
| 1C | Narrative Composer MVP: mood, snippet library, template expander, name generator + registry, composer orchestrator | ✅ merged (PR #4 → `467b55c`) |
| 1D-1 | Engine Glue: Anchor, AnchorResolver, characterFromAnchor, KarmicInsightRules, KarmicUpgrade, MetaState, RunSave, BardoFlow, GameLoop.runTurn, life-cycle integration test | ✅ merged (PR #5 → `cc71795`) |
| **1D-2** | **UI Wiring: real `engineBridge`, CreationScreen, BardoPanel, full phase flow + realm-karma formula fix** | **📋 plan next** |
| 1D-3 | Content Authoring: ~50 Yellow Plains events, ~80 snippet leaves, expanded name pools — delivers Phase 1 exit criterion | ⏳ pending |

**Test count on main**: 424 (across 59 files). Build: 199 KB JS / 62 KB gzip.

**Branch tags**: `phase-0-complete` at commit `e25a969`.

## Resuming work — next action

The immediate next step is to **write the Phase 1D-2 implementation plan** via `superpowers:writing-plans`, then execute via subagent-driven-development.

**Phase 1D-2 scope (rough):**
- Real `engineBridge` replacing Phase 0 stubs (wires `runTurn`, `runBardoFlow`, `purchaseUpgrade`, save/load into the Zustand store).
- `CreationScreen` rewrite (anchor picker, name entry, spawn preview).
- `BardoPanel` (life summary, karma breakdown, karmic-upgrade shop, reincarnate button).
- Main play screen rewire (event narrative, choice buttons, status strip).
- Phase state machine: `TITLE → CREATION → PLAYING → BARDO → CREATION → ...`.
- **Realm karma formula fix** (small task): change `realmKarma = realmIndex × 10` to cumulative `sum(i × 10 for i in 1..realmIndex)` per spec §7.1 "per realm entered". Add test covering index ≥ 2 where flat vs cumulative diverge. See "Known accepted deviations" below.
- Touch/replace legacy Gemini-era `SetupScreen.tsx`, `StatusPanel.tsx`, `StoryPanel.tsx`.

**Exact first steps for a new session:**

```bash
cd "D:/Claude Code/Wuxia RPG"
git status                           # confirm clean, on main
```

Then invoke `superpowers:writing-plans` to draft the 1D-2 plan, save under `docs/superpowers/plans/YYYY-MM-DD-phase-1d2-ui-wiring.md`, then follow the standard loop (branch, commit plan, subagent-driven execution, PR, merge).

## Tone & communication preferences

- **Mixed Indonesian / English is fine.** User is Indonesian (arthamail@gmail.com, GitHub: arthamegayasa). User mostly writes Indonesian ("lanjutkan", "setuju"); replies should match that register, with English technical terms as needed.
- **Terse reports, bullet points.** After each task, show: status, suite count, commit SHA, files changed. Do not re-explain the plan.
- **Flag plan bugs transparently.** The user expects the implementer/reviewer subagents to catch and fix small inconsistencies in the plan (wrong test expectations, wrong formula pseudocode, zod v4 quirks, etc.). Call these out in commit messages and PR descriptions.
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

## Don't do

- Don't rewrite history. Commits on main are final.
- Don't modify files in other phase-locked subsystems unless your current task requires it (and the plan permits it).
- Don't add runtime dependencies beyond the locked set in `package.json` without explicit user approval.
- Don't touch `components/SetupScreen.tsx`, `StatusPanel.tsx`, `StoryPanel.tsx` until Phase 1D-2 (they're legacy Gemini-era code; Phase 1D-2 rewires them or replaces them).
