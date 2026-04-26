# Phase 2C — Novel Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the per-life experience from "click options every turn" into "read 4-8 paragraphs, then occasionally make a major fork decision". See spec [`2026-04-26-phase-2c-novel-mode-design.md`](../specs/2026-04-26-phase-2c-novel-mode-design.md).

**Architecture:** Six fat task batches across 4 sub-phases. Each batch is a single subagent dispatch making multiple commits. Engine + UI in one shot (2C-1), then content rewrite + new authoring per region (2C-2 YP, 2C-3 AP), then final polish (2C-4).

**Tech Stack:** React 19 + TypeScript 5.8 + Vitest 4 + Zod 4 (existing).

---

## Batch 2C-1: Engine + UI foundation (single task batch, 7-10 internal commits)

**Files (all):**
- Modify: `src/content/schema.ts` (add `kind` field, Zod refinement)
- Modify: `src/engine/events/RunState.ts` (add `turnsSinceLastDecision: number`)
- Modify: `src/engine/events/RunState.test.ts` (default value)
- Modify: `src/engine/events/EventSelector.ts` (pacing multiplier + `tslc` increment/reset)
- Modify: `src/engine/events/EventSelector.test.ts` (3 pacing-band tests)
- Modify: `src/engine/narrative/Composer.ts` (multi-paragraph join with `\n\n`)
- Modify: `src/engine/narrative/Composer.test.ts` (paragraph join test)
- Modify: `src/components/PlayScreen.tsx` (kind-aware render: Continue vs choice list, scroll-to-top)
- Modify: `src/components/PlayScreen.test.tsx` (Continue rendering, choice rendering)
- Modify: `src/services/engineBridge.ts` (`turnsSinceLastDecision` increment/reset in resolveChoice)
- Modify: `src/services/engineBridge.test.ts` (resolve increments tslc on beat, resets on decision)

**Acceptance criteria for this batch:**
- New tests added for: schema kind validation, RunState default, EventSelector pacing in 3 bands, Composer multi-paragraph, PlayScreen Continue render, bridge tslc tracking
- All existing tests on main must still pass (1014 pre-batch). Some integration tests may need their click-loop updated to handle Continue buttons (but Continue is just a `<button>`, so they should work as-is).
- Typecheck clean
- Bundle: no significant change (this batch is pure logic + UI tweaks)

**Implementation guidance:**

### Schema kind field
- Add `kind: z.enum(['beat', 'decision']).default('decision')` to `EventSchema`
- Add Zod `.refine(...)` post-validation: if `kind === 'beat'`, then `choices.length === 1` AND `choices[0].id === 'continue'` AND `choices[0].label === 'Continue'`. Error message: `"beat events must have exactly one choice {id:'continue', label:'Continue'}"`
- For backward compat, all existing events parse as `kind: 'decision'` (the default)

### RunState
```ts
readonly turnsSinceLastDecision: number;
```
- `createRunState` initializes to `0`
- `RunState.test.ts` adds: "createRunState defaults turnsSinceLastDecision to 0"
- Loaders (RunSave) handle `undefined` field defaults to `0` for backward compat

### EventSelector pacing
Add helper:
```ts
export function pacingMultiplier(eventKind: 'beat' | 'decision', tslc: number): number {
  if (tslc < 4)  return eventKind === 'beat'     ? 3.0 : 0.2;
  if (tslc < 8)  return 1.0;
  return         eventKind === 'decision' ? 3.0 : 0.2;
}
```

In `selectEvent(events, ctx, ...)` inside the existing weight-loop, multiply each event's `weight` by `pacingMultiplier(event.kind, ctx.turnsSinceLastDecision ?? 0)` before the rng-pick.

Tests:
1. `tslc=0 → beat weight 3× over decision weight 0.2× of same base`
2. `tslc=5 → both weights unchanged`
3. `tslc=10 → decision weight 3× over beat weight 0.2×`

### EventSelector context
Add `turnsSinceLastDecision: number` to the `SelectorContext` (or whatever interface the selector takes). Caller (`engineBridge.doPeek`) reads from `gs.runState.turnsSinceLastDecision` and passes through.

### engineBridge — tslc track
In `resolveChoice`, after the `applyOutcome` call, before any other state writes, compute the new tslc:
```ts
const wasDecision = pending.kind === 'decision';
const newTslc = wasDecision ? 0 : (gs.runState.turnsSinceLastDecision ?? 0) + 1;
nextRunState = { ...nextRunState, turnsSinceLastDecision: newTslc };
```

Test (in `engineBridge.test.ts`):
- After a beat resolves, `turnsSinceLastDecision` is incremented
- After a decision resolves, it resets to 0

### Composer — multi-paragraph
In `Composer.renderEvent` (or wherever `text.intro + body + outro` are joined), change the join from `' '` or `'\n'` to `'\n\n'` between distinct paragraphs. Each array element of `intro/body/outro` is a paragraph; preserve them as separate paragraphs in the rendered string.

Test: a fixture event with `intro: ['p1', 'p2']`, `body: ['p3']`, `outro: ['p4']` renders as `'p1\n\np2\n\np3\n\np4'`.

### PlayScreen — Continue render
At the top of the `<main>` choices section:
```tsx
const isBeat = preview.choices.length === 1 && preview.choices[0]?.id === 'continue';
```

Replace the existing `{preview.choices.length === 0 ? ... : preview.choices.map(...)}` with:
```tsx
{preview.choices.length === 0 ? (
  <p className="text-parchment-500 italic text-center">Waiting for the world to move…</p>
) : isBeat ? (
  <div className="flex justify-center">
    <button
      type="button"
      disabled={isLoading}
      onClick={() => onChoose(preview.choices[0]!.id)}
      className="px-8 py-3 bg-jade-700 text-parchment-100 rounded hover:bg-jade-600 disabled:opacity-40 disabled:cursor-not-allowed text-base"
    >
      Continue
    </button>
  </div>
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
```

### PlayScreen — scroll-to-top
At the top of the component body:
```tsx
useEffect(() => {
  // Scroll the document to top so each new paragraph starts at the top of the viewport.
  window.scrollTo({ top: 0, behavior: 'auto' });
}, [preview.narrative]);
```

### PlayScreen — long prose styling
Update the `<p>` element:
```tsx
<p className="text-base leading-loose mb-8 whitespace-pre-line max-w-2xl">
  {preview.narrative}
</p>
```
(was `text-lg leading-relaxed`)

### Tests update
Verify `playable_life.test.ts` and `playable_life_2a.test.tsx`, `playable_life_2b.test.tsx`, `azure_peaks_playable_life.test.ts` still pass — their click-loops already work with Continue buttons. If failures emerge, the most likely cause is `tslc` change altering event selection seed; in that case bump the iteration cap and verify outcomes still occur.

**Single conventional commit per logical unit (engine: 4-5 commits, UI: 2-3 commits, bridge: 1 commit, integration test fix: 1 commit if needed). Total ~8-12 commits in this batch.**

---

## Batch 2C-2a: Yellow Plains content rewrite (existing files → mostly beats)

**Files (Yellow Plains region):**
- Modify: `src/content/events/yellow_plains/daily.json` (currently 12 events; convert most to beats, keep 1-2 as decisions)
- Modify: `src/content/events/yellow_plains/training.json` (10 events; mostly beats)
- Modify: `src/content/events/yellow_plains/social.json` (10 events; ~2 decisions, rest beats)
- Modify: `src/content/events/yellow_plains/danger.json` (8 events; ~3 decisions, rest beats)
- Modify: `src/content/events/yellow_plains/opportunity.json` (8 events; ~2 decisions, rest beats)
- Modify: `src/content/events/yellow_plains/transition.json` (2 events; both stay as decisions — region transitions are forks)
- Modify: `src/content/events/yellow_plains/bridge.json` (~6 events; mostly beats)
- Modify: `src/content/events/yellow_plains/meditation.json` (~3 events; all beats)
- Modify: corresponding test files if they assert event count or structure (most should still pass since shape changes are additive + content)

**Acceptance criteria:**
- All YP events have explicit `kind: 'beat'` or `kind: 'decision'`
- ~10 events total are decisions (anchor moments — see spec §5.1 list); rest are beats
- Beat events have:
  - Single choice `{ id: 'continue', label: 'Continue', timeCost: <appropriate>, outcomes: { SUCCESS: { ...stateDeltas of beat... } } }` (no other tier branches needed; beats are deterministic)
  - `text.body[]` has 3-5 paragraphs of 2-4 sentences each (250-400 words total per beat)
- Decision events have:
  - 2-4 choices that genuinely fork life (different stateDeltas leading to different futures)
  - `text.body[]` has 1-3 paragraphs setting up the dilemma
- All Zod validation passes (the new `kind` refinement enforces beat shape)
- All existing YP integration tests still pass

**Style guide for beat prose (FOLLOW THIS):**

Each beat is 250-400 words across 3-5 paragraphs. The register is wuxia / xianxia — Jin Yong, Mo Xiang Tong Xiu, Cradle, classical Chinese sensory poetry. Use:
- **Sensory grounding** in every paragraph (sight, sound, smell, touch, qi-sense)
- **Specific verbs** (nouns crystallize: "the millet stalks bow"; verbs reveal: "a peasant's hands learn the sickle's weight before they learn his face")
- **Temporal compression** — a beat may span hours or a season; the prose flows time
- **Internal monologue** sparingly — let actions reveal state of mind
- **No modern idioms** — "okay", "cool", "guys" etc. are forbidden
- **Names sparingly** — `$[CHARACTER]` substitutes the player's name; use it 1-2 times per beat, not every paragraph
- **Vary sentence length** — short staccato beats interrupting flowing description

**Sample BEAT (use as template, do not copy verbatim):**

```json
{
  "id": "YP_BEAT_AUTUMN_HARVEST",
  "category": "life.daily",
  "version": 1,
  "weight": 80,
  "kind": "beat",
  "conditions": { "regions": ["yellow_plains"], "seasons": ["autumn"] },
  "timeCost": "MEDIUM",
  "text": {
    "intro": [
      "Autumn comes to the Yellow Plains as it always comes — first the yellowing of the millet, then the cold edge in the morning wind, then the smell of woodsmoke from village hearths threading through the dry stalks.",
      "$[CHARACTER] rises before the sun. There is no choice in this; in the harvest season the body wakes itself, fearful of what the day requires."
    ],
    "body": [
      "The sickle is older than $[CHARACTER]'s father. The handle has been smoothed by three generations of palms. Bending into the field, knees pressing into the dust, $[CHARACTER] cuts and bundles, cuts and bundles. The stalks fall in soft golden whispers.",
      "By midday the sun has burned the haze off the eastern hills. Sweat runs into the eyes and is blinked away. The other villagers are scattered across the field, each one a small bent shape in their own square of work. No one speaks. There is nothing to say that the work does not already say.",
      "When the carts come in the late afternoon, $[CHARACTER] helps load them. The weight of the bundles is the weight of a winter, of children fed or children hungry, of taxes paid or taxes owed. Old Wen the headman walks the rows counting and counting again."
    ],
    "outro": [
      "By dusk $[CHARACTER]'s back is a wall of slow fire. But the field is cleared. Above, the first stars prick out one by one, indifferent and clean."
    ]
  },
  "choices": [
    {
      "id": "continue",
      "label": "Continue",
      "timeCost": "MEDIUM",
      "outcomes": {
        "SUCCESS": {
          "narrativeKey": "action.work.harvest",
          "stateDeltas": [
            { "kind": "attribute_delta", "stat": "Body", "amount": 1 },
            { "kind": "insight_delta", "amount": 1 }
          ]
        },
        "PARTIAL": { "narrativeKey": "action.work.harvest", "stateDeltas": [] },
        "FAILURE": { "narrativeKey": "action.work.harvest", "stateDeltas": [] }
      }
    }
  ],
  "repeat": "unlimited"
}
```

**Sample DECISION (use as template):**

```json
{
  "id": "YP_DECISION_BANDIT_CONFRONTATION",
  "category": "life.danger",
  "version": 1,
  "weight": 50,
  "kind": "decision",
  "conditions": { "regions": ["yellow_plains"], "minAge": 16 },
  "timeCost": "SHORT",
  "text": {
    "intro": [
      "The bandit comes out of the millet at dusk, and there is no time to think. He is half a head taller than $[CHARACTER], with a notched blade and the dead-eyed calm of a man who has done this before."
    ],
    "body": [
      "Behind $[CHARACTER] the village dogs are already barking. The bandit's eyes flick to the bundle of grain at $[CHARACTER]'s feet — the family's winter, the children's hunger or fullness, all in twelve catties of millet."
    ]
  },
  "choices": [
    {
      "id": "ch_fight",
      "label": "Strike first. Take him down before he draws.",
      "timeCost": "SHORT",
      "check": { "base": 25, "stats": { "Body": 2, "Agility": 1 }, "difficulty": 50 },
      "outcomes": {
        "CRIT_SUCCESS": { "narrativeKey": "action.combat.victory_clean", "stateDeltas": [{ "kind": "flag_set", "flag": "killed_first_bandit" }, { "kind": "attribute_delta", "stat": "Body", "amount": 2 }] },
        "SUCCESS":      { "narrativeKey": "action.combat.victory",       "stateDeltas": [{ "kind": "flag_set", "flag": "killed_first_bandit" }, { "kind": "hp_delta", "amount": -10 }] },
        "PARTIAL":      { "narrativeKey": "action.combat.bloody",        "stateDeltas": [{ "kind": "hp_delta", "amount": -25 }] },
        "FAILURE":      { "narrativeKey": "action.combat.defeat",        "stateDeltas": [{ "kind": "hp_delta", "amount": -40 }] },
        "CRIT_FAILURE": { "narrativeKey": "action.combat.death",         "stateDeltas": [{ "kind": "set_death", "cause": "battle" }] }
      }
    },
    {
      "id": "ch_yield",
      "label": "Drop the millet. Run.",
      "timeCost": "SHORT",
      "outcomes": {
        "SUCCESS": { "narrativeKey": "action.flee.success", "stateDeltas": [{ "kind": "flag_set", "flag": "fled_first_bandit" }, { "kind": "item_remove", "id": "winter_grain" }] }
      }
    },
    {
      "id": "ch_negotiate",
      "label": "Speak. Find what he wants beyond the grain.",
      "timeCost": "SHORT",
      "check": { "base": 30, "stats": { "Charm": 2, "Mind": 1 }, "difficulty": 55 },
      "outcomes": {
        "CRIT_SUCCESS": { "narrativeKey": "action.parlay.alliance", "stateDeltas": [{ "kind": "flag_set", "flag": "befriended_bandit" }, { "kind": "attribute_delta", "stat": "Charm", "amount": 1 }] },
        "SUCCESS":      { "narrativeKey": "action.parlay.success",  "stateDeltas": [{ "kind": "item_remove", "id": "winter_grain" }] },
        "PARTIAL":      { "narrativeKey": "action.parlay.bloody",   "stateDeltas": [{ "kind": "hp_delta", "amount": -15 }, { "kind": "item_remove", "id": "winter_grain" }] },
        "FAILURE":      { "narrativeKey": "action.combat.defeat",   "stateDeltas": [{ "kind": "hp_delta", "amount": -30 }] },
        "CRIT_FAILURE": { "narrativeKey": "action.combat.death",    "stateDeltas": [{ "kind": "set_death", "cause": "battle" }] }
      }
    }
  ],
  "repeat": "once_per_life"
}
```

**Authoring task: rewrite ALL of YP into this style.** Preserve event ids where possible (so saved games / cross-life flags don't break). When converting a multi-choice event to a beat, pick the "default" choice (highest-weight or most-positive outcome) and use its stateDeltas on Continue. When tightening to decisions, the existing outcome tiers can largely stay.

---

## Batch 2C-2b: Yellow Plains net-new beats (~20 beats)

**Files:**
- Create: `src/content/events/yellow_plains/beats_weather.json` (5 beats)
- Create: `src/content/events/yellow_plains/beats_routine.json` (5 beats)
- Create: `src/content/events/yellow_plains/beats_atmosphere.json` (4 beats)
- Create: `src/content/events/yellow_plains/beats_inner.json` (3 beats)
- Create: `src/content/events/yellow_plains/beats_dream.json` (3 beats)
- Modify: `src/services/engineBridge.ts` — register the new files in the `loadEvents` block at the top

**Themes (one file per theme):**

1. **`beats_weather.json` (5 beats)** — "first frost", "monsoon arrives", "spring qi rises in the bones", "summer drought blanches the fields", "winter wolves howl at the village edge". Conditions: matching season; weight 60-90; timeCost MEDIUM.

2. **`beats_routine.json` (5 beats)** — "dawn breath cycle", "sweeping the family courtyard", "carrying water from the well", "the spear forms repeated", "evening rice and salt". Weight 70-100 (frequent); timeCost SHORT-MEDIUM.

3. **`beats_atmosphere.json` (4 beats)** — "village wedding feast overheard", "the headman's funeral procession", "trader from the south brings news", "festival lanterns at midsummer". Weight 40-60.

4. **`beats_inner.json` (3 beats)** — "$[CHARACTER] catches a face in still water and barely recognizes it", "the dream of the past life that won't quite surface", "ambition first kindled — looking up at the southern mountains". Weight 30-50; minAge 14.

5. **`beats_dream.json` (3 beats)** — "the dream of the burning city", "the recurring image of the bronze sword", "the old woman in the dream who knows your name". Weight 20-40; condition: `seasons: ['winter']` for atmosphere.

**Style: same as Batch 2C-2a sample.** 250-400 words per beat. Vary sensory anchors and pacing. Use `$[CHARACTER]`, `$[terrain.yellow_plains.*]`, `$[weather.*.*]` snippet expansions where helpful.

**Acceptance criteria:**
- 20 net-new beats authored
- All Zod-valid (kind: 'beat', single Continue, etc.)
- Files registered in `engineBridge.ts` so they appear in `ALL_EVENTS`
- One smoke test added: `tests/integration/yp_beats_load.test.ts` verifies all 20 new beat ids load and parse

---

## Batch 2C-3a: Azure Peaks content rewrite

**Files:**
- Modify: `src/content/events/azure_peaks/daily.json` (8 events)
- Modify: `src/content/events/azure_peaks/training.json` (6 events)
- Modify: `src/content/events/azure_peaks/social.json` (6 events)
- Modify: `src/content/events/azure_peaks/danger.json` (5 events)
- Modify: `src/content/events/azure_peaks/opportunity.json` (5 events)
- Modify: `src/content/events/azure_peaks/realm_gate.json` (5 events; mostly stay as decisions — these ARE realm-crossing forks)
- Modify: `src/content/events/azure_peaks/transition.json` (5 events; mostly decisions)

**Acceptance criteria:** same as 2C-2a. Target ~8 decisions + ~32 beats.

**Style refinement for AP:** The Azure Peaks register should be slightly more elevated than YP's rural prose — sect cultivation, refined surroundings, peers who train in formal halls. Keep the same density of sensory detail but shift vocabulary toward stone halls, jade, incense, master-disciple ritual.

---

## Batch 2C-3b: Azure Peaks net-new beats (~20 beats)

**Files:**
- Create: `src/content/events/azure_peaks/beats_weather.json` (5)
- Create: `src/content/events/azure_peaks/beats_routine.json` (5)
- Create: `src/content/events/azure_peaks/beats_atmosphere.json` (4)
- Create: `src/content/events/azure_peaks/beats_inner.json` (3)
- Create: `src/content/events/azure_peaks/beats_dream.json` (3)
- Modify: `src/services/azurePeaksLoader.ts` to load new beat files
- Add smoke test mirroring YP

**Same themes adapted to AP setting:**
- weather → mountain mist, plum-blossom snow, qi-storms over the peaks
- routine → meditation in the inner court, sword forms at dawn, copying classical sutras
- atmosphere → outer-disciple banquet overheard, master's lecture in the great hall, rival sect's emissary at the gate
- inner → comparing oneself to senior brother, the unworthy thought before a breakthrough attempt
- dream → the cliff-fall dream, the dream of the master's bone-white sword, the vision of the imperial city

---

## Batch 2C-4: Final integration + polish

**Files:**
- Create: `tests/integration/novel_pacing.test.ts` — 50-turn deterministic life asserts beat:decision ratio falls in the band [4:1, 8:1] across 100 simulated lives
- Modify: existing integration tests if any break from new pacing (`playable_life.test.ts`, `playable_life_2a.test.tsx`, `playable_life_2b.test.tsx`, `azure_peaks_playable_life.test.ts`)
- Run final `npm run build` — verify main bundle stays under 460 KB raw (relaxed budget for Phase 2C — prose adds bytes; if over, lazy-load YP content via parallel pattern to AP)
- Run `npm run typecheck`
- Run full suite, record final test count

**Acceptance:**
- All tests pass
- Bundle main ≤ 460 KB raw (or YP lazy-loaded if over)
- Typecheck clean
- Manual smoke test (briefly start dev server): start a Peasant Farmer life, verify ~5-10 Continue clicks before a decision menu appears, verify prose is multi-paragraph and feels novel-like

---

## Self-Review

**Spec coverage:** every section of [`2026-04-26-phase-2c-novel-mode-design.md`](../specs/2026-04-26-phase-2c-novel-mode-design.md) is implemented in batches above. ✅

**Placeholder scan:** no TBDs, no "implement later". Sample beats and decisions are concrete. Style guide is concrete. ✅

**Type consistency:** `kind`, `turnsSinceLastDecision`, `pacingMultiplier(eventKind, tslc)`, `EventSelector` ctx — names consistent throughout. ✅

**Risk-management notes** in spec §7 are addressed:
- Bundle: 2C-4 audit task (lazy-load fallback specified)
- Determinism: tslc tracked in RunState; load defaults to 0 (safe)
- Existing tests: 2C-4 task explicitly updates them
- Content quality: Style guide + concrete sample provided in 2C-2a

---

## Execution

After saving this plan, execute via `superpowers:subagent-driven-development`. The 6 batches are sequential — each batch's subagent makes multiple commits, then the controller reviews + dispatches the next batch.

Estimated subagent dispatches: ~10 total (1 per batch + reviews + occasional fix dispatches). Estimated wall-clock time: 2-4 hours of subagent execution.
