# Phase 2C — Novel Mode (narrative pacing revamp) — Design Spec

**Date:** 2026-04-26
**Status:** authoritative for Phase 2C implementation
**Closes:** user feedback at end of Phase 2B-3 — playthrough felt "asal klik2 option" instead of reading a wuxia novel

---

## 1. The pillar

> **Each life should read like a novel.**

Concretely:
- The dominant per-turn experience is **reading a paragraph of evocative prose, then clicking [Continue]**.
- A **decision** (a turn with 2-4 weighty options) appears **roughly every 4-8 turns**, never more often, never less often than that band.
- A decision is a **major life fork** — joining a sect, betraying a friend, taking a wife, attempting a breakthrough, accepting a master, fleeing a battle. Not "Should I sweep the stoop today?".
- The text the player reads on a beat is **3-6 paragraphs of 2-4 sentences each** — wuxia register, sensory detail, internal monologue.

This pillar overrides the prior Phase 1-2B convention of "every event has a choice menu". Most events going forward are beats with a single `[Continue]` button.

---

## 2. Scope

### In scope (Phase 2C)

- **Engine:** add `kind: 'beat' | 'decision'` to `EventSchema`; `EventSelector` pacing logic that interleaves beats and decisions; `RunState.turnsSinceLastDecision` field + migration
- **UI:** `PlayScreen` renders multi-paragraph prose with `\n\n` paragraph breaks; collapses single-`continue`-choice events into a single centered `[Continue]` button; scrolls to top on event change
- **Content rewrite (Yellow Plains + Azure Peaks):** convert existing 90 events into ~18 decisions + ~72 beats. Decisions are tightened to genuine forks; beats are expanded to 3-5 paragraphs of immersive prose.
- **New content authoring:** add ~40 net-new novel beats split across both regions (weather/season interludes, training routines, daily life, internal monologue, dreams, folklore)
- **Tests:** unit test for pacing logic; UI smoke test that PlayScreen renders both kinds; existing integration tests adapted to new pacing (target: same 50-100 turn life length, same death cadence, but with novel feel)

### Out of scope (deferred to later phases)

- **Snippet library expansion** beyond what's needed for the rewritten content (Phase 3 will author much more once the novel pattern is set)
- **Per-region register tuning** (e.g., Azure Peaks should sound more refined than Yellow Plains rural prose) — minimal differentiation in 2C; deeper tuning in Phase 3
- **Audio cues, image illustrations** — text only
- **Save schema bump** beyond `RunState.turnsSinceLastDecision` — no `MetaState` change

---

## 3. Engine changes

### 3.1 EventSchema — add `kind`

```ts
const EventSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  version: z.number().int().positive(),
  weight: z.number().positive(),
  conditions: ConditionSetSchema,
  timeCost: z.enum(TIME_COST_STRINGS),
  /** Phase 2C: novel-mode pacing kind. 'beat' = single Continue, no fork.
   *  'decision' = real choice menu. Defaults to 'decision' for backward compat. */
  kind: z.enum(['beat', 'decision']).default('decision'),
  text: z.object({
    intro: z.array(z.string()).optional(),
    body: z.array(z.string()).optional(),
    outro: z.array(z.string()).optional(),
  }),
  choices: z.array(ChoiceSchema).min(1),
  flags: z.object({
    set: z.array(z.string()).optional(),
    clear: z.array(z.string()).optional(),
  }).optional(),
  witnessMemory: z.string().optional(),
  repeat: z.enum(['once_per_life', 'once_ever', 'unlimited']),
});
```

Beats MUST have exactly one choice with `id === 'continue'`, `label === 'Continue'`, and `outcomes.SUCCESS` carrying any stateDeltas the beat applies (the player has no agency, so success-tier is always reached). Validated at content-load time via a Zod refinement.

### 3.2 EventSelector — pacing curve

`RunState.turnsSinceLastDecision: number` — incremented every turn that resolves with `kind === 'beat'`, reset to 0 on `kind === 'decision'`.

`EventSelector.selectEvent` extends the existing weight calculation by multiplying each candidate's effective weight by:

```ts
function pacingMultiplier(eventKind: 'beat' | 'decision', tslc: number): number {
  if (tslc < 4)  return eventKind === 'beat'     ? 3.0 : 0.2;   // hot prose
  if (tslc < 8)  return 1.0;                                     // balanced
  /* tslc >= 8 */ return eventKind === 'decision' ? 3.0 : 0.2;   // cold prose, force fork
}
```

The pacing rule is intentionally simple — not data-driven, not per-region. Phase 3 may tune.

### 3.3 RunState migration

`createRunState` initializes `turnsSinceLastDecision: 0`. RunSave is runtime-only (not migrated like `MetaState`); existing saves that lack the field default to `0` on load, which is harmless (player gets one beat-friendly window before the next decision).

### 3.4 Composer — multi-paragraph render

`Composer.renderEvent` now joins `intro + body + outro` with `\n\n` between paragraphs (was `\n` or single string concat). Each array element is rendered as one paragraph after snippet expansion. The PlayScreen `<p>` element uses `whitespace-pre-line` (already does) to preserve paragraph breaks.

---

## 4. UI changes — PlayScreen

### 4.1 Beat rendering

When `preview.choices.length === 1 && preview.choices[0].id === 'continue'`, PlayScreen renders:
- The full prose at the top (unchanged from current rendering, just styled for longer text)
- A single centered `[Continue]` button below — wider, more prominent
- No choice list

When `preview.choices.length >= 2` OR `preview.choices.length === 1 && preview.choices[0].id !== 'continue'` (rare guard for legacy single-choice non-beat events), render the existing choice button list.

### 4.2 Scroll-to-top

PlayScreen uses a `useEffect([preview.narrative])` to scroll the main content area (or window) to the top on each new event so the reader starts from the first paragraph.

### 4.3 Long-prose styling

Tweaks:
- `<p>` gets `max-w-2xl` (already), `leading-loose` (was `leading-relaxed`), `whitespace-pre-line` (preserves `\n\n`)
- Mobile-friendly: at narrower viewports the prose stays comfortable to read

No new components — all changes are to `PlayScreen.tsx` styles + a single conditional render branch.

---

## 5. Content rewrite

### 5.1 Yellow Plains — decisions retained

Convert these ~10 events to `kind: 'decision'`, tighten body to 2-3 paragraphs, ensure choices fork life:

1. `YP_TRANSITION_LEAVE_FOR_AZURE_PEAKS` — leave home for the sect (already exists)
2. First-kill event (combat with bandit) — fork: kill / spare / flee
3. Marriage event — fork: accept / refuse / postpone
4. Master-offer event — fork: accept apprenticeship / decline (lose this life's chance) / negotiate
5. Family-illness event — fork: spend savings on healer / pray / accept
6. Sect-recruiter passing — fork: chase the recruiter / hide / report to elders
7. First-meridian-opening attempt — fork: train alone / seek elder / risk forbidden manual
8. Famine year — fork: hoard / share / migrate
9. War-conscription notice — fork: enlist / desert / pay bribe
10. End-of-life lucid moment — fork: dying wisdom passed / unfinished regret / quiet acceptance

(Some of these may not exist verbatim — the rewrite task should map current Yellow Plains events to these or invent equivalents based on existing event flags.)

### 5.2 Yellow Plains — beats from existing content

Convert remaining ~40 events to `kind: 'beat'` with single Continue choice. Expand body from 1-2 lines to 3-5 paragraphs. Move the existing choice-tier outcome stateDeltas onto the Continue's SUCCESS branch. Most events in `daily.json`, `training.json`, `social.json`, `meditation.json`, parts of `danger.json`, `opportunity.json` become beats.

### 5.3 Azure Peaks — analogous

~8 decisions (sect ranking, master selection, technique-manual choice, rivalry-resolution, etc.) + ~32 beats.

### 5.4 New beat content (~40 net-new)

20 per region. Themes:
- **Weather + season interludes** (5 per region) — "the first frost / monsoon arrives / spring qi rises in the bones"
- **Training routine** (5 per region) — "another dawn breath cycle / the spear forms repeated until muscle memory yields / sutra recitation by lamplight"
- **Daily life atmosphere** (4 per region) — village/sect daily rhythms, food, gossip overheard
- **Internal monologue** (3 per region) — character reflects on past life echoes, ambitions, fear
- **Dreams + folklore** (3 per region) — recurring imagery, regional legends, prophetic dreams

These prose pieces are 200-400 words each, evocative wuxia register, taggable with mood and seasonal conditions.

---

## 6. Sub-phase decomposition

### 2C-1: Engine + UI foundation (~8 tasks, ~80 tests delta)

- Schema kind field + Zod refinement + load-time validation
- RunState.turnsSinceLastDecision + createRunState default + migration tests
- EventSelector pacing multiplier + tests for 3 bands
- Composer multi-paragraph join
- PlayScreen kind-aware render (Continue vs choice list)
- PlayScreen scroll-to-top
- Update integration tests for new pacing (allow longer lives if needed)

### 2C-2: Yellow Plains rewrite (~8 tasks, content + ~10 regression tests)

- Rewrite 10 decisions
- Rewrite 8 daily/training files into beats (1 task per file)
- Author 20 net-new YP beats in 4 thematic chunks

### 2C-3: Azure Peaks rewrite (~7 tasks, content + ~10 regression tests)

- Rewrite 8 decisions
- Rewrite ~32 events into beats (1 task per file: daily, training, social, danger, opportunity, realm_gate, transition)
- Author 20 net-new AP beats in 4 thematic chunks

### 2C-4: Final integration + polish (~3 tasks)

- Full pacing integration test (50-turn play asserts beat-to-decision ratio)
- Update existing integration tests to dismiss/click-through Continue buttons
- Build audit (~bundle delta likely +20-30 KB raw from new prose; verify still under Phase 3 budget — 449 KB headroom 1 KB; **risk** — may need to lazy-load region content even more aggressively)

**Aggregate target:** ~26 tasks, +50-80 tests, ~1014 → ~1090 tests on main.

---

## 7. Risks

1. **Bundle budget — Yellow Plains content moves over 449 KB if eagerly loaded.** Mitigation: keep YP content static (already eagerly bundled) but ensure long prose strings don't blow up gzip more than ~10 KB. If they do, lazy-load YP too (parallels Azure Peaks pattern).
2. **Determinism — `turnsSinceLastDecision` adds RNG-relevant state.** Save migration: a Phase 2B save loaded into 2C will have `tslc = 0` at resume, which means the next event will lean toward beats (correct). No compatibility break.
3. **Existing integration tests click `buttons[0]` until BARDO.** With Continue buttons now in PlayScreen, these tests still work (Continue is a button) — but the button-text filter (`/inventory|character|codex|lineage/i`) must NOT exclude `Continue`. Current filter doesn't, so this is safe — but tests should be re-verified.
4. **Content quality at scale.** Subagent-authored prose may sound generic. Mitigation: each authoring task includes a concrete style template ("evoke Jin Yong / Mo Xiang Tong Xiu register; use sensory detail; keep sentences varied in length; minimum 200 words").
5. **`turnsSinceLastDecision` interacts with peek/resolve split.** The counter must increment on resolve, not on peek (peek is exploratory). Engine task spec must call this out explicitly.

---

## 8. Open decisions

None blocking. Defaults in this spec hold:
- Pacing band 4 / 8 (configurable later)
- Beat prose length 3-5 paragraphs (could go to 6+ in Phase 3)
- 18 decisions + 72 beats split across 2 regions (rough; subagent judgment)
- Lazy-load fallback for YP not triggered unless build exceeds 460 KB

---

End of spec.
