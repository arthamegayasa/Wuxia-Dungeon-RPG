// Lazy-load the Yellow Plains content chunk (events + snippets).
// Source: docs/spec/design.md §8.6, Phase 2C-4 (Novel Mode polish batch).
//
// All imports here are DYNAMIC so Vite can split them into a separate chunk.
// The promise is cached for the session — subsequent calls reuse the resolved content.
//
// The loader fires at the first `beginLife` call (and as a defensive guard at
// `peekNextEvent` / `resolveChoice` resume paths). Splitting the YP corpus out
// of the cold-start bundle keeps `index-*.js` under the 450 KB Phase 3 target;
// after Phase 2C's prose rewrites + 20 new beat events, eagerly bundling YP
// pushed the main chunk to ~566 KB. Mirrors the AP loader pattern.

import type { EventDef } from '@/content/schema';
import type { SnippetLibrary } from '@/engine/narrative/SnippetLibrary';

let cachedPromise: Promise<YellowPlainsContent> | null = null;

export interface YellowPlainsContent {
  events: ReadonlyArray<EventDef>;
  snippets: SnippetLibrary;
}

export function loadYellowPlainsContent(): Promise<YellowPlainsContent> {
  if (cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    const [
      dailyMod,
      trainingMod,
      socialMod,
      dangerMod,
      opportunityMod,
      transitionMod,
      bridgeMod,
      meditationMod,
      beatsWeatherMod,
      beatsRoutineMod,
      beatsAtmosphereMod,
      beatsInnerMod,
      beatsDreamMod,
      snippetMod,
      eventsLoader,
      snippetsLoader,
    ] = await Promise.all([
      import('@/content/events/yellow_plains/daily.json'),
      import('@/content/events/yellow_plains/training.json'),
      import('@/content/events/yellow_plains/social.json'),
      import('@/content/events/yellow_plains/danger.json'),
      import('@/content/events/yellow_plains/opportunity.json'),
      import('@/content/events/yellow_plains/transition.json'),
      import('@/content/events/yellow_plains/bridge.json'),
      import('@/content/events/yellow_plains/meditation.json'),
      import('@/content/events/yellow_plains/beats_weather.json'),
      import('@/content/events/yellow_plains/beats_routine.json'),
      import('@/content/events/yellow_plains/beats_atmosphere.json'),
      import('@/content/events/yellow_plains/beats_inner.json'),
      import('@/content/events/yellow_plains/beats_dream.json'),
      import('@/content/snippets/yellow_plains.json'),
      import('@/content/events/loader'),
      import('@/content/snippets/loader'),
    ]);

    const events: EventDef[] = [
      ...eventsLoader.loadEvents(dailyMod.default),
      ...eventsLoader.loadEvents(trainingMod.default),
      ...eventsLoader.loadEvents(socialMod.default),
      ...eventsLoader.loadEvents(dangerMod.default),
      ...eventsLoader.loadEvents(opportunityMod.default),
      ...eventsLoader.loadEvents(transitionMod.default),
      ...eventsLoader.loadEvents(bridgeMod.default),
      ...eventsLoader.loadEvents(meditationMod.default),
      // Phase 2C-2b: novel-mode beat files (lazy chunk).
      ...eventsLoader.loadEvents(beatsWeatherMod.default),
      ...eventsLoader.loadEvents(beatsRoutineMod.default),
      ...eventsLoader.loadEvents(beatsAtmosphereMod.default),
      ...eventsLoader.loadEvents(beatsInnerMod.default),
      ...eventsLoader.loadEvents(beatsDreamMod.default),
    ];

    const snippets = snippetsLoader.loadSnippets(snippetMod.default);

    return { events, snippets };
  })();

  return cachedPromise;
}

/** Test-only: reset module cache so re-imports test cold path. */
export function __resetYellowPlainsCache(): void {
  cachedPromise = null;
}
