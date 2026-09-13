# Wuxia Dungeon RPG

### The Thousand Deaths of a Would-Be Immortal

[![CI](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/arthamegayasa/Wuxia-Dungeon-RPG/actions/workflows/ci.yml)

A browser-based cultivation RPG about the lives that come before immortality. Read a life as a novel, make choices at its turning points, and carry karma, echoes, and memories into the next incarnation.

The current game runs entirely in the browser with an authored narrative and a seeded, deterministic game engine. It does not require a backend, Gemini API key, or AI service.

## The game loop

1. Choose **New Life**, select an available birth origin, and name your character.
2. Read narrative interludes with **Continue**, then choose how to respond when a decision appears. Train, face danger, and pursue cultivation across the Yellow Plains and Azure Peaks.
3. Open **Character** to inspect your techniques, meridians, and Core Path, or **Inventory** to view collected items.
4. When a life ends, enter **The Bardo** to review its outcome and spend earned karma on upgrades before reincarnating.
5. Visit **Codex** and **Lineage** from the title screen or Bardo to explore discoveries and the history of past lives.

The playable build includes unlockable birth origins, Soul Echo inheritance, Forbidden Memories, cultivation through Body Tempering, Qi Sensing, and Qi Condensation, and the first scripted tribulation. Narrative beats are interleaved with decisions so a playthrough reads like a novel.

The game is in development. Additional regions, later cultivation realms, and endings are described in the [design specification](docs/spec/design.md); that document includes planned features beyond the current build.

## Run locally

Use **Node.js 22.13+ within the 22.x release line, or Node.js 24+**, with npm. These versions meet the requirements of the locked development dependencies.

```bash
git clone https://github.com/arthamegayasa/Wuxia-Dungeon-RPG.git
cd Wuxia-Dungeon-RPG
npm ci
npm run dev
```

Open the local URL printed by Vite. No environment variables are required for gameplay.

Saves are stored automatically in the current browser's `localStorage`. Use the same browser and origin to resume with **Continue**; changing the port or clearing site data affects which save is available. The page currently loads Tailwind CSS and fonts from external CDNs, so an internet connection is needed for those visual assets.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run typecheck` | Check TypeScript types without emitting files. |
| `npm test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run build` | Produce the static application in `dist/`. |
| `npm run preview` | Serve a completed build locally for inspection. |

To check a change, run:

```bash
npm run typecheck
npm test
npm run build
```

The [CI workflow](.github/workflows/ci.yml) runs these checks for pushes and pull requests to `main`. Tests cover engine rules, content validation, React components, save migration, and complete life/reincarnation flows. To run a focused test, pass its path to Vitest, for example:

```bash
npm test -- src/engine/core/RNG.test.ts
```

## How it is organized

| Location | Responsibility |
| --- | --- |
| [`src/engine/`](src/engine/) | Seeded randomness, characters, choices, cultivation, narrative composition, reincarnation, and persistence. |
| [`src/content/`](src/content/) | Authored events, snippets, regions, techniques, items, and schema-validated content loaders. |
| [`src/services/`](src/services/) | The bridge between the engine and UI, plus lazy loading of regional content. |
| [`src/state/`](src/state/) | Zustand stores for game, meta, and settings state. |
| [`src/components/`](src/components/) | React screens and panels. |
| [`tests/integration/`](tests/integration/) | Playthrough, inheritance, determinism, and UI integration tests. |
| [`docs/spec/design.md`](docs/spec/design.md) | Game systems, design goals, and roadmap. |

Built with **React 19**, **TypeScript**, **Vite**, **Zustand**, and **Zod**, with **Vitest** and **Testing Library** for verification.
