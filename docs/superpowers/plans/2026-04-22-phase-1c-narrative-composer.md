# Phase 1C — Narrative Composer MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Composer MVP — given an Event + RunState, produce readable prose. Snippet library (JSON-backed), template expander (recursive `$[...]` resolution + `[VAR]` substitution), name generator (personal/sect/place), per-life name registry, mood computation (providing the `moodBonus` that Phase 1B stubbed), and an orchestrator that stitches it all together. Mood filter (adjective rewrites) and Realm lens (perception-layer injection) are stubbed — Phase 1D will wire them fully.

**Architecture:** Pure functions. Every random decision through `IRng`. Snippet content is JSON, zod-validated. The `Composer` is a single pure function `renderEvent(event, ctx, library, registry, rng) → string`. Name Registry is an immutable record keyed by `(archetype, slotId)`; writes return a new registry. Determinism contract: same `(event, runState, seed)` → same text, byte-verbatim.

**Tech Stack:** TypeScript 5.8 strict, Vitest 4, Zod 4. Depends on Phase 0 (`RNG`, `hash`, content `schema`), Phase 1A (`Character`, `Mood` type), Phase 1B (`RunState`).

**Source of truth:** `docs/spec/design.md` §6 (Narrative Composition Engine — **read in full**), particularly §6.1–§6.4 and §6.7, §6.10.

**Scope boundaries (out of Phase 1C):**
- **Full Mood Filter (§6.4)**: adjective dictionary / rewrite pass. This task implements **mood-tag bias in snippet selection** (lyrical ↔ terse ↔ ominous) but not word-level rewrites.
- **Realm Lens (§6.5)**: injects a perception-layer sentence. Phase 1D.
- **Interior Thought beats (§6.6)**: Phase 1D.
- **Time-skip prose montages (§6.8)**: Phase 1D.
- **Bardo composition (§6.9)**: Phase 1D.
- **NPC name generation beyond personal/sect/place**: technique names, manual names, era titles — Phase 1D / Phase 2.
- **Actual content authoring** (populating snippet JSON files): Phase 1D.

---

## Task Map

1. Primitive type extensions: `SnippetTag`, mood-input types, `NameSlotId`
2. `MoodInputs` + `computeDominantMood` (provides Phase 1B's `moodBonus`)
3. `MoodBonus` table — `Mood × CheckCategory → number`
4. `SnippetLibrary` — JSON schema + runtime loader + `pickSnippet(key, tags, rng)` with tag bias
5. `TemplateExpander` — recursive `$[a.b.c]` resolution + `[VAR]` literal substitution
6. `NameGenerator` — personal (family + given), sect, place name algorithms
7. `NameRegistry` — per-life immutable cache, stable on `(archetype, slotId)` reads
8. `Composer` — orchestrator: `renderEvent(event, ctx, library, registry, rng)`
9. Determinism contract tests
10. Integration test — render a Bandit event with full composition

---

## Prerequisite Reading

- `docs/spec/design.md` §6 in full. Especially §6.2 (event template format), §6.3 (snippet library structure), §6.7 (name generation), §6.10 (determinism contract).
- `src/content/schema.ts` — Phase 1B's `EventSchema.text` shape (`{ intro?: string[], body?: string[], outro?: string[] }`). Composer reads this.
- `src/engine/core/RNG.ts` — the `IRng.derive(...parts)` method produces deterministic child RNGs.
- `src/engine/core/Types.ts` — `Mood` union already exists (`sorrow | rage | serenity | paranoia | resolve | melancholy`).

---

## Task 1: Primitive type extensions

**Files:**
- Modify: `src/engine/core/Types.ts` (append)
- Create: `src/engine/core/Phase1CTypes.test.ts`

**Rationale:** Introduce the string tables Phase 1C depends on.

- [ ] **Step 1: Write the failing test**

Create `src/engine/core/Phase1CTypes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  SNIPPET_TAGS,
  NAME_SLOT_IDS,
  SnippetTag,
  NameSlotId,
} from './Types';

describe('Phase 1C primitive tables', () => {
  it('SNIPPET_TAGS lists all tonal tags', () => {
    expect(SNIPPET_TAGS).toEqual([
      'lyrical', 'terse', 'ominous', 'serious', 'tender', 'bitter',
    ]);
  });

  it('NAME_SLOT_IDS lists the canonical slots', () => {
    expect(NAME_SLOT_IDS).toEqual([
      'character', 'master', 'mother', 'father', 'sibling', 'friend',
      'rival', 'lover', 'stranger', 'bandit', 'merchant', 'monk',
      'sect', 'place', 'emperor',
    ]);
  });

  it('the SnippetTag type contains exactly the SNIPPET_TAGS values', () => {
    const x: SnippetTag = 'lyrical'; // compiles
    // @ts-expect-error — outside the union
    const y: SnippetTag = 'invalid';
    // Runtime check: every SNIPPET_TAGS entry should be assignable to SnippetTag
    for (const t of SNIPPET_TAGS) {
      const tag: SnippetTag = t; // compiles — union check
      expect(typeof tag).toBe('string');
    }
  });

  it('NameSlotId matches its table', () => {
    const slot: NameSlotId = 'character';
    expect(typeof slot).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- Phase1CTypes`
Expected: FAIL.

- [ ] **Step 3: Append to `src/engine/core/Types.ts`**

Open `src/engine/core/Types.ts` and append at the bottom (after the Phase 1B block):

```ts
// ---- Phase 1C: Narrative composer tables ----
// Source of truth: docs/spec/design.md §6.

export type SnippetTag = 'lyrical' | 'terse' | 'ominous' | 'serious' | 'tender' | 'bitter';

export const SNIPPET_TAGS: readonly SnippetTag[] = [
  'lyrical', 'terse', 'ominous', 'serious', 'tender', 'bitter',
] as const;

/** Canonical name-registry slot IDs used by the Composer. */
export type NameSlotId =
  | 'character' | 'master' | 'mother' | 'father' | 'sibling' | 'friend'
  | 'rival' | 'lover' | 'stranger' | 'bandit' | 'merchant' | 'monk'
  | 'sect' | 'place' | 'emperor';

export const NAME_SLOT_IDS: readonly NameSlotId[] = [
  'character', 'master', 'mother', 'father', 'sibling', 'friend',
  'rival', 'lover', 'stranger', 'bandit', 'merchant', 'monk',
  'sect', 'place', 'emperor',
] as const;
```

- [ ] **Step 4: Run tests**

Run: `npm test -- Phase1CTypes`
Expected: 4 passing.

Also: `npm run typecheck` clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/core/Types.ts src/engine/core/Phase1CTypes.test.ts
git commit -m "feat(engine): Phase 1C primitive tables (snippet tags, name slot ids)"
```

---

## Task 2: Mood inputs + `computeDominantMood`

**Files:**
- Create: `src/engine/narrative/Mood.ts`
- Create: `src/engine/narrative/Mood.test.ts`

**Rationale:** The §6.4 mood-score formula. Takes a `MoodInputs` record (field counts pulled from character flags later, zero by default in Phase 1C) and returns the dominant `Mood`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/narrative/Mood.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  computeDominantMood,
  moodScores,
  zeroMoodInputs,
  MoodInputs,
} from './Mood';

describe('zeroMoodInputs', () => {
  it('returns all zeros', () => {
    const z = zeroMoodInputs();
    for (const v of Object.values(z)) expect(v).toBe(0);
  });
});

describe('moodScores', () => {
  it('empty inputs produce all-zero scores', () => {
    const s = moodScores(zeroMoodInputs());
    expect(s.sorrow).toBe(0);
    expect(s.rage).toBe(0);
    expect(s.serenity).toBe(0);
    expect(s.paranoia).toBe(0);
    expect(s.resolve).toBe(0);
    expect(s.melancholy).toBe(0);
  });

  it('spec §6.4 formula: sorrow = recentRegrets*2 + unreturnedDebts', () => {
    const s = moodScores({ ...zeroMoodInputs(), recentRegrets: 3, unreturnedDebts: 2 });
    expect(s.sorrow).toBe(8);
  });

  it('rage = recentBetrayals*3 + humiliationsThisYear', () => {
    const s = moodScores({ ...zeroMoodInputs(), recentBetrayals: 2, humiliationsThisYear: 1 });
    expect(s.rage).toBe(7);
  });

  it('serenity = recentMeditationEpochs*2 + resolvedVows', () => {
    const s = moodScores({ ...zeroMoodInputs(), recentMeditationEpochs: 4, resolvedVows: 2 });
    expect(s.serenity).toBe(10);
  });

  it('paranoia = recentCloseDeaths*2 + heavenlyNoticeTier', () => {
    const s = moodScores({ ...zeroMoodInputs(), recentCloseDeaths: 1, heavenlyNoticeTier: 3 });
    expect(s.paranoia).toBe(5);
  });

  it('resolve = recentBreakthroughs*2 + mastershipsAcquired', () => {
    const s = moodScores({ ...zeroMoodInputs(), recentBreakthroughs: 2, mastershipsAcquired: 1 });
    expect(s.resolve).toBe(5);
  });

  it('melancholy = yearsAlone*0.5 + wintersInSeclusion', () => {
    const s = moodScores({ ...zeroMoodInputs(), yearsAlone: 10, wintersInSeclusion: 2 });
    expect(s.melancholy).toBe(7);
  });
});

describe('computeDominantMood', () => {
  it('returns serenity when all inputs are zero (default quiet baseline)', () => {
    expect(computeDominantMood(zeroMoodInputs())).toBe('serenity');
  });

  it('returns the single highest scorer', () => {
    expect(computeDominantMood({ ...zeroMoodInputs(), recentRegrets: 5 })).toBe('sorrow');
    expect(computeDominantMood({ ...zeroMoodInputs(), recentBetrayals: 3 })).toBe('rage');
    expect(computeDominantMood({ ...zeroMoodInputs(), recentBreakthroughs: 5 })).toBe('resolve');
  });

  it('ties resolve to a stable, documented priority order', () => {
    // Priority (tie-break order): resolve > serenity > sorrow > rage > paranoia > melancholy
    const m = computeDominantMood({ ...zeroMoodInputs(), recentRegrets: 1, recentBreakthroughs: 1 });
    // sorrow = 2, resolve = 2 → resolve wins on priority
    expect(m).toBe('resolve');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- Mood`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/narrative/Mood.ts`:

```ts
// Mood score computation. Source: docs/spec/design.md §6.4.

import { Mood } from '@/engine/core/Types';

export interface MoodInputs {
  recentRegrets: number;
  unreturnedDebts: number;
  recentBetrayals: number;
  humiliationsThisYear: number;
  recentMeditationEpochs: number;
  resolvedVows: number;
  recentCloseDeaths: number;
  heavenlyNoticeTier: number;
  recentBreakthroughs: number;
  mastershipsAcquired: number;
  yearsAlone: number;
  wintersInSeclusion: number;
}

export type MoodScores = Record<Mood, number>;

export function zeroMoodInputs(): MoodInputs {
  return {
    recentRegrets: 0,
    unreturnedDebts: 0,
    recentBetrayals: 0,
    humiliationsThisYear: 0,
    recentMeditationEpochs: 0,
    resolvedVows: 0,
    recentCloseDeaths: 0,
    heavenlyNoticeTier: 0,
    recentBreakthroughs: 0,
    mastershipsAcquired: 0,
    yearsAlone: 0,
    wintersInSeclusion: 0,
  };
}

export function moodScores(i: MoodInputs): MoodScores {
  return {
    sorrow:     i.recentRegrets * 2 + i.unreturnedDebts,
    rage:       i.recentBetrayals * 3 + i.humiliationsThisYear,
    serenity:   i.recentMeditationEpochs * 2 + i.resolvedVows,
    paranoia:   i.recentCloseDeaths * 2 + i.heavenlyNoticeTier,
    resolve:    i.recentBreakthroughs * 2 + i.mastershipsAcquired,
    melancholy: i.yearsAlone * 0.5 + i.wintersInSeclusion,
  };
}

/** Tie-break priority: higher index wins on tie, and serenity is the baseline when all scores are zero. */
const PRIORITY: ReadonlyArray<Mood> = [
  'melancholy', 'paranoia', 'rage', 'sorrow', 'serenity', 'resolve',
];

export function computeDominantMood(inputs: MoodInputs): Mood {
  const s = moodScores(inputs);
  let best: Mood = 'serenity';
  let bestScore = -Infinity;
  for (const mood of PRIORITY) {
    if (s[mood] > bestScore) {
      best = mood;
      bestScore = s[mood];
    }
  }
  return best;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- Mood`
Expected: 11 passing.

- [ ] **Step 5: Commit**

```bash
git add src/engine/narrative/Mood.ts src/engine/narrative/Mood.test.ts
git commit -m "feat(narrative): mood inputs + dominant-mood computation (§6.4)"
```

---

## Task 3: `MoodBonus` table

**Files:**
- Create: `src/engine/narrative/MoodBonus.ts`
- Create: `src/engine/narrative/MoodBonus.test.ts`

**Rationale:** Phase 1B's `ChoiceResolver` takes a `moodBonus: number` parameter. This task fills it in: a table keyed by `(Mood × CheckCategory)` that returns a small (+/- 5 range) bonus.

- [ ] **Step 1: Write the failing test**

Create `src/engine/narrative/MoodBonus.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CheckCategory, Mood } from '@/engine/core/Types';
import { computeMoodBonus, MOOD_BONUS_TABLE } from './MoodBonus';

describe('MOOD_BONUS_TABLE', () => {
  it('returns 0 for categories with no explicit entry', () => {
    // Phase 1C: most categories × moods default to 0.
    expect(computeMoodBonus('serenity', 'lore_scholarship')).toBe(0);
  });

  it('rage boosts combat checks, penalises social ones', () => {
    expect(computeMoodBonus('rage', 'brute_force')).toBeGreaterThan(0);
    expect(computeMoodBonus('rage', 'melee_skill')).toBeGreaterThan(0);
    expect(computeMoodBonus('rage', 'social_persuade')).toBeLessThan(0);
  });

  it('serenity boosts cultivation and meditation', () => {
    expect(computeMoodBonus('serenity', 'cultivation_attempt')).toBeGreaterThan(0);
    expect(computeMoodBonus('serenity', 'insight_puzzle')).toBeGreaterThan(0);
  });

  it('paranoia boosts dodge, penalises social', () => {
    expect(computeMoodBonus('paranoia', 'dodge_flee')).toBeGreaterThan(0);
    expect(computeMoodBonus('paranoia', 'social_persuade')).toBeLessThan(0);
  });

  it('resolve gives a small bonus everywhere', () => {
    // Resolve = determined state. Small positive bonus across all categories.
    for (const cat of [
      'brute_force', 'melee_skill', 'cultivation_attempt', 'social_persuade',
    ] as CheckCategory[]) {
      expect(computeMoodBonus('resolve', cat)).toBeGreaterThanOrEqual(1);
    }
  });

  it('sorrow / melancholy penalise combat but boost insight', () => {
    expect(computeMoodBonus('sorrow', 'brute_force')).toBeLessThanOrEqual(0);
    expect(computeMoodBonus('melancholy', 'insight_puzzle')).toBeGreaterThan(0);
  });

  it('all table entries are within [-5, +5]', () => {
    for (const mood of Object.keys(MOOD_BONUS_TABLE) as Mood[]) {
      for (const cat of Object.keys(MOOD_BONUS_TABLE[mood]) as CheckCategory[]) {
        const v = MOOD_BONUS_TABLE[mood][cat]!;
        expect(v).toBeGreaterThanOrEqual(-5);
        expect(v).toBeLessThanOrEqual(5);
      }
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- MoodBonus`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/narrative/MoodBonus.ts`:

```ts
// Mood × CheckCategory bonus table.
// Phase 1C: small integer modifiers within [-5, +5]. Source: inferred from spec §5 tone.

import { CheckCategory, Mood } from '@/engine/core/Types';

export type MoodBonusTable = Partial<Record<Mood, Partial<Record<CheckCategory, number>>>>;

export const MOOD_BONUS_TABLE: MoodBonusTable = {
  rage: {
    brute_force: +3,
    melee_skill: +2,
    qi_combat: +2,
    social_persuade: -3,
    social_seduce: -3,
    deception: -2,
    insight_puzzle: -2,
  },
  sorrow: {
    brute_force: -2,
    melee_skill: -2,
    social_seduce: -2,
    insight_puzzle: +1,
    lore_scholarship: +1,
  },
  serenity: {
    cultivation_attempt: +3,
    insight_puzzle: +2,
    resist_mental: +3,
    lore_scholarship: +1,
    social_persuade: +1,
  },
  paranoia: {
    dodge_flee: +3,
    resist_poison: +2,
    survival: +2,
    social_persuade: -3,
    social_intimidate: +1,
    deception: +2,
  },
  resolve: {
    brute_force: +1,
    melee_skill: +1,
    cultivation_attempt: +1,
    social_persuade: +1,
    social_intimidate: +2,
    resist_mental: +2,
  },
  melancholy: {
    insight_puzzle: +2,
    lore_scholarship: +2,
    social_seduce: -2,
    brute_force: -2,
  },
};

export function computeMoodBonus(mood: Mood, category: CheckCategory): number {
  return MOOD_BONUS_TABLE[mood]?.[category] ?? 0;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- MoodBonus`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/narrative/MoodBonus.ts src/engine/narrative/MoodBonus.test.ts
git commit -m "feat(narrative): mood × check-category bonus table"
```

---

## Task 4: `SnippetLibrary` — JSON schema + runtime loader + tag-biased pick

**Files:**
- Create: `src/engine/narrative/SnippetLibrary.ts`
- Create: `src/engine/narrative/SnippetLibrary.test.ts`

**Rationale:** Snippet content is JSON. Structure: `{ "dotted.key": [ { text, tags?, weight? }, ... ] }`. Tag-biased pick: if caller supplies preferred tags, entries matching any preferred tag get a weight multiplier.

The Phase 0 content schema already has `SnippetLibrarySchema` and `SnippetEntrySchema`. This task builds the runtime library on top.

- [ ] **Step 1: Write the failing test**

Create `src/engine/narrative/SnippetLibrary.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createSnippetLibrary, pickSnippet, SnippetLibrary } from './SnippetLibrary';

const RAW = {
  'weather.drought.heavy': [
    { text: 'The sun hung like a bronze coin nailed to the sky.', tags: ['lyrical'] },
    { text: 'Three moons without rain.', tags: ['terse'] },
    { text: 'The land was parched.', tags: ['serious'] },
  ],
  'weather.storm.soft': [
    { text: 'A hush of rain across the thatch.' },
  ],
};

describe('createSnippetLibrary', () => {
  it('accepts valid zod-shaped raw data and returns a library', () => {
    const lib = createSnippetLibrary(RAW);
    expect(lib.has('weather.drought.heavy')).toBe(true);
    expect(lib.has('weather.storm.soft')).toBe(true);
    expect(lib.has('unknown.key')).toBe(false);
  });

  it('rejects malformed raw data', () => {
    expect(() => createSnippetLibrary({ 'x.y': [{ text: '' }] })).toThrow();
  });
});

describe('pickSnippet', () => {
  it('returns null for unknown keys', () => {
    const lib = createSnippetLibrary(RAW);
    expect(pickSnippet(lib, 'does.not.exist', [], createRng(1))).toBeNull();
  });

  it('returns a text from the matching key', () => {
    const lib = createSnippetLibrary(RAW);
    const text = pickSnippet(lib, 'weather.storm.soft', [], createRng(1));
    expect(text).toBe('A hush of rain across the thatch.');
  });

  it('is deterministic for the same seed', () => {
    const lib = createSnippetLibrary(RAW);
    const a = pickSnippet(lib, 'weather.drought.heavy', [], createRng(42));
    const b = pickSnippet(lib, 'weather.drought.heavy', [], createRng(42));
    expect(a).toBe(b);
  });

  it('preferred tags bias the selection toward matching entries', () => {
    const lib = createSnippetLibrary(RAW);
    // 'lyrical' entry: "The sun hung like a bronze coin..."
    // With preferredTags=['lyrical'] it should dominate > 70% over 1000 rolls.
    const rng = createRng(99);
    let lyricalCount = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const s = pickSnippet(lib, 'weather.drought.heavy', ['lyrical'], rng);
      if (s?.startsWith('The sun')) lyricalCount++;
    }
    expect(lyricalCount / N).toBeGreaterThan(0.70);
  });

  it('no preferred tags → uniform-ish distribution across entries', () => {
    const lib = createSnippetLibrary(RAW);
    const rng = createRng(50);
    const counts = new Map<string, number>();
    const N = 3000;
    for (let i = 0; i < N; i++) {
      const s = pickSnippet(lib, 'weather.drought.heavy', [], rng)!;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    // All three entries should appear roughly equally (within 20%–50% tolerance).
    for (const [, count] of counts) {
      expect(count / N).toBeGreaterThan(0.15);
      expect(count / N).toBeLessThan(0.55);
    }
  });

  it('respects explicit weight field', () => {
    const raw = {
      'x.y': [
        { text: 'rare', weight: 1 },
        { text: 'common', weight: 9 },
      ],
    };
    const lib = createSnippetLibrary(raw);
    const rng = createRng(123);
    let commonCount = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      if (pickSnippet(lib, 'x.y', [], rng) === 'common') commonCount++;
    }
    expect(commonCount / N).toBeGreaterThan(0.80);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- SnippetLibrary`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/narrative/SnippetLibrary.ts`:

```ts
// Snippet library + tag-biased pick.
// Source: docs/spec/design.md §6.3.

import { IRng } from '@/engine/core/RNG';
import { SnippetLibrarySchema, SnippetEntry } from '@/content/schema';

export interface SnippetLibrary {
  has(key: string): boolean;
  get(key: string): ReadonlyArray<SnippetEntry> | undefined;
}

const TAG_MATCH_BIAS = 10;  // matching entries get their weight multiplied

export function createSnippetLibrary(raw: unknown): SnippetLibrary {
  const parsed = SnippetLibrarySchema.parse(raw);
  const map = new Map<string, ReadonlyArray<SnippetEntry>>(
    Object.entries(parsed),
  );
  return {
    has: (key) => map.has(key),
    get: (key) => map.get(key),
  };
}

/**
 * Weighted pick from the library with optional tag bias.
 * - Entries matching any preferred tag get weight × TAG_MATCH_BIAS.
 * - Entries without a weight default to 1.
 * - Returns null if the key doesn't exist or has no entries.
 */
export function pickSnippet(
  lib: SnippetLibrary,
  key: string,
  preferredTags: ReadonlyArray<string>,
  rng: IRng,
): string | null {
  const entries = lib.get(key);
  if (!entries || entries.length === 0) return null;

  function effectiveWeight(e: SnippetEntry): number {
    const base = e.weight ?? 1;
    if (preferredTags.length === 0) return base;
    if (!e.tags || e.tags.length === 0) return base;
    const hit = preferredTags.some((t) => e.tags!.includes(t));
    return hit ? base * TAG_MATCH_BIAS : base;
  }

  const picked = rng.weightedPick(entries, effectiveWeight);
  return picked.text;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- SnippetLibrary`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/narrative/SnippetLibrary.ts src/engine/narrative/SnippetLibrary.test.ts
git commit -m "feat(narrative): snippet library with tag-biased weighted pick"
```

---

## Task 5: `TemplateExpander` — recursive `$[...]` resolution + `[VAR]` substitution

**Files:**
- Create: `src/engine/narrative/TemplateExpander.ts`
- Create: `src/engine/narrative/TemplateExpander.test.ts`

**Rationale:** Event text is like `"$[weather.$[SEASON].heavy] $[sensory.oppressive.1]. [CHARACTER] walked on."`. We need to (1) resolve `[VAR]` by literal substitution from a `variables` record, (2) resolve `$[key]` by looking up snippets — recursively, so inner `$[SEASON]` is resolved before the outer lookup.

- [ ] **Step 1: Write the failing test**

Create `src/engine/narrative/TemplateExpander.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createSnippetLibrary } from './SnippetLibrary';
import { expandTemplate } from './TemplateExpander';

const LIB = createSnippetLibrary({
  'weather.summer.heavy': [{ text: 'The sun burned overhead.' }],
  'weather.winter.heavy': [{ text: 'Ice bit every breath.' }],
  'sensory.oppressive.1': [{ text: 'The air felt burned.' }],
  'greeting': [
    { text: 'Peace, stranger.', tags: ['serious'] },
    { text: 'Eh, you again.', tags: ['terse'] },
  ],
});

describe('expandTemplate', () => {
  it('returns input unchanged when no tokens present', () => {
    const r = expandTemplate('just a plain sentence.', { library: LIB, variables: {}, preferredTags: [], rng: createRng(1) });
    expect(r).toBe('just a plain sentence.');
  });

  it('substitutes [VAR] tokens from variables', () => {
    const r = expandTemplate('Hello, [NAME]!', { library: LIB, variables: { NAME: 'Lin Wei' }, preferredTags: [], rng: createRng(1) });
    expect(r).toBe('Hello, Lin Wei!');
  });

  it('leaves [VAR] intact when the variable is missing', () => {
    const r = expandTemplate('Hello, [NAME]!', { library: LIB, variables: {}, preferredTags: [], rng: createRng(1) });
    expect(r).toBe('Hello, [NAME]!');
  });

  it('resolves $[key] via snippet library', () => {
    const r = expandTemplate('$[sensory.oppressive.1]', { library: LIB, variables: {}, preferredTags: [], rng: createRng(1) });
    expect(r).toBe('The air felt burned.');
  });

  it('resolves nested $[…$[…]…] recursively', () => {
    const r = expandTemplate('$[weather.$[SEASON].heavy]', {
      library: LIB, variables: { SEASON: 'summer' }, preferredTags: [], rng: createRng(1),
    });
    expect(r).toBe('The sun burned overhead.');
  });

  it('different SEASON yields different resolution', () => {
    const r = expandTemplate('$[weather.$[SEASON].heavy]', {
      library: LIB, variables: { SEASON: 'winter' }, preferredTags: [], rng: createRng(1),
    });
    expect(r).toBe('Ice bit every breath.');
  });

  it('unknown $[key] is replaced with an empty string', () => {
    const r = expandTemplate('before$[no.such.key]after', {
      library: LIB, variables: {}, preferredTags: [], rng: createRng(1),
    });
    expect(r).toBe('beforeafter');
  });

  it('propagates preferredTags into snippet pick', () => {
    // With preferredTags=['terse'], "Eh, you again." should dominate.
    const rng = createRng(99);
    let terse = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      const r = expandTemplate('$[greeting]', {
        library: LIB, variables: {}, preferredTags: ['terse'], rng,
      });
      if (r === 'Eh, you again.') terse++;
    }
    expect(terse / N).toBeGreaterThan(0.7);
  });

  it('handles multiple tokens in one string', () => {
    const r = expandTemplate('$[sensory.oppressive.1] [CHARACTER] walked on.', {
      library: LIB, variables: { CHARACTER: 'Lin Wei' }, preferredTags: [], rng: createRng(1),
    });
    expect(r).toBe('The air felt burned. Lin Wei walked on.');
  });

  it('is deterministic for the same seed and inputs', () => {
    const ctx = { library: LIB, variables: {}, preferredTags: [] as string[], rng: createRng(42) };
    const ctxB = { library: LIB, variables: {}, preferredTags: [] as string[], rng: createRng(42) };
    const a = expandTemplate('$[greeting]', ctx);
    const b = expandTemplate('$[greeting]', ctxB);
    expect(a).toBe(b);
  });

  it('terminates on infinite-recursion edge case (key that contains itself) — guards via max depth', () => {
    // Construct a library where a key resolves to itself. Expander must cap depth, not loop forever.
    const bad = createSnippetLibrary({
      'loop.x': [{ text: '$[loop.x]' }],
    });
    // The guard returns the literal unresolved token or empty string — either is acceptable, just don't stall.
    const r = expandTemplate('$[loop.x]', {
      library: bad, variables: {}, preferredTags: [], rng: createRng(1),
    });
    expect(typeof r).toBe('string');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- TemplateExpander`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/narrative/TemplateExpander.ts`:

```ts
// Recursive template expander: $[key] via snippet library, [VAR] via variables map.
// Source: docs/spec/design.md §6.2.

import { IRng } from '@/engine/core/RNG';
import { SnippetLibrary, pickSnippet } from './SnippetLibrary';

export interface ExpandContext {
  library: SnippetLibrary;
  variables: Readonly<Record<string, string>>;
  preferredTags: ReadonlyArray<string>;
  rng: IRng;
}

const MAX_DEPTH = 8;
const VAR_TOKEN = /\[([A-Z_][A-Z0-9_]*)\]/g;
const SNIPPET_TOKEN_OPEN = '$[';

/**
 * Expand a template string:
 *   - [VAR]: literal substitution from ctx.variables. Missing → left intact.
 *   - $[key]: resolved via snippet library (keys may contain nested $[…] tokens).
 *     Unknown keys resolve to empty string. Recursion is capped at MAX_DEPTH.
 */
export function expandTemplate(template: string, ctx: ExpandContext, depth: number = 0): string {
  if (depth > MAX_DEPTH) return '';

  // First, resolve $[…] tokens (innermost first) until none remain or depth cap hit.
  let s = template;
  let iterations = 0;
  while (s.includes(SNIPPET_TOKEN_OPEN) && iterations < MAX_DEPTH) {
    s = resolveOneSnippetToken(s, ctx, depth);
    iterations++;
  }

  // Then, substitute [VAR] tokens (single pass; literals don't recurse).
  s = s.replace(VAR_TOKEN, (match, varName: string) => {
    const v = ctx.variables[varName];
    return v !== undefined ? v : match;
  });

  return s;
}

/** Find and resolve the innermost $[…] token in the string. One pass. */
function resolveOneSnippetToken(s: string, ctx: ExpandContext, depth: number): string {
  // Find the last "$[" — this gives us the innermost (deepest-nested) token.
  const open = s.lastIndexOf(SNIPPET_TOKEN_OPEN);
  if (open === -1) return s;
  const close = s.indexOf(']', open + 2);
  if (close === -1) return s;

  const rawKey = s.substring(open + 2, close);
  // The raw key may itself contain [VAR] tokens (but not $[…] because we picked innermost).
  const key = rawKey.replace(VAR_TOKEN, (_, v: string) => ctx.variables[v] ?? '');

  const resolved = pickSnippet(ctx.library, key, ctx.preferredTags, ctx.rng) ?? '';
  // Recurse into resolved content — a snippet may contain more $[…] or [VAR] tokens.
  const expanded = expandTemplate(resolved, ctx, depth + 1);

  return s.substring(0, open) + expanded + s.substring(close + 1);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- TemplateExpander`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/narrative/TemplateExpander.ts src/engine/narrative/TemplateExpander.test.ts
git commit -m "feat(narrative): template expander (\$[key] snippets + [VAR] substitutions)"
```

---

## Task 6: `NameGenerator`

**Files:**
- Create: `src/engine/narrative/NameGenerator.ts`
- Create: `src/engine/narrative/NameGenerator.test.ts`

**Rationale:** Chinese-inspired names for characters + sects + places. The generator takes a pool bank and an `IRng`; outputs are deterministic.

- [ ] **Step 1: Write the failing test**

Create `src/engine/narrative/NameGenerator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import {
  generatePersonalName,
  generateSectName,
  generatePlaceName,
  DEFAULT_NAME_POOLS,
  NamePools,
} from './NameGenerator';

describe('DEFAULT_NAME_POOLS', () => {
  it('has non-empty pools for every category', () => {
    expect(DEFAULT_NAME_POOLS.familyNames.length).toBeGreaterThan(0);
    expect(DEFAULT_NAME_POOLS.givenSyllables.length).toBeGreaterThan(0);
    expect(DEFAULT_NAME_POOLS.sectAdjectives.length).toBeGreaterThan(0);
    expect(DEFAULT_NAME_POOLS.sectObjects.length).toBeGreaterThan(0);
    expect(DEFAULT_NAME_POOLS.sectSuffixes.length).toBeGreaterThan(0);
    expect(DEFAULT_NAME_POOLS.placePrefixes.length).toBeGreaterThan(0);
    expect(DEFAULT_NAME_POOLS.placeFeatures.length).toBeGreaterThan(0);
  });
});

describe('generatePersonalName', () => {
  it('produces "Family Given" format with two-syllable given name by default', () => {
    const n = generatePersonalName(DEFAULT_NAME_POOLS, createRng(1));
    expect(n).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+[A-Za-z]*$/);
    expect(n.split(' ').length).toBe(2);
  });

  it('is deterministic', () => {
    expect(generatePersonalName(DEFAULT_NAME_POOLS, createRng(42)))
      .toBe(generatePersonalName(DEFAULT_NAME_POOLS, createRng(42)));
  });

  it('different seeds produce different names (most of the time)', () => {
    const names = new Set<string>();
    for (let s = 1; s <= 50; s++) {
      names.add(generatePersonalName(DEFAULT_NAME_POOLS, createRng(s)));
    }
    expect(names.size).toBeGreaterThan(20);
  });
});

describe('generateSectName', () => {
  it('produces "Adjective Object Suffix" format', () => {
    const n = generateSectName(DEFAULT_NAME_POOLS, createRng(1));
    expect(n.split(' ').length).toBeGreaterThanOrEqual(3);
  });

  it('is deterministic', () => {
    expect(generateSectName(DEFAULT_NAME_POOLS, createRng(42)))
      .toBe(generateSectName(DEFAULT_NAME_POOLS, createRng(42)));
  });
});

describe('generatePlaceName', () => {
  it('produces a multi-word name', () => {
    const n = generatePlaceName(DEFAULT_NAME_POOLS, createRng(1));
    expect(n.split(' ').length).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic', () => {
    expect(generatePlaceName(DEFAULT_NAME_POOLS, createRng(42)))
      .toBe(generatePlaceName(DEFAULT_NAME_POOLS, createRng(42)));
  });
});

describe('custom pools', () => {
  it('generatePersonalName uses the pools argument', () => {
    const pools: NamePools = {
      ...DEFAULT_NAME_POOLS,
      familyNames: ['Foo'],
      givenSyllables: ['Bar'],
    };
    // With only 1 family name and 1 given syllable, the name is deterministic.
    const n = generatePersonalName(pools, createRng(1));
    // Given name is single-syllable sometimes (50/50), two-syllable other times → "Foo Bar" or "Foo BarBar"
    expect(['Foo Bar', 'Foo BarBar']).toContain(n);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- NameGenerator`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/narrative/NameGenerator.ts`:

```ts
// Chinese-inspired name generators.
// Source: docs/spec/design.md §6.7.
//
// Phase 1C ships with small hand-curated pools. Phase 1D content authoring can expand them.

import { IRng } from '@/engine/core/RNG';

export interface NamePools {
  familyNames: ReadonlyArray<string>;
  givenSyllables: ReadonlyArray<string>;
  sectAdjectives: ReadonlyArray<string>;
  sectObjects: ReadonlyArray<string>;
  sectSuffixes: ReadonlyArray<string>;
  placePrefixes: ReadonlyArray<string>;
  placeFeatures: ReadonlyArray<string>;
}

export const DEFAULT_NAME_POOLS: NamePools = {
  familyNames: [
    'Lin', 'Wang', 'Zhao', 'Hua', 'Mo', 'Qin', 'Bai', 'Xu', 'Yan', 'Shen',
    'Tao', 'Meng', 'Lu', 'Su', 'Jiang', 'Song', 'Feng', 'Luo', 'Fan', 'Cui',
  ],
  givenSyllables: [
    'Wei', 'Min', 'Shan', 'Qing', 'Yuan', 'Hao', 'Ling', 'Jie', 'Cheng', 'Zhi',
    'Ning', 'Bo', 'Yi', 'Ran', 'Xian', 'Ru', 'Tai', 'Yong', 'Mei', 'Xiao',
  ],
  sectAdjectives: [
    'Azure', 'Crimson', 'Jade', 'Iron', 'Nine', 'Silent', 'Thousand',
    'Void', 'Heaven', 'Moon', 'Frozen', 'Eternal',
  ],
  sectObjects: [
    'Cloud', 'Sword', 'Lotus', 'Mist', 'Peak', 'Blade', 'Flame', 'River',
    'Serpent', 'Tiger', 'Phoenix', 'Pavilion',
  ],
  sectSuffixes: [
    'Sect', 'Valley', 'Pavilion', 'Palace', 'Gate', 'Temple', 'Hall',
  ],
  placePrefixes: [
    'Cold', 'Iron', 'Old', 'Quiet', 'White', 'Nine-Hundred-Steps',
    'Forgotten', 'Withered', 'Southern', 'Jade',
  ],
  placeFeatures: [
    'Peak', 'Gorge', 'Village', 'Crossroad', 'Ford', 'Hollow',
    'Grove', 'Pass', 'Town', 'Hermitage',
  ],
};

export function generatePersonalName(pools: NamePools, rng: IRng): string {
  const family = rng.pick(pools.familyNames);
  const first = rng.pick(pools.givenSyllables);
  // 50% chance of two-syllable given name.
  const twoSyl = rng.next() < 0.5;
  const given = twoSyl ? first + rng.pick(pools.givenSyllables) : first;
  return `${family} ${given}`;
}

export function generateSectName(pools: NamePools, rng: IRng): string {
  const adj = rng.pick(pools.sectAdjectives);
  const obj = rng.pick(pools.sectObjects);
  const suf = rng.pick(pools.sectSuffixes);
  return `${adj} ${obj} ${suf}`;
}

export function generatePlaceName(pools: NamePools, rng: IRng): string {
  const pref = rng.pick(pools.placePrefixes);
  const feat = rng.pick(pools.placeFeatures);
  return `${pref} ${feat}`;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- NameGenerator`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/narrative/NameGenerator.ts src/engine/narrative/NameGenerator.test.ts
git commit -m "feat(narrative): name generator (personal, sect, place)"
```

---

## Task 7: `NameRegistry` — per-life immutable cache

**Files:**
- Create: `src/engine/narrative/NameRegistry.ts`
- Create: `src/engine/narrative/NameRegistry.test.ts`

**Rationale:** Once an NPC is named, every subsequent reference must return the same name. The registry is an immutable record keyed by `(archetype, slotId)`. On miss, the caller supplies a generator + RNG; the registry returns `{ name, registry: newRegistry }` with the fresh name baked in.

- [ ] **Step 1: Write the failing test**

Create `src/engine/narrative/NameRegistry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createNameRegistry, resolveName, NameRegistry } from './NameRegistry';
import { DEFAULT_NAME_POOLS, generatePersonalName } from './NameGenerator';

const genPersonal = (rng: ReturnType<typeof createRng>) => generatePersonalName(DEFAULT_NAME_POOLS, rng);

describe('createNameRegistry', () => {
  it('starts empty', () => {
    const r = createNameRegistry();
    expect(r.slots).toEqual({});
  });
});

describe('resolveName', () => {
  it('generates a new name on first access and caches it', () => {
    const r0 = createNameRegistry();
    const { name, registry: r1 } = resolveName(r0, 'character', 'self', genPersonal, createRng(42));
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
    expect(r1.slots).toHaveProperty('character:self', name);
  });

  it('returns cached name on subsequent access, regardless of rng', () => {
    const r0 = createNameRegistry();
    const { name: n1, registry: r1 } = resolveName(r0, 'master', 'elder1', genPersonal, createRng(1));
    const { name: n2, registry: r2 } = resolveName(r1, 'master', 'elder1', genPersonal, createRng(99_999));
    expect(n2).toBe(n1);
    expect(r2).toBe(r1); // cache hit → same registry reference
  });

  it('keys by (archetype, slotId) — different slots get different names even for same archetype', () => {
    const r0 = createNameRegistry();
    const { name: nA, registry: r1 } = resolveName(r0, 'bandit', 'A', genPersonal, createRng(1));
    const { name: nB, registry: r2 } = resolveName(r1, 'bandit', 'B', genPersonal, createRng(2));
    // different slots → different generator seeds → likely different names
    expect(nA).not.toBe(undefined);
    expect(nB).not.toBe(undefined);
    expect(r2.slots['bandit:A']).toBe(nA);
    expect(r2.slots['bandit:B']).toBe(nB);
  });

  it('preserves existing slots when adding a new one', () => {
    const r0 = createNameRegistry();
    const { registry: r1 } = resolveName(r0, 'merchant', 'old_tan', genPersonal, createRng(1));
    const { registry: r2 } = resolveName(r1, 'monk', 'wanderer', genPersonal, createRng(2));
    expect(r2.slots['merchant:old_tan']).toBeDefined();
    expect(r2.slots['monk:wanderer']).toBeDefined();
  });

  it('is pure: original registry reference unchanged after resolve adds a slot', () => {
    const r0 = createNameRegistry();
    const { registry: r1 } = resolveName(r0, 'character', 'self', genPersonal, createRng(1));
    expect(r0.slots).toEqual({}); // original untouched
    expect(Object.keys(r1.slots)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- NameRegistry`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/narrative/NameRegistry.ts`:

```ts
// Per-life name registry. Once a slot is named, subsequent lookups return the cached name.
// Immutable — writes return a new registry.
// Source: docs/spec/design.md §6.7 (NameRegistry paragraph).

import { IRng } from '@/engine/core/RNG';

export interface NameRegistry {
  readonly slots: Readonly<Record<string, string>>;
}

export function createNameRegistry(): NameRegistry {
  return { slots: {} };
}

function slotKey(archetype: string, slotId: string): string {
  return `${archetype}:${slotId}`;
}

export interface ResolveNameResult {
  name: string;
  registry: NameRegistry;
}

export function resolveName(
  reg: NameRegistry,
  archetype: string,
  slotId: string,
  generator: (rng: IRng) => string,
  rng: IRng,
): ResolveNameResult {
  const key = slotKey(archetype, slotId);
  const cached = reg.slots[key];
  if (cached !== undefined) {
    return { name: cached, registry: reg };
  }
  const name = generator(rng);
  return {
    name,
    registry: { slots: { ...reg.slots, [key]: name } },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- NameRegistry`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/narrative/NameRegistry.ts src/engine/narrative/NameRegistry.test.ts
git commit -m "feat(narrative): per-life immutable name registry"
```

---

## Task 8: `Composer` — orchestrator

**Files:**
- Create: `src/engine/narrative/Composer.ts`
- Create: `src/engine/narrative/Composer.test.ts`

**Rationale:** Tie everything together. Given an `EventDef` + `CompositionContext`, produce a single paragraph of text. For each of `text.intro`, `text.body`, `text.outro`: pick one string, expand tokens, concatenate with newlines.

- [ ] **Step 1: Write the failing test**

Create `src/engine/narrative/Composer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { EventDef } from '@/content/schema';
import { createCharacter } from '@/engine/character/Character';
import { createSnippetLibrary } from './SnippetLibrary';
import { createNameRegistry } from './NameRegistry';
import { renderEvent, CompositionContext } from './Composer';

const ATTRS = { Body: 20, Mind: 15, Spirit: 10, Agility: 12, Charm: 8, Luck: 30 };

const LIB = createSnippetLibrary({
  'weather.drought': [{ text: 'The sun hung heavy.' }],
  'sensory.dust':    [{ text: 'Dust in the throat.' }],
  'dialogue.monk':   [
    { text: 'The monk offered water.', tags: ['lyrical'] },
    { text: 'A monk came by.', tags: ['terse'] },
  ],
});

function makeEvent(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'EV_TEST',
    category: 'test',
    version: 1,
    weight: 100,
    conditions: {},
    timeCost: 'SHORT',
    text: {
      intro: ['$[weather.drought]'],
      body:  ['[CHARACTER] coughed. $[sensory.dust]'],
      outro: ['$[dialogue.monk]'],
    },
    choices: [{
      id: 'ch_x', label: 'x', timeCost: 'INSTANT',
      outcomes: { SUCCESS: { narrativeKey: 'a' }, FAILURE: { narrativeKey: 'b' } },
    }],
    repeat: 'unlimited',
    ...overrides,
  };
}

function makeCtx(overrides: Partial<CompositionContext> = {}): CompositionContext {
  return {
    characterName: 'Lin Wei',
    region: 'yellow_plains',
    season: 'summer',
    realm: 'mortal',
    dominantMood: 'serenity',
    turnIndex: 1,
    runSeed: 42,
    extraVariables: {},
    ...overrides,
  };
}

describe('renderEvent', () => {
  it('composes intro + body + outro into a single paragraph separated by spaces or newlines', () => {
    const text = renderEvent(makeEvent(), makeCtx(), LIB, createNameRegistry(), createRng(1));
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('The sun hung heavy');
    expect(text).toContain('Lin Wei');
    expect(text).toContain('Dust in the throat');
  });

  it('substitutes [CHARACTER] with characterName', () => {
    const text = renderEvent(makeEvent(), makeCtx({ characterName: 'Hua Min' }), LIB, createNameRegistry(), createRng(1));
    expect(text).toContain('Hua Min');
    expect(text).not.toContain('[CHARACTER]');
  });

  it('is deterministic for the same (event, ctx, seed)', () => {
    const a = renderEvent(makeEvent(), makeCtx(), LIB, createNameRegistry(), createRng(42));
    const b = renderEvent(makeEvent(), makeCtx(), LIB, createNameRegistry(), createRng(42));
    expect(a).toBe(b);
  });

  it('mood influences tag-biased snippet selection', () => {
    // With dominantMood = 'rage', we prefer 'terse' tags → "A monk came by." should appear more than "The monk offered water."
    const rng = createRng(99);
    let terseCount = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const t = renderEvent(
        makeEvent({ text: { intro: [], body: [], outro: ['$[dialogue.monk]'] } }),
        makeCtx({ dominantMood: 'rage' }),
        LIB,
        createNameRegistry(),
        rng,
      );
      if (t.includes('A monk came by')) terseCount++;
    }
    expect(terseCount / N).toBeGreaterThan(0.6);
  });

  it('handles events with empty intro / body / outro arrays gracefully', () => {
    const ev = makeEvent({ text: { intro: [], body: [], outro: [] } });
    const text = renderEvent(ev, makeCtx(), LIB, createNameRegistry(), createRng(1));
    expect(text).toBe('');
  });

  it('extraVariables flow into [VAR] substitutions', () => {
    const ev = makeEvent({ text: { intro: ['[LOCATION] was quiet.'], body: [], outro: [] } });
    const text = renderEvent(ev, makeCtx({ extraVariables: { LOCATION: 'Cold Iron Peak' } }), LIB, createNameRegistry(), createRng(1));
    expect(text).toBe('Cold Iron Peak was quiet.');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- Composer`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/narrative/Composer.ts`:

```ts
// Composer orchestrator: renders an EventDef into prose.
// Source: docs/spec/design.md §6.1, §6.10.

import { Mood, Realm, Season } from '@/engine/core/Types';
import { IRng } from '@/engine/core/RNG';
import { EventDef } from '@/content/schema';
import { SnippetLibrary } from './SnippetLibrary';
import { NameRegistry } from './NameRegistry';
import { expandTemplate } from './TemplateExpander';

export interface CompositionContext {
  characterName: string;
  region: string;
  season: Season;
  realm: Realm | string;          // Realm enum value (string literal underlying)
  dominantMood: Mood;
  turnIndex: number;
  runSeed: number;
  extraVariables: Readonly<Record<string, string>>;
}

/** Map mood → preferred snippet tag(s). Phase 1C uses a lean 1-to-1 mapping. */
const MOOD_TAG_PREFERENCES: Readonly<Record<Mood, ReadonlyArray<string>>> = {
  sorrow:     ['lyrical', 'tender'],
  rage:       ['terse', 'bitter'],
  serenity:   ['lyrical', 'tender'],
  paranoia:   ['terse', 'ominous'],
  resolve:    ['serious'],
  melancholy: ['lyrical', 'bitter'],
};

function buildVariables(ctx: CompositionContext): Record<string, string> {
  return {
    CHARACTER: ctx.characterName,
    REGION: ctx.region,
    SEASON: ctx.season,
    REALM: String(ctx.realm),
    ...ctx.extraVariables,
  };
}

function renderLine(
  line: string,
  ctx: CompositionContext,
  library: SnippetLibrary,
  _registry: NameRegistry,
  rng: IRng,
): string {
  const preferredTags = MOOD_TAG_PREFERENCES[ctx.dominantMood];
  return expandTemplate(line, {
    library,
    variables: buildVariables(ctx),
    preferredTags,
    rng,
  });
}

/** Pick one entry per non-empty section; concatenate with single spaces. */
export function renderEvent(
  event: EventDef,
  ctx: CompositionContext,
  library: SnippetLibrary,
  registry: NameRegistry,
  rng: IRng,
): string {
  const parts: string[] = [];

  for (const section of ['intro', 'body', 'outro'] as const) {
    const lines = event.text[section] ?? [];
    if (lines.length === 0) continue;
    const chosen = lines[rng.intRange(0, lines.length - 1)]!;
    const rendered = renderLine(chosen, ctx, library, registry, rng);
    if (rendered.length > 0) parts.push(rendered);
  }

  return parts.join(' ');
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- Composer`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/narrative/Composer.ts src/engine/narrative/Composer.test.ts
git commit -m "feat(narrative): Composer orchestrator (mood-biased renderEvent)"
```

---

## Task 9: Determinism contract tests

**Files:**
- Create: `tests/integration/narrative_determinism.test.ts`

**Rationale:** Spec §6.10: *"Given identical `(event, RunState, seed)`, the composer MUST return identical text."* This test is the contract.

- [ ] **Step 1: Write the test**

Create `tests/integration/narrative_determinism.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { EventDef } from '@/content/schema';
import { renderEvent, CompositionContext } from '@/engine/narrative/Composer';
import { createSnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { createNameRegistry } from '@/engine/narrative/NameRegistry';

const EVENT: EventDef = {
  id: 'EV_DETERMINISM',
  category: 'test',
  version: 1,
  weight: 100,
  conditions: {},
  timeCost: 'SHORT',
  text: {
    intro: ['$[weather.drought]', '$[weather.rain]'],
    body:  ['[CHARACTER] considered the road.', 'A silence settled on the valley.'],
    outro: ['$[dialogue.monk.1]', '$[dialogue.monk.2]'],
  },
  choices: [{
    id: 'ch_x', label: 'x', timeCost: 'INSTANT',
    outcomes: { SUCCESS: { narrativeKey: 'a' }, FAILURE: { narrativeKey: 'b' } },
  }],
  repeat: 'unlimited',
};

const LIB = createSnippetLibrary({
  'weather.drought':   [{ text: 'The sun hung heavy.' }],
  'weather.rain':      [{ text: 'Rain threaded the mountain.' }],
  'dialogue.monk.1':   [{ text: '"Peace," the monk said.' }],
  'dialogue.monk.2':   [{ text: 'The monk walked on.' }],
});

function makeCtx(overrides: Partial<CompositionContext> = {}): CompositionContext {
  return {
    characterName: 'Lin Wei',
    region: 'yellow_plains',
    season: 'summer',
    realm: 'mortal',
    dominantMood: 'serenity',
    turnIndex: 5,
    runSeed: 42,
    extraVariables: {},
    ...overrides,
  };
}

describe('composer determinism contract (spec §6.10)', () => {
  it('same (event, ctx, seed) → identical output', () => {
    const a = renderEvent(EVENT, makeCtx(), LIB, createNameRegistry(), createRng(42));
    const b = renderEvent(EVENT, makeCtx(), LIB, createNameRegistry(), createRng(42));
    const c = renderEvent(EVENT, makeCtx(), LIB, createNameRegistry(), createRng(42));
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('different seed → different output (empirically)', () => {
    const outputs = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      outputs.add(renderEvent(EVENT, makeCtx(), LIB, createNameRegistry(), createRng(seed)));
    }
    expect(outputs.size).toBeGreaterThan(2);
  });

  it('same seed but different turnIndex → identical if other inputs are same', () => {
    // turnIndex is a context field but does NOT directly affect composition in Phase 1C
    // (it would in Phase 1D once per-turn seed derivation is wired).
    // This test documents current behaviour.
    const a = renderEvent(EVENT, makeCtx({ turnIndex: 1 }), LIB, createNameRegistry(), createRng(42));
    const b = renderEvent(EVENT, makeCtx({ turnIndex: 2 }), LIB, createNameRegistry(), createRng(42));
    expect(a).toBe(b);
  });

  it('different dominantMood → different tag preference → may differ', () => {
    // Different moods bias different tags. With default pool (no tags specified on snippet entries),
    // the bias has no effect. This test just confirms no crash.
    const a = renderEvent(EVENT, makeCtx({ dominantMood: 'rage' }), LIB, createNameRegistry(), createRng(1));
    const b = renderEvent(EVENT, makeCtx({ dominantMood: 'sorrow' }), LIB, createNameRegistry(), createRng(1));
    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
  });

  it('different characterName substitutes correctly', () => {
    const a = renderEvent(EVENT, makeCtx({ characterName: 'A' }), LIB, createNameRegistry(), createRng(1));
    const b = renderEvent(EVENT, makeCtx({ characterName: 'B' }), LIB, createNameRegistry(), createRng(1));
    // Both lines use [CHARACTER]; body snippet may or may not contain it. Check A ≠ B when [CHARACTER] was substituted.
    if (a.includes('A')) {
      expect(b).not.toBe(a);
    }
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npm test -- narrative_determinism`
Expected: all pass.

- [ ] **Step 3: Run full suite**

Run: `npm test`
Expected: all green (287 + Phase 1C tests).

Run: `npm run typecheck` — clean.
Run: `npm run build` — success.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/narrative_determinism.test.ts
git commit -m "test(integration): composer determinism contract (§6.10)"
```

---

## Task 10: Integration test — render a Bandit event with full composition

**Files:**
- Create: `tests/integration/narrative_render_bandit.test.ts`

**Rationale:** Prove Phase 1C composes with Phase 1B's event pipeline. The test builds a Bandit event with real tokens, runs the composer, and asserts the output contains the expected literal fragments from the snippet library + the character's name.

- [ ] **Step 1: Write the integration test**

Create `tests/integration/narrative_render_bandit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { EventDef } from '@/content/schema';
import { createCharacter } from '@/engine/character/Character';
import { createRunState } from '@/engine/events/RunState';
import { renderEvent } from '@/engine/narrative/Composer';
import { createSnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { createNameRegistry, resolveName } from '@/engine/narrative/NameRegistry';
import { DEFAULT_NAME_POOLS, generatePersonalName } from '@/engine/narrative/NameGenerator';
import { computeDominantMood, zeroMoodInputs } from '@/engine/narrative/Mood';

const ATTRS = { Body: 28, Mind: 20, Spirit: 15, Agility: 35, Charm: 22, Luck: 42 };

const LIB = createSnippetLibrary({
  'road.open':     [{ text: 'The road was long and dry.' }],
  'sensory.dust':  [{ text: 'Dust rose with every step.' }],
  'person.bandit': [{ text: 'a bandit with a crooked grin' }],
});

const BANDIT_EVENT: EventDef = {
  id: 'EV_BANDIT',
  category: 'road.bandit',
  version: 1,
  weight: 100,
  conditions: { regions: ['yellow_plains'] },
  timeCost: 'SHORT',
  text: {
    intro: ['$[road.open] $[sensory.dust]'],
    body:  ['[CHARACTER] met [BANDIT_NAME] — $[person.bandit].'],
    outro: ['The road offered no shelter.'],
  },
  choices: [{
    id: 'ch_fight', label: 'Fight!', timeCost: 'SHORT',
    outcomes: { SUCCESS: { narrativeKey: 'a' }, FAILURE: { narrativeKey: 'b' } },
  }],
  repeat: 'unlimited',
};

describe('narrative render — bandit event end-to-end', () => {
  it('produces a paragraph containing all expected elements', () => {
    const c = createCharacter({ name: 'Lin Wei', attributes: ATTRS, rng: createRng(1) });
    const rs = createRunState({ character: c, runSeed: 42, region: 'yellow_plains', year: 1000, season: 'summer' });

    // Pre-generate a bandit name via registry
    const rng = createRng(rs.runSeed + 1);
    const { name: banditName, registry } = resolveName(
      createNameRegistry(), 'bandit', 'road_A',
      (r) => generatePersonalName(DEFAULT_NAME_POOLS, r), rng,
    );

    const text = renderEvent(BANDIT_EVENT, {
      characterName: rs.character.name,
      region: rs.region,
      season: rs.season,
      realm: rs.character.realm,
      dominantMood: computeDominantMood(zeroMoodInputs()),
      turnIndex: rs.turn,
      runSeed: rs.runSeed,
      extraVariables: { BANDIT_NAME: banditName },
    }, LIB, registry, rng);

    expect(text).toContain('The road was long and dry.');
    expect(text).toContain('Dust rose');
    expect(text).toContain('Lin Wei');
    expect(text).toContain(banditName);
    expect(text).toContain('bandit with a crooked grin');
    expect(text).toContain('The road offered no shelter.');
  });

  it('name registry hit: same slot on re-render returns cached bandit name', () => {
    const rng1 = createRng(42);
    const { name: name1, registry: reg1 } = resolveName(
      createNameRegistry(), 'bandit', 'road_A',
      (r) => generatePersonalName(DEFAULT_NAME_POOLS, r), rng1,
    );
    const rng2 = createRng(9999);
    const { name: name2 } = resolveName(reg1, 'bandit', 'road_A',
      (r) => generatePersonalName(DEFAULT_NAME_POOLS, r), rng2,
    );
    expect(name2).toBe(name1); // cache hit even with different rng
  });

  it('mood bonus integrates with Phase 1B ChoiceResolver signature', async () => {
    // Sanity: computeMoodBonus returns a number that ChoiceResolver can consume.
    const { computeMoodBonus } = await import('@/engine/narrative/MoodBonus');
    const bonus = computeMoodBonus('rage', 'melee_skill');
    expect(typeof bonus).toBe('number');
    expect(bonus).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npm test -- narrative_render_bandit`
Expected: all pass.

- [ ] **Step 3: Run full suite + typecheck + build**

Run: `npm test`
Expected: all green.

Run: `npm run typecheck` — clean.
Run: `npm run build` — success.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/narrative_render_bandit.test.ts
git commit -m "test(integration): bandit event full narrative composition"
```

---

## Exit Criteria Checklist

- [ ] All Task 1–10 commits on branch `phase-1c-narrative-composer`.
- [ ] `npm test` passes. Phase 1C adds ~60 new tests.
- [ ] `npm run typecheck` clean.
- [ ] `npm run build` success.
- [ ] CI green.
- [ ] Every new module has a `*.test.ts` with green assertions.
- [ ] Composer determinism contract verified.
- [ ] `computeMoodBonus(mood, category)` exists and is consumable by Phase 1B's `ChoiceResolver`.
- [ ] No dependency on `src/engine/bardo/`, `src/engine/meta/`, or `src/state/`.

---

## Self-Review Notes

**Spec coverage (§6):**
- §6.1 Architecture — Task 8 (Composer orchestrator) ✔
- §6.2 Event template format — Task 5 (TemplateExpander) ✔
- §6.3 Snippet library — Task 4 ✔
- §6.4 Mood filter — Task 2 (computation) + Task 4 (tag bias in pick) + Task 8 (mood-tag mapping). **Adjective rewrites deferred to Phase 1D.**
- §6.5 Realm lens — **deferred to Phase 1D.**
- §6.6 Interior thought — **deferred to Phase 1D.**
- §6.7 Name generation — Task 6 (personal / sect / place) + Task 7 (registry) ✔. **Technique / manual / era names deferred.**
- §6.8 Time-skip prose — **deferred to Phase 1D.**
- §6.9 Bardo composition — **deferred to Phase 1D.**
- §6.10 Determinism contract — Task 9 ✔

**Phase 1B handoff — filling the stub:**
- Phase 1B's `ChoiceResolver.moodBonus` was stubbed zero. Phase 1C ships `computeMoodBonus(mood, category)` in Task 3. Phase 1D's GameLoop will call it: `moodBonus: computeMoodBonus(computeDominantMood(inputs), check.category)`.

**Placeholder scan:** none. Every step has complete code.

**Type consistency:**
- `SnippetLibrary` interface defined in Task 4 (`has`, `get`), consumed by Tasks 5 + 8.
- `NameRegistry.slots` dotted-key format (`archetype:slotId`) consistent across Tasks 7 + 8 + 10.
- `CompositionContext` shape defined in Task 8, consumed by Tasks 9 + 10.
- `expandTemplate`'s `ExpandContext` introduced in Task 5, used by Task 8.
- `Mood` union → `MOOD_TAG_PREFERENCES` maps every Mood value (enforced by exhaustive `Record<Mood, ...>`).

**Phase 1D handoff notes:**
- Realm-lens injection should happen as a post-pass on `renderEvent`'s output, keyed on `ctx.realm`.
- Interior-thought beats are another post-pass with ~30% rate, tag-biased by mood.
- Time-skip prose for EPOCH timeCost events gets a dedicated category of montage snippets, selected before intro.
- Name generator needs a technique + manual name pool. Extend `NamePools`.
- The full `CompositionContext` should be derivable from `RunState + currentEvent + turnIndex`. Phase 1D GameLoop will construct it.

**Gaps:** none against Phase 1C's scope.
