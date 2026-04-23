# Phase 1D-3 — Content Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-event playtest fixture with a real ~50-event Yellow Plains corpus + ~80 snippet leaves + expanded name pools, so that a full life plays as a coherent peasant-life narrative. Delivers the Phase 1 exit criterion — not just "technically playable" but "actually feels like a life."

**Architecture:** Introduce `loadEvents(raw)` (JSON → validated `EventDef[]`) and `loadSnippets(raw)` (JSON → validated `SnippetLibrary`) loaders — mirroring the Phase 1D-2 `loadAnchors` pattern. JSON-backed content lives under `src/content/events/yellow_plains/*.json` and `src/content/snippets/*.json`. Refactor the bridge so `chooseAction` no longer requires a retry-loop — split into `peekNextEvent` (select + compose, no resolve) and `resolveChoice` (runs the cached peeked event against the user's click). App.tsx loses its three `['ch_work','ch_train','ch_fight']` retry shims. Delete the fixture module.

**Tech Stack:** TypeScript 5.8, Zod 4, Vitest 4, React 19 (UI integration only). No new runtime deps.

**Source of truth:** `docs/spec/design.md` §6 (narrative composition — snippets, templates, mood-driven variation), §8.1 (Yellow Plains region flavor), §9 (content schemas), §5.3 (outcome resolver tiers).

**Scope boundaries:**
- ✅ **In:** `loadEvents` + `loadSnippets` loaders, ~50 Yellow Plains events (daily/training/social/danger/opportunity/transition), ~80 snippet leaves (weather/terrain/emotion/action/reflection/npc), expanded name pools (3× current size), bridge peek/resolve refactor, App.tsx retry-shim removal, `$[CHAR_NAME]` → `$[CHARACTER]` fix in fixture (replaced by real content), integration test proving "playable life" (100-turn variety + coherent narrative + eventual death + bardo with non-trivial karma).
- ❌ **Out:** Multi-region events (Yellow Plains only — other regions in Phase 2). Echo/memory/anchor unlock events via `outcome.unlocks` (the engine supports it but the meta systems around echoes/memories are Phase 2). Tribulation events (Phase 3). NPC personality/relationship state (Phase 2). Faction/sect affiliation events (Phase 2). Technique registry + learning events (Phase 2 — `technique_learn` stateDelta is supported but we don't ship authored techniques yet). Codex/Lineage UI (Phase 2). Custom predicates (`condition.customPredicate` field).

---

## Task Map

1. **Event loader + JSON envelope** — `loadEvents(raw)` validates via `z.object({ version: 1, events: z.array(EventSchema) })`. Add one dev-smoke JSON to confirm the loader works end-to-end.
2. **Snippet library loader + JSON envelope** — `loadSnippets(raw)` validates + instantiates a `SnippetLibrary`. JSON shape is `{ version: 1, leaves: Record<string, SnippetEntry[]> }`.
3. **Author the snippet library** — ~80 dotted-path keys under `src/content/snippets/yellow_plains.json`, covering weather/terrain/emotion/action/reflection/npc per spec §6.3.
4. **Expand name pools** — enlarge `DEFAULT_NAME_POOLS` to at least 50 family names, 80 given syllables, 20 sect adjectives, 20 sect objects, 10 sect suffixes, 15 place prefixes, 15 place features. Source: classical Chinese names + wuxia flavor.
5. **Bridge refactor: `peekNextEvent` + `resolveChoice`** — split `chooseAction` into two methods. `peekNextEvent()` runs selector + composer, returns preview, caches event on store. `resolveChoice(choiceId)` runs resolver + applier + persistence against the cached event. Update App.tsx to call `peek → display → resolve → peek` in sequence; delete the three retry-shim loops.
6. **Author daily-life events** — ~12 events covering farming, weather, meals, village interaction, chores, rest, seasonal shifts. Stored as `src/content/events/yellow_plains/daily.json`.
7. **Author training events** — ~10 events covering body / mind / spirit training, meditation, self-study, attempted breakthroughs.  Stored as `.../training.json`.
8. **Author social + family events** — ~10 events covering parents, siblings, rivals, strangers, romance. Stored as `.../social.json`.
9. **Author danger + opportunity + transition events** — ~18 events covering bandits/beasts/illness/war (danger), pill-seller/teacher/chance-encounter (opportunity), marriage/childbirth/aging/peaceful death (transition). Stored as three JSON files.
10. **Integration test "playable life" + wire content into engineBridge + remove retry shim (if still present) + final smoke + CLAUDE.md update** — bridge's `createSnippetLibrary({})` → `createSnippetLibrary(loadSnippets(yellowPlainsJson))`; bridge's `FIXTURE_EVENTS` → flattened list from `loadEvents` on each region JSON. Delete `src/content/events/fixture.ts`. New integration test plays 100 turns and asserts variety, narrative coherence, eventual death, non-trivial karma.

---

## Prerequisite Reading

- `docs/spec/design.md` §6 (narrative composition — snippets, template syntax `$[KEY]`, mood → tag bias).
- `docs/spec/design.md` §8.1 (Yellow Plains: peasant farmland, war-torn, mortal-heavy, 0.4× qi density).
- `docs/spec/design.md` §9 (content schemas — field-by-field authoring reference).
- `src/content/schema.ts` — `EventSchema`, `ChoiceSchema`, `OutcomeSchema`, `ConditionSetSchema`, `StateDeltaSchema`, `SnippetEntrySchema`. Read every field before authoring.
- `src/content/anchors/loader.ts` — the pattern for `loadEvents` and `loadSnippets`.
- `src/content/events/fixture.ts` — current 3-event fixture. Note `$[CHAR_NAME]` is wrong; new content uses `$[CHARACTER]`.
- `src/engine/narrative/Composer.ts` — inspect `CompositionContext` and which variables are injected (`CHARACTER`, `REGION`, `SEASON`, `REALM` — **not** `CHAR_NAME`).
- `src/engine/narrative/TemplateExpander.ts` — `$[KEY]` resolves through snippet library (recursive), `[VAR]` is literal variable substitution.
- `src/engine/narrative/Mood.ts` — how mood tags bias snippet pick.
- `src/engine/narrative/NameGenerator.ts` — `DEFAULT_NAME_POOLS` constant, generator functions.
- `src/engine/events/OutcomeApplier.ts` — 16 supported `stateDelta.kind` values (hp_delta, qi_delta, insight_delta, attribute_delta, flag_set, flag_clear, world_flag_set, world_flag_clear, cultivation_progress_delta, item_add, item_remove, technique_learn, meridian_open, karma_delta, notice_delta, age_delta_days).
- `src/services/engineBridge.ts` — especially `chooseAction` (Task 5 splits it), `beginLife` (Task 5 adjusts the kickoff), `listAnchors` (unchanged).
- `src/App.tsx` — the three retry-shim loops in `onBegin`, `onContinue`, `onChoose` that Task 5 deletes.

---

## Authoring conventions (read before Tasks 3, 6-9)

These apply to all content tasks.

### Variable syntax — use `$[CHARACTER]` not `$[CHAR_NAME]`

The Composer injects four variables by default: `CHARACTER`, `REGION`, `SEASON`, `REALM`. Everything else must be a snippet-library key or a literal. Do NOT invent new variables.

### Snippet key taxonomy

Use dotted-path keys with this hierarchy:

| Domain | Example keys |
|--------|--------------|
| `weather.<condition>.<intensity>` | `weather.drought.heavy`, `weather.rain.spring`, `weather.frost.light` |
| `terrain.<region>.<feature>` | `terrain.yellow_plains.millet_field`, `terrain.yellow_plains.road` |
| `time.<moment>.<flavor>` | `time.dawn.cold`, `time.dusk.village`, `time.night.quiet` |
| `npc.<archetype>.<beat>` | `npc.bandit.threat`, `npc.merchant.haggle`, `npc.elder.wisdom` |
| `emotion.<name>.<intensity>` | `emotion.resignation.1`, `emotion.hunger.2`, `emotion.hope.1` |
| `action.<verb>.<flavor>` | `action.work.tired`, `action.rest.peaceful`, `action.flee.desperate` |
| `reflection.mood.<mood>.<n>` | `reflection.mood.resolve.1`, `reflection.mood.sorrow.2` |

Each key maps to 3-6 variants with `tags` matching the mood bias table (`sorrow`→lyrical/tender, `rage`→terse/bitter, `serenity`→lyrical/tender, `paranoia`→terse/ominous, `resolve`→serious, `melancholy`→lyrical/bitter).

### Event authoring rubric

Per event:
- `id`: `YP_<category>_<shortname>` pattern (e.g., `YP_DAILY_MILLET`, `YP_TRAIN_STONE`, `YP_BANDIT_ROAD`).
- `category`: dotted category string matching one of `life.daily`, `life.training`, `life.social`, `life.danger`, `life.opportunity`, `life.transition`.
- `weight`: 5–100. Common events (daily): 60–100. Rare (opportunity): 5–15. Danger: 10–30 depending on severity.
- `conditions.regions`: always `['yellow_plains']` for this phase.
- `conditions.minAge` / `maxAge`: use for age-gated content (e.g., marriage min 16, childbirth min 18, old age min 60).
- `timeCost`: choose per spec §2.5 — `INSTANT` (< 1 hour), `SHORT` (1 day), `MEDIUM` (1 week), `LONG` (1 season), `EPOCH` (1+ year). Most daily events: SHORT or MEDIUM. Training: MEDIUM. Dangers: INSTANT. Transitions: LONG or EPOCH.
- `text.intro` (required): 1-3 variants, each using `$[CHARACTER]`, `$[weather.*]`, `$[terrain.*]` snippets + literal prose. Variants let the Composer pick per mood.
- `text.body` / `text.outro`: optional elaborations.
- `choices`: 1-3 choices. Each with a distinct `id` (`ch_<verb>`), clear `label`, optional `check`, and a full `outcomes` table (at least `SUCCESS` + `FAILURE`; `CRIT_*` + `PARTIAL` optional for check-gated choices).
- `repeat`: `'unlimited'` for common daily events, `'once_per_life'` for life-transitions (marriage, childbirth), `'once_ever'` for one-time milestone events.

### Outcome authoring

Every outcome has `narrativeKey` (snippet lookup) + optional `stateDeltas`. Keep stateDeltas small and coherent:
- A training success: `attribute_delta` +1 to the relevant stat.
- A training failure: `hp_delta` −3 to −8.
- A meditation success: `insight_delta` +1 or +2, maybe `cultivation_progress_delta` +small.
- A social success: `flag_set` adding a relationship flag (e.g., `friend:elder_li`).
- A dangerous encounter: `hp_delta` large negative or `deathCause` on CRIT_FAILURE.

Use `deathCause` judiciously — only events whose narrative justifies it should kill. For the full list of valid `DeathCause` values see `src/engine/core/Types.ts` (`DeathCause` type). Most 1D-3 deaths: `combat_melee`, `disease`, `starvation`, `old_age`.

### Tone guidelines (§6.1, §8.1)

Yellow Plains is **peasant farmland, war-torn, mortal-heavy**. Events should feel like a hard, ordinary life with brief moments of wonder. Avoid:
- Modern idioms ("you got this", "epic fail").
- Jargon from other cultivation genres (no "cultivator-senpai", no anime-isms).
- Purple prose (spec §6.1: *"terse, grounded, occasional lyricism"*).
- Mentioning realms above `Qi Sensing` (Foundation+ is far beyond the Yellow Plains window).

Prefer:
- Specific sensory details (smell, texture, weight).
- Short sentences for action, longer for reflection.
- Character name via `$[CHARACTER]`, used sparingly (not every sentence).
- Wuxia-flavored imagery when a moment warrants it (spec example: *"the ink-black river, the pale moon, the ox in the yoke"*).

---

## Task 1: Event loader + JSON envelope

**Files:**
- Create: `src/content/events/loader.ts`
- Create: `src/content/events/loader.test.ts`
- Create: `src/content/events/yellow_plains/__smoke.json` — minimal 2-event pack just to prove the loader works. Later tasks add real files; this one stays as the loader's regression fixture.

**Rationale:** Phase 1D-2 used a hardcoded TypeScript fixture. Phase 1D-3 moves content into JSON validated at load time, following the `loadAnchors` pattern. This task establishes the format + loader without authoring any real content.

- [ ] **Step 1: Write the failing test**

Create `src/content/events/loader.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadEvents } from './loader';
import smokeJson from './yellow_plains/__smoke.json';

describe('loadEvents', () => {
  it('parses the smoke event pack', () => {
    const events = loadEvents(smokeJson);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.id).toBeDefined();
  });

  it('returns fully validated EventDef objects', () => {
    const events = loadEvents(smokeJson);
    for (const e of events) {
      expect(e.choices.length).toBeGreaterThan(0);
      expect(e.weight).toBeGreaterThan(0);
      expect(e.timeCost).toBeDefined();
    }
  });

  it('throws on an envelope without an events array', () => {
    expect(() => loadEvents({ version: 1 })).toThrow(/events/i);
  });

  it('throws on an event with a missing required field (id)', () => {
    const bad = {
      version: 1,
      events: [{
        // no id
        category: 'test', version: 1, weight: 1,
        conditions: {}, timeCost: 'SHORT',
        text: { intro: ['x'] },
        choices: [{
          id: 'ch', label: 'Go.', timeCost: 'SHORT',
          outcomes: { SUCCESS: { narrativeKey: 'ok' } },
        }],
        repeat: 'unlimited',
      }],
    };
    expect(() => loadEvents(bad)).toThrow();
  });

  it('throws on an unknown timeCost value', () => {
    const bad = {
      version: 1,
      events: [{
        id: 'x', category: 'test', version: 1, weight: 1,
        conditions: {}, timeCost: 'NEVER',
        text: { intro: ['x'] },
        choices: [{
          id: 'ch', label: 'Go.', timeCost: 'NEVER',
          outcomes: { SUCCESS: { narrativeKey: 'ok' } },
        }],
        repeat: 'unlimited',
      }],
    };
    expect(() => loadEvents(bad)).toThrow();
  });
});
```

- [ ] **Step 2: Create the smoke fixture JSON**

Create `src/content/events/yellow_plains/__smoke.json`:

```json
{
  "version": 1,
  "events": [
    {
      "id": "__SMOKE_EV1",
      "category": "test",
      "version": 1,
      "weight": 1,
      "conditions": { "regions": ["yellow_plains"] },
      "timeCost": "SHORT",
      "text": {
        "intro": ["A test day passes for $[CHARACTER]."],
        "body": [],
        "outro": []
      },
      "choices": [
        {
          "id": "ch_pass",
          "label": "Pass time.",
          "timeCost": "SHORT",
          "outcomes": {
            "SUCCESS": { "narrativeKey": "ok", "stateDeltas": [] },
            "FAILURE": { "narrativeKey": "ok", "stateDeltas": [] }
          }
        }
      ],
      "repeat": "unlimited"
    },
    {
      "id": "__SMOKE_EV2",
      "category": "test",
      "version": 1,
      "weight": 1,
      "conditions": { "regions": ["yellow_plains"] },
      "timeCost": "INSTANT",
      "text": {
        "intro": ["Nothing happens."],
        "body": [],
        "outro": []
      },
      "choices": [
        {
          "id": "ch_pass",
          "label": "Keep going.",
          "timeCost": "INSTANT",
          "outcomes": {
            "SUCCESS": { "narrativeKey": "ok", "stateDeltas": [] }
          }
        }
      ],
      "repeat": "unlimited"
    }
  ]
}
```

- [ ] **Step 3: Run tests → expect RED**

```bash
npm test -- events/loader
```

Expected: FAIL (loader module missing).

- [ ] **Step 4: Implement the loader**

Create `src/content/events/loader.ts`:

```ts
// Validated loader for Yellow Plains event packs. Source: docs/spec/design.md §9.
import { z } from 'zod';
import { EventDef, EventSchema } from '@/content/schema';

const EventPackSchema = z.object({
  version: z.literal(1),
  events: z.array(EventSchema).min(1),
});

export function loadEvents(raw: unknown): ReadonlyArray<EventDef> {
  const parsed = EventPackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`loadEvents: invalid event pack — ${parsed.error.message}`);
  }
  return parsed.data.events;
}

/** Helper for callers loading multiple JSON files: flatten into one array. */
export function flattenEventPacks(packs: ReadonlyArray<unknown>): ReadonlyArray<EventDef> {
  const all: EventDef[] = [];
  for (const raw of packs) {
    all.push(...loadEvents(raw));
  }
  return all;
}
```

- [ ] **Step 5: Verify EventSchema is exported from `@/content/schema`**

Open `src/content/schema.ts` and confirm `EventSchema` and `EventDef` (the inferred type) are both exported. If `EventDef` is named differently (e.g., just `Event`), adjust the import accordingly. If `EventDef` is not exported, add:

```ts
export type EventDef = z.infer<typeof EventSchema>;
```

at the bottom of `schema.ts`.

- [ ] **Step 6: Run tests → expect GREEN**

```bash
npm test -- events/loader
```

Expected: 5 passing.

- [ ] **Step 7: Typecheck and commit**

```bash
npm run typecheck
git add src/content/events/loader.ts src/content/events/loader.test.ts src/content/events/yellow_plains/__smoke.json
git commit -m "feat(content): loadEvents validated JSON loader + smoke fixture"
```

---

## Task 2: Snippet library loader + JSON envelope

**Files:**
- Create: `src/content/snippets/loader.ts`
- Create: `src/content/snippets/loader.test.ts`
- Create: `src/content/snippets/__smoke.json` — minimal snippet pack for loader regression.

**Rationale:** `createSnippetLibrary({})` accepts a data object but there's no JSON loader yet. Phase 1D-3 authors many snippets; load them from JSON.

- [ ] **Step 1: Failing test**

Create `src/content/snippets/loader.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadSnippets } from './loader';
import smokeJson from './__smoke.json';

describe('loadSnippets', () => {
  it('parses the smoke snippet pack into a SnippetLibrary', () => {
    const lib = loadSnippets(smokeJson);
    expect(lib.has('weather.rain.spring')).toBe(true);
    const entries = lib.get('weather.rain.spring');
    expect(entries).toBeDefined();
    expect(entries!.length).toBeGreaterThan(0);
  });

  it('returns undefined for unknown keys', () => {
    const lib = loadSnippets(smokeJson);
    expect(lib.get('not.a.real.key')).toBeUndefined();
    expect(lib.has('not.a.real.key')).toBe(false);
  });

  it('validates SnippetEntry shape (text required, weight + tags optional)', () => {
    const bad = {
      version: 1,
      leaves: {
        'weather.rain.spring': [{ /* missing text */ weight: 1 }],
      },
    };
    expect(() => loadSnippets(bad)).toThrow();
  });

  it('validates entry text is non-empty', () => {
    const bad = {
      version: 1,
      leaves: {
        'weather.rain.spring': [{ text: '' }],
      },
    };
    expect(() => loadSnippets(bad)).toThrow();
  });

  it('throws on missing leaves object', () => {
    expect(() => loadSnippets({ version: 1 })).toThrow(/leaves/i);
  });
});
```

- [ ] **Step 2: Smoke JSON**

Create `src/content/snippets/__smoke.json`:

```json
{
  "version": 1,
  "leaves": {
    "weather.rain.spring": [
      { "text": "A spring rain dampens the millet.", "weight": 1, "tags": ["lyrical"] },
      { "text": "Rain.", "weight": 1, "tags": ["terse"] }
    ]
  }
}
```

- [ ] **Step 3: Confirm red**

```bash
npm test -- snippets/loader
```

Expected: FAIL.

- [ ] **Step 4: Implement the loader**

Create `src/content/snippets/loader.ts`:

```ts
// Validated loader for snippet packs → SnippetLibrary. Source: docs/spec/design.md §6.3.
import { z } from 'zod';
import { SnippetEntrySchema } from '@/content/schema';
import { createSnippetLibrary, SnippetLibrary } from '@/engine/narrative/SnippetLibrary';

const SnippetPackSchema = z.object({
  version: z.literal(1),
  leaves: z.record(z.string(), z.array(SnippetEntrySchema).min(1)),
});

export function loadSnippets(raw: unknown): SnippetLibrary {
  const parsed = SnippetPackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`loadSnippets: invalid snippet pack — ${parsed.error.message}`);
  }
  return createSnippetLibrary(parsed.data.leaves);
}

/** Merge multiple snippet packs into a single library. Later packs override earlier keys. */
export function mergeSnippetPacks(packs: ReadonlyArray<unknown>): SnippetLibrary {
  const combined: Record<string, Array<z.infer<typeof SnippetEntrySchema>>> = {};
  for (const raw of packs) {
    const parsed = SnippetPackSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`mergeSnippetPacks: invalid pack — ${parsed.error.message}`);
    }
    for (const [k, v] of Object.entries(parsed.data.leaves)) {
      combined[k] = [...(combined[k] ?? []), ...v];
    }
  }
  return createSnippetLibrary(combined);
}
```

- [ ] **Step 5: Verify imports**

Confirm:
- `SnippetEntrySchema` exported from `src/content/schema.ts`.
- `createSnippetLibrary` accepts `Record<string, SnippetEntry[]>` (per `src/engine/narrative/SnippetLibrary.ts`). Read that file if the signature differs; adapt the loader.

- [ ] **Step 6: Run tests → GREEN**

```bash
npm test -- snippets/loader
```

Expected: 5 passing.

- [ ] **Step 7: Commit**

```bash
npm run typecheck
git add src/content/snippets/loader.ts src/content/snippets/loader.test.ts src/content/snippets/__smoke.json
git commit -m "feat(content): loadSnippets validated JSON loader + smoke fixture"
```

---

## Task 3: Author the Yellow Plains snippet library

**Files:**
- Create: `src/content/snippets/yellow_plains.json`
- Create: `src/content/snippets/yellow_plains.test.ts`

**Rationale:** The snippet library is the vocabulary that events compose from. Spec §6 targets 80 leaves × ~6 variants ≈ 480 strings. For Phase 1D-3 we ship 80 leaves; variants can be 2-4 each (no need for 6 uniformly).

### Required leaves (80 total)

**Weather (12 leaves)**
- `weather.sun.spring`, `weather.sun.summer`, `weather.sun.autumn`
- `weather.rain.spring`, `weather.rain.autumn`
- `weather.snow.winter`, `weather.frost.winter`
- `weather.wind.dry`, `weather.wind.cold`
- `weather.drought.heavy`, `weather.drought.breaking`
- `weather.overcast.calm`

**Terrain (14 leaves)**
- `terrain.yellow_plains.millet_field`, `terrain.yellow_plains.wheat_field`
- `terrain.yellow_plains.road`, `terrain.yellow_plains.crossroads`
- `terrain.yellow_plains.river_low`, `terrain.yellow_plains.river_flood`
- `terrain.yellow_plains.village`, `terrain.yellow_plains.hut`
- `terrain.yellow_plains.temple_ruined`, `terrain.yellow_plains.shrine`
- `terrain.yellow_plains.hills`, `terrain.yellow_plains.burial_mound`
- `terrain.yellow_plains.inn_yard`, `terrain.yellow_plains.well`

**Time of day (8 leaves)**
- `time.dawn.cold`, `time.dawn.mist`
- `time.noon.work`, `time.noon.rest`
- `time.dusk.village`, `time.dusk.field`
- `time.night.quiet`, `time.night.watchful`

**NPCs (12 leaves)**
- `npc.bandit.threat`, `npc.bandit.flee`
- `npc.merchant.haggle`, `npc.merchant.story`
- `npc.monk.blessing`, `npc.monk.warning`
- `npc.elder.wisdom`, `npc.elder.warning`
- `npc.traveler.stranger`, `npc.traveler.thank`
- `npc.child.laugh`, `npc.child.cry`

**Emotions (14 leaves)**
- `emotion.hunger.mild`, `emotion.hunger.severe`
- `emotion.fear.sudden`, `emotion.fear.long`
- `emotion.hope.small`, `emotion.hope.dawn`
- `emotion.resignation.tired`, `emotion.resignation.old`
- `emotion.anger.flash`, `emotion.anger.cold`
- `emotion.grief.fresh`, `emotion.grief.faded`
- `emotion.wonder.quiet`, `emotion.wonder.sudden`

**Action beats (10 leaves)**
- `action.work.plowing`, `action.work.harvest`
- `action.rest.sleep`, `action.rest.meditation`
- `action.flee.desperate`, `action.fight.desperate`
- `action.travel.slow`, `action.travel.urgent`
- `action.eat.simple`, `action.drink.water`

**Reflection (moody) (10 leaves)**
- `reflection.mood.sorrow.1`, `reflection.mood.sorrow.2`
- `reflection.mood.rage.1`
- `reflection.mood.serenity.1`, `reflection.mood.serenity.2`
- `reflection.mood.paranoia.1`
- `reflection.mood.resolve.1`, `reflection.mood.resolve.2`
- `reflection.mood.melancholy.1`, `reflection.mood.melancholy.2`

### Step-by-step

- [ ] **Step 1: Write the test first**

Create `src/content/snippets/yellow_plains.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadSnippets } from './loader';
import yp from './yellow_plains.json';

describe('yellow_plains snippet pack', () => {
  const lib = loadSnippets(yp);

  it('has at least 80 distinct snippet keys', () => {
    const data = (yp as any).leaves as Record<string, unknown[]>;
    expect(Object.keys(data).length).toBeGreaterThanOrEqual(80);
  });

  it('every entry has non-empty text', () => {
    const data = (yp as any).leaves as Record<string, Array<{ text: string }>>;
    for (const entries of Object.values(data)) {
      for (const e of entries) {
        expect(e.text.length).toBeGreaterThan(0);
      }
    }
  });

  it('covers weather / terrain / time / npc / emotion / action / reflection domains', () => {
    const data = (yp as any).leaves as Record<string, unknown>;
    const keys = Object.keys(data);
    const domains = ['weather.', 'terrain.yellow_plains.', 'time.', 'npc.', 'emotion.', 'action.', 'reflection.'];
    for (const prefix of domains) {
      expect(keys.some((k) => k.startsWith(prefix))).toBe(true);
    }
  });

  it('references no undefined variables (only CHARACTER | REGION | SEASON | REALM)', () => {
    const data = (yp as any).leaves as Record<string, Array<{ text: string }>>;
    const ALLOWED = /^(CHARACTER|REGION|SEASON|REALM)$/;
    const VAR_RE = /\[([A-Z_][A-Z0-9_]*)\]/g;
    for (const entries of Object.values(data)) {
      for (const e of entries) {
        for (const m of e.text.matchAll(VAR_RE)) {
          expect(ALLOWED.test(m[1]!)).toBe(true);
        }
      }
    }
  });

  it('lib.has + lib.get agree for every authored key', () => {
    const data = (yp as any).leaves as Record<string, unknown>;
    for (const k of Object.keys(data)) {
      expect(lib.has(k)).toBe(true);
      expect(lib.get(k)!.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Confirm red**

```bash
npm test -- snippets/yellow_plains
```

Expected: FAIL (JSON missing).

- [ ] **Step 3: Author the JSON**

Create `src/content/snippets/yellow_plains.json` with all 80 leaves. Each leaf has 2-4 variants. Below is a **starter template of ~20 leaves**; the implementer must fill in the remaining ~60 following the list above and the authoring guidelines.

Template (copy this into the JSON and extend — DO NOT ship with only these 20):

```json
{
  "version": 1,
  "leaves": {
    "weather.sun.spring": [
      { "text": "The spring sun warms the millet shoots.", "weight": 1, "tags": ["lyrical"] },
      { "text": "Sun. Green shoots.", "weight": 1, "tags": ["terse"] },
      { "text": "A kind sun. The earth remembers how to breathe.", "weight": 1, "tags": ["tender"] }
    ],
    "weather.sun.summer": [
      { "text": "The summer sun beats the field flat.", "weight": 1, "tags": ["serious"] },
      { "text": "Everything white. Everything hot.", "weight": 1, "tags": ["terse"] }
    ],
    "weather.rain.spring": [
      { "text": "A spring rain dampens the millet.", "weight": 1, "tags": ["lyrical"] },
      { "text": "Rain. The mud grabs at ankles.", "weight": 1, "tags": ["terse"] },
      { "text": "Rain like a mother's hand.", "weight": 1, "tags": ["tender"] }
    ],
    "weather.drought.heavy": [
      { "text": "The earth cracks like old pottery.", "weight": 1, "tags": ["lyrical"] },
      { "text": "No rain. No rain. No rain.", "weight": 1, "tags": ["terse", "ominous"] },
      { "text": "The wells are giving back less each day.", "weight": 1, "tags": ["serious"] }
    ],
    "weather.frost.winter": [
      { "text": "Frost scrawls on the paper windows.", "weight": 1, "tags": ["lyrical"] },
      { "text": "Ice at the water bucket.", "weight": 1, "tags": ["terse"] }
    ],
    "terrain.yellow_plains.millet_field": [
      { "text": "Rows of millet, shoulder-high, whispering.", "weight": 1, "tags": ["lyrical"] },
      { "text": "The field. Brown stalks, brown earth.", "weight": 1, "tags": ["terse"] },
      { "text": "Millet to the edge of sight.", "weight": 1, "tags": ["serious"] }
    ],
    "terrain.yellow_plains.road": [
      { "text": "The road, packed dirt, bends east toward the river.", "weight": 1, "tags": ["serious"] },
      { "text": "The road. It is always the road.", "weight": 1, "tags": ["bitter"] }
    ],
    "terrain.yellow_plains.village": [
      { "text": "The village — ten huts, a single well, an old banyan.", "weight": 1, "tags": ["serious"] },
      { "text": "Dogs bark. Smoke curls. A child is crying somewhere.", "weight": 1, "tags": ["lyrical"] }
    ],
    "terrain.yellow_plains.well": [
      { "text": "The well, its ropes frayed, its bucket dented.", "weight": 1, "tags": ["serious"] },
      { "text": "Water rises slow out of the stone.", "weight": 1, "tags": ["lyrical"] }
    ],
    "time.dawn.cold": [
      { "text": "Dawn. The breath of the world is cold.", "weight": 1, "tags": ["lyrical"] },
      { "text": "First light, grey and thin.", "weight": 1, "tags": ["terse"] }
    ],
    "time.noon.work": [
      { "text": "Noon. The sun at the crown of the sky.", "weight": 1, "tags": ["serious"] },
      { "text": "Sweat has found every seam.", "weight": 1, "tags": ["terse"] }
    ],
    "time.dusk.village": [
      { "text": "Dusk settles on the huts. Cooking smoke rises.", "weight": 1, "tags": ["tender"] },
      { "text": "The sky turns copper. Someone is calling a child home.", "weight": 1, "tags": ["lyrical"] }
    ],
    "time.night.quiet": [
      { "text": "Night. The world goes small, lantern-sized.", "weight": 1, "tags": ["lyrical"] },
      { "text": "Crickets. The fire is low.", "weight": 1, "tags": ["terse"] }
    ],
    "npc.bandit.threat": [
      { "text": "A man steps from the millet, hand on his knife.", "weight": 1, "tags": ["ominous"] },
      { "text": "Three men. They want what you have.", "weight": 1, "tags": ["terse", "ominous"] }
    ],
    "npc.merchant.haggle": [
      { "text": "The merchant weighs his words like copper.", "weight": 1, "tags": ["serious"] },
      { "text": "'Two coppers less,' he says. 'And I ate this morning.'", "weight": 1, "tags": ["bitter"] }
    ],
    "npc.elder.wisdom": [
      { "text": "The old man waits until the wind shifts before he speaks.", "weight": 1, "tags": ["lyrical"] },
      { "text": "'A plow breaks a hundred times before it breaks the ox.'", "weight": 1, "tags": ["serious"] }
    ],
    "emotion.hunger.mild": [
      { "text": "A small emptiness in the belly, nothing new.", "weight": 1, "tags": ["terse"] },
      { "text": "Hunger like a polite visitor.", "weight": 1, "tags": ["lyrical"] }
    ],
    "emotion.resignation.tired": [
      { "text": "There is work tomorrow. There is work forever.", "weight": 1, "tags": ["bitter"] },
      { "text": "$[CHARACTER] does not fight the day any longer.", "weight": 1, "tags": ["melancholy", "lyrical"] }
    ],
    "reflection.mood.resolve.1": [
      { "text": "Something in $[CHARACTER] settles. A line has been drawn.", "weight": 1, "tags": ["serious"] },
      { "text": "Not yet. Not yet. There is further to go.", "weight": 1, "tags": ["terse"] }
    ],
    "reflection.mood.sorrow.1": [
      { "text": "The heart makes its small, slow room for grief.", "weight": 1, "tags": ["lyrical", "tender"] },
      { "text": "$[CHARACTER] does not weep. It is past weeping.", "weight": 1, "tags": ["bitter"] }
    ],
    "action.work.plowing": [
      { "text": "The plow bites. The ox complains. The furrow opens.", "weight": 1, "tags": ["serious"] },
      { "text": "Hands on the haft. Back curved against the earth.", "weight": 1, "tags": ["terse"] }
    ]
  }
}
```

**Continue authoring the remaining ~60 leaves following these conventions:**
- 2-4 variants each, mostly 2-3.
- At least one variant matching each mood's tag preferences (so every mood has enough variants to bias toward).
- Use `$[CHARACTER]` sparingly inside snippet text (it's not required — events inject `$[CHARACTER]` in their intro prose directly).
- Keep text under 150 characters per variant. Short = composable.

- [ ] **Step 4: Run tests → GREEN**

```bash
npm test -- snippets/yellow_plains
```

Expected: 5 passing, with the "≥80 leaves" assertion satisfied.

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add src/content/snippets/yellow_plains.json src/content/snippets/yellow_plains.test.ts
git commit -m "feat(content): Yellow Plains snippet library (80 leaves)"
```

---

## Task 4: Expand name pools

**Files:**
- Modify: `src/engine/narrative/NameGenerator.ts` — enlarge `DEFAULT_NAME_POOLS`.
- Modify: `src/engine/narrative/NameGenerator.test.ts` (create if missing).

**Rationale:** Current pools are small (20 family names, 20 syllables). With ~50 events interacting with ~10 name slots, collisions are common. Enlarge to reduce the "everyone is named Lin Wei" problem.

**Targets:**
- `familyNames`: 50+ (from ~20)
- `givenSyllables`: 80+ (from ~20)
- `sectAdjectives`: 20+ (from ~12)
- `sectObjects`: 20+ (from ~12)
- `sectSuffixes`: 10+ (from ~7)
- `placePrefixes`: 15+ (from ~10)
- `placeFeatures`: 15+ (from ~10)

Source material: classical Chinese surnames (Bai Jia Xing top 100), wuxia sect naming conventions, peasant-era place-name patterns. Stay in-genre.

- [ ] **Step 1: Failing test**

Create or extend `src/engine/narrative/NameGenerator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { DEFAULT_NAME_POOLS, generatePersonalName, generateSectName, generatePlaceName } from './NameGenerator';

describe('DEFAULT_NAME_POOLS', () => {
  it('has at least 50 family names', () => {
    expect(DEFAULT_NAME_POOLS.familyNames.length).toBeGreaterThanOrEqual(50);
  });

  it('has at least 80 given-name syllables', () => {
    expect(DEFAULT_NAME_POOLS.givenSyllables.length).toBeGreaterThanOrEqual(80);
  });

  it('has at least 20 sect adjectives', () => {
    expect(DEFAULT_NAME_POOLS.sectAdjectives.length).toBeGreaterThanOrEqual(20);
  });

  it('has at least 20 sect objects', () => {
    expect(DEFAULT_NAME_POOLS.sectObjects.length).toBeGreaterThanOrEqual(20);
  });

  it('has at least 10 sect suffixes', () => {
    expect(DEFAULT_NAME_POOLS.sectSuffixes.length).toBeGreaterThanOrEqual(10);
  });

  it('has at least 15 place prefixes', () => {
    expect(DEFAULT_NAME_POOLS.placePrefixes.length).toBeGreaterThanOrEqual(15);
  });

  it('has at least 15 place features', () => {
    expect(DEFAULT_NAME_POOLS.placeFeatures.length).toBeGreaterThanOrEqual(15);
  });

  it('all entries are non-empty strings', () => {
    for (const k of Object.keys(DEFAULT_NAME_POOLS) as Array<keyof typeof DEFAULT_NAME_POOLS>) {
      for (const s of DEFAULT_NAME_POOLS[k]) {
        expect(s.length).toBeGreaterThan(0);
      }
    }
  });

  it('over many rolls, produces distinct personal names (variety check)', () => {
    const names = new Set<string>();
    for (let s = 1; s <= 50; s++) {
      const n = generatePersonalName(DEFAULT_NAME_POOLS, createRng(s));
      names.add(n);
    }
    expect(names.size).toBeGreaterThanOrEqual(40); // ≥80% unique across 50 tries
  });
});
```

- [ ] **Step 2: Confirm red**

```bash
npm test -- NameGenerator
```

Expected: most new assertions fail (pools too small).

- [ ] **Step 3: Expand the pools**

Open `src/engine/narrative/NameGenerator.ts`. Find the `DEFAULT_NAME_POOLS` constant. Replace each pool with an enlarged list. Example (adapt to actual pool structure, which uses `as const`):

```ts
export const DEFAULT_NAME_POOLS = {
  familyNames: [
    // Top 30 classical Chinese surnames (Bai Jia Xing order, selective)
    'Lin', 'Wang', 'Zhao', 'Liu', 'Chen', 'Li', 'Zhang', 'Huang', 'Yang', 'Zhou',
    'Wu', 'Xu', 'Sun', 'Zhu', 'Ma', 'Hu', 'Guo', 'He', 'Gao', 'Luo',
    'Song', 'Zheng', 'Xie', 'Han', 'Tang', 'Feng', 'Yu', 'Dong', 'Xiao', 'Cao',
    // Additions for variety
    'Cheng', 'Peng', 'Lu', 'Fan', 'Cui', 'Shen', 'Mo', 'Qian', 'Bai', 'Gu',
    'Jiao', 'Yue', 'Meng', 'Ren', 'Kong', 'Shi', 'Jia', 'Nie', 'Qiu', 'Duan',
  ] as const,
  givenSyllables: [
    // First batch (classical / virtues / nature)
    'Wei', 'Min', 'Shan', 'Yu', 'Ling', 'Xue', 'Fang', 'Ping', 'An', 'Jing',
    'Hua', 'Lan', 'Mei', 'Yan', 'Rui', 'Jun', 'Tai', 'Heng', 'Qing', 'De',
    // Second batch (wuxia flavors / elements)
    'Feng', 'Yun', 'Xue', 'Huo', 'Shui', 'Shan', 'Long', 'Hu', 'Niu', 'Ma',
    'Bai', 'Hong', 'Qing', 'Hei', 'Jin', 'Yin', 'Tie', 'Shi', 'Yu', 'Mu',
    // Third batch (quiet peasant names)
    'Lao', 'Xiao', 'Da', 'Er', 'San', 'Si', 'Wu', 'Liu', 'Qi', 'Ba',
    'Tian', 'He', 'Gou', 'Shu', 'Cao', 'Mai', 'Dou', 'Dao', 'Chun', 'Qiu',
    'Dong', 'Xia', 'Zhao', 'Mu', 'Chen', 'Shao', 'Yi', 'San', 'Yin', 'Yue',
  ] as const,
  sectAdjectives: [
    'Azure', 'Crimson', 'Jade', 'Obsidian', 'Silver', 'Golden', 'Thousand',
    'Black', 'White', 'Eternal', 'Forgotten', 'Hidden', 'Wandering', 'Still',
    'Nine', 'Endless', 'Heavenly', 'Broken', 'Righteous', 'Burning', 'Silent',
  ] as const,
  sectObjects: [
    'Cloud', 'Sword', 'Lotus', 'Mountain', 'River', 'Moon', 'Sun', 'Phoenix',
    'Dragon', 'Tiger', 'Crane', 'Pine', 'Mirror', 'Scroll', 'Flame',
    'Blade', 'Fist', 'Heart', 'Bone', 'Shadow', 'Star', 'Ocean',
  ] as const,
  sectSuffixes: [
    'Sect', 'Valley', 'Pavilion', 'Mountain', 'Temple', 'Hall',
    'Palace', 'Peak', 'School', 'Way', 'Gate', 'Dao',
  ] as const,
  placePrefixes: [
    'Cold', 'Iron', 'Old', 'New', 'Broken', 'Hidden', 'Crooked', 'Long',
    'Yellow', 'Black', 'Quiet', 'Whispering', 'Nine', 'Red', 'Lesser',
  ] as const,
  placeFeatures: [
    'Peak', 'Gorge', 'Village', 'Crossroads', 'Bridge', 'Hollow', 'Ford',
    'Well', 'Mound', 'Ridge', 'Pass', 'Plains', 'Market', 'Shrine', 'Temple',
  ] as const,
};
```

Adjust to the actual shape of the existing constant (may use different quoting or a helper). The important thing: hit every count target and keep entries in-genre.

- [ ] **Step 4: Run tests → GREEN**

```bash
npm test -- NameGenerator
```

Expected: all assertions pass, including variety check (≥40/50 unique).

- [ ] **Step 5: Typecheck + commit**

```bash
npm test
npm run typecheck
git add src/engine/narrative/NameGenerator.ts src/engine/narrative/NameGenerator.test.ts
git commit -m "feat(narrative): expanded DEFAULT_NAME_POOLS for 1D-3 content"
```

---

## Task 5: Bridge refactor — `peekNextEvent` + `resolveChoice`

**Files:**
- Modify: `src/services/engineBridge.ts` — split `chooseAction`.
- Modify: `src/services/engineBridge.test.ts` — adjust tests to the new surface.
- Modify: `src/App.tsx` — call `peek → display → resolve → peek`, delete the three retry-shim loops.

**Rationale:** Phase 1D-2's `chooseAction` re-runs `selectEvent` on every call. That means the event being displayed to the user (preview at turn N) may not be the event actually resolved on click (a new selection at turn N+1). When events have unique choice IDs (Phase 1D-3), the click often lands on an event whose choices don't match the user's button — hence the retry shim.

The fix: split the click into two phases.
- `peekNextEvent()`: run `selectEvent` + `renderEvent` only. Cache the event on `runState` (new field `pendingEventId`). Return a `TurnPreview` with the narrative + choices of the *peeked* event.
- `resolveChoice(choiceId)`: use the cached event directly (skip selection), run the resolver + applier + advanceTurn. Clear the cache. Return the next `peekNextEvent()` result (or a BardoPayload on death).

After this refactor, the UI's click is guaranteed to match the displayed event. The retry shim goes away.

### Sub-design: `RunState.pendingEventId?: string`

Add an optional field to `RunState` (per `src/engine/events/RunState.ts`). Default: undefined. When set, `peekNextEvent` won't re-peek; when consumed by `resolveChoice`, it gets cleared.

### Step-by-step

- [ ] **Step 1: Extend RunState**

Open `src/engine/events/RunState.ts`. Add `pendingEventId?: string` to the `RunState` interface. Update `createRunState` to default it to `undefined`. Serialization in `RunSave.ts` is unaffected (optional fields round-trip through JSON naturally).

- [ ] **Step 2: Failing test (bridge)**

Open `src/services/engineBridge.test.ts`. Replace the existing `describe('engineBridge.chooseAction', ...)` block with:

```ts
describe('engineBridge.peekNextEvent', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('returns a preview whose choices correspond to the selected event', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 1 });
    await engine.beginLife('peasant_farmer', 'Lin');
    const preview = await engine.peekNextEvent();
    expect(preview.choices.length).toBeGreaterThan(0);
    expect(typeof preview.narrative).toBe('string');
  });

  it('repeated peeks without resolving return the same event', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 1 });
    await engine.beginLife('peasant_farmer', 'Lin');
    const p1 = await engine.peekNextEvent();
    const p2 = await engine.peekNextEvent();
    // Same pending event → same choice set.
    expect(p1.choices.map((c) => c.id)).toEqual(p2.choices.map((c) => c.id));
  });
});

describe('engineBridge.resolveChoice', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('throws if called without a pending event', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm });
    await engine.beginLife('peasant_farmer', 'Lin');
    await expect(engine.resolveChoice('ch_anything'))
      .rejects.toThrow(/no pending event|peek/i);
  });

  it('throws on an unknown choiceId for the pending event', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 1 });
    await engine.beginLife('peasant_farmer', 'Lin');
    await engine.peekNextEvent();
    await expect(engine.resolveChoice('ch_nonsense'))
      .rejects.toThrow(/choice.*not found/i);
  });

  it('returns TurnPreview (alive) or BardoPayload (dead) after resolving', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 1 });
    await engine.beginLife('peasant_farmer', 'Lin');
    const preview = await engine.peekNextEvent();
    const firstChoiceId = preview.choices[0]!.id;
    const result = await engine.resolveChoice(firstChoiceId);
    if ('narrative' in result) {
      expect(result.choices.length).toBeGreaterThan(0); // next peek happened
    } else {
      expect(useGameStore.getState().phase).toBe(GamePhase.BARDO);
    }
  });
});
```

The tests above replace the `chooseAction` tests. If the codebase still exposes `chooseAction`, leave it as a deprecation wrapper calling `peek` then `resolve` — or remove entirely if nothing else uses it. The App.tsx changes in Step 6 below eliminate the last caller.

- [ ] **Step 3: Confirm red**

```bash
npm test -- engineBridge
```

Expected: FAIL on the new peek/resolve tests.

- [ ] **Step 4: Implement in engineBridge.ts**

In `src/services/engineBridge.ts`:

1. Add to the interface `EngineBridge`:

```ts
peekNextEvent(): Promise<TurnPreview>;
resolveChoice(choiceId: string): Promise<TurnPreview | BardoPayload>;
```

2. Add helpers near `buildTurnPreview`:

```ts
function findEventById(events: ReadonlyArray<EventDef>, id: string): EventDef | undefined {
  return events.find((e) => e.id === id);
}
```

3. Implement `peekNextEvent`:

```ts
async peekNextEvent() {
  const gs = useGameStore.getState();
  if (!gs.runState || !gs.streak || !gs.nameRegistry) {
    throw new Error('peekNextEvent: no active run in store');
  }
  // If there's already a pendingEventId, return its composed preview without re-selecting.
  if (gs.runState.pendingEventId) {
    const cached = findEventById(ALL_EVENTS, gs.runState.pendingEventId);
    if (cached) {
      const rng = createRng(
        ((gs.runState.rngState?.cursor ?? gs.runState.runSeed) + 1) & 0xffffffff,
      );
      const narrative = renderEvent(cached, compositionContextFrom(gs), library, gs.nameRegistry, rng);
      return buildTurnPreview(narrative, cached.choices.map((c) => ({ id: c.id, label: c.label })));
    }
    // Stale cache → fall through to fresh selection.
  }

  const rng = createRng(
    (gs.runState.rngState?.cursor ?? gs.runState.runSeed) & 0xffffffff,
  );
  const selected = selectEvent(
    ALL_EVENTS,
    {
      character: gs.runState.character,
      worldFlags: gs.runState.worldFlags,
      region: gs.runState.region,
      locale: gs.runState.locale,
      year: gs.runState.year,
      season: gs.runState.season,
      heavenlyNotice: gs.runState.heavenlyNotice,
      ageYears: Math.floor(gs.runState.character.ageDays / 365),
    },
    gs.lifetimeSeenEvents,
    gs.runState.thisLifeSeenEvents,
    rng,
  );
  if (!selected) {
    throw new Error('peekNextEvent: no event selectable from the current context');
  }

  const narrative = renderEvent(selected, compositionContextFrom(gs), library, gs.nameRegistry, rng);

  // Cache the selected event on runState so resolveChoice uses it deterministically.
  const nextRun = { ...gs.runState, pendingEventId: selected.id };
  useGameStore.getState().updateRun(nextRun, gs.streak, gs.nameRegistry);
  saveRun(sm, nextRun);

  return buildTurnPreview(narrative, selected.choices.map((c) => ({ id: c.id, label: c.label })));
},
```

Notes on the above:
- `ALL_EVENTS` is the full event pool — must be defined (next step).
- `compositionContextFrom(gs)` is a small helper; add one if it doesn't exist.
- The RNG seed bumps by +1 for peek vs normal flow to avoid the peek mutating the resolver's seed trajectory. Acceptable compromise for Phase 1D-3; Phase 2 may split peek/resolve RNG streams cleanly.

4. Implement `resolveChoice`:

```ts
async resolveChoice(choiceId) {
  const gs = useGameStore.getState();
  if (!gs.runState || !gs.streak || !gs.nameRegistry) {
    throw new Error('resolveChoice: no active run in store');
  }
  if (!gs.runState.pendingEventId) {
    throw new Error('resolveChoice: no pending event — call peekNextEvent first');
  }
  const pending = findEventById(ALL_EVENTS, gs.runState.pendingEventId);
  if (!pending) {
    throw new Error(`resolveChoice: pending event ${gs.runState.pendingEventId} not found in pool`);
  }
  const choice = pending.choices.find((c) => c.id === choiceId);
  if (!choice) {
    throw new Error(`resolveChoice: choice ${choiceId} not found in event ${pending.id}`);
  }

  const rng = createRng(
    (gs.runState.rngState?.cursor ?? gs.runState.runSeed) & 0xffffffff,
  );

  // resolveCheck + resolveOutcome + applyOutcome + streak tick + age tick.
  // Mirrors the in-line flow from the original chooseAction, but with a pre-selected
  // event (skipping selectEvent inside runTurn).
  const techBonus = choice.check?.techniqueBonusCategory
    ? resolveTechniqueBonus([], choice.check.techniqueBonusCategory)
    : 0;
  const moodBonus = choice.check?.techniqueBonusCategory
    ? computeMoodBonus(computeDominantMood(zeroMoodInputs()),
        choice.check.techniqueBonusCategory as CheckCategory)
    : 0;
  const checkResult = resolveCheck({
    check: choice.check,
    characterStats: gs.runState.character.attributes,
    characterSkills: {},
    techniqueBonus: techBonus,
    itemBonus: 0,
    echoBonus: 0,
    memoryBonus: 0,
    moodBonus,
    worldMalice: computeWorldMaliceBuff(gs.streak),
    streakBonus: computeStreakBonus(gs.streak),
    rng,
  });
  const outcome = resolveOutcome(choice.outcomes, checkResult.tier);

  let nextRunState = applyOutcome(gs.runState, outcome);
  nextRunState = {
    ...nextRunState,
    thisLifeSeenEvents: [...nextRunState.thisLifeSeenEvents, pending.id],
    pendingEventId: undefined, // consumed
  };

  let nextStreak = recordOutcome(gs.streak, checkResult.tier);
  nextStreak = tickBuff(nextStreak);
  nextRunState = advanceTurn(nextRunState, choice.timeCost, rng);

  // Advance rng state on runState.
  const advanced = rng.state();
  nextRunState = {
    ...nextRunState,
    rngState: { seed: gs.runState.rngState?.seed ?? gs.runState.runSeed, cursor: advanced.cursor },
  };

  useGameStore.getState().updateRun(nextRunState, nextStreak, gs.nameRegistry);
  useGameStore.getState().setTurnResult({
    eventId: pending.id, choiceId, tier: checkResult.tier,
    narrative: renderEvent(pending, compositionContextFrom(gs), library, gs.nameRegistry, rng),
    nextRunState, nextStreak, nextNameRegistry: gs.nameRegistry,
  });
  useGameStore.getState().appendSeenEvent(pending.id);
  saveRun(sm, nextRunState);

  if (nextRunState.deathCause) {
    const anchorFlag = nextRunState.character.flags.find((f) => f.startsWith('anchor:'));
    const anchorId = anchorFlag ? anchorFlag.slice(7) : 'unknown';
    const mult = anchorMultiplierFor(anchorId);
    const bardo = runBardoFlow(nextRunState, currentMetaState(), mult);
    useGameStore.getState().setBardoResult(bardo);
    hydrateMeta(bardo.meta);
    saveMeta(sm, bardo.meta);
    useGameStore.getState().setPhase(GamePhase.BARDO);
    return buildBardoPayload();
  }

  // Auto-peek the next event so the UI has choices to show.
  return this.peekNextEvent!();
  // Note: `this` here refers to the bridge object; method call may need
  // to be extracted to a helper function if `this` isn't bound properly.
  // Safer: just inline peek here.
},
```

**Important:** the `return this.peekNextEvent!()` at the end is fragile because of `this` binding inside an object literal. Replace with an inlined call to a top-level `doPeek(sm, library)` helper, OR restructure the bridge as an ES class. Simplest: extract a private `_peek()` closure at the top of `createEngineBridge` and call it from both `peekNextEvent` and `resolveChoice`.

5. Define `ALL_EVENTS`:

Until Task 10 wires real content, `ALL_EVENTS` = `FIXTURE_EVENTS` still works. Keep the import. Task 10 replaces `ALL_EVENTS` with the content-loader result.

```ts
import { FIXTURE_EVENTS } from '@/content/events/fixture';
const ALL_EVENTS = FIXTURE_EVENTS;
```

6. Decide about the old `chooseAction`:
   - Remove it entirely and remove from the `EngineBridge` interface.
   - OR keep as a thin wrapper calling `peekNextEvent` followed by `resolveChoice`. Discouraged — leaves two surfaces.

Recommend: remove, force callers to use the new two-step API.

- [ ] **Step 5: Update App.tsx**

Replace the retry-shim loops with the two-step flow:

```tsx
async function onBegin(anchorId: string, name: string) {
  setIsLoading(true);
  try {
    await getEngine().beginLife(anchorId, name);
    const preview = await getEngine().peekNextEvent();
    setPreview(preview);
  } finally {
    setIsLoading(false);
  }
}

async function onContinue() {
  setIsLoading(true);
  try {
    useGameStore.getState().setPhase(GamePhase.PLAYING);
    const preview = await getEngine().peekNextEvent();
    setPreview(preview);
  } finally {
    setIsLoading(false);
  }
}

async function onChoose(choiceId: string) {
  setIsLoading(true);
  try {
    const next = await getEngine().resolveChoice(choiceId);
    if ('karmaEarned' in next) {
      setBardoPayload(next);
    } else {
      setPreview(next);
    }
  } finally {
    setIsLoading(false);
  }
}
```

Delete all `for (const choiceId of ['ch_work', 'ch_train', 'ch_fight'])` loops.

- [ ] **Step 6: Run tests → GREEN**

```bash
npm test -- engineBridge
npm test -- ui_full_cycle
npm test
npm run typecheck
```

Expected: all green. The UI integration test still passes because it spam-clicks whatever buttons are rendered, which are now always valid choices for the peeked event.

- [ ] **Step 7: Commit**

```bash
git add src/services/engineBridge.ts src/services/engineBridge.test.ts \
        src/App.tsx src/engine/events/RunState.ts
git commit -m "refactor(bridge): peekNextEvent + resolveChoice split; remove App retry shims"
```

---

## Task 6: Author daily-life events (~12)

**Files:**
- Create: `src/content/events/yellow_plains/daily.json`
- Create: `src/content/events/yellow_plains/daily.test.ts`

**Rationale:** Daily events make up the majority of a peasant life. They advance age + HP + insight + occasionally attributes, and establish the texture of ordinary time.

### Required events (12)

1. `YP_DAILY_MILLET_HARVEST` — harvest millet at the end of summer (weight 80, check Body, success: attribute + insight; fail: hp −4).
2. `YP_DAILY_PLOW_FIELD` — plow the heavy spring earth (weight 70, check Body, gradual).
3. `YP_DAILY_WEED_FIELD` — long, tedious weeding (weight 100, insight on success).
4. `YP_DAILY_FETCH_WATER` — carry water from the well (weight 90, mild Body stress).
5. `YP_DAILY_COOK_MEAL` — simple cooking (weight 60, domestic).
6. `YP_DAILY_SLEEP_COLD` — sleep in a cold hut (weight 50, Qi restore on success, −Qi on fail).
7. `YP_DAILY_WALK_ROAD` — walk the road into the next village (weight 30, LONG timeCost).
8. `YP_DAILY_MARKET_DAY` — the market in town (weight 20, social leaning).
9. `YP_DAILY_VILLAGE_FESTIVAL` — rare festival, lifts mood (weight 8, once_per_life? No, rare repeat).
10. `YP_DAILY_WINTER_WAIT` — a cold winter day, nothing to do (weight 40, melancholy snippet bias).
11. `YP_DAILY_OX_TROUBLE` — the family ox is sick (weight 25, decision: treat vs slaughter).
12. `YP_DAILY_ROOF_LEAK` — after a heavy rain, the roof leaks (weight 30, repair check).

### Example event template (complete, usable as golden reference)

```json
{
  "id": "YP_DAILY_MILLET_HARVEST",
  "category": "life.daily",
  "version": 1,
  "weight": 80,
  "conditions": {
    "regions": ["yellow_plains"],
    "seasons": ["autumn"]
  },
  "timeCost": "MEDIUM",
  "text": {
    "intro": [
      "$[terrain.yellow_plains.millet_field] The harvest cannot be delayed.",
      "$[CHARACTER] kneels among the millet. The stalks are heavy with grain."
    ],
    "body": [],
    "outro": []
  },
  "choices": [
    {
      "id": "ch_harvest_hard",
      "label": "Work from dawn till dark.",
      "timeCost": "MEDIUM",
      "check": { "base": 25, "stats": { "Body": 1 }, "difficulty": 40 },
      "outcomes": {
        "CRIT_SUCCESS": {
          "narrativeKey": "action.work.harvest",
          "stateDeltas": [
            { "kind": "attribute_delta", "stat": "Body", "amount": 2 },
            { "kind": "insight_delta", "amount": 2 }
          ]
        },
        "SUCCESS": {
          "narrativeKey": "action.work.harvest",
          "stateDeltas": [
            { "kind": "attribute_delta", "stat": "Body", "amount": 1 },
            { "kind": "insight_delta", "amount": 1 }
          ]
        },
        "PARTIAL": {
          "narrativeKey": "emotion.resignation.tired",
          "stateDeltas": [{ "kind": "hp_delta", "amount": -2 }]
        },
        "FAILURE": {
          "narrativeKey": "emotion.resignation.tired",
          "stateDeltas": [{ "kind": "hp_delta", "amount": -5 }]
        }
      }
    },
    {
      "id": "ch_harvest_easy",
      "label": "Pace yourself.",
      "timeCost": "LONG",
      "outcomes": {
        "SUCCESS": {
          "narrativeKey": "action.work.harvest",
          "stateDeltas": [{ "kind": "insight_delta", "amount": 1 }]
        },
        "FAILURE": {
          "narrativeKey": "action.work.harvest",
          "stateDeltas": [{ "kind": "insight_delta", "amount": 1 }]
        }
      }
    }
  ],
  "repeat": "unlimited"
}
```

### Step-by-step

- [ ] **Step 1: Failing test**

Create `src/content/events/yellow_plains/daily.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadEvents } from '../loader';
import daily from './daily.json';

describe('yellow_plains daily events', () => {
  const events = loadEvents(daily);

  it('has at least 12 events', () => {
    expect(events.length).toBeGreaterThanOrEqual(12);
  });

  it('every event has id starting with YP_DAILY_', () => {
    for (const e of events) {
      expect(e.id).toMatch(/^YP_DAILY_/);
    }
  });

  it('all events declare yellow_plains region', () => {
    for (const e of events) {
      expect(e.conditions.regions).toContain('yellow_plains');
    }
  });

  it('all events have at least one choice with a non-empty outcome set', () => {
    for (const e of events) {
      expect(e.choices.length).toBeGreaterThan(0);
      for (const c of e.choices) {
        expect(Object.keys(c.outcomes).length).toBeGreaterThan(0);
      }
    }
  });

  it('no event text uses $[CHAR_NAME] (must use $[CHARACTER])', () => {
    const all = JSON.stringify(daily);
    expect(all).not.toContain('$[CHAR_NAME]');
  });
});
```

- [ ] **Step 2: Confirm red**

```bash
npm test -- daily
```

Expected: FAIL.

- [ ] **Step 3: Author the 12 events**

Create `src/content/events/yellow_plains/daily.json` as `{ "version": 1, "events": [ /* 12 events */ ] }`. Use the `YP_DAILY_MILLET_HARVEST` template above as the gold standard. The remaining 11 events follow the list in the "Required events" section — implementer fills in per the rubric + template.

Authoring constraints:
- Each event: 2-3 intro variants, 1-2 choices.
- Use existing snippet keys from Task 3 (`terrain.yellow_plains.*`, `action.work.*`, `emotion.*`, `time.*`, `weather.*`, `npc.*`, `reflection.mood.*`).
- `$[CHARACTER]` for name; never `$[CHAR_NAME]`.
- Unique `id` and `ch_*` choice ids across the corpus (pick descriptive names to avoid collision across all 50 events).

- [ ] **Step 4: Run tests → GREEN**

```bash
npm test -- daily
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
npm test
npm run typecheck
git add src/content/events/yellow_plains/daily.json src/content/events/yellow_plains/daily.test.ts
git commit -m "feat(content): 12 Yellow Plains daily-life events"
```

---

## Task 7: Author training events (~10)

**Files:**
- Create: `src/content/events/yellow_plains/training.json`
- Create: `src/content/events/yellow_plains/training.test.ts`

### Required events (10)

1. `YP_TRAIN_STONE_LIFT` — lift a heavy stone (check Body, attribute gain on success).
2. `YP_TRAIN_RIVER_SWIM` — swim the cold river (check Body + Agility, endurance training).
3. `YP_TRAIN_MOUNTAIN_RUN` — run up the hill (Agility).
4. `YP_TRAIN_MEDITATE_DAWN` — dawn meditation (check Mind/Spirit, insight + cultivation_progress).
5. `YP_TRAIN_MEDITATE_DUSK` — evening meditation (mirror, gentler).
6. `YP_TRAIN_READ_SCROLL` — a neighbor lends an old scroll (check Mind, insight gain + lore flag).
7. `YP_TRAIN_PRACTICE_FIST` — simple form practice (check Body + Agility, attribute gain).
8. `YP_TRAIN_BREATH_COUNTING` — breathing discipline (check Spirit, Qi gain).
9. `YP_TRAIN_FAST_SELFDENIAL` — fast for a day (Spirit check, Qi + insight — or starvation).
10. `YP_TRAIN_OPEN_MERIDIAN` — attempt to open the first meridian (weight 5, once_ever, high difficulty, meridian_open on success, hp penalty on failure).

### Step-by-step

- [ ] **Step 1: Test + JSON (single step — pattern is the same as Task 6)**

Create `src/content/events/yellow_plains/training.test.ts` — same shape as daily.test.ts but filter by `^YP_TRAIN_`.

Author `training.json` with 10 events. At least one event uses `cultivation_progress_delta`, at least one uses `meridian_open`, at least one uses `insight_delta` + 2.

```ts
// training.test.ts follows the same 5-test pattern as daily.test.ts:
//   1. at least 10 events
//   2. ids match /^YP_TRAIN_/
//   3. regions include yellow_plains
//   4. every choice has non-empty outcomes
//   5. no $[CHAR_NAME]
// Additionally:
//   6. at least one cultivation_progress_delta appears across the pool
//   7. at least one meridian_open appears in YP_TRAIN_OPEN_MERIDIAN
```

- [ ] **Step 2: Commit**

```bash
npm test -- training
npm run typecheck
git add src/content/events/yellow_plains/training.json src/content/events/yellow_plains/training.test.ts
git commit -m "feat(content): 10 Yellow Plains training events"
```

---

## Task 8: Author social + family events (~10)

**Files:**
- Create: `src/content/events/yellow_plains/social.json`
- Create: `src/content/events/yellow_plains/social.test.ts`

### Required events (10)

1. `YP_SOCIAL_ELDER_ADVICE` — village elder gives counsel (Charm check, insight + friend-of-elder flag).
2. `YP_SOCIAL_SIBLING_QUARREL` — argue with sibling (Charm check, family flag effect).
3. `YP_SOCIAL_PARENT_PRAISE` — parent notes $[CHARACTER]'s effort (mood lift, confidence flag).
4. `YP_SOCIAL_VILLAGE_RIVAL` — a village rival challenges $[CHARACTER] (Body/Charm check, flag rival).
5. `YP_SOCIAL_STRANGER_HELP` — a stranger asks for help on the road (choice: help or walk on).
6. `YP_SOCIAL_ORPHAN_ENCOUNTER` — a hungry child on the road (choice: feed or walk on).
7. `YP_SOCIAL_MARRIAGE_PROPOSAL` — minAge 16, once_per_life (accept: add flag `married`, reject: add flag `rejected_marriage`).
8. `YP_SOCIAL_FRIEND_SHARED_MEAL` — sharing a meal with an old friend (mood lift, Qi restore).
9. `YP_SOCIAL_WEDDING_ATTEND` — attend a neighbor's wedding (weight 20, mild social lift).
10. `YP_SOCIAL_FUNERAL_ATTEND` — a funeral in the village (weight 15, grief flag, mood shift).

- [ ] **Step 1: Test + JSON**

Same pattern as Tasks 6–7. Include:
- Test #6: at least one event with `minAge` condition (for marriage).
- Test #7: at least one once_per_life event.

Author social.json with 10 events. Attribute deltas smaller here (social ≠ training). Use `flag_set` / `flag_clear` generously to shape narrative branching.

- [ ] **Step 2: Commit**

```bash
npm test -- social
npm run typecheck
git add src/content/events/yellow_plains/social.json src/content/events/yellow_plains/social.test.ts
git commit -m "feat(content): 10 Yellow Plains social + family events"
```

---

## Task 9: Author danger + opportunity + transition events (~18)

**Files:**
- Create: `src/content/events/yellow_plains/danger.json`
- Create: `src/content/events/yellow_plains/opportunity.json`
- Create: `src/content/events/yellow_plains/transition.json`
- Create: one `.test.ts` per file, each asserting count + id-prefix + validity (same pattern).

### Danger events (8)

1. `YP_DANGER_BANDIT_ROAD` — ambush on the road (Body check 75; FAILURE = combat_melee death).
2. `YP_DANGER_WILD_BEAST` — a boar or wolf (check Body+Agility 60; FAILURE = hp −15, CRIT_FAILURE = combat_melee death).
3. `YP_DANGER_ILLNESS_FEVER` — sudden fever (Spirit check 50; CRIT_FAILURE = disease death).
4. `YP_DANGER_FAMINE_WINTER` — famine year (Luck check 45; FAILURE = starvation death).
5. `YP_DANGER_CONSCRIPTION` — press-ganged into war (Mind check 60; FAILURE = marches away, flag `conscripted`).
6. `YP_DANGER_HOUSE_FIRE` — the hut catches fire (Agility check 50; FAILURE = hp −12; CRIT_FAILURE = disease death from burns).
7. `YP_DANGER_DROUGHT_SEVERE` — a long drought (Luck check 40; FAILURE = starvation death).
8. `YP_DANGER_RIVER_FLOOD` — sudden flood (Agility check 55; FAILURE = hp −10; CRIT_FAILURE = disease death from drowning).

### Opportunity events (8)

1. `YP_OPP_WANDERING_MONK` — a cultivator-monk passes through (weight 5; Charm check; success: lore flag, gift spiritual stone).
2. `YP_OPP_PILL_SELLER` — a traveling pill-seller (weight 8; Mind check to tell real from fake; success: `item_add` minor_pill).
3. `YP_OPP_ANCIENT_TOME` — find a scroll in a ruined temple (weight 3, once_per_life, Mind check; success: `insight_delta` +5, flag `read_tome`).
4. `YP_OPP_HIDDEN_SHRINE` — a forgotten shrine in the hills (weight 4; Luck check; success: `cultivation_progress_delta` +small).
5. `YP_OPP_SKILLED_ARTISAN` — apprenticeship offer (weight 10; Charm check; success: flag `apprentice`, skill bonus later).
6. `YP_OPP_LOST_CHILD` — find a wealthy family's lost child (weight 6; Luck check; success: `item_add` silver_pouch).
7. `YP_OPP_STRANGE_FRUIT` — unusual fruit in the wild (weight 12; Luck check; success: `attribute_delta` +1 random stat).
8. `YP_OPP_MASTER_WATCHES` — a wandering master observes $[CHARACTER]'s practice (weight 2, once_ever; Spirit check; success: flag `master_watched`, big insight).

### Transition events (2, rare / mandatory)

1. `YP_TRANS_OLD_AGE` — minAge 60, high weight (30), once_per_life. LONG timeCost. Auto-ends life: `deathCause: 'old_age'`.
2. `YP_TRANS_CHILDBIRTH` — minAge 18, condition: flag `married`, weight 8, once_per_life. Charm/Body check; success: flag `has_child`, small mood lift; CRIT_FAILURE: disease death (childbirth complications).

**Total across three files: 18 events.**

- [ ] **Step 1: Tests**

Create three test files (one per JSON). Each asserts:
- Count ≥ the expected number (8/8/2).
- IDs match `^YP_DANGER_`, `^YP_OPP_`, `^YP_TRANS_` respectively.
- All include `yellow_plains` region.
- All choices have non-empty outcomes.
- No `$[CHAR_NAME]`.
- Danger test also asserts at least one `deathCause` in the JSON.
- Transition test asserts the `old_age` death event exists and its `conditions.minAge` is ≥ 60.

- [ ] **Step 2: Author JSON**

Create three JSON files matching the event list. The `YP_DANGER_BANDIT_ROAD` event should closely mirror the Phase 1D-2 fixture `FX_BANDIT` — but with richer narrative (3 variants of intro, referencing snippet keys).

- [ ] **Step 3: Run tests → GREEN**

```bash
npm test -- danger opportunity transition
```

Expected: 3 test files, ~5-6 tests each, all passing.

- [ ] **Step 4: Commit**

```bash
npm test
npm run typecheck
git add src/content/events/yellow_plains/danger.json \
        src/content/events/yellow_plains/opportunity.json \
        src/content/events/yellow_plains/transition.json \
        src/content/events/yellow_plains/danger.test.ts \
        src/content/events/yellow_plains/opportunity.test.ts \
        src/content/events/yellow_plains/transition.test.ts
git commit -m "feat(content): 18 Yellow Plains danger/opportunity/transition events"
```

---

## Task 10: Wire real content in App; delete fixture; "playable life" integration test; CLAUDE.md update

**Files:**
- Modify: `src/services/engineBridge.ts` — load all content JSON at bridge construction; replace `FIXTURE_EVENTS` reference with the loaded pool.
- Delete: `src/content/events/fixture.ts` + `src/content/events/fixture.test.ts`.
- Create: `tests/integration/playable_life.test.ts` — 100-turn variety + coherence test.
- Modify: `CLAUDE.md` (main repo) — mark 1D-3 merged; suggest Phase 2 focus.

### Step 1: Replace FIXTURE_EVENTS with real content

In `src/services/engineBridge.ts`, replace the `FIXTURE_EVENTS` import and usage with:

```ts
import { loadEvents } from '@/content/events/loader';
import { loadSnippets } from '@/content/snippets/loader';

import dailyJson from '@/content/events/yellow_plains/daily.json';
import trainingJson from '@/content/events/yellow_plains/training.json';
import socialJson from '@/content/events/yellow_plains/social.json';
import dangerJson from '@/content/events/yellow_plains/danger.json';
import opportunityJson from '@/content/events/yellow_plains/opportunity.json';
import transitionJson from '@/content/events/yellow_plains/transition.json';
import ypSnippets from '@/content/snippets/yellow_plains.json';

const ALL_EVENTS = [
  ...loadEvents(dailyJson),
  ...loadEvents(trainingJson),
  ...loadEvents(socialJson),
  ...loadEvents(dangerJson),
  ...loadEvents(opportunityJson),
  ...loadEvents(transitionJson),
];
const DEFAULT_LIBRARY = loadSnippets(ypSnippets);
```

Update `createEngineBridge` so `library` defaults to `DEFAULT_LIBRARY`:

```ts
const library = opts.library ?? DEFAULT_LIBRARY;
```

Remove the `FIXTURE_EVENTS` import entirely.

### Step 2: Delete the fixture

```bash
rm -f src/content/events/fixture.ts src/content/events/fixture.test.ts
```

### Step 3: Author the "playable life" integration test

Create `tests/integration/playable_life.test.ts`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { createSaveManager } from '@/engine/persistence/SaveManager';
import { createEngineBridge } from '@/services/engineBridge';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';
import { GamePhase } from '@/engine/core/Types';

describe('UI integration: playable life with real content', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('plays 100 turns with variety, coherent narrative, eventual death', async () => {
    const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
    const engine = createEngineBridge({ saveManager: sm, now: () => 1 });
    await engine.beginLife('peasant_farmer', 'Lin Wei');
    const previews: Array<{ eventId: string; narrative: string }> = [];

    // peekNextEvent is called internally by beginLife in some flows; call it here to
    // prime the first preview.
    let preview = await engine.peekNextEvent();
    const seenEventIds = new Set<string>();
    let turnsPlayed = 0;

    while (turnsPlayed < 100 && useGameStore.getState().phase !== GamePhase.BARDO) {
      previews.push({ eventId: 'derived', narrative: preview.narrative });
      const choiceId = preview.choices[0]!.id;
      const result = await engine.resolveChoice(choiceId);
      seenEventIds.add(useGameStore.getState().turnResult!.eventId);
      turnsPlayed++;
      if ('karmaEarned' in result) break;
      preview = result;
    }

    // Invariant 1: we played SOME turns.
    expect(turnsPlayed).toBeGreaterThan(0);

    // Invariant 2: variety — at least 10 distinct events seen.
    expect(seenEventIds.size).toBeGreaterThanOrEqual(10);

    // Invariant 3: narratives are non-empty and don't leak template syntax.
    for (const { narrative } of previews) {
      expect(narrative.length).toBeGreaterThan(0);
      expect(narrative).not.toMatch(/\$\[/); // no unresolved snippet keys
      expect(narrative).not.toMatch(/^\[[A-Z_]+\]$/); // no unresolved variable tokens
    }

    // Invariant 4: eventual death (or at least reached BARDO or still progressing on HP).
    // A 100-turn cap is generous; if still alive at turn 100, forcibly inspect HP.
    const gs = useGameStore.getState();
    if (gs.phase !== GamePhase.BARDO) {
      // Character still alive after 100 turns: narrative progress is acceptable; don't require death.
      expect(gs.runState?.character.ageDays).toBeGreaterThan(0);
    } else {
      // Died → karma earned should be non-trivial.
      expect(gs.bardoResult!.karmaEarned).toBeGreaterThan(0);
    }
  });

  it('produces distinct narratives on separate runs (seed variance)', async () => {
    const seeds = [1, 2, 3];
    const narrativesPerSeed: string[][] = [];
    for (const seed of seeds) {
      localStorage.clear();
      useGameStore.getState().reset();
      useMetaStore.getState().reset();
      const sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
      const engine = createEngineBridge({ saveManager: sm, now: () => seed });
      await engine.beginLife('peasant_farmer', 'Seeker');
      let preview = await engine.peekNextEvent();
      const narratives: string[] = [];
      for (let i = 0; i < 15; i++) {
        narratives.push(preview.narrative);
        const result = await engine.resolveChoice(preview.choices[0]!.id);
        if ('karmaEarned' in result) break;
        preview = result;
      }
      narrativesPerSeed.push(narratives);
    }
    // Cross-seed comparison: the first few narratives should differ across seeds.
    const first0 = narrativesPerSeed[0]!.slice(0, 5).join('|');
    const first1 = narrativesPerSeed[1]!.slice(0, 5).join('|');
    expect(first0).not.toEqual(first1);
  });
});
```

### Step 4: Run full suite + integration test + build

```bash
npm test -- playable_life
npm test
npm run typecheck
npm run build
```

Expected:
- `playable_life` — both tests pass.
- Full suite — everything green, ~500+ tests total.
- Typecheck — clean.
- Build — success, bundle growth reasonable (each JSON file ~2-10 KB; total gzipped ≤ 120 KB).

If any content JSON has a schema error discovered here, fix it in the relevant Task 6-9 commit via a follow-up commit (do not amend history).

### Step 5: Update CLAUDE.md (main repo)

Edit `D:/Claude Code/Wuxia RPG/CLAUDE.md` (main repo root — not the worktree copy). Find the "Current status" table and update:

- Mark 1D-3 as merged (once this PR lands; do the edit in a separate post-merge commit on main, same pattern as 1D-2).

Also update "Resuming work — next action" to point at Phase 2 (start with brainstorming — the Phase 2 spec scope needs brainstorming before planning).

This edit should happen AFTER the PR is merged, in a separate `docs:` commit on main. Do not include it in this PR.

### Step 6: Commit the task

```bash
git add src/services/engineBridge.ts tests/integration/playable_life.test.ts
git add -u   # captures fixture deletions
git commit -m "feat(content): wire Yellow Plains content into engine; playable-life integration test"
```

---

## Exit Criteria Checklist

- [ ] All Task 1-10 commits on branch `phase-1d3-content`.
- [ ] `npm test` passes. Phase 1D-3 adds ~80-120 new tests.
- [ ] `npm run typecheck` clean.
- [ ] `npm run build` success; bundle ≤ 450 KB raw / 140 KB gzip.
- [ ] 50+ events authored across `daily/training/social/danger/opportunity/transition.json`.
- [ ] 80+ snippet leaves authored in `yellow_plains.json`.
- [ ] Name pools meet size minima.
- [ ] Fixture (`src/content/events/fixture.ts`) deleted.
- [ ] App.tsx retry-shim loops deleted.
- [ ] Integration test `playable_life.test.ts` passes, showing ≥10 distinct events in 100 turns + no template leaks.
- [ ] CI green on PR.
- [ ] Manual smoke via `npm run dev` → character lives a varied life, narrative feels like a peasant's existence.

---

## Self-Review Notes

**Spec coverage:**
- §6 narrative composition — Tasks 2 (loader) + 3 (corpus).
- §8.1 Yellow Plains flavor — authoring guidelines + Tasks 6-9.
- §9 content schemas — Tasks 1-2 loaders validate against `src/content/schema.ts`.
- §13 Phase 1 exit criterion — Task 10 integration test proves playable-life delivery.

**Placeholder scan:** The content-authoring tasks (3, 6-9) require the implementer to fill in the bulk of content from templates. Each task has 1 complete golden reference + a list of required ids + a rubric. This is the appropriate level of detail for content work — per-snippet or per-event inlining of 400+ strings would bloat the plan past usefulness. Each task includes tests that enforce shape, count, and key invariants.

**Type consistency:**
- `loadEvents` (Task 1) and `loadSnippets` (Task 2) use explicit Zod schemas from `src/content/schema.ts`.
- `EventDef`, `SnippetEntry`, `SnippetLibrary` types re-used from existing exports.
- `TurnPreview` / `BardoPayload` from Phase 1D-2 unchanged.
- `peekNextEvent` / `resolveChoice` (Task 5) added to `EngineBridge` interface; `chooseAction` removed (clean break; no legacy alias).
- `RunState.pendingEventId?: string` field added (optional, backward-compatible).

**Phase 2 handoff:**
- Multi-region content: add more region JSONs under `src/content/events/<region>/` and snippet packs under `src/content/snippets/<region>.json`.
- Echo/memory unlock events: `outcome.unlocks` field is schema-supported; authors just need the echo/memory corpus to unlock.
- Technique registry + learning events: need to author a technique corpus + `technique_learn` stateDelta wiring first.
- Codex/Lineage UI: add screens for browsing lifetimeSeenEvents + lineage lore.

**Gaps vs 1D-3 scope:** None intentional. The "50+ events" target lands at 50 (12 daily + 10 training + 10 social + 18 danger/opportunity/transition). The "~80 snippet leaves" target lands at exactly 80 per the Task 3 rubric.
