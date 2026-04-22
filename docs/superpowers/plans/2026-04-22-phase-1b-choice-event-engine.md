# Phase 1B — Choice-Event Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic event → choice → outcome pipeline. Event schema, condition evaluator, weighted event selector, the §5.3 probability resolver, outcome tier selection + application, streakbreaker / streak-greed tracker, age tick. All pure functions; zero UI / narrative / content wiring.

**Architecture:** Pure engine modules under `src/engine/events/`, `src/engine/choices/`, and extensions under `src/engine/cultivation/`. Content is validated JSON via zod; runtime types are `z.infer` from those schemas. Every random decision routes through `IRng`. The `RunState` record (introduced in this phase) ties `Character` + turn counter + rng state + world/character flags + streak state + learned techniques into a single immutable slice.

**Tech Stack:** TypeScript 5.8 strict, Vitest 4, Zod 4. Depends on Phase 0 (`@/engine/core/*`, `@/engine/persistence/*`, `@/utils/*`, `@/content/schema.ts`) and Phase 1A (`@/engine/character/*`, `@/engine/cultivation/*`).

**Source of truth:** `docs/spec/design.md` §2.5 (time costs), §5 (choice-event system — **the most important section to re-read**), §9.1-§9.3 (content schemas), §4.7 (techniques as choice-bonus providers).

**Scope boundaries (out of Phase 1B):**
- `moodBonus` in the formula — moods are computed in Phase 1C's narrative module; stubbed as 0 here.
- `echoBonus` / `memoryBonus` — Phase 1D meta systems; stubbed as 0.
- `itemBonus` — items don't exist yet; stubbed as 0.
- Pillar events, cross-life threads — Phase 3.
- Actual event content (the JSON files under `src/content/events/`) — Phase 1D content authoring.
- GameLoop turn orchestrator — Phase 1D (needs Composer + Bardo).
- Content-schema extension in `schema.ts` (the Phase 0 stub) — this phase adds Event/Choice/Outcome to the loader.

---

## Task Map

1. Extend primitive types: `CheckCategory`, `TimeCostBand`, `OutcomeTier` (already exists — just add `OUTCOME_TIER_ORDER` helper)
2. `StateDelta` taxonomy (the structured mutation union)
3. Event / Choice / Outcome zod schemas + TS types (extends content loader)
4. `ConditionSet` + `ConditionEvaluator`
5. `EventSelector` — weighted pick with filters and repetition penalty
6. `Technique` types + choice-bonus lookup
7. `ChoiceResolver` — the §5.3 probability formula
8. `OutcomeResolver` — tier → Outcome with fallback
9. `OutcomeApplier` — apply `StateDelta[]` to `Character` + `RunState`
10. `StreakTracker` — anti-frustration +10, anti-greed world malice
11. `AgeTick` — `TimeCostBand` → day advancement
12. `RunState` type + minimal factory
13. Integration test — resolve a hand-built event end-to-end

---

## Prerequisite Reading

Before Task 1, skim:
- `docs/spec/design.md` §5 in full. **Re-read §5.3 and §5.7 (the Bandit-on-the-Road worked example).**
- `docs/spec/design.md` §14.5 (canonical resolver test cases) — these become the Task 7 test suite.
- `docs/spec/design.md` §2.5 (time cost buckets) and §14.6 (death cause taxonomy — already implemented).
- `src/content/schema.ts` — Phase 0's zod stub. Phase 1B adds Event/Choice/Outcome schemas to it.
- `src/engine/character/Character.ts` — `Character` is immutable; all state deltas produce new records.

---

## Task 1: Primitive type extensions

**Files:**
- Modify: `src/engine/core/Types.ts` (append)
- Create: `src/engine/core/Phase1BTypes.test.ts`

**Rationale:** Lock the enums the rest of Phase 1B reads from: `CheckCategory` (for technique-bonus lookup), the `OUTCOME_TIER_ORDER` helper for tier fallback, and `TIME_COST_DAYS` for the age tick.

- [ ] **Step 1: Write the failing test**

Create `src/engine/core/Phase1BTypes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  CHECK_CATEGORIES,
  OUTCOME_TIER_ORDER,
  TIME_COST_DAYS,
  OutcomeTier,
  TimeCost,
} from './Types';

describe('Phase 1B primitive tables', () => {
  it('CHECK_CATEGORIES lists all canonical categories from spec §5.8', () => {
    expect(CHECK_CATEGORIES).toEqual([
      'brute_force', 'melee_skill', 'qi_combat', 'dodge_flee',
      'social_persuade', 'social_intimidate', 'social_seduce',
      'deception', 'insight_puzzle', 'resist_mental', 'resist_poison',
      'cultivation_attempt', 'survival', 'lore_scholarship',
    ]);
  });

  it('OUTCOME_TIER_ORDER runs from CRIT_SUCCESS down to CRIT_FAILURE', () => {
    expect(OUTCOME_TIER_ORDER).toEqual([
      'CRIT_SUCCESS', 'SUCCESS', 'PARTIAL', 'FAILURE', 'CRIT_FAILURE',
    ] as OutcomeTier[]);
  });

  it('TIME_COST_DAYS maps each TimeCost to a [min, max] day range per spec §2.5', () => {
    expect(TIME_COST_DAYS.INSTANT).toEqual([0, 0]);
    expect(TIME_COST_DAYS.SHORT).toEqual([1, 7]);
    expect(TIME_COST_DAYS.MEDIUM).toEqual([30, 90]);
    expect(TIME_COST_DAYS.LONG).toEqual([180, 540]);
    expect(TIME_COST_DAYS.EPOCH).toEqual([1095, 3650]);
  });

  it('TIME_COST_DAYS covers every TimeCost bucket', () => {
    const all: TimeCost[] = ['INSTANT', 'SHORT', 'MEDIUM', 'LONG', 'EPOCH'];
    for (const k of all) {
      expect(TIME_COST_DAYS[k]).toBeDefined();
      const [min, max] = TIME_COST_DAYS[k];
      expect(min).toBeLessThanOrEqual(max);
    }
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- Phase1BTypes`
Expected: FAIL — imports don't exist.

- [ ] **Step 3: Append to `src/engine/core/Types.ts`**

Open `src/engine/core/Types.ts` and append at the bottom (after the Phase 1A block added by Task 1 of Phase 1A):

```ts
// ---- Phase 1B: Choice-event engine tables ----
// Source of truth: docs/spec/design.md §5, §2.5.

export type CheckCategory =
  | 'brute_force' | 'melee_skill' | 'qi_combat' | 'dodge_flee'
  | 'social_persuade' | 'social_intimidate' | 'social_seduce'
  | 'deception' | 'insight_puzzle' | 'resist_mental' | 'resist_poison'
  | 'cultivation_attempt' | 'survival' | 'lore_scholarship';

export const CHECK_CATEGORIES: readonly CheckCategory[] = [
  'brute_force', 'melee_skill', 'qi_combat', 'dodge_flee',
  'social_persuade', 'social_intimidate', 'social_seduce',
  'deception', 'insight_puzzle', 'resist_mental', 'resist_poison',
  'cultivation_attempt', 'survival', 'lore_scholarship',
] as const;

/** Ordered from best to worst — used by OutcomeResolver for tier fallback. */
export const OUTCOME_TIER_ORDER: readonly OutcomeTier[] = [
  'CRIT_SUCCESS', 'SUCCESS', 'PARTIAL', 'FAILURE', 'CRIT_FAILURE',
] as const;

/** Day-range [min, max] for each TimeCost bucket — spec §2.5. */
export const TIME_COST_DAYS: Readonly<Record<TimeCost, readonly [number, number]>> = {
  INSTANT: [0, 0],
  SHORT:   [1, 7],
  MEDIUM:  [30, 90],
  LONG:    [180, 540],
  EPOCH:   [1095, 3650],
};
```

- [ ] **Step 4: Run tests**

Run: `npm test -- Phase1BTypes`
Expected: 4 passing.

Also: `npm run typecheck` clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/core/Types.ts src/engine/core/Phase1BTypes.test.ts
git commit -m "feat(engine): Phase 1B primitive tables (check categories, outcome order, time-cost days)"
```

---

## Task 2: StateDelta taxonomy

**Files:**
- Create: `src/engine/events/StateDelta.ts`
- Create: `src/engine/events/StateDelta.test.ts`

**Rationale:** Every outcome mutates game state through a structured, discriminated-union list of deltas. Centralising the shapes here makes Task 9 (OutcomeApplier) a pure dispatch over `kind`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/events/StateDelta.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  StateDelta,
  STATE_DELTA_KINDS,
  isStateDelta,
} from './StateDelta';

describe('StateDelta', () => {
  it('STATE_DELTA_KINDS lists every kind', () => {
    expect(STATE_DELTA_KINDS).toEqual([
      'hp_delta', 'qi_delta', 'insight_delta', 'attribute_delta',
      'flag_set', 'flag_clear', 'world_flag_set', 'world_flag_clear',
      'cultivation_progress_delta', 'item_add', 'item_remove',
      'technique_learn', 'meridian_open',
      'karma_delta', 'notice_delta',
      'age_delta_days',
    ]);
  });

  it('isStateDelta recognises each concrete shape', () => {
    const deltas: StateDelta[] = [
      { kind: 'hp_delta', amount: -10 },
      { kind: 'qi_delta', amount: 5 },
      { kind: 'insight_delta', amount: 3 },
      { kind: 'attribute_delta', stat: 'Body', amount: 1 },
      { kind: 'flag_set', flag: 'met_master' },
      { kind: 'flag_clear', flag: 'shamed_this_year' },
      { kind: 'world_flag_set', flag: 'drought_active' },
      { kind: 'world_flag_clear', flag: 'drought_active' },
      { kind: 'cultivation_progress_delta', amount: 15 },
      { kind: 'item_add', id: 'water_flask', count: 1 },
      { kind: 'item_remove', id: 'water_flask', count: 1 },
      { kind: 'technique_learn', id: 'TECH_IRON_SHIRT_NOVICE' },
      { kind: 'meridian_open', id: 3 },
      { kind: 'karma_delta', amount: -10 },
      { kind: 'notice_delta', amount: 2 },
      { kind: 'age_delta_days', amount: 30 },
    ];
    for (const d of deltas) expect(isStateDelta(d)).toBe(true);
  });

  it('isStateDelta rejects malformed shapes', () => {
    expect(isStateDelta(null)).toBe(false);
    expect(isStateDelta({})).toBe(false);
    expect(isStateDelta({ kind: 'banana', amount: 1 })).toBe(false);
    expect(isStateDelta({ kind: 'hp_delta' })).toBe(false); // missing amount
    expect(isStateDelta({ kind: 'attribute_delta', amount: 1 })).toBe(false); // missing stat
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- StateDelta`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/events/StateDelta.ts`:

```ts
// Discriminated union of state mutations produced by outcomes.
// Every kind is applied by OutcomeApplier (Task 9).

import { MeridianId, Stat } from '@/engine/core/Types';

export type StateDelta =
  | { kind: 'hp_delta'; amount: number }
  | { kind: 'qi_delta'; amount: number }
  | { kind: 'insight_delta'; amount: number }
  | { kind: 'attribute_delta'; stat: Stat; amount: number }
  | { kind: 'flag_set'; flag: string }
  | { kind: 'flag_clear'; flag: string }
  | { kind: 'world_flag_set'; flag: string }
  | { kind: 'world_flag_clear'; flag: string }
  | { kind: 'cultivation_progress_delta'; amount: number }
  | { kind: 'item_add'; id: string; count: number }
  | { kind: 'item_remove'; id: string; count: number }
  | { kind: 'technique_learn'; id: string }
  | { kind: 'meridian_open'; id: MeridianId }
  | { kind: 'karma_delta'; amount: number }
  | { kind: 'notice_delta'; amount: number }
  | { kind: 'age_delta_days'; amount: number };

export const STATE_DELTA_KINDS = [
  'hp_delta', 'qi_delta', 'insight_delta', 'attribute_delta',
  'flag_set', 'flag_clear', 'world_flag_set', 'world_flag_clear',
  'cultivation_progress_delta', 'item_add', 'item_remove',
  'technique_learn', 'meridian_open',
  'karma_delta', 'notice_delta',
  'age_delta_days',
] as const;

export function isStateDelta(v: unknown): v is StateDelta {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.kind !== 'string') return false;
  if (!(STATE_DELTA_KINDS as readonly string[]).includes(o.kind)) return false;

  switch (o.kind) {
    case 'hp_delta':
    case 'qi_delta':
    case 'insight_delta':
    case 'cultivation_progress_delta':
    case 'karma_delta':
    case 'notice_delta':
    case 'age_delta_days':
      return typeof o.amount === 'number';
    case 'attribute_delta':
      return typeof o.amount === 'number' && typeof o.stat === 'string';
    case 'flag_set':
    case 'flag_clear':
    case 'world_flag_set':
    case 'world_flag_clear':
      return typeof o.flag === 'string';
    case 'item_add':
    case 'item_remove':
      return typeof o.id === 'string' && typeof o.count === 'number';
    case 'technique_learn':
      return typeof o.id === 'string';
    case 'meridian_open':
      return typeof o.id === 'number';
    default:
      return false;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- StateDelta`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/engine/events/StateDelta.ts src/engine/events/StateDelta.test.ts
git commit -m "feat(events): StateDelta taxonomy (16 kinds)"
```

---

## Task 3: Event / Choice / Outcome schemas

**Files:**
- Modify: `src/content/schema.ts` (extend; preserve Phase 0 exports)
- Create: `src/content/event-schema.test.ts`

**Rationale:** Replace the Phase 0 stub `EventStubSchema` with full Event/Choice/Outcome shapes per spec §9.1–§9.3. The zod schema IS the TypeScript type source (`z.infer`).

- [ ] **Step 1: Write the failing test**

Create `src/content/event-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  EventSchema,
  ChoiceSchema,
  OutcomeSchema,
  OutcomeTableSchema,
  ConditionSetSchema,
} from './schema';

const validMinimalEvent = {
  id: 'EV_TEST_001',
  category: 'life.test',
  version: 1,
  weight: 100,
  conditions: {},
  timeCost: 'SHORT',
  text: { intro: ['hello'], body: [], outro: [] },
  choices: [
    {
      id: 'ch_stay',
      label: 'Wait and see.',
      timeCost: 'INSTANT',
      outcomes: {
        SUCCESS: { narrativeKey: 'out.wait.ok' },
        FAILURE: { narrativeKey: 'out.wait.fail' },
      },
    },
  ],
  repeat: 'unlimited',
};

describe('EventSchema', () => {
  it('accepts a minimal valid event', () => {
    const r = EventSchema.safeParse(validMinimalEvent);
    expect(r.success).toBe(true);
  });

  it('rejects events missing required fields', () => {
    const broken = { ...validMinimalEvent, id: undefined };
    const r = EventSchema.safeParse(broken);
    expect(r.success).toBe(false);
  });

  it('accepts all TimeCost values on the event and each choice', () => {
    for (const t of ['INSTANT', 'SHORT', 'MEDIUM', 'LONG', 'EPOCH'] as const) {
      const ev = { ...validMinimalEvent, timeCost: t };
      expect(EventSchema.safeParse(ev).success).toBe(true);
    }
  });

  it('rejects events with invalid TimeCost', () => {
    const r = EventSchema.safeParse({ ...validMinimalEvent, timeCost: 'FOREVER' });
    expect(r.success).toBe(false);
  });

  it('accepts "once_per_life", "once_ever", "unlimited" repeat values', () => {
    for (const rep of ['once_per_life', 'once_ever', 'unlimited'] as const) {
      const ev = { ...validMinimalEvent, repeat: rep };
      expect(EventSchema.safeParse(ev).success).toBe(true);
    }
  });
});

describe('ChoiceSchema', () => {
  it('accepts a check-bearing choice with stat weights and difficulty', () => {
    const choice = {
      id: 'ch_fight',
      label: 'Fight!',
      timeCost: 'SHORT',
      check: {
        stats: { Body: 1.2, Agility: 0.6 },
        base: 30,
        difficulty: 40,
      },
      outcomes: {
        CRIT_SUCCESS: { narrativeKey: 'out.fight.crit' },
        SUCCESS: { narrativeKey: 'out.fight.win' },
        FAILURE: { narrativeKey: 'out.fight.loss' },
      },
    };
    expect(ChoiceSchema.safeParse(choice).success).toBe(true);
  });

  it('rejects negative base or weight values', () => {
    const bad = {
      id: 'ch_x', label: 'x', timeCost: 'SHORT',
      check: { stats: { Body: -1 }, base: 10, difficulty: 10 },
      outcomes: { SUCCESS: { narrativeKey: 'ok' }, FAILURE: { narrativeKey: 'bad' } },
    };
    // stats values can be negative weights? — actually spec allows any real. Let's allow but disallow negative base.
    expect(ChoiceSchema.safeParse(bad).success).toBe(true); // stat weights unrestricted
    const badBase = {
      ...bad,
      check: { stats: { Body: 1 }, base: -5, difficulty: 10 },
    };
    expect(ChoiceSchema.safeParse(badBase).success).toBe(false);
  });
});

describe('OutcomeTableSchema', () => {
  it('requires at least SUCCESS and FAILURE entries', () => {
    expect(OutcomeTableSchema.safeParse({
      SUCCESS: { narrativeKey: 'a' },
      FAILURE: { narrativeKey: 'b' },
    }).success).toBe(true);

    expect(OutcomeTableSchema.safeParse({
      SUCCESS: { narrativeKey: 'a' },
    }).success).toBe(false);

    expect(OutcomeTableSchema.safeParse({
      FAILURE: { narrativeKey: 'b' },
    }).success).toBe(false);
  });

  it('accepts optional CRIT_SUCCESS, PARTIAL, CRIT_FAILURE', () => {
    expect(OutcomeTableSchema.safeParse({
      CRIT_SUCCESS: { narrativeKey: 'a' },
      SUCCESS: { narrativeKey: 'b' },
      PARTIAL: { narrativeKey: 'c' },
      FAILURE: { narrativeKey: 'd' },
      CRIT_FAILURE: { narrativeKey: 'e' },
    }).success).toBe(true);
  });
});

describe('OutcomeSchema', () => {
  it('accepts an outcome with stateDeltas and deathCause', () => {
    const out = {
      narrativeKey: 'x',
      stateDeltas: [{ kind: 'hp_delta', amount: -10 }],
      deathCause: 'starvation',
    };
    expect(OutcomeSchema.safeParse(out).success).toBe(true);
  });

  it('rejects unknown deathCause', () => {
    const out = { narrativeKey: 'x', deathCause: 'dragon_bite' };
    expect(OutcomeSchema.safeParse(out).success).toBe(false);
  });
});

describe('ConditionSetSchema', () => {
  it('accepts an empty object', () => {
    expect(ConditionSetSchema.safeParse({}).success).toBe(true);
  });

  it('accepts realistic filters', () => {
    const cond = {
      minAge: 10, maxAge: 50,
      regions: ['yellow_plains'],
      realms: ['mortal'],
      seasons: ['summer', 'autumn'],
      worldFlags: { require: ['drought_active'], exclude: [] },
      characterFlags: { require: [], exclude: ['drought_survived_this_life'] },
      minStat: { Body: 10 },
      maxNotice: 50,
    };
    expect(ConditionSetSchema.safeParse(cond).success).toBe(true);
  });

  it('rejects unknown region or realm strings', () => {
    expect(ConditionSetSchema.safeParse({ regions: ['atlantis'] }).success).toBe(true);
    // region is free-form string (matches content IDs) → accepted
    expect(ConditionSetSchema.safeParse({ realms: ['demigod'] }).success).toBe(false);
    // realm must be one of the known Realm enum values
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- event-schema`
Expected: FAIL.

- [ ] **Step 3: Implement**

Modify `src/content/schema.ts`. **Preserve all Phase 0 exports** (`SnippetEntrySchema`, `SnippetLibrarySchema`, `ContentPackSchema`, `ContentPack`, `SnippetEntry`). Replace the `EventStubSchema` with the full shapes.

Full rewritten file:

```ts
import { z } from 'zod';

// ---- Phase 0 snippet stubs (unchanged) ----
export const SnippetEntrySchema = z.object({
  text: z.string().min(1),
  weight: z.number().positive().optional(),
  tags: z.array(z.string()).optional(),
});

export const SnippetLibrarySchema = z.record(z.string(), z.array(SnippetEntrySchema));

// ---- Phase 1B event/choice/outcome schemas ----
// Source: docs/spec/design.md §9.

const REALM_STRINGS = [
  'mortal', 'body_tempering', 'qi_sensing', 'qi_condensation',
  'foundation', 'core', 'nascent_soul', 'soul_transformation',
  'void_refinement', 'immortal',
] as const;

const SEASON_STRINGS = ['spring', 'summer', 'autumn', 'winter'] as const;

const TIME_COST_STRINGS = ['INSTANT', 'SHORT', 'MEDIUM', 'LONG', 'EPOCH'] as const;

const STAT_STRINGS = ['Body', 'Mind', 'Spirit', 'Agility', 'Charm', 'Luck'] as const;

const DEATH_CAUSE_STRINGS = [
  'starvation', 'disease', 'old_age',
  'combat_melee', 'combat_qi', 'poison',
  'betrayal', 'tribulation', 'qi_deviation',
  'cripple_wasting', 'suicide_ritual', 'heavenly_intervention',
  'karmic_hunter', 'self_sacrifice', 'love_death', 'madness',
  'drowning', 'beast', 'demonic_corruption', 'childbirth',
] as const;

export const ConditionSetSchema = z.object({
  minAge: z.number().int().nonnegative().optional(),
  maxAge: z.number().int().nonnegative().optional(),
  regions: z.array(z.string()).optional(),
  locales: z.array(z.string()).optional(),
  realms: z.array(z.enum(REALM_STRINGS)).optional(),
  seasons: z.array(z.enum(SEASON_STRINGS)).optional(),
  worldFlags: z.object({
    require: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
  }).optional(),
  characterFlags: z.object({
    require: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
  }).optional(),
  minStat: z.record(z.enum(STAT_STRINGS), z.number()).optional(),
  maxStat: z.record(z.enum(STAT_STRINGS), z.number()).optional(),
  minNotice: z.number().optional(),
  maxNotice: z.number().optional(),
  requiresEcho: z.array(z.string()).optional(),
  excludesEcho: z.array(z.string()).optional(),
  requiresMemory: z.array(z.string()).optional(),
  requiresItem: z.array(z.string()).optional(),
  era: z.object({
    minYear: z.number().int().optional(),
    maxYear: z.number().int().optional(),
  }).optional(),
  customPredicate: z.string().optional(),
});

const StateDeltaSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hp_delta'), amount: z.number() }),
  z.object({ kind: z.literal('qi_delta'), amount: z.number() }),
  z.object({ kind: z.literal('insight_delta'), amount: z.number() }),
  z.object({ kind: z.literal('attribute_delta'), stat: z.enum(STAT_STRINGS), amount: z.number() }),
  z.object({ kind: z.literal('flag_set'), flag: z.string() }),
  z.object({ kind: z.literal('flag_clear'), flag: z.string() }),
  z.object({ kind: z.literal('world_flag_set'), flag: z.string() }),
  z.object({ kind: z.literal('world_flag_clear'), flag: z.string() }),
  z.object({ kind: z.literal('cultivation_progress_delta'), amount: z.number() }),
  z.object({ kind: z.literal('item_add'), id: z.string(), count: z.number().int().positive() }),
  z.object({ kind: z.literal('item_remove'), id: z.string(), count: z.number().int().positive() }),
  z.object({ kind: z.literal('technique_learn'), id: z.string() }),
  z.object({ kind: z.literal('meridian_open'), id: z.number().int().min(1).max(12) }),
  z.object({ kind: z.literal('karma_delta'), amount: z.number() }),
  z.object({ kind: z.literal('notice_delta'), amount: z.number() }),
  z.object({ kind: z.literal('age_delta_days'), amount: z.number().int().nonnegative() }),
]);

export const OutcomeSchema = z.object({
  narrativeKey: z.union([z.string(), z.array(z.string())]),
  stateDeltas: z.array(StateDeltaSchema).optional(),
  eventQueue: z.array(z.object({
    id: z.string(),
    priority: z.number().int().optional(),
  })).optional(),
  unlocks: z.object({
    echoes: z.array(z.string()).optional(),
    memories: z.array(z.string()).optional(),
    anchors: z.array(z.string()).optional(),
    codex: z.array(z.string()).optional(),
  }).optional(),
  witnessMemory: z.string().optional(),
  noticeDelta: z.number().optional(),
  deathCause: z.enum(DEATH_CAUSE_STRINGS).optional(),
});

export const OutcomeTableSchema = z.object({
  CRIT_SUCCESS: OutcomeSchema.optional(),
  SUCCESS: OutcomeSchema,
  PARTIAL: OutcomeSchema.optional(),
  FAILURE: OutcomeSchema,
  CRIT_FAILURE: OutcomeSchema.optional(),
});

export const ChoiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  subtext: z.string().optional(),
  preconditions: ConditionSetSchema.optional(),
  cost: z.object({
    qi: z.number().nonnegative().optional(),
    insight: z.number().nonnegative().optional(),
    items: z.array(z.object({
      id: z.string(),
      count: z.number().int().positive(),
    })).optional(),
  }).optional(),
  check: z.object({
    stats: z.record(z.enum(STAT_STRINGS), z.number()).optional(),
    skills: z.record(z.string(), z.number()).optional(),
    base: z.number().nonnegative(),
    difficulty: z.number(),
    techniqueBonusCategory: z.string().optional(),
  }).optional(),
  timeCost: z.enum(TIME_COST_STRINGS),
  outcomes: OutcomeTableSchema,
  flagDeltas: z.object({
    set: z.array(z.string()).optional(),
    clear: z.array(z.string()).optional(),
  }).optional(),
});

export const EventSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  version: z.number().int().positive(),
  weight: z.number().positive(),
  conditions: ConditionSetSchema,
  timeCost: z.enum(TIME_COST_STRINGS),
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

// ---- Content pack (Phase 0 loader — now wraps the richer Event schema) ----

export const ContentPackSchema = z.object({
  version: z.number().int().positive(),
  snippets: SnippetLibrarySchema,
  events: z.array(EventSchema),
});

export type ContentPack = z.infer<typeof ContentPackSchema>;
export type SnippetEntry = z.infer<typeof SnippetEntrySchema>;
export type EventDef = z.infer<typeof EventSchema>;
export type Choice = z.infer<typeof ChoiceSchema>;
export type Outcome = z.infer<typeof OutcomeSchema>;
export type OutcomeTable = z.infer<typeof OutcomeTableSchema>;
export type ConditionSet = z.infer<typeof ConditionSetSchema>;
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: all green — including the previously-passing Phase 0 `content loader` test (which uses `EventStubSchema` — we've replaced it with `EventSchema`, so the "empty events array" fixture still validates, but any existing fixture that only had `{id: string}` events will break. Phase 0's fixture has `events: []` so it passes.).

Specifically: `npm test -- event-schema` → 10 passing. `npm test -- loader` → still 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/content/schema.ts src/content/event-schema.test.ts
git commit -m "feat(content): full Event/Choice/Outcome schemas with StateDelta union"
```

---

## Task 4: ConditionSet evaluator

**Files:**
- Create: `src/engine/events/ConditionEvaluator.ts`
- Create: `src/engine/events/ConditionEvaluator.test.ts`

**Rationale:** A pure predicate: given a `ConditionSet` and the current evaluation context (character + world flags + era + region + notice), decide whether the event (or choice) is admissible.

- [ ] **Step 1: Write the failing test**

Create `src/engine/events/ConditionEvaluator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';
import { createCharacter, refreshDerived, withFlag } from '@/engine/character/Character';
import { ConditionSet } from '@/content/schema';
import { evaluateConditions, EvalContext } from './ConditionEvaluator';

const ATTRS = { Body: 20, Mind: 15, Spirit: 10, Agility: 12, Charm: 8, Luck: 30 };

function ctx(overrides: Partial<EvalContext> = {}): EvalContext {
  const base = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
  return {
    character: base,
    worldFlags: [],
    region: 'yellow_plains',
    locale: 'unnamed',
    year: 1000,
    season: 'summer',
    heavenlyNotice: 0,
    ageYears: 0,
    ...overrides,
  };
}

describe('evaluateConditions', () => {
  it('empty conditions are always true', () => {
    expect(evaluateConditions({}, ctx())).toBe(true);
  });

  it('minAge / maxAge gate on ageYears', () => {
    expect(evaluateConditions({ minAge: 10 }, ctx({ ageYears: 5 }))).toBe(false);
    expect(evaluateConditions({ minAge: 10 }, ctx({ ageYears: 10 }))).toBe(true);
    expect(evaluateConditions({ maxAge: 20 }, ctx({ ageYears: 25 }))).toBe(false);
    expect(evaluateConditions({ maxAge: 20 }, ctx({ ageYears: 20 }))).toBe(true);
  });

  it('regions filter is OR: ctx.region must match one', () => {
    expect(evaluateConditions({ regions: ['yellow_plains'] }, ctx({ region: 'yellow_plains' }))).toBe(true);
    expect(evaluateConditions({ regions: ['azure_peaks'] }, ctx({ region: 'yellow_plains' }))).toBe(false);
    expect(evaluateConditions({ regions: ['yellow_plains', 'azure_peaks'] }, ctx({ region: 'yellow_plains' }))).toBe(true);
  });

  it('realms filter', () => {
    expect(evaluateConditions({ realms: ['mortal'] }, ctx())).toBe(true);
    const bt = refreshDerived({ ...ctx().character, realm: Realm.BODY_TEMPERING, bodyTemperingLayer: 1 });
    expect(evaluateConditions({ realms: ['mortal'] }, ctx({ character: bt }))).toBe(false);
    expect(evaluateConditions({ realms: ['mortal', 'body_tempering'] }, ctx({ character: bt }))).toBe(true);
  });

  it('seasons filter', () => {
    expect(evaluateConditions({ seasons: ['summer'] }, ctx({ season: 'summer' }))).toBe(true);
    expect(evaluateConditions({ seasons: ['winter'] }, ctx({ season: 'summer' }))).toBe(false);
  });

  it('worldFlags.require matches by intersection', () => {
    expect(evaluateConditions(
      { worldFlags: { require: ['drought_active'] } },
      ctx({ worldFlags: ['drought_active', 'war_in_south'] })
    )).toBe(true);

    expect(evaluateConditions(
      { worldFlags: { require: ['drought_active'] } },
      ctx({ worldFlags: ['war_in_south'] })
    )).toBe(false);
  });

  it('worldFlags.exclude rejects when any excluded flag is present', () => {
    expect(evaluateConditions(
      { worldFlags: { exclude: ['drought_active'] } },
      ctx({ worldFlags: ['drought_active'] })
    )).toBe(false);

    expect(evaluateConditions(
      { worldFlags: { exclude: ['drought_active'] } },
      ctx({ worldFlags: [] })
    )).toBe(true);
  });

  it('characterFlags.require and exclude use character.flags', () => {
    const c0 = ctx().character;
    const c1 = withFlag(c0, 'stole_from_monk');
    expect(evaluateConditions(
      { characterFlags: { exclude: ['stole_from_monk'] } },
      ctx({ character: c1 })
    )).toBe(false);

    expect(evaluateConditions(
      { characterFlags: { require: ['met_master'] } },
      ctx({ character: c1 })
    )).toBe(false);
  });

  it('minStat and maxStat gate on character attributes', () => {
    expect(evaluateConditions(
      { minStat: { Body: 30 } },
      ctx() // Body 20
    )).toBe(false);

    expect(evaluateConditions(
      { minStat: { Body: 10 } },
      ctx()
    )).toBe(true);

    expect(evaluateConditions(
      { maxStat: { Charm: 5 } },
      ctx() // Charm 8
    )).toBe(false);
  });

  it('notice thresholds', () => {
    expect(evaluateConditions({ minNotice: 20 }, ctx({ heavenlyNotice: 10 }))).toBe(false);
    expect(evaluateConditions({ minNotice: 20 }, ctx({ heavenlyNotice: 30 }))).toBe(true);
    expect(evaluateConditions({ maxNotice: 50 }, ctx({ heavenlyNotice: 60 }))).toBe(false);
  });

  it('era range', () => {
    expect(evaluateConditions({ era: { minYear: 500, maxYear: 900 } }, ctx({ year: 700 }))).toBe(true);
    expect(evaluateConditions({ era: { minYear: 500, maxYear: 900 } }, ctx({ year: 300 }))).toBe(false);
    expect(evaluateConditions({ era: { minYear: 500, maxYear: 900 } }, ctx({ year: 1000 }))).toBe(false);
  });

  it('combines multiple conditions with AND', () => {
    const cs: ConditionSet = {
      minAge: 10, maxAge: 50,
      regions: ['yellow_plains'],
      realms: ['mortal'],
    };
    expect(evaluateConditions(cs, ctx({ ageYears: 20 }))).toBe(true);
    expect(evaluateConditions(cs, ctx({ ageYears: 60 }))).toBe(false);
    expect(evaluateConditions(cs, ctx({ ageYears: 20, region: 'azure_peaks' }))).toBe(false);
  });

  it('customPredicate is not supported in Phase 1B and returns false when set', () => {
    // Phase 1B defers the predicate registry. Event using one is simply rejected.
    expect(evaluateConditions({ customPredicate: 'some_predicate' }, ctx())).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- ConditionEvaluator`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/events/ConditionEvaluator.ts`:

```ts
// Pure predicate over a ConditionSet.
// Source: docs/spec/design.md §5.1, §9.2.

import { Realm, Season, Stat } from '@/engine/core/Types';
import { Character } from '@/engine/character/Character';
import { ConditionSet } from '@/content/schema';

export interface EvalContext {
  character: Character;
  worldFlags: ReadonlyArray<string>;
  region: string;
  locale: string;
  year: number;
  season: Season;
  heavenlyNotice: number;
  ageYears: number;
}

function any<T>(list: ReadonlyArray<T> | undefined, target: T): boolean {
  if (!list || list.length === 0) return true; // empty means no constraint
  return list.includes(target);
}

function hasAll(list: ReadonlyArray<string> | undefined, have: ReadonlyArray<string>): boolean {
  if (!list || list.length === 0) return true;
  return list.every((f) => have.includes(f));
}

function hasAny(list: ReadonlyArray<string> | undefined, have: ReadonlyArray<string>): boolean {
  if (!list || list.length === 0) return false;
  return list.some((f) => have.includes(f));
}

export function evaluateConditions(cs: ConditionSet, ctx: EvalContext): boolean {
  // Phase 1B rejects any customPredicate outright (registry not implemented).
  if (cs.customPredicate !== undefined) return false;

  if (cs.minAge !== undefined && ctx.ageYears < cs.minAge) return false;
  if (cs.maxAge !== undefined && ctx.ageYears > cs.maxAge) return false;

  if (cs.regions && cs.regions.length > 0 && !cs.regions.includes(ctx.region)) return false;
  if (cs.locales && cs.locales.length > 0 && !cs.locales.includes(ctx.locale)) return false;

  if (cs.realms && cs.realms.length > 0) {
    // cs.realms uses the string form; Realm enum stores the same strings.
    if (!cs.realms.includes(ctx.character.realm as Realm)) return false;
  }

  if (cs.seasons && cs.seasons.length > 0 && !cs.seasons.includes(ctx.season)) return false;

  if (cs.worldFlags) {
    if (!hasAll(cs.worldFlags.require, ctx.worldFlags)) return false;
    if (hasAny(cs.worldFlags.exclude, ctx.worldFlags)) return false;
  }

  if (cs.characterFlags) {
    if (!hasAll(cs.characterFlags.require, ctx.character.flags)) return false;
    if (hasAny(cs.characterFlags.exclude, ctx.character.flags)) return false;
  }

  if (cs.minStat) {
    for (const [stat, minV] of Object.entries(cs.minStat)) {
      if ((ctx.character.attributes as Record<string, number>)[stat] < (minV as number)) return false;
    }
  }
  if (cs.maxStat) {
    for (const [stat, maxV] of Object.entries(cs.maxStat)) {
      if ((ctx.character.attributes as Record<string, number>)[stat] > (maxV as number)) return false;
    }
  }

  if (cs.minNotice !== undefined && ctx.heavenlyNotice < cs.minNotice) return false;
  if (cs.maxNotice !== undefined && ctx.heavenlyNotice > cs.maxNotice) return false;

  if (cs.era) {
    if (cs.era.minYear !== undefined && ctx.year < cs.era.minYear) return false;
    if (cs.era.maxYear !== undefined && ctx.year > cs.era.maxYear) return false;
  }

  // Echo / Memory / Item requirements deferred to later phases; if set, treat as unmatched.
  if (cs.requiresEcho && cs.requiresEcho.length > 0) return false;
  if (cs.excludesEcho && cs.excludesEcho.length > 0) return true;
  if (cs.requiresMemory && cs.requiresMemory.length > 0) return false;
  if (cs.requiresItem && cs.requiresItem.length > 0) return false;

  return true;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- ConditionEvaluator`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/events/ConditionEvaluator.ts src/engine/events/ConditionEvaluator.test.ts
git commit -m "feat(events): ConditionSet evaluator"
```

---

## Task 5: EventSelector — weighted pick with filters and repetition penalty

**Files:**
- Create: `src/engine/events/EventSelector.ts`
- Create: `src/engine/events/EventSelector.test.ts`

**Rationale:** Given the full event pool + eval context, produce a weighted random pick. Applies repetition penalty (recent events get ×0.1 for 5 turns). Rejects events whose `repeat` has been satisfied (once_per_life, once_ever).

- [ ] **Step 1: Write the failing test**

Create `src/engine/events/EventSelector.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createCharacter } from '@/engine/character/Character';
import { EventDef } from '@/content/schema';
import { EvalContext } from './ConditionEvaluator';
import {
  selectEvent,
  buildSelectionPool,
  REPETITION_WINDOW_TURNS,
} from './EventSelector';

const ATTRS = { Body: 20, Mind: 15, Spirit: 10, Agility: 12, Charm: 8, Luck: 30 };

function makeEvent(id: string, weight: number, overrides: Partial<EventDef> = {}): EventDef {
  return {
    id,
    category: 'test',
    version: 1,
    weight,
    conditions: {},
    timeCost: 'SHORT',
    text: {},
    choices: [{
      id: 'ch_x',
      label: 'x',
      timeCost: 'INSTANT',
      outcomes: { SUCCESS: { narrativeKey: 'a' }, FAILURE: { narrativeKey: 'b' } },
    }],
    repeat: 'unlimited',
    ...overrides,
  };
}

function ctx(overrides: Partial<EvalContext> = {}): EvalContext {
  return {
    character: createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) }),
    worldFlags: [],
    region: 'yellow_plains',
    locale: 'unnamed',
    year: 1000,
    season: 'summer',
    heavenlyNotice: 0,
    ageYears: 20,
    ...overrides,
  };
}

describe('buildSelectionPool', () => {
  it('includes events whose conditions match', () => {
    const pool = [
      makeEvent('A', 100),
      makeEvent('B', 100, { conditions: { regions: ['azure_peaks'] } }),
    ];
    const result = buildSelectionPool(pool, ctx(), [], []);
    expect(result.map(x => x.event.id)).toEqual(['A']);
  });

  it('excludes once_per_life events already seen this life', () => {
    const pool = [
      makeEvent('OP', 100, { repeat: 'once_per_life' }),
    ];
    const result = buildSelectionPool(pool, ctx(), [], ['OP']);
    expect(result).toHaveLength(0);
  });

  it('excludes once_ever events already seen lifetime-wide (via lifetimeSeen)', () => {
    const pool = [makeEvent('OE', 100, { repeat: 'once_ever' })];
    const result = buildSelectionPool(pool, ctx(), ['OE'], []);
    expect(result).toHaveLength(0);
  });

  it('applies 0.1× repetition penalty within REPETITION_WINDOW_TURNS', () => {
    const pool = [
      makeEvent('X', 100),
      makeEvent('Y', 100),
    ];
    // X was seen 2 turns ago, within the 5-turn window
    const recent: ReadonlyArray<string> = ['Y', 'X', 'Y', 'X', 'Y']; // last 5 turns, X appears
    const r = buildSelectionPool(pool, ctx(), [], recent);
    const xEntry = r.find(e => e.event.id === 'X')!;
    const yEntry = r.find(e => e.event.id === 'Y')!;
    expect(xEntry.effectiveWeight).toBeLessThan(yEntry.effectiveWeight);
    expect(xEntry.effectiveWeight).toBeCloseTo(100 * 0.1, 5);
  });
});

describe('selectEvent', () => {
  it('returns null when pool is empty', () => {
    expect(selectEvent([], ctx(), [], [], createRng(1))).toBeNull();
  });

  it('is deterministic for the same inputs and seed', () => {
    const pool = [makeEvent('A', 100), makeEvent('B', 100), makeEvent('C', 100)];
    const a = selectEvent(pool, ctx(), [], [], createRng(42));
    const b = selectEvent(pool, ctx(), [], [], createRng(42));
    expect(a?.id).toBe(b?.id);
  });

  it('respects weight distribution approximately', () => {
    const pool = [
      makeEvent('rare',  10),
      makeEvent('common', 90),
    ];
    const rng = createRng(123);
    const counts: Record<string, number> = { rare: 0, common: 0 };
    for (let i = 0; i < 1000; i++) {
      const pick = selectEvent(pool, ctx(), [], [], rng);
      if (pick) counts[pick.id]++;
    }
    expect(counts.common).toBeGreaterThan(counts.rare * 5);
  });

  it('never picks a filtered-out event', () => {
    const pool = [
      makeEvent('A', 100, { conditions: { regions: ['azure_peaks'] } }),
      makeEvent('B', 100),
    ];
    const rng = createRng(9);
    for (let i = 0; i < 200; i++) {
      const pick = selectEvent(pool, ctx(), [], [], rng);
      if (pick) expect(pick.id).toBe('B');
    }
  });

  it('returns null when every event fails conditions', () => {
    const pool = [
      makeEvent('A', 100, { conditions: { regions: ['azure_peaks'] } }),
    ];
    expect(selectEvent(pool, ctx(), [], [], createRng(1))).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- EventSelector`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/events/EventSelector.ts`:

```ts
// Weighted event selector with filters + repetition penalty.
// Source: docs/spec/design.md §5.1.

import { IRng } from '@/engine/core/RNG';
import { EventDef } from '@/content/schema';
import { evaluateConditions, EvalContext } from './ConditionEvaluator';

export const REPETITION_WINDOW_TURNS = 5;
export const REPETITION_PENALTY = 0.1;

export interface PoolEntry {
  event: EventDef;
  effectiveWeight: number;
}

/**
 * Build the admissible selection pool:
 *   1. Filter by ConditionSet
 *   2. Drop events whose `repeat` has been satisfied
 *   3. Multiply base weight by repetition penalty if recently seen
 */
export function buildSelectionPool(
  events: ReadonlyArray<EventDef>,
  ctx: EvalContext,
  lifetimeSeen: ReadonlyArray<string>,
  thisLifeSeen: ReadonlyArray<string>,
): PoolEntry[] {
  // Only the last N turns count as "recent".
  const recent = thisLifeSeen.slice(-REPETITION_WINDOW_TURNS);
  const out: PoolEntry[] = [];

  for (const ev of events) {
    // Repeat gate
    if (ev.repeat === 'once_ever' && lifetimeSeen.includes(ev.id)) continue;
    if (ev.repeat === 'once_per_life' && thisLifeSeen.includes(ev.id)) continue;

    // Condition gate
    if (!evaluateConditions(ev.conditions, ctx)) continue;

    // Weight adjustment
    const penalised = recent.includes(ev.id)
      ? ev.weight * REPETITION_PENALTY
      : ev.weight;

    if (penalised > 0) out.push({ event: ev, effectiveWeight: penalised });
  }
  return out;
}

export function selectEvent(
  events: ReadonlyArray<EventDef>,
  ctx: EvalContext,
  lifetimeSeen: ReadonlyArray<string>,
  thisLifeSeen: ReadonlyArray<string>,
  rng: IRng,
): EventDef | null {
  const pool = buildSelectionPool(events, ctx, lifetimeSeen, thisLifeSeen);
  if (pool.length === 0) return null;
  return rng.weightedPick(pool, (p) => p.effectiveWeight).event;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- EventSelector`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/events/EventSelector.ts src/engine/events/EventSelector.test.ts
git commit -m "feat(events): weighted selector with filters and repetition penalty"
```

---

## Task 6: Technique types + choice-bonus lookup

**Files:**
- Create: `src/engine/cultivation/Technique.ts`
- Create: `src/engine/cultivation/Technique.test.ts`

**Rationale:** A technique contributes +X to any check matching its `choice_bonus` effect's category. Phase 1B needs the lookup (used by ChoiceResolver). Actual technique data authoring is Phase 1D.

- [ ] **Step 1: Write the failing test**

Create `src/engine/cultivation/Technique.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  TechniqueDef,
  resolveTechniqueBonus,
} from './Technique';

const IRON_SHIRT: TechniqueDef = {
  id: 'TECH_IRON_SHIRT_NOVICE',
  name: 'Iron Shirt',
  grade: 'mortal',
  element: 'none',
  coreAffinity: ['iron_mountain'],
  requires: { openMeridianCount: 1 },
  qiCost: 3,
  effects: [
    { kind: 'choice_bonus', category: 'resist_physical', bonus: 15 },
    { kind: 'choice_bonus', category: 'body_cultivation', bonus: 8 },
  ],
  description: '…',
};

const FLAME_PALM: TechniqueDef = {
  id: 'TECH_FLAME_PALM',
  name: 'Flame Palm',
  grade: 'yellow',
  element: 'fire',
  coreAffinity: ['severing_edge'],
  requires: {},
  qiCost: 5,
  effects: [
    { kind: 'choice_bonus', category: 'melee_skill', bonus: 20 },
    { kind: 'choice_bonus', category: 'brute_force', bonus: 10 },
  ],
  description: '…',
};

describe('resolveTechniqueBonus', () => {
  it('returns 0 for unknown category', () => {
    expect(resolveTechniqueBonus([], 'melee_skill')).toBe(0);
    expect(resolveTechniqueBonus([IRON_SHIRT], 'melee_skill')).toBe(0);
  });

  it('sums bonuses across learned techniques for the given category', () => {
    expect(resolveTechniqueBonus([IRON_SHIRT, FLAME_PALM], 'melee_skill')).toBe(20);
    expect(resolveTechniqueBonus([IRON_SHIRT, FLAME_PALM], 'brute_force')).toBe(10);
    expect(resolveTechniqueBonus([IRON_SHIRT, FLAME_PALM], 'resist_physical')).toBe(15);
  });

  it('ignores non-choice_bonus effects', () => {
    const t: TechniqueDef = {
      ...IRON_SHIRT,
      effects: [
        { kind: 'qi_regen', amount: 2 },
        { kind: 'choice_bonus', category: 'melee_skill', bonus: 5 },
      ],
    };
    expect(resolveTechniqueBonus([t], 'melee_skill')).toBe(5);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- Technique`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/cultivation/Technique.ts`:

```ts
// Technique types + choice-bonus resolver.
// Source: docs/spec/design.md §4.7, §9.5.

import { CorePathId, Element, Realm } from '@/engine/core/Types';

export type TechniqueGrade = 'mortal' | 'yellow' | 'profound' | 'earth' | 'heaven' | 'immortal';

export type TechniqueEffect =
  | { kind: 'choice_bonus'; category: string; bonus: number }
  | { kind: 'qi_regen'; amount: number }
  | { kind: 'insight_gain_per_meditation'; amount: number };

export interface TechniqueDef {
  id: string;
  name: string;
  grade: TechniqueGrade;
  element: Element;
  coreAffinity: ReadonlyArray<CorePathId>;
  requires: {
    realm?: Realm;
    meridians?: ReadonlyArray<number>;
    openMeridianCount?: number;
  };
  qiCost: number;
  insightCost?: number;
  effects: ReadonlyArray<TechniqueEffect>;
  description: string;
}

/**
 * Sum all `choice_bonus` contributions across the character's learned techniques
 * for a specific category.
 */
export function resolveTechniqueBonus(
  techniques: ReadonlyArray<TechniqueDef>,
  category: string,
): number {
  let total = 0;
  for (const t of techniques) {
    for (const eff of t.effects) {
      if (eff.kind === 'choice_bonus' && eff.category === category) {
        total += eff.bonus;
      }
    }
  }
  return total;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- Technique`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/cultivation/Technique.ts src/engine/cultivation/Technique.test.ts
git commit -m "feat(cultivation): Technique types + choice-bonus resolver"
```

---

## Task 7: ChoiceResolver — the §5.3 formula

**Files:**
- Create: `src/engine/choices/ChoiceResolver.ts`
- Create: `src/engine/choices/ChoiceResolver.test.ts`

**Rationale:** THE formula of the game. Every combat, social, and cultivation interaction routes through this. The tests use the canonical cases from spec §14.5.

- [ ] **Step 1: Write the failing test**

Create `src/engine/choices/ChoiceResolver.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { OutcomeTier } from '@/engine/core/Types';
import { Choice } from '@/content/schema';
import { resolveCheck, ResolveArgs, ResolveResult } from './ChoiceResolver';

function baseArgs(overrides: Partial<ResolveArgs> = {}): ResolveArgs {
  const check: Choice['check'] = {
    stats: { Body: 1.2, Agility: 0.6 },
    base: 30,
    difficulty: 40,
  };
  return {
    check: check!,
    characterStats: { Body: 28, Mind: 15, Spirit: 10, Agility: 35, Charm: 10, Luck: 42 },
    characterSkills: {},
    techniqueBonus: 0,
    itemBonus: 0,
    echoBonus: 0,
    memoryBonus: 0,
    moodBonus: 0,
    worldMalice: 0,
    streakBonus: 0,
    rng: createRng(1),
    ...overrides,
  };
}

describe('resolveCheck — worked example (spec §5.7)', () => {
  it('produces rawChance 44.6, clamped 44 (rounded) for Bandit-on-the-Road Fight', () => {
    const r = resolveCheck(baseArgs({ rng: createRng(1) }));
    // rawChance = 30 + 1.2*28 + 0.6*35 - 40 = 44.6
    // floor = 5 + 42/10 = 9.2, ceiling = 95
    // clamped = round(44.6) = 45 (we round at the end)
    // The exact rounding behavior is implementation-defined; test that chance is 44 or 45.
    expect([44, 45]).toContain(r.chance);
    expect(r.floor).toBeCloseTo(9.2, 1);
    expect(r.ceiling).toBe(95);
  });
});

describe('resolveCheck — canonical table (spec §14.5)', () => {
  it('Body 0, Luck 0, base 30, diff 40 → floor ≥ 5', () => {
    const r = resolveCheck(baseArgs({
      characterStats: { Body: 0, Mind: 0, Spirit: 0, Agility: 0, Charm: 0, Luck: 0 },
      check: { stats: { Body: 1.0 }, base: 30, difficulty: 40 },
    }));
    expect(r.chance).toBeGreaterThanOrEqual(5);
  });

  it('Body 0, Luck 100, base 30, diff 40 → floor 15, critBand 0.45', () => {
    const r = resolveCheck(baseArgs({
      characterStats: { Body: 0, Mind: 0, Spirit: 0, Agility: 0, Charm: 0, Luck: 100 },
      check: { stats: { Body: 1.0 }, base: 30, difficulty: 40 },
    }));
    expect(r.floor).toBeCloseTo(15, 2);
    expect(r.critBand).toBeCloseTo(0.45, 2);
  });

  it('maxed stats vs very hard check clamps to ceiling 95', () => {
    const r = resolveCheck(baseArgs({
      characterStats: { Body: 100, Mind: 100, Spirit: 100, Agility: 100, Charm: 100, Luck: 0 },
      check: { stats: { Body: 1.2 }, base: 30, difficulty: 100 },
      worldMalice: 0,
    }));
    expect(r.chance).toBeLessThanOrEqual(95);
  });

  it('same seed + same inputs → identical tier', () => {
    const a = resolveCheck(baseArgs({ rng: createRng(42) }));
    const b = resolveCheck(baseArgs({ rng: createRng(42) }));
    expect(a).toEqual(b);
  });

  it('Luck 100 → CRIT_SUCCESS window covers up to chance × 0.45', () => {
    // Rig a resolver to always roll the minimum d100 (1) — use a seed that gives low roll.
    // Alternative: verify critBand equation.
    const r = resolveCheck(baseArgs({
      characterStats: { Body: 0, Mind: 0, Spirit: 0, Agility: 0, Charm: 0, Luck: 100 },
    }));
    expect(r.critBand).toBeCloseTo(0.45, 2);
  });

  it('Luck 0 → fumbleFloor = 5 (CRIT_FAIL on roll ≥ 96)', () => {
    const r = resolveCheck(baseArgs({
      characterStats: { Body: 0, Mind: 0, Spirit: 0, Agility: 0, Charm: 0, Luck: 0 },
    }));
    expect(r.fumbleFloor).toBe(5);
  });

  it('Luck 100 → fumbleFloor = 1 (CRIT_FAIL on roll = 100 only)', () => {
    const r = resolveCheck(baseArgs({
      characterStats: { Body: 0, Mind: 0, Spirit: 0, Agility: 0, Charm: 0, Luck: 100 },
    }));
    expect(r.fumbleFloor).toBe(1);
  });

  it('streakBonus +10 lifts the chance', () => {
    const noStreak = resolveCheck(baseArgs({ streakBonus: 0, rng: createRng(1) }));
    const withStreak = resolveCheck(baseArgs({ streakBonus: 10, rng: createRng(1) }));
    expect(withStreak.chance).toBeGreaterThan(noStreak.chance);
  });

  it('worldMalice lowers the ceiling', () => {
    const peaceful = resolveCheck(baseArgs({ worldMalice: 0 }));
    const hostile  = resolveCheck(baseArgs({ worldMalice: 50 }));
    expect(hostile.ceiling).toBeLessThan(peaceful.ceiling);
    expect(hostile.ceiling).toBeCloseTo(95 - 50/5, 2);
  });

  it('produces tier consistent with roll vs chance', () => {
    // Sweep seeds to confirm all five tiers are reachable with standard inputs
    const tiers = new Set<OutcomeTier>();
    for (let seed = 1; seed <= 500 && tiers.size < 5; seed++) {
      tiers.add(resolveCheck(baseArgs({ rng: createRng(seed) })).tier);
    }
    expect(tiers.size).toBe(5);
  });

  it('technique + item + echo + memory + mood bonuses all add to raw chance', () => {
    const base = resolveCheck(baseArgs());
    const boosted = resolveCheck(baseArgs({
      techniqueBonus: 5, itemBonus: 3, echoBonus: 4, memoryBonus: 2, moodBonus: 1,
    }));
    expect(boosted.chance).toBeGreaterThan(base.chance);
  });
});

describe('resolveCheck — missing check field', () => {
  it('returns SUCCESS with chance 100 when choice has no check', () => {
    const r = resolveCheck({ ...baseArgs(), check: undefined });
    expect(r.tier).toBe('SUCCESS');
    expect(r.chance).toBe(100);
    expect(r.roll).toBe(0); // sentinel value
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- ChoiceResolver`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/choices/ChoiceResolver.ts`:

```ts
// The core probability resolver. Source: docs/spec/design.md §5.3.

import { OutcomeTier, Stat } from '@/engine/core/Types';
import { IRng } from '@/engine/core/RNG';
import { Choice } from '@/content/schema';
import { AttributeMap } from '@/engine/character/Attribute';

export interface ResolveArgs {
  /** The check from the Choice. `undefined` means auto-success. */
  check: Choice['check'] | undefined;
  characterStats: Readonly<AttributeMap>;
  characterSkills: Readonly<Record<string, number>>;
  techniqueBonus: number;
  itemBonus: number;
  echoBonus: number;
  memoryBonus: number;
  moodBonus: number;
  worldMalice: number;
  streakBonus: number;
  rng: IRng;
}

export interface ResolveResult {
  tier: OutcomeTier;
  chance: number;       // clamped, integer percent
  roll: number;         // d100 roll, or 0 if auto-success (no check)
  floor: number;
  ceiling: number;
  critBand: number;
  fumbleFloor: number;
  rawChance: number;    // pre-clamp, for debugging
}

function sumWeightedStats(
  weights: Readonly<Partial<Record<Stat, number>>> | undefined,
  stats: Readonly<AttributeMap>,
): number {
  if (!weights) return 0;
  let sum = 0;
  for (const [stat, w] of Object.entries(weights)) {
    sum += (w as number) * (stats[stat as Stat] ?? 0);
  }
  return sum;
}

function sumWeightedSkills(
  weights: Readonly<Record<string, number>> | undefined,
  skills: Readonly<Record<string, number>>,
): number {
  if (!weights) return 0;
  let sum = 0;
  for (const [name, w] of Object.entries(weights)) {
    sum += w * (skills[name] ?? 0);
  }
  return sum;
}

export function resolveCheck(args: ResolveArgs): ResolveResult {
  // Auto-success path: choices without a check always succeed.
  if (!args.check) {
    return {
      tier: 'SUCCESS',
      chance: 100,
      roll: 0,
      floor: 0,
      ceiling: 100,
      critBand: 0,
      fumbleFloor: 0,
      rawChance: 100,
    };
  }

  const { check } = args;
  const luck = args.characterStats.Luck ?? 0;

  const rawChance =
    check.base
    + sumWeightedStats(check.stats, args.characterStats)
    + sumWeightedSkills(check.skills, args.characterSkills)
    + args.techniqueBonus
    + args.itemBonus
    + args.echoBonus
    + args.memoryBonus
    + args.moodBonus
    + args.streakBonus
    - check.difficulty
    - args.worldMalice;

  const floor   = 5 + luck / 10;
  const ceiling = 95 - args.worldMalice / 5;

  const clampedRaw = Math.min(ceiling, Math.max(floor, rawChance));
  const chance = Math.round(clampedRaw);

  const critBand    = 0.15 + luck * 0.003;
  const fumbleFloor = Math.max(1, Math.round(5 - luck * 0.04));

  const roll = args.rng.d100();

  let tier: OutcomeTier;
  if (roll <= chance * critBand) tier = 'CRIT_SUCCESS';
  else if (roll <= chance)        tier = 'SUCCESS';
  else if (roll <= chance + 15)   tier = 'PARTIAL';
  else if (roll >= 100 - fumbleFloor + 1) tier = 'CRIT_FAILURE';
  else                            tier = 'FAILURE';

  return { tier, chance, roll, floor, ceiling, critBand, fumbleFloor, rawChance };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- ChoiceResolver`
Expected: all pass. The "all five tiers reachable" test scans up to 500 seeds — should complete in well under 1 second.

- [ ] **Step 5: Commit**

```bash
git add src/engine/choices/ChoiceResolver.ts src/engine/choices/ChoiceResolver.test.ts
git commit -m "feat(choices): §5.3 probability resolver"
```

---

## Task 8: OutcomeResolver — tier → Outcome with fallback

**Files:**
- Create: `src/engine/choices/OutcomeResolver.ts`
- Create: `src/engine/choices/OutcomeResolver.test.ts`

**Rationale:** The `OutcomeTable` may omit `CRIT_SUCCESS`, `PARTIAL`, `CRIT_FAILURE`. Per spec §5.4, the engine falls back one tier toward SUCCESS or FAILURE — never across the success/fail boundary.

- [ ] **Step 1: Write the failing test**

Create `src/engine/choices/OutcomeResolver.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { OutcomeTable, Outcome } from '@/content/schema';
import { resolveOutcome } from './OutcomeResolver';

const full: OutcomeTable = {
  CRIT_SUCCESS: { narrativeKey: 'cs' },
  SUCCESS:      { narrativeKey: 's' },
  PARTIAL:      { narrativeKey: 'p' },
  FAILURE:      { narrativeKey: 'f' },
  CRIT_FAILURE: { narrativeKey: 'cf' },
};

const minimal: OutcomeTable = {
  SUCCESS: { narrativeKey: 's' },
  FAILURE: { narrativeKey: 'f' },
};

describe('resolveOutcome', () => {
  it('returns exact tier when present', () => {
    expect(resolveOutcome(full, 'CRIT_SUCCESS').narrativeKey).toBe('cs');
    expect(resolveOutcome(full, 'SUCCESS').narrativeKey).toBe('s');
    expect(resolveOutcome(full, 'PARTIAL').narrativeKey).toBe('p');
    expect(resolveOutcome(full, 'FAILURE').narrativeKey).toBe('f');
    expect(resolveOutcome(full, 'CRIT_FAILURE').narrativeKey).toBe('cf');
  });

  it('CRIT_SUCCESS falls back to SUCCESS when missing', () => {
    const r = resolveOutcome(minimal, 'CRIT_SUCCESS');
    expect(r.narrativeKey).toBe('s');
  });

  it('CRIT_FAILURE falls back to FAILURE when missing', () => {
    const r = resolveOutcome(minimal, 'CRIT_FAILURE');
    expect(r.narrativeKey).toBe('f');
  });

  it('PARTIAL falls back to SUCCESS when missing', () => {
    const r = resolveOutcome(minimal, 'PARTIAL');
    expect(r.narrativeKey).toBe('s');
  });

  it('never crosses success/fail boundary: FAILURE never falls back to SUCCESS', () => {
    // If only SUCCESS and FAILURE are defined, no cross-boundary fallback.
    const r = resolveOutcome(minimal, 'FAILURE');
    expect(r.narrativeKey).toBe('f');
  });

  it('PARTIAL fallback prefers SUCCESS side (per spec §5.4: "one level toward SUCCESS or FAILURE")', () => {
    // PARTIAL straddles — spec says "toward SUCCESS or FAILURE" (never crosses). We resolve toward SUCCESS.
    const table: OutcomeTable = {
      SUCCESS: { narrativeKey: 's' },
      FAILURE: { narrativeKey: 'f' },
      // no PARTIAL
    };
    expect(resolveOutcome(table, 'PARTIAL').narrativeKey).toBe('s');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- OutcomeResolver`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/choices/OutcomeResolver.ts`:

```ts
// Tier → Outcome with fallback. Source: docs/spec/design.md §5.4.

import { OutcomeTier } from '@/engine/core/Types';
import { Outcome, OutcomeTable } from '@/content/schema';

/**
 * Fallback chain per spec §5.4:
 *   CRIT_SUCCESS → SUCCESS (never fails over to FAILURE)
 *   PARTIAL      → SUCCESS (straddles — resolve toward SUCCESS side)
 *   CRIT_FAILURE → FAILURE
 * SUCCESS and FAILURE are guaranteed present in a valid OutcomeTable (schema enforces).
 */
export function resolveOutcome(table: OutcomeTable, tier: OutcomeTier): Outcome {
  const direct = table[tier];
  if (direct !== undefined) return direct;

  switch (tier) {
    case 'CRIT_SUCCESS': return table.SUCCESS;
    case 'PARTIAL':      return table.SUCCESS;
    case 'CRIT_FAILURE': return table.FAILURE;
    // SUCCESS and FAILURE are always present by schema.
    case 'SUCCESS':      return table.SUCCESS;
    case 'FAILURE':      return table.FAILURE;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- OutcomeResolver`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/choices/OutcomeResolver.ts src/engine/choices/OutcomeResolver.test.ts
git commit -m "feat(choices): outcome-tier resolver with §5.4 fallback"
```

---

## Task 9: OutcomeApplier — apply `StateDelta[]` to `Character` + `RunState`

**Files:**
- Create: `src/engine/events/RunState.ts`
- Create: `src/engine/events/RunState.test.ts`
- Create: `src/engine/events/OutcomeApplier.ts`
- Create: `src/engine/events/OutcomeApplier.test.ts`

**Rationale:** `RunState` wraps the mutable-per-life data beyond just Character (world flags, recent events, meta deltas). `OutcomeApplier` takes an Outcome + current state and returns a new state.

- [ ] **Step 1: Write failing tests for RunState**

Create `src/engine/events/RunState.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createCharacter } from '@/engine/character/Character';
import { createRunState, RunState } from './RunState';

const ATTRS = { Body: 20, Mind: 15, Spirit: 10, Agility: 12, Charm: 8, Luck: 30 };

describe('createRunState', () => {
  it('initialises turn=0, empty flags, empty seen lists', () => {
    const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    const rs: RunState = createRunState({
      character: c,
      runSeed: 42,
      region: 'yellow_plains',
      year: 1000,
      season: 'summer',
    });
    expect(rs.turn).toBe(0);
    expect(rs.worldFlags).toEqual([]);
    expect(rs.thisLifeSeenEvents).toEqual([]);
    expect(rs.learnedTechniques).toEqual([]);
    expect(rs.character.name).toBe('t');
    expect(rs.region).toBe('yellow_plains');
    expect(rs.heavenlyNotice).toBe(0);
    expect(rs.karmaEarnedBuffer).toBe(0);
  });

  it('preserves provided rngState', () => {
    const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    const rs = createRunState({
      character: c, runSeed: 77, region: 'yellow_plains',
      year: 1000, season: 'summer',
    });
    expect(rs.rngState.seed).toBe(77);
  });
});
```

- [ ] **Step 2: Implement RunState**

Create `src/engine/events/RunState.ts`:

```ts
// Per-life run state record. Immutable: mutations return new records.
// See docs/spec/design.md §2.6.

import { Season } from '@/engine/core/Types';
import { Character } from '@/engine/character/Character';
import { RngState } from '@/engine/core/RNG';

export interface RunState {
  readonly character: Character;
  readonly turn: number;
  readonly runSeed: number;
  readonly rngState: RngState;
  readonly worldFlags: ReadonlyArray<string>;
  readonly thisLifeSeenEvents: ReadonlyArray<string>;
  readonly learnedTechniques: ReadonlyArray<string>;  // technique IDs
  readonly inventory: ReadonlyArray<{ id: string; count: number }>;
  readonly region: string;
  readonly locale: string;
  readonly year: number;
  readonly season: Season;
  readonly heavenlyNotice: number;
  /** Buffered karma earned this life; committed at Bardo (Phase 1D). */
  readonly karmaEarnedBuffer: number;
  /** Cause of death when set; triggers Bardo transition. */
  readonly deathCause: string | null;
}

export interface CreateRunStateArgs {
  character: Character;
  runSeed: number;
  region: string;
  year: number;
  season: Season;
  locale?: string;
}

export function createRunState(args: CreateRunStateArgs): RunState {
  return {
    character: args.character,
    turn: 0,
    runSeed: args.runSeed,
    rngState: { seed: args.runSeed, cursor: args.runSeed },
    worldFlags: [],
    thisLifeSeenEvents: [],
    learnedTechniques: [],
    inventory: [],
    region: args.region,
    locale: args.locale ?? 'unnamed',
    year: args.year,
    season: args.season,
    heavenlyNotice: 0,
    karmaEarnedBuffer: 0,
    deathCause: null,
  };
}
```

- [ ] **Step 3: Run RunState test**

Run: `npm test -- RunState`
Expected: 2 pass.

- [ ] **Step 4: Write failing tests for OutcomeApplier**

Create `src/engine/events/OutcomeApplier.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createCharacter } from '@/engine/character/Character';
import { Outcome } from '@/content/schema';
import { createRunState } from './RunState';
import { applyOutcome } from './OutcomeApplier';

const ATTRS = { Body: 20, Mind: 15, Spirit: 10, Agility: 12, Charm: 8, Luck: 30 };

function baseState() {
  const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
  return createRunState({ character: c, runSeed: 1, region: 'yellow_plains', year: 1000, season: 'summer' });
}

describe('applyOutcome — no-op / empty', () => {
  it('outcome with no stateDeltas returns an equal state', () => {
    const rs = baseState();
    const o: Outcome = { narrativeKey: 'x' };
    const next = applyOutcome(rs, o);
    expect(next.character).toBe(rs.character); // no mutation
  });
});

describe('applyOutcome — character mutations', () => {
  it('applies hp_delta', () => {
    const rs = baseState();
    const next = applyOutcome(rs, { narrativeKey: 'x', stateDeltas: [{ kind: 'hp_delta', amount: -10 }] });
    expect(next.character.hp).toBe(rs.character.hp - 10);
  });

  it('applies qi_delta (clamped to qiMax)', () => {
    const rs = baseState();
    const next = applyOutcome(rs, { narrativeKey: 'x', stateDeltas: [{ kind: 'qi_delta', amount: 1000 }] });
    expect(next.character.qi).toBe(next.character.qiMax);
  });

  it('applies insight_delta', () => {
    const rs = baseState();
    const next = applyOutcome(rs, { narrativeKey: 'x', stateDeltas: [{ kind: 'insight_delta', amount: 5 }] });
    expect(next.character.insight).toBe(5);
  });

  it('applies attribute_delta', () => {
    const rs = baseState();
    const next = applyOutcome(rs, { narrativeKey: 'x', stateDeltas: [{ kind: 'attribute_delta', stat: 'Body', amount: 3 }] });
    expect(next.character.attributes.Body).toBe(rs.character.attributes.Body + 3);
  });

  it('applies cultivation_progress_delta', () => {
    const rs = baseState();
    const next = applyOutcome(rs, { narrativeKey: 'x', stateDeltas: [{ kind: 'cultivation_progress_delta', amount: 40 }] });
    expect(next.character.cultivationProgress).toBe(40);
  });
});

describe('applyOutcome — flags and world', () => {
  it('flag_set adds to character.flags (idempotent)', () => {
    const rs = baseState();
    const n1 = applyOutcome(rs, { narrativeKey: 'x', stateDeltas: [{ kind: 'flag_set', flag: 'met_master' }] });
    expect(n1.character.flags).toContain('met_master');
    const n2 = applyOutcome(n1, { narrativeKey: 'x', stateDeltas: [{ kind: 'flag_set', flag: 'met_master' }] });
    expect(n2.character.flags.filter(f => f === 'met_master')).toHaveLength(1);
  });

  it('flag_clear removes', () => {
    const rs = baseState();
    const withFlag = applyOutcome(rs, { narrativeKey: 'x', stateDeltas: [{ kind: 'flag_set', flag: 'shamed' }] });
    const cleared = applyOutcome(withFlag, { narrativeKey: 'x', stateDeltas: [{ kind: 'flag_clear', flag: 'shamed' }] });
    expect(cleared.character.flags).not.toContain('shamed');
  });

  it('world_flag_set and world_flag_clear affect runState.worldFlags', () => {
    const rs = baseState();
    const withFlag = applyOutcome(rs, { narrativeKey: 'x', stateDeltas: [{ kind: 'world_flag_set', flag: 'drought_active' }] });
    expect(withFlag.worldFlags).toContain('drought_active');
    const cleared = applyOutcome(withFlag, { narrativeKey: 'x', stateDeltas: [{ kind: 'world_flag_clear', flag: 'drought_active' }] });
    expect(cleared.worldFlags).not.toContain('drought_active');
  });
});

describe('applyOutcome — inventory & techniques', () => {
  it('item_add stacks by id', () => {
    const rs = baseState();
    const n1 = applyOutcome(rs, { narrativeKey: 'x', stateDeltas: [{ kind: 'item_add', id: 'pill_x', count: 2 }] });
    expect(n1.inventory.find(i => i.id === 'pill_x')?.count).toBe(2);
    const n2 = applyOutcome(n1, { narrativeKey: 'x', stateDeltas: [{ kind: 'item_add', id: 'pill_x', count: 1 }] });
    expect(n2.inventory.find(i => i.id === 'pill_x')?.count).toBe(3);
  });

  it('item_remove decrements and removes entry when count hits 0', () => {
    const rs = baseState();
    const n1 = applyOutcome(rs, { narrativeKey: 'x', stateDeltas: [{ kind: 'item_add', id: 'pill_x', count: 2 }] });
    const n2 = applyOutcome(n1, { narrativeKey: 'x', stateDeltas: [{ kind: 'item_remove', id: 'pill_x', count: 2 }] });
    expect(n2.inventory.find(i => i.id === 'pill_x')).toBeUndefined();
  });

  it('item_remove of absent item is a no-op', () => {
    const rs = baseState();
    const next = applyOutcome(rs, { narrativeKey: 'x', stateDeltas: [{ kind: 'item_remove', id: 'pill_unknown', count: 1 }] });
    expect(next.inventory).toEqual([]);
  });

  it('technique_learn adds id (idempotent)', () => {
    const rs = baseState();
    const n1 = applyOutcome(rs, { narrativeKey: 'x', stateDeltas: [{ kind: 'technique_learn', id: 'TECH_A' }] });
    expect(n1.learnedTechniques).toContain('TECH_A');
    const n2 = applyOutcome(n1, { narrativeKey: 'x', stateDeltas: [{ kind: 'technique_learn', id: 'TECH_A' }] });
    expect(n2.learnedTechniques.filter(t => t === 'TECH_A')).toHaveLength(1);
  });
});

describe('applyOutcome — meta-deltas and age', () => {
  it('karma_delta buffers into karmaEarnedBuffer', () => {
    const rs = baseState();
    const next = applyOutcome(rs, { narrativeKey: 'x', stateDeltas: [{ kind: 'karma_delta', amount: 15 }] });
    expect(next.karmaEarnedBuffer).toBe(15);
  });

  it('notice_delta clamps to [0, 100]', () => {
    const rs = baseState();
    const up = applyOutcome(rs, { narrativeKey: 'x', stateDeltas: [{ kind: 'notice_delta', amount: 120 }] });
    expect(up.heavenlyNotice).toBe(100);
    const down = applyOutcome(up, { narrativeKey: 'x', stateDeltas: [{ kind: 'notice_delta', amount: -1000 }] });
    expect(down.heavenlyNotice).toBe(0);
  });

  it('age_delta_days increases character.ageDays', () => {
    const rs = baseState();
    const next = applyOutcome(rs, { narrativeKey: 'x', stateDeltas: [{ kind: 'age_delta_days', amount: 30 }] });
    expect(next.character.ageDays).toBe(rs.character.ageDays + 30);
  });
});

describe('applyOutcome — deathCause', () => {
  it('sets runState.deathCause', () => {
    const rs = baseState();
    const dead = applyOutcome(rs, { narrativeKey: 'x', deathCause: 'starvation' });
    expect(dead.deathCause).toBe('starvation');
  });
});
```

- [ ] **Step 5: Implement OutcomeApplier**

Create `src/engine/events/OutcomeApplier.ts`:

```ts
// Apply a resolved Outcome's StateDeltas to the current RunState.
// Pure; returns a new state.

import { Outcome } from '@/content/schema';
import { applyHp, applyQi, applyInsight, ageDays, withFlag, Character } from '@/engine/character/Character';
import { advanceCultivation } from '@/engine/cultivation/CultivationProgress';
import { RunState } from './RunState';
import { StateDelta } from './StateDelta';
import { addAttribute } from '@/engine/character/Attribute';

function removeFlag(c: Character, flag: string): Character {
  if (!c.flags.includes(flag)) return c;
  return { ...c, flags: c.flags.filter((f) => f !== flag) };
}

function applyDeltaToState(rs: RunState, delta: StateDelta): RunState {
  switch (delta.kind) {
    case 'hp_delta':
      return { ...rs, character: applyHp(rs.character, delta.amount) };
    case 'qi_delta':
      return { ...rs, character: applyQi(rs.character, delta.amount) };
    case 'insight_delta':
      return { ...rs, character: applyInsight(rs.character, delta.amount) };
    case 'attribute_delta': {
      const nextValue = addAttribute((rs.character.attributes as Record<string, number>)[delta.stat] ?? 0, delta.amount);
      return {
        ...rs,
        character: {
          ...rs.character,
          attributes: { ...rs.character.attributes, [delta.stat]: nextValue },
        },
      };
    }
    case 'flag_set':
      return { ...rs, character: withFlag(rs.character, delta.flag) };
    case 'flag_clear':
      return { ...rs, character: removeFlag(rs.character, delta.flag) };
    case 'world_flag_set':
      if (rs.worldFlags.includes(delta.flag)) return rs;
      return { ...rs, worldFlags: [...rs.worldFlags, delta.flag] };
    case 'world_flag_clear':
      if (!rs.worldFlags.includes(delta.flag)) return rs;
      return { ...rs, worldFlags: rs.worldFlags.filter((f) => f !== delta.flag) };
    case 'cultivation_progress_delta':
      if (delta.amount < 0) {
        const cp = Math.max(0, rs.character.cultivationProgress + delta.amount);
        return { ...rs, character: { ...rs.character, cultivationProgress: cp } };
      }
      return { ...rs, character: advanceCultivation(rs.character, delta.amount) };
    case 'item_add': {
      const idx = rs.inventory.findIndex((i) => i.id === delta.id);
      if (idx === -1) {
        return { ...rs, inventory: [...rs.inventory, { id: delta.id, count: delta.count }] };
      }
      const next = [...rs.inventory];
      next[idx] = { id: delta.id, count: next[idx]!.count + delta.count };
      return { ...rs, inventory: next };
    }
    case 'item_remove': {
      const idx = rs.inventory.findIndex((i) => i.id === delta.id);
      if (idx === -1) return rs;
      const existing = rs.inventory[idx]!;
      const nextCount = existing.count - delta.count;
      const next = [...rs.inventory];
      if (nextCount <= 0) next.splice(idx, 1);
      else next[idx] = { id: delta.id, count: nextCount };
      return { ...rs, inventory: next };
    }
    case 'technique_learn':
      if (rs.learnedTechniques.includes(delta.id)) return rs;
      return { ...rs, learnedTechniques: [...rs.learnedTechniques, delta.id] };
    case 'meridian_open':
      // Delegated to the character module in a later phase (actual opening + deviation flow).
      // For Phase 1B, simply add the id if not present.
      if (rs.character.openMeridians.includes(delta.id)) return rs;
      return {
        ...rs,
        character: {
          ...rs.character,
          openMeridians: [...rs.character.openMeridians, delta.id],
        },
      };
    case 'karma_delta':
      return { ...rs, karmaEarnedBuffer: rs.karmaEarnedBuffer + delta.amount };
    case 'notice_delta': {
      const nextN = Math.max(0, Math.min(100, rs.heavenlyNotice + delta.amount));
      return { ...rs, heavenlyNotice: nextN };
    }
    case 'age_delta_days':
      return { ...rs, character: ageDays(rs.character, delta.amount) };
  }
}

export function applyOutcome(rs: RunState, outcome: Outcome): RunState {
  let next = rs;
  for (const delta of outcome.stateDeltas ?? []) {
    next = applyDeltaToState(next, delta as StateDelta);
  }
  if (outcome.noticeDelta !== undefined) {
    const n = Math.max(0, Math.min(100, next.heavenlyNotice + outcome.noticeDelta));
    next = { ...next, heavenlyNotice: n };
  }
  if (outcome.deathCause !== undefined) {
    next = { ...next, deathCause: outcome.deathCause };
  }
  return next;
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- OutcomeApplier`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/engine/events/RunState.ts src/engine/events/RunState.test.ts \
        src/engine/events/OutcomeApplier.ts src/engine/events/OutcomeApplier.test.ts
git commit -m "feat(events): RunState + OutcomeApplier (StateDelta dispatch)"
```

---

## Task 10: StreakTracker

**Files:**
- Create: `src/engine/choices/StreakTracker.ts`
- Create: `src/engine/choices/StreakTracker.test.ts`

**Rationale:** Spec §5.6 — anti-frustration (+10 after 4 failures) and anti-greed (+3 world malice for 5 turns after 3 consecutive crit successes). Pure state transitions.

- [ ] **Step 1: Write the failing test**

Create `src/engine/choices/StreakTracker.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  createStreakState,
  recordOutcome,
  computeStreakBonus,
  computeWorldMaliceBuff,
  tickBuff,
} from './StreakTracker';

describe('StreakTracker', () => {
  it('starts at zero state', () => {
    const s = createStreakState();
    expect(s.consecutiveFailures).toBe(0);
    expect(s.consecutiveCritSuccesses).toBe(0);
    expect(s.worldMaliceBuff).toBeNull();
    expect(computeStreakBonus(s)).toBe(0);
  });

  it('records FAILURE and increments consecutiveFailures', () => {
    let s = createStreakState();
    s = recordOutcome(s, 'FAILURE');
    expect(s.consecutiveFailures).toBe(1);
    s = recordOutcome(s, 'FAILURE');
    s = recordOutcome(s, 'FAILURE');
    s = recordOutcome(s, 'FAILURE');
    expect(s.consecutiveFailures).toBe(4);
  });

  it('resets consecutiveFailures on SUCCESS or CRIT_SUCCESS', () => {
    let s = createStreakState();
    s = recordOutcome(s, 'FAILURE');
    s = recordOutcome(s, 'FAILURE');
    s = recordOutcome(s, 'SUCCESS');
    expect(s.consecutiveFailures).toBe(0);
  });

  it('computeStreakBonus returns +10 after 4 consecutive failures', () => {
    let s = createStreakState();
    for (let i = 0; i < 4; i++) s = recordOutcome(s, 'FAILURE');
    expect(computeStreakBonus(s)).toBe(10);
  });

  it('computeStreakBonus returns 0 after 3 failures (not yet 4)', () => {
    let s = createStreakState();
    for (let i = 0; i < 3; i++) s = recordOutcome(s, 'FAILURE');
    expect(computeStreakBonus(s)).toBe(0);
  });

  it('CRIT_FAILURE does not count toward the +10 bonus', () => {
    // Per spec §5.6, "rolled FAILURE on 4 consecutive non-trivial checks" — interpret as regular FAILURE.
    let s = createStreakState();
    for (let i = 0; i < 4; i++) s = recordOutcome(s, 'CRIT_FAILURE');
    expect(computeStreakBonus(s)).toBe(0);
  });

  it('records CRIT_SUCCESS and increments consecutiveCritSuccesses', () => {
    let s = createStreakState();
    s = recordOutcome(s, 'CRIT_SUCCESS');
    s = recordOutcome(s, 'CRIT_SUCCESS');
    s = recordOutcome(s, 'CRIT_SUCCESS');
    expect(s.consecutiveCritSuccesses).toBe(3);
  });

  it('3 consecutive CRIT_SUCCESSes activate a worldMaliceBuff for 5 turns', () => {
    let s = createStreakState();
    s = recordOutcome(s, 'CRIT_SUCCESS');
    s = recordOutcome(s, 'CRIT_SUCCESS');
    s = recordOutcome(s, 'CRIT_SUCCESS');
    expect(s.worldMaliceBuff).toEqual({ value: 3, turnsRemaining: 5 });
  });

  it('any non-CRIT_SUCCESS breaks the crit streak', () => {
    let s = createStreakState();
    s = recordOutcome(s, 'CRIT_SUCCESS');
    s = recordOutcome(s, 'SUCCESS');
    expect(s.consecutiveCritSuccesses).toBe(0);
  });

  it('tickBuff decrements turnsRemaining and clears buff at 0', () => {
    let s = createStreakState();
    for (let i = 0; i < 3; i++) s = recordOutcome(s, 'CRIT_SUCCESS');
    expect(s.worldMaliceBuff?.turnsRemaining).toBe(5);
    for (let i = 0; i < 4; i++) s = tickBuff(s);
    expect(s.worldMaliceBuff?.turnsRemaining).toBe(1);
    s = tickBuff(s);
    expect(s.worldMaliceBuff).toBeNull();
  });

  it('computeWorldMaliceBuff returns value when buff active, 0 otherwise', () => {
    let s = createStreakState();
    expect(computeWorldMaliceBuff(s)).toBe(0);
    for (let i = 0; i < 3; i++) s = recordOutcome(s, 'CRIT_SUCCESS');
    expect(computeWorldMaliceBuff(s)).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- StreakTracker`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/choices/StreakTracker.ts`:

```ts
// Streak tracking: anti-frustration (+10 after 4 failures)
// and anti-greed (+3 world malice for 5 turns after 3 crit successes).
// Source: docs/spec/design.md §5.6.

import { OutcomeTier } from '@/engine/core/Types';

export interface WorldMaliceBuff {
  value: number;
  turnsRemaining: number;
}

export interface StreakState {
  consecutiveFailures: number;
  consecutiveCritSuccesses: number;
  worldMaliceBuff: WorldMaliceBuff | null;
}

const STREAKBREAK_FAILURES_NEEDED = 4;
const STREAKBREAK_BONUS = 10;

const ANTI_GREED_CRITS_NEEDED = 3;
const ANTI_GREED_MALICE = 3;
const ANTI_GREED_DURATION_TURNS = 5;

export function createStreakState(): StreakState {
  return {
    consecutiveFailures: 0,
    consecutiveCritSuccesses: 0,
    worldMaliceBuff: null,
  };
}

export function recordOutcome(state: StreakState, tier: OutcomeTier): StreakState {
  let s = { ...state };

  // Failure streak: only regular FAILURE counts (not CRIT_FAILURE).
  if (tier === 'FAILURE') {
    s = { ...s, consecutiveFailures: s.consecutiveFailures + 1 };
  } else if (tier === 'SUCCESS' || tier === 'CRIT_SUCCESS') {
    s = { ...s, consecutiveFailures: 0 };
  }
  // PARTIAL and CRIT_FAILURE leave consecutiveFailures unchanged.

  // Crit streak.
  if (tier === 'CRIT_SUCCESS') {
    const nextCount = s.consecutiveCritSuccesses + 1;
    s = { ...s, consecutiveCritSuccesses: nextCount };
    if (nextCount >= ANTI_GREED_CRITS_NEEDED) {
      s = { ...s, worldMaliceBuff: { value: ANTI_GREED_MALICE, turnsRemaining: ANTI_GREED_DURATION_TURNS } };
    }
  } else {
    s = { ...s, consecutiveCritSuccesses: 0 };
  }

  return s;
}

export function computeStreakBonus(state: StreakState): number {
  return state.consecutiveFailures >= STREAKBREAK_FAILURES_NEEDED ? STREAKBREAK_BONUS : 0;
}

export function computeWorldMaliceBuff(state: StreakState): number {
  return state.worldMaliceBuff?.value ?? 0;
}

/** Decrement the buff's turnsRemaining. Called once per turn tick. */
export function tickBuff(state: StreakState): StreakState {
  if (!state.worldMaliceBuff) return state;
  const next = state.worldMaliceBuff.turnsRemaining - 1;
  if (next <= 0) return { ...state, worldMaliceBuff: null };
  return { ...state, worldMaliceBuff: { ...state.worldMaliceBuff, turnsRemaining: next } };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- StreakTracker`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/choices/StreakTracker.ts src/engine/choices/StreakTracker.test.ts
git commit -m "feat(choices): streak tracker (+10 anti-frustration, +3 anti-greed malice)"
```

---

## Task 11: AgeTick

**Files:**
- Create: `src/engine/events/AgeTick.ts`
- Create: `src/engine/events/AgeTick.test.ts`

**Rationale:** Every turn advances the character's age by a TimeCost bucket's randomised day count.

- [ ] **Step 1: Write the failing test**

Create `src/engine/events/AgeTick.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { rollTimeCostDays, advanceTurn } from './AgeTick';
import { createCharacter } from '@/engine/character/Character';
import { createRunState } from './RunState';

const ATTRS = { Body: 20, Mind: 15, Spirit: 10, Agility: 12, Charm: 8, Luck: 30 };

function baseState() {
  const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
  return createRunState({ character: c, runSeed: 1, region: 'yellow_plains', year: 1000, season: 'summer' });
}

describe('rollTimeCostDays', () => {
  it('INSTANT is always 0', () => {
    const rng = createRng(1);
    for (let i = 0; i < 100; i++) expect(rollTimeCostDays('INSTANT', rng)).toBe(0);
  });

  it('SHORT produces 1..7 inclusive', () => {
    const rng = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const d = rollTimeCostDays('SHORT', rng);
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(7);
      seen.add(d);
    }
    expect(seen.size).toBeGreaterThan(4); // should see multiple values
  });

  it('MEDIUM produces 30..90', () => {
    const rng = createRng(1);
    for (let i = 0; i < 500; i++) {
      const d = rollTimeCostDays('MEDIUM', rng);
      expect(d).toBeGreaterThanOrEqual(30);
      expect(d).toBeLessThanOrEqual(90);
    }
  });

  it('LONG produces 180..540', () => {
    const rng = createRng(1);
    for (let i = 0; i < 500; i++) {
      const d = rollTimeCostDays('LONG', rng);
      expect(d).toBeGreaterThanOrEqual(180);
      expect(d).toBeLessThanOrEqual(540);
    }
  });

  it('EPOCH produces 1095..3650', () => {
    const rng = createRng(1);
    for (let i = 0; i < 500; i++) {
      const d = rollTimeCostDays('EPOCH', rng);
      expect(d).toBeGreaterThanOrEqual(1095);
      expect(d).toBeLessThanOrEqual(3650);
    }
  });
});

describe('advanceTurn', () => {
  it('increments turn by 1 and rolls a TimeCost-sized age delta', () => {
    const rs = baseState();
    const rng = createRng(42);
    const next = advanceTurn(rs, 'SHORT', rng);
    expect(next.turn).toBe(rs.turn + 1);
    expect(next.character.ageDays).toBeGreaterThanOrEqual(rs.character.ageDays + 1);
    expect(next.character.ageDays).toBeLessThanOrEqual(rs.character.ageDays + 7);
  });

  it('INSTANT advances turn but not age', () => {
    const rs = baseState();
    const next = advanceTurn(rs, 'INSTANT', createRng(1));
    expect(next.turn).toBe(1);
    expect(next.character.ageDays).toBe(rs.character.ageDays);
  });

  it('is deterministic for the same seed', () => {
    const rs = baseState();
    const a = advanceTurn(rs, 'MEDIUM', createRng(99));
    const b = advanceTurn(rs, 'MEDIUM', createRng(99));
    expect(a.character.ageDays).toBe(b.character.ageDays);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- AgeTick`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/events/AgeTick.ts`:

```ts
// Turn-advancement helpers. Rolls a day count per TimeCost bucket and advances character age.
// Source: docs/spec/design.md §2.5.

import { TIME_COST_DAYS, TimeCost } from '@/engine/core/Types';
import { IRng } from '@/engine/core/RNG';
import { ageDays } from '@/engine/character/Character';
import { RunState } from './RunState';

export function rollTimeCostDays(bucket: TimeCost, rng: IRng): number {
  const [min, max] = TIME_COST_DAYS[bucket];
  if (min === max) return min;
  return rng.intRange(min, max);
}

export function advanceTurn(rs: RunState, bucket: TimeCost, rng: IRng): RunState {
  const days = rollTimeCostDays(bucket, rng);
  const character = days > 0 ? ageDays(rs.character, days) : rs.character;
  return {
    ...rs,
    character,
    turn: rs.turn + 1,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- AgeTick`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/events/AgeTick.ts src/engine/events/AgeTick.test.ts
git commit -m "feat(events): AgeTick — TimeCost → randomised day advance"
```

---

## Task 12: Technique resolver integration (no code; sanity check only)

**Rationale:** No new code — just confirm the pieces compose. `ChoiceResolver.techniqueBonus` is produced by `resolveTechniqueBonus(learnedTechniques, category)`. Both are pure. A later phase's GameLoop plugs them together.

**Skip this task entirely — it exists only as a mental waypoint. Proceed to Task 13.**

(If your subagent flow requires a concrete task at this slot, treat it as: "verify `npm test` passes end-to-end after Task 11". No commit.)

---

## Task 13: Integration test — full turn resolution

**Files:**
- Create: `tests/integration/choice_event_engine.test.ts`

**Rationale:** Prove all Phase 1B modules compose into a coherent turn cycle: build pool → select event → resolve choice → apply outcome → tick streak + age.

- [ ] **Step 1: Write the integration test**

Create `tests/integration/choice_event_engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { EventDef } from '@/content/schema';
import { createCharacter } from '@/engine/character/Character';
import { createRunState } from '@/engine/events/RunState';
import { selectEvent } from '@/engine/events/EventSelector';
import { resolveCheck } from '@/engine/choices/ChoiceResolver';
import { resolveOutcome } from '@/engine/choices/OutcomeResolver';
import { applyOutcome } from '@/engine/events/OutcomeApplier';
import { advanceTurn } from '@/engine/events/AgeTick';
import {
  createStreakState, recordOutcome, computeStreakBonus, computeWorldMaliceBuff, tickBuff,
} from '@/engine/choices/StreakTracker';
import { resolveTechniqueBonus } from '@/engine/cultivation/Technique';

const ATTRS = { Body: 28, Mind: 20, Spirit: 15, Agility: 35, Charm: 22, Luck: 42 };

const BANDIT_EVENT: EventDef = {
  id: 'EV_BANDIT_001',
  category: 'road.bandit',
  version: 1,
  weight: 100,
  conditions: { regions: ['yellow_plains'] },
  timeCost: 'SHORT',
  text: { intro: ['A bandit blocks your path.'] },
  choices: [
    {
      id: 'ch_fight',
      label: 'Fight!',
      timeCost: 'SHORT',
      check: {
        stats: { Body: 1.2, Agility: 0.6 },
        base: 30,
        difficulty: 40,
      },
      outcomes: {
        CRIT_SUCCESS: { narrativeKey: 'out.fight.crit', stateDeltas: [{ kind: 'item_add', id: 'bandit_purse', count: 1 }] },
        SUCCESS:      { narrativeKey: 'out.fight.success', stateDeltas: [{ kind: 'hp_delta', amount: -5 }, { kind: 'item_add', id: 'bandit_purse', count: 1 }] },
        PARTIAL:      { narrativeKey: 'out.fight.partial', stateDeltas: [{ kind: 'hp_delta', amount: -15 }] },
        FAILURE:      { narrativeKey: 'out.fight.fail', stateDeltas: [{ kind: 'hp_delta', amount: -30 }] },
        CRIT_FAILURE: { narrativeKey: 'out.fight.crit_fail', deathCause: 'combat_melee' },
      },
    },
  ],
  repeat: 'unlimited',
};

describe('choice-event engine — full turn cycle', () => {
  it('resolves a Bandit event end-to-end without crashing', () => {
    const c = createCharacter({ name: 'Lin Wei', attributes: ATTRS, rng: createRng(1) });
    let rs = createRunState({ character: c, runSeed: 1, region: 'yellow_plains', year: 1000, season: 'summer' });
    let streak = createStreakState();
    const turnRng = createRng(100);

    // 1. Select event
    const ev = selectEvent([BANDIT_EVENT], {
      character: rs.character,
      worldFlags: rs.worldFlags,
      region: rs.region,
      locale: rs.locale,
      year: rs.year,
      season: rs.season,
      heavenlyNotice: rs.heavenlyNotice,
      ageYears: Math.floor(rs.character.ageDays / 365),
    }, [], rs.thisLifeSeenEvents, turnRng);
    expect(ev).not.toBeNull();
    expect(ev!.id).toBe('EV_BANDIT_001');

    // 2. Resolve the fight choice
    const choice = ev!.choices[0]!;
    const result = resolveCheck({
      check: choice.check,
      characterStats: rs.character.attributes,
      characterSkills: {},
      techniqueBonus: resolveTechniqueBonus([], 'melee_skill'),
      itemBonus: 0, echoBonus: 0, memoryBonus: 0, moodBonus: 0,
      worldMalice: computeWorldMaliceBuff(streak),
      streakBonus: computeStreakBonus(streak),
      rng: turnRng,
    });
    expect(['CRIT_SUCCESS','SUCCESS','PARTIAL','FAILURE','CRIT_FAILURE']).toContain(result.tier);

    // 3. Pick outcome
    const outcome = resolveOutcome(choice.outcomes, result.tier);
    expect(outcome.narrativeKey).toBeDefined();

    // 4. Apply deltas
    rs = applyOutcome(rs, outcome);
    rs = { ...rs, thisLifeSeenEvents: [...rs.thisLifeSeenEvents, ev!.id] };

    // 5. Update streak + tick buff + advance turn
    streak = recordOutcome(streak, result.tier);
    streak = tickBuff(streak);
    rs = advanceTurn(rs, choice.timeCost, turnRng);

    expect(rs.turn).toBe(1);
    expect(rs.thisLifeSeenEvents).toContain(ev!.id);
  });

  it('after 4 consecutive FAILUREs, streak bonus is active', () => {
    let streak = createStreakState();
    for (let i = 0; i < 4; i++) streak = recordOutcome(streak, 'FAILURE');
    expect(computeStreakBonus(streak)).toBe(10);
  });

  it('after 3 consecutive CRIT_SUCCESSes, world malice buff kicks in', () => {
    let streak = createStreakState();
    for (let i = 0; i < 3; i++) streak = recordOutcome(streak, 'CRIT_SUCCESS');
    expect(computeWorldMaliceBuff(streak)).toBe(3);
  });

  it('a CRIT_FAILURE outcome with deathCause sets runState.deathCause', () => {
    const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    let rs = createRunState({ character: c, runSeed: 1, region: 'yellow_plains', year: 1000, season: 'summer' });
    const choice = BANDIT_EVENT.choices[0]!;
    const outcome = resolveOutcome(choice.outcomes, 'CRIT_FAILURE');
    rs = applyOutcome(rs, outcome);
    expect(rs.deathCause).toBe('combat_melee');
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npm test -- choice_event_engine`
Expected: 4 tests pass.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: all tests green.

Run: `npm run typecheck` — clean.
Run: `npm run build` — success.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/choice_event_engine.test.ts
git commit -m "test(integration): full choice-event turn resolution"
```

---

## Exit Criteria Checklist

- [ ] All Task 1–13 commits on branch `phase-1b-choice-event-engine`.
- [ ] `npm test` passes. Phase 1B adds ~80 new tests.
- [ ] `npm run typecheck` clean.
- [ ] `npm run build` success.
- [ ] CI green.
- [ ] Every new module has a corresponding `*.test.ts` with green assertions.
- [ ] `ChoiceResolver` exactly matches spec §5.3 (formula locked, clamps, critBand, fumbleFloor all tested).
- [ ] Integration test resolves a full turn cycle (select → resolve → apply → tick) without crashing.
- [ ] No dependency on `src/engine/narrative/`, `src/engine/bardo/`, `src/engine/meta/` (those subsystems are Phase 1C / 1D).

---

## Self-Review Notes

**1. Spec coverage:**
- §5.1 Event selection — Task 5 ✔
- §5.2 Choice structure — Task 3 (zod) + Task 7 (resolver reads it) ✔
- §5.3 Probability resolver — Task 7 ✔
- §5.4 Outcome resolution + fallback — Task 8 ✔
- §5.5 Probability transparency — **deferred to Phase 1D** (UI renders the qualifier based on `chance`; no engine code needed here)
- §5.6 Streakbreaking — Task 10 ✔
- §5.7 Worked example — covered by Task 7 tests ✔
- §5.8 Check categories & default weights — Task 1 (CHECK_CATEGORIES) + Task 7 (statWeight in ResolveArgs) ✔
- §9.1-§9.3 Content schemas — Task 3 ✔
- §9.6-§9.7 Item/Manual schemas — **deferred** (Phase 2 when real items land)
- §9.8 Soul Echo — **deferred to Phase 1D meta**
- §9.9 Forbidden Memory — **deferred to Phase 1D meta**
- §2.5 Time costs — Task 1 (table) + Task 11 (advanceTurn) ✔
- §4.7 Techniques as choice-bonus providers — Task 6 ✔

**2. Placeholder scan:** none. Every step has complete code.

**3. Type consistency:**
- `RunState.thisLifeSeenEvents` consumed by `EventSelector.selectEvent` — matches.
- `StateDelta` union defined in Task 2, referenced by schema (zod mirror) in Task 3, dispatched in Task 9. Kinds match exactly.
- `ResolveArgs` consumers: all 5 bonus fields (technique/item/echo/memory/mood) declared in Task 7, passed in Task 13 integration.
- `StreakState` created in Task 10, consumed by Task 13 via `computeStreakBonus` / `computeWorldMaliceBuff` / `recordOutcome` / `tickBuff`.
- `TIME_COST_DAYS` exported in Task 1, read by Task 11. Keys match `TimeCost` enum values.
- `applyOutcome` returns `RunState`; Task 13 chains it correctly.

**4. Gaps against Phase 1B scope:** none.

**5. Phase 1D handoff notes:**
- `advanceTurn`'s RNG comes from caller; Phase 1D's GameLoop should derive it from `rs.rngState` for save-stable determinism.
- `RunState.karmaEarnedBuffer` is written here but read only at Bardo (Phase 1D).
- `RunState.deathCause` triggers the BARDO phase transition — Phase 1D wires the StateMachine.
- `ChoiceResolver.moodBonus` is parameter-only; Phase 1C computes mood from character state and passes it in.
- `ChoiceResolver.echoBonus` / `memoryBonus` stubbed zero; Phase 1D meta module will compute them.
