// Lazy-load the Azure Peaks content chunk (region + events + snippets)
// and the gameplay registries (techniques, items, echoes, memories).
// Source: docs/spec/design.md §8.6, Phase 2B-2 Task 24.
//
// All imports here are DYNAMIC so Vite can split them into a separate chunk.
// The promise is cached for the session — subsequent calls reuse the resolved content.
//
// The loader fires at the first `beginLife` call. YP-only gameplay before that
// still works; the registries are stubs until this resolves (bridge guards ensure
// ensureAzurePeaksLoaded() is awaited before any event selection).

import type { RegionDef, EventDef } from '@/content/schema';
import type { SnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import type { TechniqueRawDef, ItemRawDef } from '@/content/schema';
import type { SoulEcho } from '@/engine/meta/SoulEcho';
import type { ForbiddenMemory } from '@/engine/meta/ForbiddenMemory';

let cachedPromise: Promise<AzurePeaksContent> | null = null;

export interface AzurePeaksContent {
  region: RegionDef;
  events: ReadonlyArray<EventDef>;
  snippets: SnippetLibrary;
  techniques: ReadonlyArray<TechniqueRawDef>;
  items: ReadonlyArray<ItemRawDef>;
  echoes: ReadonlyArray<SoulEcho>;
  memories: ReadonlyArray<ForbiddenMemory>;
}

export function loadAzurePeaksContent(): Promise<AzurePeaksContent> {
  if (cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    const [
      regionMod,
      dailyMod,
      trainingMod,
      socialMod,
      dangerMod,
      opportunityMod,
      realmGateMod,
      transitionMod,
      beatsWeatherMod,
      beatsRoutineMod,
      beatsAtmosphereMod,
      beatsInnerMod,
      beatsDreamMod,
      snippetMod,
      techniquesMod,
      itemsMod,
      echoesMod,
      memoriesMod,
      regionsLoader,
      eventsLoader,
      snippetsLoader,
      techniquesLoader,
      itemsLoader,
      echoesLoader,
      memoriesLoader,
    ] = await Promise.all([
      import('@/content/regions/azure_peaks.json'),
      import('@/content/events/azure_peaks/daily.json'),
      import('@/content/events/azure_peaks/training.json'),
      import('@/content/events/azure_peaks/social.json'),
      import('@/content/events/azure_peaks/danger.json'),
      import('@/content/events/azure_peaks/opportunity.json'),
      import('@/content/events/azure_peaks/realm_gate.json'),
      import('@/content/events/azure_peaks/transition.json'),
      import('@/content/events/azure_peaks/beats_weather.json'),
      import('@/content/events/azure_peaks/beats_routine.json'),
      import('@/content/events/azure_peaks/beats_atmosphere.json'),
      import('@/content/events/azure_peaks/beats_inner.json'),
      import('@/content/events/azure_peaks/beats_dream.json'),
      import('@/content/snippets/azure_peaks.json'),
      import('@/content/techniques/techniques.json'),
      import('@/content/items/items.json'),
      import('@/content/echoes/echoes.json'),
      import('@/content/memories/memories.json'),
      import('@/content/regions/loader'),
      import('@/content/events/loader'),
      import('@/content/snippets/loader'),
      import('@/content/techniques/loader'),
      import('@/content/items/loader'),
      import('@/content/echoes/loader'),
      import('@/content/memories/loader'),
    ]);

    const regions = regionsLoader.loadRegions(regionMod.default);
    const region = regions[0];
    if (!region) throw new Error('azurePeaksLoader: azure_peaks.json contained no regions');

    const events: EventDef[] = [
      ...eventsLoader.loadEvents(dailyMod.default),
      ...eventsLoader.loadEvents(trainingMod.default),
      ...eventsLoader.loadEvents(socialMod.default),
      ...eventsLoader.loadEvents(dangerMod.default),
      ...eventsLoader.loadEvents(opportunityMod.default),
      ...eventsLoader.loadEvents(realmGateMod.default),
      ...eventsLoader.loadEvents(transitionMod.default),
      // Phase 2C-3b: novel-mode beat files (lazy chunk).
      ...eventsLoader.loadEvents(beatsWeatherMod.default),
      ...eventsLoader.loadEvents(beatsRoutineMod.default),
      ...eventsLoader.loadEvents(beatsAtmosphereMod.default),
      ...eventsLoader.loadEvents(beatsInnerMod.default),
      ...eventsLoader.loadEvents(beatsDreamMod.default),
    ];

    const snippets = snippetsLoader.loadSnippets(snippetMod.default);
    const techniques = techniquesLoader.loadTechniques(techniquesMod.default) as ReadonlyArray<TechniqueRawDef>;
    const items = itemsLoader.loadItems(itemsMod.default) as ReadonlyArray<ItemRawDef>;
    const echoes = echoesLoader.loadEchoes(echoesMod.default) as ReadonlyArray<SoulEcho>;
    const memories = memoriesLoader.loadMemories(memoriesMod.default) as ReadonlyArray<ForbiddenMemory>;

    return { region, events, snippets, techniques, items, echoes, memories };
  })();

  return cachedPromise;
}

/** Test-only: reset module cache so re-imports test cold path. */
export function __resetAzurePeaksCache(): void {
  cachedPromise = null;
}
