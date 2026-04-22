# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the engine foundation — dependencies, directory layout, seeded RNG, EventBus, state machine, SaveManager, migrator, store skeletons — and boot the app to an empty TitleScreen. Zero gameplay; zero content. Everything green on tests and build.

**Architecture:** Pure client-side React 19 + TS + Vite. Engine is a collection of small pure-function modules under `src/engine/`. State lives in zustand stores. Content is JSON validated with zod at load time. All RNG is seed-stable. Saves are envelope-wrapped and versioned with an explicit migrator chain.

**Tech Stack:** React 19, TypeScript ~5.8, Vite 6, Vitest 2 (+ jsdom), Zustand 4, Zod 3, idb 8.

**Source of truth:** `docs/spec/design.md` (§2, §10, §12 are the sections this plan implements).

**Scope boundaries (out of Phase 0):** character creation, events, composer, content schemas (beyond a loader stub), full UI — all belong to Phase 1+.

---

## Task Map

1. Remove Gemini dependency, clean baseline
2. Install & configure Vitest
3. Install engine runtime dependencies
4. Scaffold directory structure + path aliases
5. Shared engine primitive types
6. `hash` utility (FNV-1a 32-bit)
7. `RNG` — seeded Mulberry32 PRNG
8. `EventBus` — typed pub/sub
9. `GamePhase` StateMachine
10. `SaveManager` — localStorage envelope with atomic swap
11. `Migrator` — chained schema migrations
12. Zustand store skeletons (`gameStore`, `metaStore`, `settingsStore`)
13. Zod content loader stub
14. Engine public interface (`engineBridge`) stubs
15. `TitleScreen` component + wire `App.tsx`
16. CI workflow (GitHub Actions)
17. Final green-bar verification

Frequent commits. TDD for every logic-bearing module.

---

## Task 1: Remove Gemini dependency, clean baseline

**Rationale:** Spec §1.4 / §12.10 explicitly remove all LLM dependencies. Do this first so nothing downstream drags in `@google/genai`.

**Files:**
- Modify: `package.json`
- Delete: `services/geminiService.ts`
- Modify: `App.tsx` (temporarily stub to a minimal placeholder so it still compiles)
- Modify: `types.ts` (retain current exports; we will expand in later tasks)

- [ ] **Step 1: Remove `@google/genai` from `package.json` and reinstall**

Edit `package.json` to drop the dependency:

```json
{
  "name": "wuxia-dungeon-rpg",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "lucide-react": "^0.554.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.0"
  }
}
```

Then:

```bash
npm install
```

- [ ] **Step 2: Delete the Gemini service file**

```bash
rm services/geminiService.ts
rmdir services 2>/dev/null || true
```

- [ ] **Step 3: Replace `App.tsx` with a minimal placeholder so the project compiles**

Full file:

```tsx
import React from 'react';

export default function App() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-ink-900 text-parchment-100 font-serif">
      <div className="text-center">
        <h1 className="text-3xl mb-4">The Thousand Deaths of a Would-Be Immortal</h1>
        <p className="text-parchment-400">Rebuilding the world&hellip;</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify the build still works**

```bash
npm run build
```

Expected: a `dist/` output with no errors. Warnings about unused existing components (`SetupScreen`, `StatusPanel`, `StoryPanel`) are acceptable — they'll be rewired in Phase 1.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json App.tsx
git rm services/geminiService.ts
git commit -m "chore: remove Gemini dependency, stub App for v2 rebuild"
```

---

## Task 2: Install & configure Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/sanity.test.ts`

- [ ] **Step 1: Install Vitest and jsdom**

```bash
npm install -D vitest @vitest/ui jsdom
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'tests/', 'dist/'],
    },
  },
});
```

- [ ] **Step 3: Create `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';

// Wipe browser storage between tests.
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
```

Then add the peer dep:

```bash
npm install -D @testing-library/jest-dom
```

- [ ] **Step 4: Write a sanity test**

Create `tests/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('has a jsdom environment', () => {
    expect(typeof window).toBe('object');
    expect(typeof localStorage).toBe('object');
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: 2 passed, 0 failed.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/setup.ts tests/sanity.test.ts package.json package-lock.json
git commit -m "build: add vitest + jsdom test harness"
```

---

## Task 3: Install engine runtime dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install zustand zod idb
```

- [ ] **Step 2: Verify package.json reflects the installs**

Expected `dependencies` now includes `zustand`, `zod`, `idb` alongside React.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add zustand, zod, idb runtime deps"
```

---

## Task 4: Scaffold directory structure + path aliases

**Rationale:** Lay out the full directory tree specified in `docs/spec/design.md` §12. Empty index files keep imports tidy and let later tasks drop code in without scaffolding again.

**Files:**
- Create: `src/main.tsx` (move React root from current setup if needed)
- Create: `src/App.tsx` (move the placeholder from root)
- Delete: `App.tsx` (root), `index.tsx` (root) — replaced by `src/App.tsx` and `src/main.tsx`
- Modify: `index.html` (update entry path)
- Modify: `tsconfig.json` (path aliases)
- Modify: `vite.config.ts` (path alias)
- Create: empty directory markers via placeholder `index.ts` files

- [ ] **Step 1: Read existing `index.tsx` and `index.html` to preserve mount point**

```bash
cat index.tsx
cat index.html
```

- [ ] **Step 2: Move entrypoint into `src/`**

Create `src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element found');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Move the placeholder `App.tsx` content into `src/App.tsx` (identical content to Task 1 Step 3).

Create `src/index.css` as a placeholder:

```css
/* Tailwind / custom styles are loaded via index.html CDN per existing setup. */
/* Intentionally empty for Phase 0. */
```

- [ ] **Step 3: Update `index.html` entry**

Change the script tag that previously pointed to `/index.tsx` to `/src/main.tsx`:

```html
<script type="module" src="/src/main.tsx"></script>
```

- [ ] **Step 4: Delete old root-level files**

```bash
rm App.tsx index.tsx
```

- [ ] **Step 5: Update `tsconfig.json`**

Full file:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "allowJs": false,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 6: Update `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 7: Create engine directory tree with placeholder indexes**

```bash
mkdir -p src/engine/core src/engine/character src/engine/cultivation \
         src/engine/choices src/engine/events src/engine/narrative \
         src/engine/world src/engine/meta src/engine/persistence src/engine/bardo \
         src/content/events src/content/snippets src/content/techniques \
         src/content/items src/content/manuals src/content/echoes \
         src/content/memories src/content/anchors src/content/regions \
         src/content/factions src/content/eras src/content/names \
         src/content/npcs src/content/pillars \
         src/state src/components src/hooks src/services src/utils
```

Create an `index.ts` placeholder in each engine subdir so the folder isn't git-empty:

```ts
// Placeholder to keep directory tracked; will be replaced as modules are added.
export {};
```

Do this for: `src/engine/index.ts`, and each of `src/engine/core/index.ts`, `src/engine/character/index.ts`, etc.

- [ ] **Step 8: Move existing components into `src/components/`**

```bash
git mv components/SetupScreen.tsx src/components/
git mv components/StatusPanel.tsx src/components/
git mv components/StoryPanel.tsx src/components/
rmdir components
```

These files import relative paths from the old location. They currently reference `../types` etc. Temporarily leave them; Task 5 will relocate `types.ts`. They're not mounted in Phase 0.

- [ ] **Step 9: Verify build and tests still pass**

```bash
npm run typecheck
npm test
npm run build
```

Expected: all green. If `src/components/*.tsx` files reference types, they may fail typecheck — in that case, add `// @ts-nocheck` at the top of each temporarily (Phase 1 will fix them properly). Record any nocheck'd files in the commit message.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: move entry to src/ and scaffold engine directory tree"
```

---

## Task 5: Shared engine primitive types

**Files:**
- Move: `types.ts` → `src/engine/core/Types.ts` (overwrite)
- Create: `src/engine/core/Types.test.ts`

**Rationale:** Establish the canonical type set that later modules import. Replaces the legacy `types.ts` with the spec's expanded type surface.

- [ ] **Step 1: Delete old root `types.ts` and create new canonical types**

```bash
git rm types.ts
```

Create `src/engine/core/Types.ts`:

```ts
// Canonical primitive types. Imported everywhere. Keep this file free of behavior.
// Source of truth: docs/spec/design.md §2, §3, §4, §5, §7.

export enum GamePhase {
  TITLE = 'TITLE',
  CREATION = 'CREATION',
  PLAYING = 'PLAYING',
  BARDO = 'BARDO',
  CODEX = 'CODEX',
  GAME_OVER_FINAL = 'GAME_OVER_FINAL',
}

export type Stat = 'Body' | 'Mind' | 'Spirit' | 'Agility' | 'Charm' | 'Luck';
export const STATS: readonly Stat[] = ['Body', 'Mind', 'Spirit', 'Agility', 'Charm', 'Luck'] as const;

export type Element = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'none';

export enum Realm {
  MORTAL = 'mortal',
  BODY_TEMPERING = 'body_tempering',
  QI_SENSING = 'qi_sensing',
  QI_CONDENSATION = 'qi_condensation',
  FOUNDATION = 'foundation',
  CORE = 'core',
  NASCENT_SOUL = 'nascent_soul',
  SOUL_TRANSFORMATION = 'soul_transformation',
  VOID_REFINEMENT = 'void_refinement',
  IMMORTAL = 'immortal',
}

export const REALM_ORDER: readonly Realm[] = [
  Realm.MORTAL,
  Realm.BODY_TEMPERING,
  Realm.QI_SENSING,
  Realm.QI_CONDENSATION,
  Realm.FOUNDATION,
  Realm.CORE,
  Realm.NASCENT_SOUL,
  Realm.SOUL_TRANSFORMATION,
  Realm.VOID_REFINEMENT,
  Realm.IMMORTAL,
] as const;

export type Mood = 'sorrow' | 'rage' | 'serenity' | 'paranoia' | 'resolve' | 'melancholy';
export const MOODS: readonly Mood[] = ['sorrow', 'rage', 'serenity', 'paranoia', 'resolve', 'melancholy'] as const;

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type TimeCost = 'INSTANT' | 'SHORT' | 'MEDIUM' | 'LONG' | 'EPOCH';

export type OutcomeTier = 'CRIT_SUCCESS' | 'SUCCESS' | 'PARTIAL' | 'FAILURE' | 'CRIT_FAILURE';

export type DeathCause =
  | 'starvation' | 'disease' | 'old_age'
  | 'combat_melee' | 'combat_qi' | 'poison'
  | 'betrayal' | 'tribulation' | 'qi_deviation'
  | 'cripple_wasting' | 'suicide_ritual' | 'heavenly_intervention'
  | 'karmic_hunter' | 'self_sacrifice' | 'love_death' | 'madness'
  | 'drowning' | 'beast' | 'demonic_corruption' | 'childbirth';

export type NoticeTier = 'baseline' | 'awakening' | 'noticed' | 'marked' | 'watched' | 'heir_of_void';

export function noticeTierFor(value: number): NoticeTier {
  if (value >= 100) return 'heir_of_void';
  if (value >= 75)  return 'watched';
  if (value >= 50)  return 'marked';
  if (value >= 25)  return 'noticed';
  if (value >= 10)  return 'awakening';
  return 'baseline';
}

// ---- Types used by the existing UI components during Phase 0 ----
// Kept for backward-compatibility so src/components/* still typecheck.
// Phase 1 will redesign these.

export interface CharacterStatus {
  date: string;
  location: string;
  name: string;
  age: string;
  realm: string;
  cp: string | number;
  root: string;
  activeArts: string[];
  inventory: {
    weapon: string;
    equipment: string[];
    bag: string[];
  };
  relations: string[];
}

export interface GameChoice {
  id: number;
  text: string;
  subtext?: string;
}

export interface TurnData {
  narrative: string;
  status: CharacterStatus;
  choices: GameChoice[];
}
```

- [ ] **Step 2: Write tests for the notice tier derivation (the only behavior in this file)**

Create `src/engine/core/Types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { noticeTierFor } from './Types';

describe('noticeTierFor', () => {
  it.each([
    [0,   'baseline'],
    [9,   'baseline'],
    [10,  'awakening'],
    [24,  'awakening'],
    [25,  'noticed'],
    [49,  'noticed'],
    [50,  'marked'],
    [74,  'marked'],
    [75,  'watched'],
    [99,  'watched'],
    [100, 'heir_of_void'],
    [250, 'heir_of_void'],
  ])('value %i maps to %s', (value, expected) => {
    expect(noticeTierFor(value)).toBe(expected);
  });
});
```

- [ ] **Step 3: Run the test**

```bash
npm test -- Types
```

Expected: 12 assertions pass.

- [ ] **Step 4: Fix any existing component imports that referenced old `types.ts`**

The files `src/components/SetupScreen.tsx`, `StatusPanel.tsx`, `StoryPanel.tsx` imported from `'../types'`. Change each to:

```ts
import { /* ... */ } from '@/engine/core/Types';
```

Remove any `@ts-nocheck` pragmas added in Task 4 that are no longer needed. Run typecheck:

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(engine): canonical primitive types + notice tier derivation"
```

---

## Task 6: `hash` utility (FNV-1a 32-bit)

**Rationale:** Needed by the RNG to derive per-turn seeds from `(runSeed, turnIndex, eventId)` (spec §6.10 determinism contract).

**Files:**
- Create: `src/utils/hash.ts`
- Create: `src/utils/hash.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/hash.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fnv1a32, hashSeed } from './hash';

describe('fnv1a32', () => {
  it('is deterministic for the same input', () => {
    expect(fnv1a32('lin wei')).toBe(fnv1a32('lin wei'));
  });

  it('differs across different inputs', () => {
    expect(fnv1a32('a')).not.toBe(fnv1a32('b'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = fnv1a32('anything');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(h)).toBe(true);
  });

  it('matches known vector for empty string', () => {
    // FNV-1a offset basis
    expect(fnv1a32('')).toBe(0x811c9dc5);
  });

  it('produces different hashes for single-character inputs', () => {
    const seen = new Set<number>();
    for (const c of 'abcdefghij') seen.add(fnv1a32(c));
    expect(seen.size).toBe(10);
  });
});

describe('hashSeed', () => {
  it('combines seed + parts deterministically', () => {
    expect(hashSeed(42, 'turn', 7)).toBe(hashSeed(42, 'turn', 7));
  });

  it('order matters', () => {
    expect(hashSeed(1, 'a', 'b')).not.toBe(hashSeed(1, 'b', 'a'));
  });

  it('seed change produces different output', () => {
    expect(hashSeed(1, 'x')).not.toBe(hashSeed(2, 'x'));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npm test -- hash
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/utils/hash.ts`:

```ts
// FNV-1a 32-bit hash. Used for seed derivation only — not cryptographic.
// See spec §6.10.

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Multiply by FNV prime mod 2^32
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Derive a 32-bit seed from a base seed plus ordered parts.
 * Parts are stringified and concatenated with NUL separators (NUL cannot appear
 * in a normal identifier so collisions across distinct part sequences are rare).
 */
export function hashSeed(baseSeed: number, ...parts: Array<string | number>): number {
  const joined = parts.map((p) => String(p)).join('\u0000');
  const h = fnv1a32(joined);
  // Mix with base seed using xor + FNV prime multiplication
  return (Math.imul(h ^ baseSeed, FNV_PRIME) >>> 0);
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- hash
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/hash.ts src/utils/hash.test.ts
git commit -m "feat(utils): fnv1a32 hash + hashSeed derivation"
```

---

## Task 7: `RNG` — seeded Mulberry32 PRNG

**Rationale:** The entire game's determinism rests on this module. Every RNG call in the engine goes through `RNG`. See spec §5.3 (probability resolver uses `seededD100`) and §6.10.

**Files:**
- Create: `src/engine/core/RNG.ts`
- Create: `src/engine/core/RNG.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/engine/core/RNG.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng, Rng } from './RNG';

describe('RNG', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('differs for different seeds', () => {
    const a = createRng(1).next();
    const b = createRng(2).next();
    expect(a).not.toBe(b);
  });

  it('returns values in [0, 1)', () => {
    const rng = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('d100 returns integers in [1, 100]', () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 10_000; i++) {
      const v = rng.d100();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
      seen.add(v);
    }
    expect(seen.size).toBe(100);
  });

  it('d100 mean is approximately 50.5 over many rolls', () => {
    const rng = createRng(12345);
    let sum = 0;
    const N = 50_000;
    for (let i = 0; i < N; i++) sum += rng.d100();
    const mean = sum / N;
    expect(mean).toBeGreaterThan(49);
    expect(mean).toBeLessThan(52);
  });

  it('intRange is inclusive on both ends', () => {
    const rng = createRng(9);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(rng.intRange(3, 7));
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it('pick selects from an array', () => {
    const rng = createRng(5);
    const arr = ['a', 'b', 'c', 'd'];
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(rng.pick(arr));
    expect(seen).toEqual(new Set(arr));
  });

  it('weightedPick respects weights (rough distribution)', () => {
    const rng = createRng(13);
    const items: Array<{ v: string; w: number }> = [
      { v: 'a', w: 1 },
      { v: 'b', w: 9 },
    ];
    const counts = { a: 0, b: 0 };
    const N = 10_000;
    for (let i = 0; i < N; i++) counts[rng.weightedPick(items, (x) => x.w).v]++;
    // b should dominate — accept >80% for b within tolerance
    expect(counts.b / N).toBeGreaterThan(0.85);
    expect(counts.a / N).toBeGreaterThan(0.05);
  });

  it('derive produces a stable child Rng from ordered parts', () => {
    const parent = createRng(100);
    const a = parent.derive('turn', 1);
    const b = parent.derive('turn', 1);
    expect(a.next()).toBe(b.next());
    const c = parent.derive('turn', 2);
    expect(c.next()).not.toBe(a.next()); // different part sequence
  });

  it('exposes current seed and resumes from it', () => {
    const rng = createRng(77);
    rng.next();
    rng.next();
    const frozen = rng.state();
    const resumed = Rng.fromState(frozen);
    expect(resumed.next()).toBe(createRng(77).next_nth(3));
  });
});
```

- [ ] **Step 2: Run it to verify failure**

```bash
npm test -- RNG
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement Mulberry32 RNG**

Create `src/engine/core/RNG.ts`:

```ts
// Seeded deterministic PRNG. Mulberry32 chosen for:
//   - tiny state (32 bits)
//   - easy to serialise
//   - adequate statistical quality for game decisions
// Cryptographic strength NOT a requirement; determinism IS.
//
// Every random decision in the engine MUST go through this module.
// Direct calls to Math.random() are forbidden at build time (see eslint rule in a later task).

import { hashSeed } from '@/utils/hash';

export interface RngState {
  readonly seed: number; // original seed, for reference
  readonly cursor: number; // advanced on each next()
}

export interface IRng {
  next(): number;                           // [0, 1)
  d100(): number;                           // [1, 100]
  intRange(lo: number, hi: number): number; // inclusive both ends
  pick<T>(arr: readonly T[]): T;
  weightedPick<T>(items: readonly T[], weightOf: (t: T) => number): T;
  derive(...parts: Array<string | number>): IRng;
  state(): RngState;
  /** For tests / debugging only. Not part of the engine contract. */
  next_nth(n: number): number;
}

export class Rng implements IRng {
  private s: number;

  constructor(private readonly original: number, cursor: number) {
    // Mulberry32 state is a 32-bit int.
    this.s = cursor >>> 0;
  }

  static fromState(state: RngState): Rng {
    return new Rng(state.seed, state.cursor);
  }

  next(): number {
    // Mulberry32
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  d100(): number {
    return Math.floor(this.next() * 100) + 1;
  }

  intRange(lo: number, hi: number): number {
    if (hi < lo) throw new Error(`intRange: hi (${hi}) < lo (${lo})`);
    const span = hi - lo + 1;
    return lo + Math.floor(this.next() * span);
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('pick: empty array');
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  weightedPick<T>(items: readonly T[], weightOf: (t: T) => number): T {
    if (items.length === 0) throw new Error('weightedPick: empty items');
    let total = 0;
    for (const it of items) {
      const w = weightOf(it);
      if (w < 0) throw new Error('weightedPick: negative weight');
      total += w;
    }
    if (total <= 0) throw new Error('weightedPick: total weight = 0');
    let roll = this.next() * total;
    for (const it of items) {
      roll -= weightOf(it);
      if (roll <= 0) return it;
    }
    // Floating-point fallthrough
    return items[items.length - 1]!;
  }

  derive(...parts: Array<string | number>): IRng {
    const childSeed = hashSeed(this.s, ...parts);
    return new Rng(childSeed, childSeed);
  }

  state(): RngState {
    return { seed: this.original, cursor: this.s };
  }

  next_nth(n: number): number {
    let last = 0;
    for (let i = 0; i < n; i++) last = this.next();
    return last;
  }
}

export function createRng(seed: number): IRng {
  const s = (seed | 0) >>> 0;
  return new Rng(s, s);
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- RNG
```

Expected: all assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/engine/core/RNG.ts src/engine/core/RNG.test.ts
git commit -m "feat(engine): seeded Mulberry32 RNG with derivation"
```

---

## Task 8: `EventBus` — typed pub/sub

**Rationale:** Internal pub/sub for cross-module hooks (e.g. meta module listens to "death" events fired by the run module). Kept small and synchronous. See spec §12.2.

**Files:**
- Create: `src/engine/core/EventBus.ts`
- Create: `src/engine/core/EventBus.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/engine/core/EventBus.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from './EventBus';

type Events = {
  turnComplete: { turnIndex: number };
  death: { cause: string };
};

describe('EventBus', () => {
  it('delivers events to subscribers', () => {
    const bus = createEventBus<Events>();
    const spy = vi.fn();
    bus.on('turnComplete', spy);
    bus.emit('turnComplete', { turnIndex: 3 });
    expect(spy).toHaveBeenCalledWith({ turnIndex: 3 });
  });

  it('delivers to all subscribers of the same event', () => {
    const bus = createEventBus<Events>();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('death', a);
    bus.on('death', b);
    bus.emit('death', { cause: 'old_age' });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('isolates events by key', () => {
    const bus = createEventBus<Events>();
    const spy = vi.fn();
    bus.on('turnComplete', spy);
    bus.emit('death', { cause: 'starvation' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('off removes a subscription', () => {
    const bus = createEventBus<Events>();
    const spy = vi.fn();
    const off = bus.on('turnComplete', spy);
    off();
    bus.emit('turnComplete', { turnIndex: 1 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('once delivers exactly one event', () => {
    const bus = createEventBus<Events>();
    const spy = vi.fn();
    bus.once('turnComplete', spy);
    bus.emit('turnComplete', { turnIndex: 1 });
    bus.emit('turnComplete', { turnIndex: 2 });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith({ turnIndex: 1 });
  });

  it('errors in one subscriber do not prevent others from firing', () => {
    const bus = createEventBus<Events>();
    const thrower = vi.fn(() => { throw new Error('boom'); });
    const ok = vi.fn();
    bus.on('death', thrower);
    bus.on('death', ok);
    expect(() => bus.emit('death', { cause: 'beast' })).not.toThrow();
    expect(ok).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

```bash
npm test -- EventBus
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/engine/core/EventBus.ts`:

```ts
// Tiny synchronous typed pub/sub.
// Used inside the engine for cross-module notifications.
// Intentionally NOT exposed to React components — React talks to the engine
// through the engineBridge, not this bus.

export type EventMap = Record<string, unknown>;

export type Handler<P> = (payload: P) => void;

export interface EventBus<E extends EventMap> {
  on<K extends keyof E>(key: K, handler: Handler<E[K]>): () => void;
  once<K extends keyof E>(key: K, handler: Handler<E[K]>): () => void;
  off<K extends keyof E>(key: K, handler: Handler<E[K]>): void;
  emit<K extends keyof E>(key: K, payload: E[K]): void;
}

export function createEventBus<E extends EventMap>(): EventBus<E> {
  const handlers = new Map<keyof E, Set<Handler<unknown>>>();

  function on<K extends keyof E>(key: K, handler: Handler<E[K]>): () => void {
    let set = handlers.get(key);
    if (!set) {
      set = new Set();
      handlers.set(key, set);
    }
    set.add(handler as Handler<unknown>);
    return () => off(key, handler);
  }

  function once<K extends keyof E>(key: K, handler: Handler<E[K]>): () => void {
    const wrapper: Handler<E[K]> = (p) => {
      off(key, wrapper);
      handler(p);
    };
    return on(key, wrapper);
  }

  function off<K extends keyof E>(key: K, handler: Handler<E[K]>): void {
    const set = handlers.get(key);
    if (!set) return;
    set.delete(handler as Handler<unknown>);
  }

  function emit<K extends keyof E>(key: K, payload: E[K]): void {
    const set = handlers.get(key);
    if (!set) return;
    // Clone so mutations during iteration don't break us.
    for (const h of [...set]) {
      try {
        (h as Handler<E[K]>)(payload);
      } catch (err) {
        // Swallow + report. One bad subscriber cannot break the emit loop.
        // eslint-disable-next-line no-console
        console.error(`[EventBus] handler error for "${String(key)}":`, err);
      }
    }
  }

  return { on, once, off, emit };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- EventBus
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/core/EventBus.ts src/engine/core/EventBus.test.ts
git commit -m "feat(engine): typed synchronous EventBus"
```

---

## Task 9: `GamePhase` StateMachine

**Rationale:** Centralised allowed-transition table. Prevents illegal phase changes (e.g. `PLAYING → CREATION` without going through BARDO).

**Files:**
- Create: `src/engine/core/StateMachine.ts`
- Create: `src/engine/core/StateMachine.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/engine/core/StateMachine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GamePhase } from './Types';
import { createPhaseMachine } from './StateMachine';

describe('PhaseMachine', () => {
  it('starts at TITLE', () => {
    const m = createPhaseMachine();
    expect(m.phase()).toBe(GamePhase.TITLE);
  });

  it('allows TITLE -> CREATION', () => {
    const m = createPhaseMachine();
    m.transition(GamePhase.CREATION);
    expect(m.phase()).toBe(GamePhase.CREATION);
  });

  it('allows CREATION -> PLAYING', () => {
    const m = createPhaseMachine();
    m.transition(GamePhase.CREATION);
    m.transition(GamePhase.PLAYING);
    expect(m.phase()).toBe(GamePhase.PLAYING);
  });

  it('allows PLAYING -> BARDO', () => {
    const m = createPhaseMachine();
    m.transition(GamePhase.CREATION);
    m.transition(GamePhase.PLAYING);
    m.transition(GamePhase.BARDO);
    expect(m.phase()).toBe(GamePhase.BARDO);
  });

  it('allows BARDO -> CREATION', () => {
    const m = createPhaseMachine();
    m.transition(GamePhase.CREATION);
    m.transition(GamePhase.PLAYING);
    m.transition(GamePhase.BARDO);
    m.transition(GamePhase.CREATION);
    expect(m.phase()).toBe(GamePhase.CREATION);
  });

  it('rejects PLAYING -> CREATION (must go through BARDO)', () => {
    const m = createPhaseMachine();
    m.transition(GamePhase.CREATION);
    m.transition(GamePhase.PLAYING);
    expect(() => m.transition(GamePhase.CREATION))
      .toThrow(/illegal transition/i);
    expect(m.phase()).toBe(GamePhase.PLAYING);
  });

  it('allows CODEX as a modal overlay from TITLE, PLAYING, BARDO', () => {
    for (const from of [GamePhase.TITLE, GamePhase.PLAYING, GamePhase.BARDO]) {
      const m = createPhaseMachine(from);
      m.transition(GamePhase.CODEX);
      expect(m.phase()).toBe(GamePhase.CODEX);
      // and back
      m.transition(from);
      expect(m.phase()).toBe(from);
    }
  });

  it('GAME_OVER_FINAL is terminal from any state (except itself)', () => {
    const m = createPhaseMachine();
    m.transition(GamePhase.CREATION);
    m.transition(GamePhase.PLAYING);
    m.transition(GamePhase.GAME_OVER_FINAL);
    expect(m.phase()).toBe(GamePhase.GAME_OVER_FINAL);
    expect(() => m.transition(GamePhase.PLAYING))
      .toThrow(/illegal transition/i);
  });

  it('exposes canTransition() without throwing', () => {
    const m = createPhaseMachine();
    expect(m.canTransition(GamePhase.CREATION)).toBe(true);
    expect(m.canTransition(GamePhase.PLAYING)).toBe(false);
    expect(m.canTransition(GamePhase.BARDO)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

```bash
npm test -- StateMachine
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/core/StateMachine.ts`:

```ts
import { GamePhase } from './Types';

// Adjacency: from → set of allowed destinations.
// CODEX is allowed as an overlay from TITLE / PLAYING / BARDO, and can return
// to the same phase it came from. We enforce "return to origin" by storing
// the previous phase when entering CODEX.
const allowed: Record<GamePhase, ReadonlySet<GamePhase>> = {
  [GamePhase.TITLE]: new Set([GamePhase.CREATION, GamePhase.CODEX]),
  [GamePhase.CREATION]: new Set([GamePhase.PLAYING, GamePhase.TITLE]),
  [GamePhase.PLAYING]: new Set([GamePhase.BARDO, GamePhase.CODEX, GamePhase.GAME_OVER_FINAL]),
  [GamePhase.BARDO]: new Set([GamePhase.CREATION, GamePhase.CODEX, GamePhase.GAME_OVER_FINAL]),
  [GamePhase.CODEX]: new Set([/* set dynamically based on whence */]),
  [GamePhase.GAME_OVER_FINAL]: new Set([GamePhase.TITLE]),
};

export interface PhaseMachine {
  phase(): GamePhase;
  canTransition(next: GamePhase): boolean;
  transition(next: GamePhase): void;
}

export function createPhaseMachine(initial: GamePhase = GamePhase.TITLE): PhaseMachine {
  let current = initial;
  let codexReturn: GamePhase | null = null;

  function canTransition(next: GamePhase): boolean {
    if (current === GamePhase.CODEX) {
      // Only legal return is to the phase we came from.
      return codexReturn === next;
    }
    return allowed[current].has(next);
  }

  function transition(next: GamePhase): void {
    if (!canTransition(next)) {
      throw new Error(`illegal transition: ${current} -> ${next}`);
    }
    if (next === GamePhase.CODEX) {
      codexReturn = current;
    } else if (current === GamePhase.CODEX) {
      codexReturn = null;
    }
    current = next;
  }

  return {
    phase: () => current,
    canTransition,
    transition,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- StateMachine
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/core/StateMachine.ts src/engine/core/StateMachine.test.ts
git commit -m "feat(engine): GamePhase state machine with legal transitions"
```

---

## Task 10: `SaveManager` — localStorage envelope with atomic swap

**Rationale:** All reads/writes to persistent storage go through this. Envelope carries schemaVersion so the migrator can upgrade old saves. Atomic swap prevents half-written state on crash. See spec §10.

**Files:**
- Create: `src/engine/persistence/SaveManager.ts`
- Create: `src/engine/persistence/SaveManager.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/engine/persistence/SaveManager.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createSaveManager, SaveEnvelope } from './SaveManager';

interface Demo { greeting: string; count: number }

describe('SaveManager', () => {
  let sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });

  beforeEach(() => {
    localStorage.clear();
    sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
  });

  it('returns null when key not present', () => {
    expect(sm.load<Demo>('wdr.run')).toBeNull();
  });

  it('round-trips data through envelope', () => {
    sm.save<Demo>('wdr.run', { greeting: 'hello', count: 3 }, 1);
    const env = sm.load<Demo>('wdr.run');
    expect(env).not.toBeNull();
    expect(env!.schemaVersion).toBe(1);
    expect(env!.gameVersion).toBe('0.1.0');
    expect(env!.data).toEqual({ greeting: 'hello', count: 3 });
    expect(typeof env!.createdAt).toBe('string');
    expect(typeof env!.updatedAt).toBe('string');
  });

  it('preserves createdAt across subsequent saves but updates updatedAt', async () => {
    sm.save<Demo>('wdr.run', { greeting: 'a', count: 1 }, 1);
    const first = sm.load<Demo>('wdr.run')!;
    // Sleep a millisecond so updatedAt differs reliably.
    await new Promise((r) => setTimeout(r, 2));
    sm.save<Demo>('wdr.run', { greeting: 'b', count: 2 }, 1);
    const second = sm.load<Demo>('wdr.run')!;
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).not.toBe(first.updatedAt);
    expect(second.data.greeting).toBe('b');
  });

  it('uses atomic swap (tmp key cleared after save)', () => {
    sm.save<Demo>('wdr.run', { greeting: 'x', count: 0 }, 1);
    expect(localStorage.getItem('wdr.run.__tmp__')).toBeNull();
    expect(localStorage.getItem('wdr.run')).not.toBeNull();
  });

  it('recovers from a leftover tmp key (prior crash) on next load', () => {
    // Simulate prior crash: tmp present, main missing.
    const env: SaveEnvelope<Demo> = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gameVersion: '0.1.0',
      data: { greeting: 'rescued', count: 9 },
    };
    localStorage.setItem('wdr.run.__tmp__', JSON.stringify(env));
    const loaded = sm.load<Demo>('wdr.run');
    expect(loaded?.data).toEqual({ greeting: 'rescued', count: 9 });
    // Recovery promoted tmp to main.
    expect(localStorage.getItem('wdr.run')).not.toBeNull();
    expect(localStorage.getItem('wdr.run.__tmp__')).toBeNull();
  });

  it('clear removes both main and tmp', () => {
    sm.save<Demo>('wdr.run', { greeting: 'bye', count: 0 }, 1);
    localStorage.setItem('wdr.run.__tmp__', 'leftover');
    sm.clear('wdr.run');
    expect(localStorage.getItem('wdr.run')).toBeNull();
    expect(localStorage.getItem('wdr.run.__tmp__')).toBeNull();
  });

  it('throws on malformed JSON in stored envelope', () => {
    localStorage.setItem('wdr.run', 'not-json{');
    expect(() => sm.load<Demo>('wdr.run')).toThrow(/corrupt/i);
  });

  it('throws on envelope missing required fields', () => {
    localStorage.setItem('wdr.run', JSON.stringify({ hello: 'world' }));
    expect(() => sm.load<Demo>('wdr.run')).toThrow(/invalid envelope/i);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

```bash
npm test -- SaveManager
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/persistence/SaveManager.ts`:

```ts
// Envelope-wrapped localStorage persistence with atomic swap.
// See docs/spec/design.md §10.

export interface SaveEnvelope<T> {
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  gameVersion: string;
  data: T;
}

export interface SaveManager {
  load<T>(key: string): SaveEnvelope<T> | null;
  save<T>(key: string, data: T, schemaVersion: number): void;
  clear(key: string): void;
}

export interface SaveManagerOptions {
  /** Accessor so jsdom's localStorage can be injected and swapped for IDB later. */
  storage: () => Storage;
  gameVersion: string;
  now?: () => string;
}

const TMP_SUFFIX = '.__tmp__';

export function createSaveManager(opts: SaveManagerOptions): SaveManager {
  const now = opts.now ?? (() => new Date().toISOString());

  function readEnvelope<T>(key: string): SaveEnvelope<T> | null {
    const raw = opts.storage().getItem(key);
    if (raw == null) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`corrupt save at "${key}": JSON parse failed`);
    }
    if (!isEnvelope<T>(parsed)) {
      throw new Error(`invalid envelope at "${key}": missing required fields`);
    }
    return parsed;
  }

  function load<T>(key: string): SaveEnvelope<T> | null {
    // Crash recovery: if a tmp exists with no main, promote tmp.
    const tmpKey = key + TMP_SUFFIX;
    const tmp = opts.storage().getItem(tmpKey);
    const main = opts.storage().getItem(key);
    if (tmp != null && main == null) {
      opts.storage().setItem(key, tmp);
      opts.storage().removeItem(tmpKey);
    } else if (tmp != null && main != null) {
      // Both present → discard tmp (previous save succeeded after tmp written).
      opts.storage().removeItem(tmpKey);
    }
    return readEnvelope<T>(key);
  }

  function save<T>(key: string, data: T, schemaVersion: number): void {
    const existing = readEnvelope<T>(key);
    const envelope: SaveEnvelope<T> = {
      schemaVersion,
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
      gameVersion: opts.gameVersion,
      data,
    };
    const serialised = JSON.stringify(envelope);
    const tmpKey = key + TMP_SUFFIX;
    // Atomic-ish swap: write tmp, overwrite main, clear tmp.
    // If we crash mid-write, load() recovers.
    opts.storage().setItem(tmpKey, serialised);
    opts.storage().setItem(key, serialised);
    opts.storage().removeItem(tmpKey);
  }

  function clear(key: string): void {
    opts.storage().removeItem(key);
    opts.storage().removeItem(key + TMP_SUFFIX);
  }

  return { load, save, clear };
}

function isEnvelope<T>(v: unknown): v is SaveEnvelope<T> {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.schemaVersion === 'number'
    && typeof o.createdAt === 'string'
    && typeof o.updatedAt === 'string'
    && typeof o.gameVersion === 'string'
    && 'data' in o
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- SaveManager
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/persistence/SaveManager.ts src/engine/persistence/SaveManager.test.ts
git commit -m "feat(persistence): SaveManager with envelope + atomic swap"
```

---

## Task 11: `Migrator` — chained schema migrations

**Rationale:** When a save's schemaVersion < current, run registered migrations in order. Missing steps = loud error. See spec §10.4.

**Files:**
- Create: `src/engine/persistence/Migrator.ts`
- Create: `src/engine/persistence/Migrator.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/engine/persistence/Migrator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createMigrator, Migration } from './Migrator';

interface V1 { name: string }
interface V2 { name: string; age: number }
interface V3 { fullName: string; age: number }

describe('Migrator', () => {
  it('returns input untouched when already at current version', () => {
    const m = createMigrator<V3>({ currentVersion: 3, migrations: [] });
    const out = m.migrate({ fullName: 'Lin', age: 20 }, 3);
    expect(out).toEqual({ fullName: 'Lin', age: 20 });
  });

  it('runs a chain of migrations 1 -> 2 -> 3', () => {
    const v1to2: Migration<V1, V2> = { from: 1, to: 2, transform: (v) => ({ ...v, age: 0 }) };
    const v2to3: Migration<V2, V3> = { from: 2, to: 3, transform: (v) => ({ fullName: v.name, age: v.age }) };
    const m = createMigrator<V3>({ currentVersion: 3, migrations: [v1to2, v2to3] });
    const out = m.migrate({ name: 'Lin' }, 1);
    expect(out).toEqual({ fullName: 'Lin', age: 0 });
  });

  it('throws on missing step in the chain', () => {
    const v1to2: Migration<V1, V2> = { from: 1, to: 2, transform: (v) => ({ ...v, age: 0 }) };
    // No 2->3 registered.
    const m = createMigrator<V3>({ currentVersion: 3, migrations: [v1to2] });
    expect(() => m.migrate({ name: 'Lin' }, 1))
      .toThrow(/no migration from 2 to 3/i);
  });

  it('throws if source version > current', () => {
    const m = createMigrator({ currentVersion: 2, migrations: [] });
    expect(() => m.migrate({}, 5))
      .toThrow(/save version 5.*newer than current 2/i);
  });

  it('throws if source version < 1', () => {
    const m = createMigrator({ currentVersion: 2, migrations: [] });
    expect(() => m.migrate({}, 0))
      .toThrow(/invalid save version 0/i);
  });

  it('allows registering migrations out of order', () => {
    const v2to3: Migration<V2, V3> = { from: 2, to: 3, transform: (v) => ({ fullName: v.name, age: v.age }) };
    const v1to2: Migration<V1, V2> = { from: 1, to: 2, transform: (v) => ({ ...v, age: 10 }) };
    const m = createMigrator<V3>({ currentVersion: 3, migrations: [v2to3, v1to2] });
    const out = m.migrate({ name: 'Hua' }, 1);
    expect(out).toEqual({ fullName: 'Hua', age: 10 });
  });
});
```

- [ ] **Step 2: Run it to verify failure**

```bash
npm test -- Migrator
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/engine/persistence/Migrator.ts`:

```ts
// Chained save-schema migrator. See docs/spec/design.md §10.4.

export interface Migration<From = unknown, To = unknown> {
  from: number;
  to: number;
  transform: (old: From) => To;
}

export interface MigratorOptions {
  currentVersion: number;
  migrations: Migration<any, any>[];
}

export interface Migrator<TCurrent = unknown> {
  migrate(data: unknown, fromVersion: number): TCurrent;
}

export function createMigrator<TCurrent = unknown>(opts: MigratorOptions): Migrator<TCurrent> {
  // Index migrations by source version.
  const byFrom = new Map<number, Migration>();
  for (const m of opts.migrations) {
    if (m.to !== m.from + 1) {
      throw new Error(`migration must be single-step: got ${m.from} -> ${m.to}`);
    }
    if (byFrom.has(m.from)) {
      throw new Error(`duplicate migration registered from version ${m.from}`);
    }
    byFrom.set(m.from, m);
  }

  function migrate(data: unknown, fromVersion: number): TCurrent {
    if (!Number.isInteger(fromVersion) || fromVersion < 1) {
      throw new Error(`invalid save version ${fromVersion}`);
    }
    if (fromVersion > opts.currentVersion) {
      throw new Error(
        `save version ${fromVersion} is newer than current ${opts.currentVersion}`,
      );
    }
    let current: unknown = data;
    let v = fromVersion;
    while (v < opts.currentVersion) {
      const step = byFrom.get(v);
      if (!step) {
        throw new Error(`no migration from ${v} to ${v + 1}`);
      }
      current = step.transform(current);
      v += 1;
    }
    return current as TCurrent;
  }

  return { migrate };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- Migrator
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/persistence/Migrator.ts src/engine/persistence/Migrator.test.ts
git commit -m "feat(persistence): chained schema Migrator"
```

---

## Task 12: Zustand store skeletons

**Rationale:** Three stores per spec §12.4 — `gameStore` (RunState), `metaStore` (MetaState), `settingsStore` (UI). Phase 0 only needs empty shells with their phase state and a few minimal slots so downstream tasks have a shape to extend.

**Files:**
- Create: `src/state/gameStore.ts`
- Create: `src/state/metaStore.ts`
- Create: `src/state/settingsStore.ts`
- Create: `src/state/gameStore.test.ts`
- Create: `src/state/metaStore.test.ts`

- [ ] **Step 1: Write failing tests for `gameStore`**

Create `src/state/gameStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import { GamePhase } from '@/engine/core/Types';

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('initialises in TITLE phase', () => {
    expect(useGameStore.getState().phase).toBe(GamePhase.TITLE);
  });

  it('setPhase updates the phase', () => {
    useGameStore.getState().setPhase(GamePhase.CREATION);
    expect(useGameStore.getState().phase).toBe(GamePhase.CREATION);
  });

  it('reset returns to TITLE and clears error/loading', () => {
    const s = useGameStore.getState();
    s.setPhase(GamePhase.PLAYING);
    s.setError('something');
    s.setLoading(true);
    s.reset();
    const after = useGameStore.getState();
    expect(after.phase).toBe(GamePhase.TITLE);
    expect(after.error).toBeNull();
    expect(after.isLoading).toBe(false);
  });
});
```

- [ ] **Step 2: Implement `gameStore`**

Create `src/state/gameStore.ts`:

```ts
import { create } from 'zustand';
import { GamePhase } from '@/engine/core/Types';

export interface GameStoreState {
  phase: GamePhase;
  isLoading: boolean;
  error: string | null;

  // Actions
  setPhase: (p: GamePhase) => void;
  setLoading: (b: boolean) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

const initial = {
  phase: GamePhase.TITLE,
  isLoading: false,
  error: null,
} as const;

export const useGameStore = create<GameStoreState>((set) => ({
  ...initial,
  setPhase: (p) => set({ phase: p }),
  setLoading: (b) => set({ isLoading: b }),
  setError: (msg) => set({ error: msg }),
  reset: () => set({ ...initial }),
}));
```

- [ ] **Step 3: Write failing tests for `metaStore`**

Create `src/state/metaStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useMetaStore } from './metaStore';

describe('metaStore', () => {
  beforeEach(() => {
    useMetaStore.getState().reset();
  });

  it('starts with zero karma and empty echoes/memories', () => {
    const s = useMetaStore.getState();
    expect(s.karmicInsight).toBe(0);
    expect(s.unlockedEchoes).toEqual([]);
    expect(s.unlockedMemories).toEqual([]);
    expect(s.heavenlyNotice).toBe(0);
    expect(s.lifeCount).toBe(0);
  });

  it('addKarma increments', () => {
    useMetaStore.getState().addKarma(50);
    useMetaStore.getState().addKarma(25);
    expect(useMetaStore.getState().karmicInsight).toBe(75);
  });

  it('spendKarma requires sufficient balance', () => {
    const s = useMetaStore.getState();
    s.addKarma(100);
    expect(s.spendKarma(30)).toBe(true);
    expect(useMetaStore.getState().karmicInsight).toBe(70);
    expect(useMetaStore.getState().spendKarma(999)).toBe(false);
    expect(useMetaStore.getState().karmicInsight).toBe(70);
  });
});
```

- [ ] **Step 4: Implement `metaStore`**

Create `src/state/metaStore.ts`:

```ts
import { create } from 'zustand';

export interface MetaStoreState {
  karmicInsight: number;
  heavenlyNotice: number;
  unlockedEchoes: string[];
  unlockedMemories: string[];
  unlockedAnchors: string[];
  lifeCount: number;

  addKarma: (amount: number) => void;
  spendKarma: (amount: number) => boolean;
  addNotice: (amount: number) => void;
  unlockEcho: (id: string) => void;
  unlockMemory: (id: string) => void;
  unlockAnchor: (id: string) => void;
  incrementLifeCount: () => void;
  reset: () => void;
}

const initial = {
  karmicInsight: 0,
  heavenlyNotice: 0,
  unlockedEchoes: [] as string[],
  unlockedMemories: [] as string[],
  unlockedAnchors: ['true_random', 'peasant_farmer'] as string[], // defaults per spec §7.4
  lifeCount: 0,
};

export const useMetaStore = create<MetaStoreState>((set, get) => ({
  ...initial,

  addKarma: (amount) => set({ karmicInsight: get().karmicInsight + amount }),

  spendKarma: (amount) => {
    const balance = get().karmicInsight;
    if (amount > balance) return false;
    set({ karmicInsight: balance - amount });
    return true;
  },

  addNotice: (amount) =>
    set({ heavenlyNotice: Math.max(0, Math.min(100, get().heavenlyNotice + amount)) }),

  unlockEcho: (id) => {
    const cur = get().unlockedEchoes;
    if (!cur.includes(id)) set({ unlockedEchoes: [...cur, id] });
  },

  unlockMemory: (id) => {
    const cur = get().unlockedMemories;
    if (!cur.includes(id)) set({ unlockedMemories: [...cur, id] });
  },

  unlockAnchor: (id) => {
    const cur = get().unlockedAnchors;
    if (!cur.includes(id)) set({ unlockedAnchors: [...cur, id] });
  },

  incrementLifeCount: () => set({ lifeCount: get().lifeCount + 1 }),

  reset: () => set({
    ...initial,
    // Default anchors should always exist.
    unlockedAnchors: [...initial.unlockedAnchors],
  }),
}));
```

- [ ] **Step 5: Implement `settingsStore` (no tests needed yet; shape is trivial)**

Create `src/state/settingsStore.ts`:

```ts
import { create } from 'zustand';

export interface SettingsState {
  revealRawProbability: boolean;
  reducedMotion: boolean;
  minFontSize: number;

  setRevealRawProbability: (b: boolean) => void;
  setReducedMotion: (b: boolean) => void;
  setMinFontSize: (px: number) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  revealRawProbability: false,
  reducedMotion: false,
  minFontSize: 14,
  setRevealRawProbability: (b) => set({ revealRawProbability: b }),
  setReducedMotion: (b) => set({ reducedMotion: b }),
  setMinFontSize: (px) => set({ minFontSize: px }),
}));
```

- [ ] **Step 6: Run tests**

```bash
npm test -- store
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/state/
git commit -m "feat(state): zustand stores for game/meta/settings"
```

---

## Task 13: Zod content loader stub

**Rationale:** Content is JSON validated at load. Phase 0 ships an empty schema + a loader that validates a trivial fixture. Real schemas (events, snippets, etc.) land in Phase 1.

**Files:**
- Create: `src/content/schema.ts`
- Create: `src/content/loader.ts`
- Create: `src/content/loader.test.ts`
- Create: `src/content/__fixtures__/minimal.json`

- [ ] **Step 1: Write the failing tests**

Create `src/content/loader.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadContentPack } from './loader';

describe('content loader', () => {
  it('accepts a minimal valid pack', () => {
    const pack = {
      version: 1,
      snippets: {},
      events: [],
    };
    const loaded = loadContentPack(pack);
    expect(loaded.version).toBe(1);
    expect(loaded.events).toEqual([]);
  });

  it('rejects a pack missing version', () => {
    expect(() => loadContentPack({ snippets: {}, events: [] }))
      .toThrow(/version/i);
  });

  it('rejects a pack with wrong types', () => {
    expect(() => loadContentPack({ version: 'one', snippets: {}, events: [] }))
      .toThrow();
  });

  it('accepts snippet entries with text + optional tags', () => {
    const pack = {
      version: 1,
      snippets: {
        'weather.drought.heavy': [
          { text: 'The sun hung heavy.', tags: ['lyrical'] },
          { text: 'It was hot.' },
        ],
      },
      events: [],
    };
    const loaded = loadContentPack(pack);
    expect(loaded.snippets['weather.drought.heavy']).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Implement schema and loader**

Create `src/content/schema.ts`:

```ts
import { z } from 'zod';

// Phase 0: minimal schema sufficient to prove zod is wired.
// Phase 1 expands with full Event / Choice / Outcome shapes.

export const SnippetEntrySchema = z.object({
  text: z.string().min(1),
  weight: z.number().positive().optional(),
  tags: z.array(z.string()).optional(),
});

export const SnippetLibrarySchema = z.record(z.string(), z.array(SnippetEntrySchema));

// Placeholder Event schema — will be fleshed out in Phase 1.
export const EventStubSchema = z.object({
  id: z.string(),
});

export const ContentPackSchema = z.object({
  version: z.number().int().positive(),
  snippets: SnippetLibrarySchema,
  events: z.array(EventStubSchema),
});

export type ContentPack = z.infer<typeof ContentPackSchema>;
export type SnippetEntry = z.infer<typeof SnippetEntrySchema>;
```

Create `src/content/loader.ts`:

```ts
import { ContentPack, ContentPackSchema } from './schema';

export function loadContentPack(raw: unknown): ContentPack {
  const result = ContentPackSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`invalid content pack: ${issues}`);
  }
  return result.data;
}
```

Create `src/content/__fixtures__/minimal.json`:

```json
{
  "version": 1,
  "snippets": {
    "weather.drought.heavy": [
      { "text": "The sun hung like a bronze coin nailed to the sky.", "tags": ["lyrical"] }
    ]
  },
  "events": []
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- loader
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/content/schema.ts src/content/loader.ts src/content/loader.test.ts src/content/__fixtures__/
git commit -m "feat(content): zod-validated content loader stub"
```

---

## Task 14: Engine public interface stubs (`engineBridge`)

**Rationale:** Spec §12.11 defines the exact surface React talks to. Phase 0 provides stubs that return sensible empty payloads. Phase 1+ fills them in.

**Files:**
- Create: `src/services/engineBridge.ts`
- Create: `src/services/engineBridge.test.ts`
- Create: `src/services/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/services/engineBridge.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createEngineBridge } from './engineBridge';
import { GamePhase } from '@/engine/core/Types';

describe('engineBridge stubs', () => {
  it('loadOrInit returns TITLE by default', async () => {
    const engine = createEngineBridge();
    const out = await engine.loadOrInit();
    expect(out.phase).toBe(GamePhase.TITLE);
    expect(out.turn).toBeUndefined();
  });

  it('getMetaSummary returns zeroed defaults', () => {
    const engine = createEngineBridge();
    const meta = engine.getMetaSummary();
    expect(meta.karmicInsight).toBe(0);
    expect(meta.lifeCount).toBe(0);
    expect(meta.heavenlyNotice).toBe(0);
  });

  it('getLineage returns empty array', () => {
    expect(createEngineBridge().getLineage()).toEqual([]);
  });

  it('unimplemented actions throw a clear not-implemented error', async () => {
    const engine = createEngineBridge();
    await expect(engine.beginLife('true_random', 'Lin')).rejects.toThrow(/not implemented/i);
    await expect(engine.chooseAction('x')).rejects.toThrow(/not implemented/i);
    await expect(engine.beginBardo()).rejects.toThrow(/not implemented/i);
  });
});
```

- [ ] **Step 2: Implement stubs**

Create `src/services/engineBridge.ts`:

```ts
import { GamePhase, TurnData } from '@/engine/core/Types';
import { useMetaStore } from '@/state/metaStore';

export interface LoadOrInitResult {
  phase: GamePhase;
  turn?: TurnData;
}

export interface MetaSnapshot {
  karmicInsight: number;
  heavenlyNotice: number;
  lifeCount: number;
  unlockedEchoes: readonly string[];
  unlockedMemories: readonly string[];
  unlockedAnchors: readonly string[];
}

export interface LineageEntry {
  lifeIndex: number;
  name: string;
  // Phase 0: stub shape — will be expanded per spec §7.7.
}

export interface BardoPayload {
  lifeIndex: number;
  karmaEarned: number;
  // Phase 0: stub.
}

export interface CreationPayload {
  availableAnchors: readonly string[];
}

export interface CodexSnapshot {
  memories: readonly string[];
  echoes: readonly string[];
  anchors: readonly string[];
}

export interface EngineBridge {
  loadOrInit(): Promise<LoadOrInitResult>;
  beginLife(anchorId: string, chosenName: string): Promise<TurnData>;
  chooseAction(choiceId: string): Promise<TurnData>;
  beginBardo(): Promise<BardoPayload>;
  spendKarma(upgradeId: string): Promise<BardoPayload>;
  reincarnate(): Promise<CreationPayload>;
  getCodex(): CodexSnapshot;
  getLineage(): LineageEntry[];
  getMetaSummary(): MetaSnapshot;
}

const NOT_IMPLEMENTED = (name: string) => new Error(`engineBridge.${name}: not implemented in Phase 0`);

export function createEngineBridge(): EngineBridge {
  return {
    async loadOrInit() {
      return { phase: GamePhase.TITLE };
    },
    async beginLife(_anchor, _name) {
      throw NOT_IMPLEMENTED('beginLife');
    },
    async chooseAction(_choiceId) {
      throw NOT_IMPLEMENTED('chooseAction');
    },
    async beginBardo() {
      throw NOT_IMPLEMENTED('beginBardo');
    },
    async spendKarma(_upgradeId) {
      throw NOT_IMPLEMENTED('spendKarma');
    },
    async reincarnate() {
      throw NOT_IMPLEMENTED('reincarnate');
    },
    getCodex() {
      const m = useMetaStore.getState();
      return {
        memories: m.unlockedMemories,
        echoes: m.unlockedEchoes,
        anchors: m.unlockedAnchors,
      };
    },
    getLineage() {
      return [];
    },
    getMetaSummary() {
      const m = useMetaStore.getState();
      return {
        karmicInsight: m.karmicInsight,
        heavenlyNotice: m.heavenlyNotice,
        lifeCount: m.lifeCount,
        unlockedEchoes: m.unlockedEchoes,
        unlockedMemories: m.unlockedMemories,
        unlockedAnchors: m.unlockedAnchors,
      };
    },
  };
}
```

Create `src/services/index.ts`:

```ts
export { createEngineBridge } from './engineBridge';
export type {
  EngineBridge,
  LoadOrInitResult,
  MetaSnapshot,
  LineageEntry,
  BardoPayload,
  CreationPayload,
  CodexSnapshot,
} from './engineBridge';
```

- [ ] **Step 3: Run tests**

```bash
npm test -- engineBridge
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/services/
git commit -m "feat(services): engineBridge public interface stubs"
```

---

## Task 15: `TitleScreen` component + wire `App.tsx`

**Rationale:** Produce a visible Phase 0 deliverable: the app boots to a functional (if skeletal) title screen. Buttons route through the engineBridge stubs.

**Files:**
- Create: `src/components/TitleScreen.tsx`
- Create: `src/components/TitleScreen.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/TitleScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TitleScreen } from './TitleScreen';

describe('TitleScreen', () => {
  it('renders the game title', () => {
    render(<TitleScreen onNewGame={() => {}} onContinue={() => {}} onOpenCodex={() => {}} hasSave={false} />);
    expect(screen.getByText(/thousand deaths/i)).toBeInTheDocument();
  });

  it('disables Continue when no save', () => {
    render(<TitleScreen onNewGame={() => {}} onContinue={() => {}} onOpenCodex={() => {}} hasSave={false} />);
    const btn = screen.getByRole('button', { name: /continue/i });
    expect(btn).toBeDisabled();
  });

  it('enables Continue when a save exists', () => {
    render(<TitleScreen onNewGame={() => {}} onContinue={() => {}} onOpenCodex={() => {}} hasSave={true} />);
    const btn = screen.getByRole('button', { name: /continue/i });
    expect(btn).not.toBeDisabled();
  });

  it('calls onNewGame when New Game clicked', async () => {
    const onNewGame = vi.fn();
    render(<TitleScreen onNewGame={onNewGame} onContinue={() => {}} onOpenCodex={() => {}} hasSave={false} />);
    await userEvent.click(screen.getByRole('button', { name: /new game/i }));
    expect(onNewGame).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Install testing-library react deps**

```bash
npm install -D @testing-library/react @testing-library/user-event
```

- [ ] **Step 3: Implement `TitleScreen`**

Create `src/components/TitleScreen.tsx`:

```tsx
import React from 'react';

export interface TitleScreenProps {
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
  onOpenCodex: () => void;
}

export function TitleScreen({ hasSave, onNewGame, onContinue, onOpenCodex }: TitleScreenProps): JSX.Element {
  return (
    <div className="h-full w-full flex items-center justify-center bg-ink-900 text-parchment-100 font-serif">
      <div className="max-w-xl w-full px-8 text-center">
        <h1 className="text-4xl md:text-5xl mb-2 text-jade-400">
          The Thousand Deaths
        </h1>
        <h2 className="text-xl md:text-2xl mb-12 text-parchment-400 italic">
          of a Would-Be Immortal
        </h2>

        <div className="flex flex-col gap-3 items-stretch">
          <button
            type="button"
            onClick={onNewGame}
            className="py-3 px-6 border border-jade-700 text-jade-300 hover:bg-jade-900/40 transition"
          >
            New Life
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={!hasSave}
            className="py-3 px-6 border border-parchment-700 text-parchment-300 hover:bg-parchment-900/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={onOpenCodex}
            className="py-3 px-6 border border-ash-700 text-ash-300 hover:bg-ash-900/30 transition"
          >
            Codex
          </button>
        </div>

        <p className="mt-16 text-xs text-parchment-600 italic">
          &mdash; The Wheel turns. Patience. &mdash;
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire `App.tsx` to the engine and TitleScreen**

Replace `src/App.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { TitleScreen } from './components/TitleScreen';
import { createEngineBridge, EngineBridge } from './services';
import { GamePhase } from './engine/core/Types';

export default function App(): JSX.Element {
  const [engine] = useState<EngineBridge>(() => createEngineBridge());
  const [phase, setPhase] = useState<GamePhase>(GamePhase.TITLE);
  const [hasSave, setHasSave] = useState(false);

  useEffect(() => {
    engine.loadOrInit().then((r) => {
      setPhase(r.phase);
      setHasSave(!!r.turn);
    });
  }, [engine]);

  const handleNewGame = (): void => {
    // Phase 0: stub — advance phase locally so we see the transition fire.
    setPhase(GamePhase.CREATION);
  };
  const handleContinue = (): void => { /* Phase 0 stub */ };
  const handleOpenCodex = (): void => setPhase(GamePhase.CODEX);

  if (phase === GamePhase.TITLE) {
    return (
      <TitleScreen
        hasSave={hasSave}
        onNewGame={handleNewGame}
        onContinue={handleContinue}
        onOpenCodex={handleOpenCodex}
      />
    );
  }

  // Phase 0 placeholder for any non-title phase.
  return (
    <div className="h-full w-full flex items-center justify-center bg-ink-900 text-parchment-100 font-serif">
      <div className="text-center">
        <p className="text-parchment-400 mb-4">
          You have entered the phase: <code className="text-jade-400">{phase}</code>.
        </p>
        <p className="text-parchment-600 italic text-sm">(Phase 0: no content yet. Phase 1 will wire this in.)</p>
        <button
          type="button"
          onClick={() => setPhase(GamePhase.TITLE)}
          className="mt-8 py-2 px-5 border border-parchment-700 text-parchment-300 hover:bg-parchment-900/20"
        >
          Back to Title
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- TitleScreen
```

Expected: all 4 assertions pass.

- [ ] **Step 6: Run full test + build**

```bash
npm test
npm run typecheck
npm run build
```

Expected: all green. The build should produce a working `dist/`.

- [ ] **Step 7: Manual smoke test**

```bash
npm run dev
```

Open http://localhost:5173. You should see the TitleScreen with "The Thousand Deaths / of a Would-Be Immortal" and three buttons. Clicking *New Life* shows the Phase 0 placeholder. Clicking *Codex* does the same. Continue should be disabled.

Kill the dev server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ui): TitleScreen wired to engineBridge; Phase 0 boot path"
```

---

## Task 16: CI workflow (GitHub Actions)

**Rationale:** Spec §13 requires CI running `npm test` + `npm run build` on every PR. Set it up now; downstream phases benefit automatically.

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Build
        run: npm run build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add test + build GitHub Actions workflow"
```

- [ ] **Step 3: Push and verify the first CI run (if remote is set up)**

```bash
git push origin main
```

Then on GitHub, check the Actions tab. Expected: a successful run of `test-and-build`. If it fails, fix and re-commit. Do not merge a red main.

> **Note:** if the remote requires a feature branch and PR, push to a branch instead (`git checkout -b phase-0-foundation && git push -u origin phase-0-foundation`) and open a PR.

---

## Task 17: Final green-bar verification

**Rationale:** Prove Phase 0 exit criteria are met.

- [ ] **Step 1: Run everything one more time**

```bash
npm run typecheck
npm test -- --coverage
npm run build
```

Expected:
- Typecheck: zero errors.
- Tests: all green. Coverage > 70% on `src/engine/` and `src/utils/`.
- Build: `dist/` produced, no errors.

- [ ] **Step 2: Manual smoke: three fresh boots**

```bash
npm run dev
```

In three separate browser tabs:
1. Hard-refresh. Title screen loads.
2. Click *New Life*. Placeholder appears. Back.
3. Click *Codex*. Placeholder appears. Back.

Kill the dev server.

- [ ] **Step 3: Verify the repo layout matches spec §12**

Run a sanity check:

```bash
ls -la src/
ls -la src/engine/
ls -la src/content/
```

You should see all scaffolded subdirectories. No stray files from the old layout.

- [ ] **Step 4: Write a short Phase 0 completion note**

Append to `docs/spec/design.md` at the bottom, a new section:

```markdown
---

## Phase 0 Completion Log

- Date: <TODAY>
- Deliverables: engine scaffold, seeded RNG, EventBus, StateMachine, SaveManager, Migrator, empty stores, content loader stub, TitleScreen.
- Test coverage: <paste from coverage>
- Known follow-ups for Phase 1: replace SetupScreen/StatusPanel/StoryPanel wiring, introduce Character & Event subsystems per spec §3, §5, §9.
```

- [ ] **Step 5: Commit the log**

```bash
git add docs/spec/design.md
git commit -m "docs: Phase 0 completion log"
```

- [ ] **Step 6: Tag the phase**

```bash
git tag -a phase-0-complete -m "Phase 0 Foundation: engine scaffold + TitleScreen"
```

(Push the tag only if the user approves pushing to remote.)

---

## Exit Criteria Checklist

Before Phase 1 begins, all of the following must be true:

- [ ] `npm test` passes with no skipped or pending tests that matter.
- [ ] `npm run typecheck` is clean.
- [ ] `npm run build` produces a working bundle.
- [ ] CI green on `main`.
- [ ] `src/engine/` structure matches spec §12.2 (some modules empty; that's fine).
- [ ] `src/content/` structure matches spec §12.3 (all placeholders; that's fine).
- [ ] Title screen renders and all three buttons respond as specified.
- [ ] `@google/genai` not in `package.json`, not in `node_modules`, not in any source file.
- [ ] No `Math.random()` calls anywhere in `src/` (grep to verify).
- [ ] Every module introduced in Phase 0 has a corresponding `*.test.ts` file with green assertions.

---

## Self-Review Notes

Done after writing this plan:

- **Placeholder scan:** none. Every step shows concrete code.
- **Type consistency:** `GamePhase`, `Realm`, `Stat`, `Mood`, `NoticeTier`, `OutcomeTier`, `DeathCause`, `TimeCost`, `TurnData`, `CharacterStatus`, `GameChoice`, `SaveEnvelope`, `Migration`, `ContentPack`, `SnippetEntry`, `EngineBridge` and the method names on it all match between tasks.
- **Spec coverage (of Phase 0 only):** every Phase 0 exit criterion in spec §13 is mapped to a task here.
  - Remove Gemini → Task 1 ✔
  - Install vitest/zod/zustand/idb → Task 2/3 ✔
  - Scaffold directory tree → Task 4 ✔
  - RNG → Task 7 ✔
  - EventBus → Task 8 ✔
  - StateMachine → Task 9 ✔
  - SaveManager (envelope + tmp) → Task 10 ✔
  - Zod-validated content loader → Task 13 ✔
  - Test harness + CI → Task 2 + Task 16 ✔
  - App boots to empty TitleScreen → Task 15 ✔
  - Architectural smoke tests (load empty content, round-trip save) → Task 10 + Task 13 ✔

Nothing deferred out of scope.
