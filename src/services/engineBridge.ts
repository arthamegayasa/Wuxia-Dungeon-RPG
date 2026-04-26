// Real engineBridge — adapter from UI → engine. Source: docs/spec/design.md §2, §11.

import { GamePhase } from '@/engine/core/Types';
import { SaveManager, createSaveManager } from '@/engine/persistence/SaveManager';
import { loadRun, saveRun, clearRun } from '@/engine/persistence/RunSave';
import {
  MetaState, loadMeta, saveMeta, LineageEntrySummary, purchaseUpgrade,
} from '@/engine/meta/MetaState';
import { getAnchorById, DEFAULT_ANCHORS } from '@/engine/meta/Anchor';
import { resolveAnchor } from '@/engine/meta/AnchorResolver';
import { characterFromAnchor } from '@/engine/meta/characterFromAnchor';
import { createRng, derivedRng } from '@/engine/core/RNG';
import {
  createStreakState, recordOutcome, computeStreakBonus, computeWorldMaliceBuff, tickBuff,
} from '@/engine/choices/StreakTracker';
import { SnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { createNameRegistry } from '@/engine/narrative/NameRegistry';
import { computeDominantMood, zeroMoodInputs } from '@/engine/narrative/Mood';
import { moodDeltasFromTechniques } from '@/engine/narrative/MoodFromTechniques';
import { renderEvent, CompositionContext } from '@/engine/narrative/Composer';
import { selectEvent } from '@/engine/events/EventSelector';
import { resolveCheck } from '@/engine/choices/ChoiceResolver';
import { resolveOutcome } from '@/engine/choices/OutcomeResolver';
import { applyOutcome } from '@/engine/events/OutcomeApplier';
import { advanceTurn } from '@/engine/events/AgeTick';
import { computeMoodBonus } from '@/engine/narrative/MoodBonus';
import { checkCategoryFromEvent } from '@/engine/narrative/CheckCategoryFromEvent';
import { TechniqueRegistry } from '@/engine/cultivation/TechniqueRegistry';
import { resolveLearnedTechniqueBonus } from '@/engine/core/TechniqueHelpers';
import { computeCultivationMultiplier } from '@/engine/cultivation/Technique';
import type { TechniqueDef, TechniqueGrade } from '@/engine/cultivation/Technique';
import { visibleChoicesForCharacter } from '@/engine/choices/ChoiceVisibility';
import { runBardoFlow } from '@/engine/bardo/BardoFlow';
// NB: runTurn is no longer used — replaced by peekNextEvent + resolveChoice split.
import { DEFAULT_UPGRADES, getUpgradeById } from '@/engine/meta/KarmicUpgrade';
import { EchoTracker, commitTrackerToMeta } from '@/engine/meta/EchoTracker';
import { applyPostOutcomeHooks } from '@/engine/core/PostOutcomeHooks';
import { loadEvents } from '@/content/events/loader';
import { loadSnippets, mergeSnippetPacks, mergeSnippetLibraries } from '@/content/snippets/loader';
import { EchoRegistry } from '@/engine/meta/EchoRegistry';
import { MemoryRegistry } from '@/engine/meta/MemoryRegistry';
import { ItemRegistry, ItemDef, ItemType } from '@/engine/cultivation/ItemRegistry';
import { RegionRegistry } from '@/engine/world/RegionRegistry';
import { SoulEcho } from '@/engine/meta/SoulEcho';
import type { UnlockCondition, EchoEffect } from '@/engine/meta/SoulEcho';
import { ForbiddenMemory, memoryLevelOf } from '@/engine/meta/ForbiddenMemory';
import { EventDef } from '@/content/schema';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';
import { loadAzurePeaksContent } from './azurePeaksLoader';

import dailyJson from '@/content/events/yellow_plains/daily.json';
import trainingJson from '@/content/events/yellow_plains/training.json';
import socialJson from '@/content/events/yellow_plains/social.json';
import dangerJson from '@/content/events/yellow_plains/danger.json';
import opportunityJson from '@/content/events/yellow_plains/opportunity.json';
import transitionJson from '@/content/events/yellow_plains/transition.json';
import bridgeJson from '@/content/events/yellow_plains/bridge.json';
import meditationJson from '@/content/events/yellow_plains/meditation.json';
import ypSnippets from '@/content/snippets/yellow_plains.json';
// NOTE: azure_peaks content, techniques, items, echoes, and memories are NOT imported
// eagerly here. Phase 2B-2 Task 24 lazy-loads them via azurePeaksLoader.ts on first
// beginLife call, keeping the cold-start bundle under the 450 KB hard limit.

// Phase 1D-3 Task 10: Yellow Plains content pool. Flattens all authored regional
// packs (~50 events) into one selectable array.
// Phase 2B-2 Task 24: mutable so AP events can be spliced in on lazy-load.
let ALL_EVENTS: ReadonlyArray<EventDef> = [
  ...loadEvents(dailyJson),
  ...loadEvents(trainingJson),
  ...loadEvents(socialJson),
  ...loadEvents(dangerJson),
  ...loadEvents(opportunityJson),
  ...loadEvents(transitionJson),
  ...loadEvents(bridgeJson),
  ...loadEvents(meditationJson),
];
// Phase 2B-2 Task 24: starts as YP-only; AP snippets appended on first AP need.
// (Replaces the earlier eager merge from Task 22 which pulled AP into the cold bundle.)
let DEFAULT_LIBRARY: SnippetLibrary = mergeSnippetPacks([ypSnippets]);

// Phase 2B-2 Task 24: guard flag so AP content is only spliced once per session.
let azurePeaksLoaded = false;

/**
 * Ensure Azure Peaks content AND all gameplay registries are loaded.
 * Idempotent — subsequent calls are no-ops.
 * Must be awaited at `beginLife` (all anchors) and before any AP event selection.
 */
async function ensureAzurePeaksLoaded(): Promise<void> {
  if (azurePeaksLoaded) return;
  const ap = await loadAzurePeaksContent();

  // Merge AP events into the event pool.
  ALL_EVENTS = [...ALL_EVENTS, ...ap.events];

  // Merge AP region into the region registry.
  REGION_REGISTRY.current = RegionRegistry.fromList([
    ...REGION_REGISTRY.current.all(),
    ap.region,
  ]);

  // Merge AP snippets into the library.
  DEFAULT_LIBRARY = mergeSnippetLibraries(DEFAULT_LIBRARY, ap.snippets);

  // Hydrate gameplay registries (techniques, items, echoes, memories).
  TECHNIQUE_REGISTRY = TechniqueRegistry.fromList(
    ap.techniques as ReadonlyArray<TechniqueDef>,
  );
  ITEM_REGISTRY = ItemRegistry.fromList(
    ap.items as ReadonlyArray<ItemDef>,
  );
  ECHO_REGISTRY = EchoRegistry.fromList(ap.echoes);
  MEMORY_REGISTRY = MemoryRegistry.fromList(ap.memories);

  azurePeaksLoaded = true;
}

// Phase 2B-2 Task 24: registries are mutable live-binding exports initialised to
// empty stubs at module load and populated on first beginLife call.
// External importers (tests, GameLoop) see the live value via ESM live bindings.
// loadOrInit does not use any registry — only beginLife and subsequent gameplay calls do.

// Echo registry — populated by ensureAzurePeaksLoaded from echoes.json.
// eslint-disable-next-line prefer-const
export let ECHO_REGISTRY: EchoRegistry = EchoRegistry.fromList([]);

// Memory registry — populated by ensureAzurePeaksLoaded from memories.json.
// eslint-disable-next-line prefer-const
export let MEMORY_REGISTRY: MemoryRegistry = MemoryRegistry.fromList([]);

// Technique registry — populated by ensureAzurePeaksLoaded from techniques.json.
// eslint-disable-next-line prefer-const
export let TECHNIQUE_REGISTRY: TechniqueRegistry = TechniqueRegistry.fromList([]);

// Item registry — populated by ensureAzurePeaksLoaded from items.json.
// eslint-disable-next-line prefer-const
export let ITEM_REGISTRY: ItemRegistry = ItemRegistry.fromList([]);

// Region registry starts empty; Task 24 lazy-loads azure_peaks.json on first need.
// Container is a stable reference object so Task 24 can hot-swap `current`.
export const REGION_REGISTRY: { current: RegionRegistry } = {
  current: RegionRegistry.empty(),
};

export interface LoadOrInitResult {
  phase: GamePhase;
  hasSave: boolean;
}

export interface TurnPreviewTechnique {
  id: string;
  name: string;
}

export interface TurnPreviewItem {
  id: string;
  name: string;
  count: number;
  itemType: ItemType;
}

export interface TribulationPayload {
  pillarId: 'tribulation_i';
  phases: ReadonlyArray<{
    phaseId: string;
    success: boolean;
    chance: number;
    roll: number;
  }>;
  fatal: boolean;
}

export interface TurnPreview {
  narrative: string;
  name: string;
  ageYears: number;
  hpCurrent: number;
  hpMax: number;
  qiCurrent: number;
  qiMax: number;
  realm: string;
  insight: number;
  choices: Array<{ id: string; label: string }>;
  // Phase 2B-3 additions
  region: string;
  regionName: string;
  corePath: string | null;
  /** True only on the turn the 3rd meridian opened. UI uses for shimmer animation. */
  corePathRevealedThisTurn: boolean;
  learnedTechniques: ReadonlyArray<TurnPreviewTechnique>;
  inventory: ReadonlyArray<TurnPreviewItem>;
  openMeridians: ReadonlyArray<number>;
  /** Set only by resolveChoice when the resolved outcome triggered a Tribulation pillar. */
  tribulation?: TribulationPayload;
}

export interface RevealedMemory {
  id: string;
  name: string;
  level: 'fragment' | 'partial' | 'complete';
  manifestFlavour?: string;  // present iff manifested this life (the snippet key)
}

export interface RevealedEcho {
  id: string;
  name: string;
  description: string;
}

export interface RevealedTechnique {
  id: string;
  name: string;
  description: string;
}

export interface BardoPayload {
  lifeIndex: number;
  years: number;
  realm: string;
  deathCause: string;
  karmaEarned: number;
  karmaBreakdown: Record<string, number>;
  karmaBalance: number;
  ownedUpgrades: ReadonlyArray<string>;
  availableUpgrades: ReadonlyArray<{
    id: string; name: string; description: string; cost: number;
    affordable: boolean; requirementsMet: boolean; owned: boolean;
  }>;
  /** Phase 2A-3: memories that manifested this life (10a reveal). */
  manifestedThisLife: ReadonlyArray<RevealedMemory>;
  /** Phase 2A-3: memories witnessed this life (10b reveal). Compact list. */
  witnessedThisLife: ReadonlyArray<RevealedMemory>;
  /** Phase 2A-3: echoes whose unlock condition fired this life (10c reveal). */
  echoesUnlockedThisLife: ReadonlyArray<RevealedEcho>;
  /** Phase 2B-3: core path locked this life (null if 3rd meridian never opened). */
  corePath: string | null;
  /** Phase 2B-3: techniques the player learned during this life. */
  techniquesLearnedThisLife: ReadonlyArray<RevealedTechnique>;
}

export interface CreationAnchorView {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  unlockHint: string;
  freshlyUnlocked: boolean;   // true iff anchorId is in the most recent bardo's freshly-unlocked set
}

export interface CreationPayload {
  availableAnchors: ReadonlyArray<CreationAnchorView>;
}

export interface MetaSnapshot {
  karmicInsight: number;
  heavenlyNotice: number;
  lifeCount: number;
  unlockedEchoes: readonly string[];
  unlockedMemories: readonly string[];
  unlockedAnchors: readonly string[];
}

export type LineageEntry = LineageEntrySummary;

export interface CodexEchoEntry {
  id: string;
  name: string;
  description: string;
  tier: 'fragment' | 'partial' | 'full';
  unlocked: boolean;
  unlockHint: string;
  effectsSummary: string;
}

export interface CodexMemoryEntry {
  id: string;
  name: string;
  description: string;
  element: string;
  level: 'unseen' | 'fragment' | 'partial' | 'complete';
  witnessFlavour: string | null;
  manifested: boolean;
  manifestFlavour: string | null;
}

export interface CodexAnchorEntry {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockHint: string;
  karmaMultiplier: number;
}

export interface CodexTechniqueEntry {
  id: string;
  name: string;
  description: string;
  grade: TechniqueGrade;
  seen: boolean;
  learned: boolean;
}

export interface CodexSnapshot {
  echoes: ReadonlyArray<CodexEchoEntry>;
  memories: ReadonlyArray<CodexMemoryEntry>;
  anchors: ReadonlyArray<CodexAnchorEntry>;
  techniques: ReadonlyArray<CodexTechniqueEntry>;
}

export interface LineageEntryView {
  lifeIndex: number;
  name: string;
  anchorId: string;
  anchorName: string;
  birthYear: number;          // 0 means "absolute year unknown" (pre-v3 entries)
  deathYear: number;
  yearsLived: number;
  realmReached: string;
  deathCause: string;
  karmaEarned: number;
  echoesUnlockedThisLife: ReadonlyArray<{ id: string; name: string }>;
  corePath: string | null;
  techniqueCount: number;
}

export interface LineageSnapshot {
  entries: ReadonlyArray<LineageEntryView>;
}

export interface EngineBridge {
  loadOrInit(): Promise<LoadOrInitResult>;
  beginLife(anchorId: string, chosenName: string): Promise<TurnPreview>;
  peekNextEvent(): Promise<TurnPreview>;
  resolveChoice(choiceId: string): Promise<TurnPreview | BardoPayload>;
  beginBardo(): Promise<BardoPayload>;
  spendKarma(upgradeId: string): Promise<BardoPayload>;
  reincarnate(): Promise<CreationPayload>;
  listAnchors(): CreationPayload;
  getMetaSummary(): MetaSnapshot;
  getLineage(): ReadonlyArray<LineageEntry>;
  getLineageSnapshot(): LineageSnapshot;
  getCodexSnapshot(): CodexSnapshot;
}

function describeUnlockCondition(c: UnlockCondition): string {
  switch (c.kind) {
    case 'reach_realm':
      return `Reach ${c.realm}${c.sublayer != null ? ` ${c.sublayer}` : ''}`;
    case 'choice_category_count':
      return `Make ${c.count}+ ${c.category} choices across lives`;
    case 'outcome_count':
      return `Trigger ${c.outcomeKind} ${c.count}+ times across lives`;
    case 'lives_as_anchor_max_age':
      return `Live ${c.lives}+ full lives as ${c.anchor}`;
    case 'died_with_flag':
      return `Die with the mark of ${c.flag.replace(/_/g, ' ')}`;
    case 'flag_set':
      return `Carry the flag ${c.flag.replace(/_/g, ' ')}`;
    case 'died_in_same_region_streak':
      return `Die in ${c.region} ${c.streak} lives running`;
    case 'reached_insight_cap_lives':
      return `Hit the insight cap in ${c.lives} lives`;
    case 'lived_min_years_in_single_life':
      return `Live ${c.years}+ years in a single life`;
    case 'reached_realm_without_techniques':
      return `Reach ${c.realm} without learning a technique`;
    default:
      return 'Hidden condition';
  }
}

function summarizeEffects(effects: ReadonlyArray<EchoEffect>): string {
  return effects.map((e) => {
    switch (e.kind) {
      case 'stat_mod':       return `${e.delta >= 0 ? '+' : ''}${e.delta} ${e.stat}`;
      case 'stat_mod_pct':   return `${e.pct >= 0 ? '+' : ''}${e.pct}% ${e.stat}`;
      case 'hp_mult':        return `×${e.mult.toFixed(2)} HP`;
      case 'heal_efficacy_pct': return `${e.pct >= 0 ? '+' : ''}${e.pct}% heal efficacy`;
      case 'body_cultivation_rate_pct': return `${e.pct >= 0 ? '+' : ''}${e.pct}% body cultivation`;
      case 'mood_swing_pct': return `${e.pct >= 0 ? '+' : ''}${e.pct}% mood swing`;
      case 'old_age_death_roll_pct': return `${e.pct >= 0 ? '+' : ''}${e.pct}% old-age death roll`;
      case 'insight_cap_bonus': return `+${e.bonus} insight cap`;
      case 'starting_flag':  return `Starts with ${e.flag.replace(/_/g, ' ')}`;
      case 'resolver_bonus': return `+${e.bonus} ${e.category}`;
      case 'event_weight':   return `×${e.mult.toFixed(2)} ${e.eventTag}`;
      case 'imprint_encounter_rate_pct': return `${e.pct >= 0 ? '+' : ''}${e.pct}% imprint rate`;
      default: return '';
    }
  }).filter(Boolean).join(' · ');
}

function describeAnchorUnlock(unlock: string): string {
  if (unlock === 'default') return 'Available from the start';
  switch (unlock) {
    case 'reach_body_tempering_5':  return 'Reach Body Tempering 5 in any past life';
    case 'read_ten_tomes_one_life': return 'Read 10 tomes in one life';
    case 'befriend_sect_disciple':  return 'Befriend a sect disciple';
    default: return unlock.replace(/_/g, ' ');
  }
}

interface BridgeOpts {
  saveManager?: SaveManager;
  library?: SnippetLibrary;
  now?: () => number;
}

function findEventById(events: ReadonlyArray<EventDef>, id: string): EventDef | undefined {
  return events.find((e) => e.id === id);
}

function compositionContextFromStore(
  gs: ReturnType<typeof useGameStore.getState>,
): CompositionContext {
  if (!gs.runState) throw new Error('compositionContextFromStore: no runState');
  const learnedDefs = gs.runState.learnedTechniques
    .map((id) => TECHNIQUE_REGISTRY.byId(id))
    .filter((t): t is NonNullable<typeof t> => t !== null);
  return {
    characterName: gs.runState.character.name,
    region: gs.runState.region,
    season: gs.runState.season,
    realm: gs.runState.character.realm,
    dominantMood: computeDominantMood(zeroMoodInputs(), moodDeltasFromTechniques(learnedDefs)),
    turnIndex: gs.runState.turn,
    runSeed: gs.runState.runSeed,
    extraVariables: {},
  };
}

export function createEngineBridge(opts: BridgeOpts = {}): EngineBridge {
  const sm = opts.saveManager ?? createSaveManager({
    storage: () => localStorage, gameVersion: '0.1.0',
  });
  // Snippet library getter used by the Composer. Phase 1D-3 Task 10 wires the authored
  // Yellow Plains corpus (~80 leaves) as the default. Tests/adapters can still
  // override via opts.library for determinism.
  // Phase 2B-2 Task 24: use a getter so DEFAULT_LIBRARY reflects the post-lazy-load
  // merged state (YP + AP). opts.library override is respected for tests.
  const getLibrary = (): SnippetLibrary => opts.library ?? DEFAULT_LIBRARY;
  const now = opts.now ?? (() => Date.now());

  function currentMetaState(): MetaState {
    return useMetaStore.getState().toMetaState();
  }
  function hydrateMeta(meta: MetaState) {
    useMetaStore.getState().hydrateFromMetaState(meta);
  }

  function buildTurnPreview(
    narrative: string,
    choices: Array<{ id: string; label: string }>,
    tribulation?: TribulationPayload,
  ): TurnPreview {
    const gs = useGameStore.getState();
    if (!gs.runState) throw new Error('buildTurnPreview: no runState in store');
    const rs = gs.runState;
    const regionDef = REGION_REGISTRY.current.byId(rs.region);
    const learnedTechniques: TurnPreviewTechnique[] = rs.learnedTechniques.flatMap((id) => {
      const t = TECHNIQUE_REGISTRY.byId(id);
      return t ? [{ id, name: t.name }] : [];
    });
    const inventory: TurnPreviewItem[] = rs.inventory.flatMap((slot) => {
      const def = ITEM_REGISTRY.byId(slot.id);
      if (!def) return [];
      return [{ id: slot.id, name: def.name, count: slot.count, itemType: def.type }];
    });
    return {
      narrative,
      name: rs.character.name,
      ageYears: Math.floor(rs.character.ageDays / 365),
      hpCurrent: rs.character.hp,
      hpMax: rs.character.hpMax,
      qiCurrent: rs.character.qi,
      qiMax: rs.character.qiMax,
      realm: rs.character.realm,
      insight: rs.character.insight,
      choices,
      region: rs.region,
      regionName: regionDef?.name ?? rs.region.replace(/_/g, ' '),
      corePath: rs.character.corePath,
      corePathRevealedThisTurn: gs.corePathRevealedThisTurn,
      learnedTechniques,
      inventory,
      openMeridians: rs.character.openMeridians,
      tribulation,
    };
  }

  function anchorMultiplierFor(anchorId: string): number {
    return getAnchorById(anchorId)?.karmaMultiplier ?? 1.0;
  }

  function decorateUpgrades(meta: MetaState): BardoPayload['availableUpgrades'] {
    return DEFAULT_UPGRADES.map((u) => {
      const owned = meta.ownedUpgrades.includes(u.id);
      const requirementsMet = u.requires.every((r) => meta.ownedUpgrades.includes(r));
      const affordable = meta.karmaBalance >= u.cost;
      return {
        id: u.id,
        name: u.name,
        description: u.description,
        cost: u.cost,
        affordable,
        requirementsMet,
        owned,
      };
    });
  }

  /**
   * Select+compose the next event and cache its id on RunState.pendingEventId.
   * Idempotent: a second call before resolveChoice returns the same event.
   *
   * Phase 1D-3 addition — closes the race the earlier `chooseAction` had where
   * every click re-selected a (potentially different) event and the UI's click
   * could hit a choiceId that no longer existed.
   */
  async function doPeek(): Promise<TurnPreview> {
    useGameStore.getState().clearCorePathRevealed();
    const gs = useGameStore.getState();
    if (!gs.runState || !gs.streak || !gs.nameRegistry) {
      throw new Error('peekNextEvent: no active run in store');
    }

    // Phase 2B-2 Task 24: ensure gameplay content chunk is loaded (resume path).
    // Normal flow: beginLife already awaited this. This guard covers the case where
    // a page reload restores a saved run and the user resumes directly into doPeek.
    if (!azurePeaksLoaded) {
      await ensureAzurePeaksLoaded();
    }

    // Cached peek: re-render the already-selected event.
    if (gs.runState.pendingEventId) {
      const cached = findEventById(ALL_EVENTS, gs.runState.pendingEventId);
      if (cached) {
        const cursor = gs.runState.rngState?.cursor ?? gs.runState.runSeed;
        const peekRng = derivedRng(cursor, 'narrative');
        const narrative = renderEvent(
          cached,
          compositionContextFromStore(gs),
          getLibrary(),
          gs.nameRegistry,
          peekRng,
        );
        const cachedVisibleChoices = visibleChoicesForCharacter(
          cached.choices,
          gs.runState.learnedTechniques,
          TECHNIQUE_REGISTRY,
        );
        return buildTurnPreview(
          narrative,
          cachedVisibleChoices.map((c) => ({ id: c.id, label: c.label })),
        );
      }
      // Stale cache — fall through to a fresh selection.
    }

    const cursor = gs.runState.rngState?.cursor ?? gs.runState.runSeed;
    const selectorRng = derivedRng(cursor, 'selector');
    const narrativeRng = derivedRng(cursor, 'narrative');
    const rng = selectorRng;  // alias for backward-compat in this block
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
        learnedTechniques: gs.runState.learnedTechniques,
      },
      gs.lifetimeSeenEvents,
      gs.runState.thisLifeSeenEvents,
      rng,
    );
    if (!selected) {
      throw new Error('peekNextEvent: no event selectable from the current context');
    }

    const narrative = renderEvent(
      selected,
      compositionContextFromStore(gs),
      getLibrary(),
      gs.nameRegistry,
      narrativeRng,
    );

    // Cache the selection on runState. NOTE: we do NOT advance the rngState
    // cursor here — resolveChoice will seed its own rng off the same cursor so
    // peek+resolve collectively consume the same RNG bits as the old chooseAction
    // did. The rngState we write is therefore identical to the current one.
    const nextRun = { ...gs.runState, pendingEventId: selected.id };
    useGameStore.getState().updateRun(nextRun, gs.streak, gs.nameRegistry);
    saveRun(sm, nextRun);

    const selectedVisibleChoices = visibleChoicesForCharacter(
      selected.choices,
      gs.runState.learnedTechniques,
      TECHNIQUE_REGISTRY,
    );

    return buildTurnPreview(
      narrative,
      selectedVisibleChoices.map((c) => ({ id: c.id, label: c.label })),
    );
  }

  function buildCreationPayload(): CreationPayload {
    const meta = currentMetaState();
    const unlocked = new Set<string>(meta.unlockedAnchors);
    // Default-unlock anchors are always present.
    for (const a of DEFAULT_ANCHORS) {
      if (a.unlock === 'default') unlocked.add(a.id);
    }
    // freshly-unlocked: read from the just-completed bardo result, if any.
    const fresh = new Set<string>(useGameStore.getState().bardoResult?.freshlyUnlockedAnchors ?? []);
    return {
      availableAnchors: DEFAULT_ANCHORS.map((a) => {
        const isUnlocked = a.unlock === 'default' || unlocked.has(a.id);
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          locked: !isUnlocked,
          unlockHint: describeAnchorUnlock(a.unlock),
          freshlyUnlocked: fresh.has(a.id),
        };
      }),
    };
  }

  function buildBardoPayload(): BardoPayload {
    const gs = useGameStore.getState();
    const meta = currentMetaState();
    if (!gs.bardoResult) throw new Error('buildBardoPayload: no bardoResult in store');
    const br = gs.bardoResult;
    const rs = gs.runState!;

    const witnessedIds = rs.memoriesWitnessedThisLife;
    const manifestedIds = rs.memoriesManifestedThisLife;

    const witnessedThisLife: RevealedMemory[] = witnessedIds.map((id) => {
      const m = MEMORY_REGISTRY.get(id);
      const lifetimeCount = meta.memoriesWitnessed[id] ?? 0;
      const level = lifetimeCount > 0 ? memoryLevelOf(lifetimeCount) : 'fragment';
      return { id, name: m?.name ?? id, level };
    });

    const manifestedThisLife: RevealedMemory[] = manifestedIds.map((id) => {
      const m = MEMORY_REGISTRY.get(id);
      const lifetimeCount = meta.memoriesWitnessed[id] ?? 1;
      const level = memoryLevelOf(Math.max(1, lifetimeCount));
      return {
        id, name: m?.name ?? id, level,
        manifestFlavour: m?.manifestFlavour,
      };
    });

    // The just-pushed lineage entry is the last one; pull echo ids from there.
    const lastEntry = meta.lineage[meta.lineage.length - 1];
    const echoesUnlockedThisLife: RevealedEcho[] = (lastEntry?.echoesUnlockedThisLife ?? []).map((id) => {
      const e = ECHO_REGISTRY.get(id);
      return { id, name: e?.name ?? id, description: e?.description ?? '' };
    });

    const techniquesLearnedThisLife: RevealedTechnique[] = (rs.learnedTechniques ?? []).flatMap((id) => {
      const t = TECHNIQUE_REGISTRY.byId(id);
      return t ? [{ id, name: t.name, description: t.description }] : [];
    });

    return {
      lifeIndex: meta.lifeCount,
      years: br.summary.yearsLived,
      realm: br.summary.realmReached,
      deathCause: br.summary.deathCause,
      karmaEarned: br.karmaEarned,
      karmaBreakdown: {
        yearsLived: br.karmaBreakdown.yearsLived,
        realm: br.karmaBreakdown.realm,
        deathCause: br.karmaBreakdown.deathCause,
        vows: br.karmaBreakdown.vows,
        diedProtecting: br.karmaBreakdown.diedProtecting,
        achievements: br.karmaBreakdown.achievements,
        inLifeDelta: br.karmaBreakdown.inLifeDelta,
      },
      karmaBalance: meta.karmaBalance,
      ownedUpgrades: meta.ownedUpgrades,
      availableUpgrades: decorateUpgrades(meta),
      manifestedThisLife,
      witnessedThisLife,
      echoesUnlockedThisLife,
      corePath: rs.character.corePath,
      techniquesLearnedThisLife,
    };
  }

  return {
    async loadOrInit() {
      // Always hydrate meta from the envelope (or empty-state fallback inside loadMeta).
      const meta = loadMeta(sm);
      hydrateMeta(meta);

      const runEnvelope = loadRun(sm);
      const metaEnvelope = sm.load('wdr.meta');
      // hasSave is truthy when either a run or a meta envelope exists — "there is
      // prior-life state to surface in the UI." Matches plan semantic; either save
      // key is enough for the UI to show a Continue / Reincarnate affordance.
      const hasSave = !!runEnvelope || !!metaEnvelope;

      if (runEnvelope) {
        // Phase 1D-2 simplification: resume straight into PLAYING. Mid-phase restore
        // (CREATION vs BARDO checkpoints) is Phase 2.
        useGameStore.getState().setPhase(GamePhase.PLAYING);
      } else {
        useGameStore.getState().setPhase(GamePhase.TITLE);
      }

      return {
        phase: useGameStore.getState().phase,
        hasSave,
      };
    },

    async beginLife(anchorId, chosenName) {
      const anchor = getAnchorById(anchorId);
      if (!anchor) throw new Error(`beginLife: unknown anchor ${anchorId}`);

      // Phase 2B-2 Task 24: always load the gameplay content chunk before spawning.
      // This ensures TECHNIQUE_REGISTRY, ITEM_REGISTRY, ECHO_REGISTRY, and
      // MEMORY_REGISTRY are populated for the life about to start, regardless of
      // anchor. Also loads AP content so targetRegion is honoured for AP anchors.
      await ensureAzurePeaksLoaded();

      const loadedRegions = ['yellow_plains', 'azure_peaks'];

      const spawnRng = createRng(now() & 0xffffffff);
      const resolved = resolveAnchor(anchor, spawnRng, loadedRegions);
      const runSeed = spawnRng.intRange(0, 0x7fffffff);
      const { character, runState } = characterFromAnchor({
        resolved, name: chosenName, runSeed, rng: spawnRng,
        meta: currentMetaState(),
        echoRegistry: ECHO_REGISTRY,
      });

      // Tag the character so BardoFlow can extract the anchor id for lineage.
      const taggedCharacter = {
        ...character,
        flags: [...character.flags, `anchor:${anchor.id}`],
      };
      const taggedRun = { ...runState, character: taggedCharacter };

      useGameStore.getState().seedRun({
        runState: taggedRun,
        streak: createStreakState(),
        nameRegistry: createNameRegistry(),
        lifetimeSeenEvents: [...useMetaStore.getState().lifetimeSeenEvents],
      });
      useGameStore.getState().setPhase(GamePhase.PLAYING);
      saveRun(sm, taggedRun);

      // Phase 1D-2 simplification: return a preview with NO choices. App.tsx triggers
      // the first chooseAction immediately after seeing this preview. Task 5 wires
      // that flow.
      return buildTurnPreview(
        `${chosenName} steps into the world. The dust of the plains is in the air.`,
        [],
      );
    },

    async peekNextEvent() {
      return doPeek();
    },

    async resolveChoice(choiceId) {
      const gs = useGameStore.getState();
      if (!gs.runState || !gs.streak || !gs.nameRegistry) {
        throw new Error('resolveChoice: no active run in store');
      }

      // Phase 2B-2 Task 24: ensure gameplay content chunk is loaded (resume path).
      if (!azurePeaksLoaded) {
        await ensureAzurePeaksLoaded();
      }

      if (!gs.runState.pendingEventId) {
        throw new Error('resolveChoice: no pending event — call peekNextEvent first');
      }
      const pending = findEventById(ALL_EVENTS, gs.runState.pendingEventId);
      if (!pending) {
        throw new Error(`resolveChoice: pending event ${gs.runState.pendingEventId} not found in pool`);
      }
      const visibleChoices = visibleChoicesForCharacter(
        pending.choices,
        gs.runState.learnedTechniques,
        TECHNIQUE_REGISTRY,
      );
      // learnedDefs needed for mood (Task 10 mood integration)
      const learnedDefs = gs.runState.learnedTechniques
        .map((id) => TECHNIQUE_REGISTRY.byId(id))
        .filter((t): t is NonNullable<typeof t> => t !== null);
      const choice = visibleChoices.find((c) => c.id === choiceId);
      if (!choice) {
        throw new Error(`resolveChoice: choice ${choiceId} not found in event ${pending.id} (or locked)`);
      }

      // Seed the turn RNG off the run's current cursor so replays are deterministic.
      // Fall back to runSeed if (somehow) cursor is absent.
      const seedCursor = gs.runState.rngState?.cursor ?? gs.runState.runSeed;
      const rng = createRng(seedCursor & 0xffffffff);
      const narrativeRng = derivedRng(seedCursor, 'narrative');

      // Phase 2B-1 Task 7: registry-backed technique bonus. Empty registry → 0
      // (no regression vs old resolveTechniqueBonus([]) stub). 2B-2 swaps in
      // the canonical corpus; affinity halving already active here.
      // Phase 2B-2 Task 10: fold mood_modifier effects from learned techniques
      // into dominantMood via moodDeltasFromTechniques (forward note #1).
      // learnedDefs already declared above for visibility filtering — reuse it.
      const dominantMood = computeDominantMood(zeroMoodInputs(), moodDeltasFromTechniques(learnedDefs));
      const techBonus = choice.check?.techniqueBonusCategory
        ? resolveLearnedTechniqueBonus({
            registry: TECHNIQUE_REGISTRY,
            learnedIds: gs.runState.learnedTechniques,
            corePath: gs.runState.character.corePath,
            category: choice.check.techniqueBonusCategory,
          })
        : 0;
      const moodBonus = choice.check
        ? computeMoodBonus(dominantMood, checkCategoryFromEvent(pending.category))
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

      // Render the narrative for this event BEFORE applying deltas so the text
      // composition uses the state the player just acted on. Uses the narrative
      // substream (derivedRng) so the composer is isolated from check/outcome RNG.
      const narrative = renderEvent(
        pending,
        compositionContextFromStore(gs),
        getLibrary(),
        gs.nameRegistry,
        narrativeRng,
      );

      // Apply outcome, then append to thisLifeSeenEvents AND clear pendingEventId.
      // Ordering: applyOutcome does a shallow merge on RunState; the spread after
      // ensures our fields win.
      // Phase 2B-2 Task 12: pass techniqueMultiplier for meditation_progress delta.
      // learnedDefs already declared above for visibility filtering — reuse it.
      const techniqueMultiplier = computeCultivationMultiplier(learnedDefs);
      let nextRunState = applyOutcome(gs.runState, outcome, { techniqueMultiplier, rng });
      nextRunState = {
        ...nextRunState,
        thisLifeSeenEvents: [...nextRunState.thisLifeSeenEvents, pending.id],
        pendingEventId: undefined,
      };

      let nextStreak = recordOutcome(gs.streak, checkResult.tier);
      nextStreak = tickBuff(nextStreak);
      nextRunState = advanceTurn(nextRunState, choice.timeCost, rng);

      // Snapshot the advanced RNG cursor so subsequent turns do not re-seed.
      const advancedState = rng.state();
      nextRunState = {
        ...nextRunState,
        rngState: {
          seed: gs.runState.rngState?.seed ?? gs.runState.runSeed,
          cursor: advancedState.cursor,
        },
      };

      // Phase 2A-2 Task 10 + 11: post-outcome hooks via the shared helper.
      // IDENTICAL call shape to GameLoop.runTurn — the helper owns both:
      //   a. `choice_cat.<event.category>` tracker increment (always), and
      //   b. meditation-gated MemoryManifestResolver roll.
      // Keeping this as a single call site prevents tracker drift between the
      // two paths (runTurn vs. bridge) flagged as an Important concern in the
      // Task 10 reviewer report.
      const currentTracker = gs.echoTracker ?? EchoTracker.empty();
      const hooks = applyPostOutcomeHooks({
        preRunState: gs.runState,
        runState: nextRunState,
        event: pending,
        meta: currentMetaState(),
        echoTracker: currentTracker,
        memoryRegistry: MEMORY_REGISTRY,
      });
      nextRunState = hooks.runState;
      const nextEchoTracker = hooks.echoTracker;
      if (hooks.corePathRevealed) {
        useGameStore.getState().markCorePathRevealed();
      }

      // Phase 2B-3: lift Tribulation I result onto TurnPreview if applyOutcome stamped one.
      let tribulationPayload: TribulationPayload | undefined;
      if (nextRunState.pendingTribulationResult) {
        tribulationPayload = {
          pillarId: nextRunState.pendingTribulationResult.pillarId,
          phases: nextRunState.pendingTribulationResult.phases,
          fatal: nextRunState.pendingTribulationResult.fatal,
        };
        // Clear so a subsequent peek/resolve doesn't re-emit it.
        nextRunState = { ...nextRunState, pendingTribulationResult: undefined };
      }

      useGameStore.getState().updateRun(nextRunState, nextStreak, gs.nameRegistry);
      useGameStore.getState().setEchoTracker(nextEchoTracker);
      useGameStore.getState().setTurnResult({
        eventId: pending.id,
        choiceId,
        tier: checkResult.tier,
        narrative,
        nextRunState,
        nextStreak,
        nextNameRegistry: gs.nameRegistry,
        nextEchoTracker,
        manifested: hooks.manifested,
      });
      useGameStore.getState().appendSeenEvent(pending.id);
      saveRun(sm, nextRunState);

      if (nextRunState.deathCause) {
        const anchorFlag = nextRunState.character.flags.find((f) => f.startsWith('anchor:'));
        const anchorId = anchorFlag ? anchorFlag.slice(7) : 'unknown';
        const mult = anchorMultiplierFor(anchorId);
        // Fold the life-scoped tracker into meta.echoProgress BEFORE runBardoFlow
        // so EchoUnlocker (inside BardoFlow) observes this life's counters.
        // Scope: keeps runBardoFlow's signature stable from Task 9.
        const metaWithProgress = commitTrackerToMeta(currentMetaState(), nextEchoTracker);
        const bardo = runBardoFlow(nextRunState, metaWithProgress, mult, ECHO_REGISTRY);
        useGameStore.getState().setBardoResult(bardo);
        useGameStore.getState().setEchoTracker(null); // reset for next life
        hydrateMeta(bardo.meta);
        saveMeta(sm, bardo.meta);
        useGameStore.getState().setPhase(GamePhase.BARDO);
        return buildBardoPayload();
      }

      // Still alive — auto-peek the next event for the UI.
      const next = await doPeek();
      return tribulationPayload ? { ...next, tribulation: tribulationPayload } : next;
    },
    async beginBardo() {
      const gs = useGameStore.getState();
      if (gs.bardoResult) {
        return buildBardoPayload();
      }
      // Rare: reload captured a dead character without a computed bardoResult.
      if (gs.runState?.deathCause) {
        const anchorFlag = gs.runState.character.flags.find((f) => f.startsWith('anchor:'));
        const anchorId = anchorFlag ? anchorFlag.slice(7) : 'unknown';
        const mult = anchorMultiplierFor(anchorId);
        // Tracker fallback invariant (Task 10 I2):
        //   The primary death path in `resolveChoice` calls
        //   `commitTrackerToMeta(...)` BEFORE `setEchoTracker(null)` and BEFORE
        //   `saveMeta`. So after a reload the persisted meta already holds the
        //   previous life's counters, and `gs.echoTracker` is either `null`
        //   (typical — we cleared it) or a lingering non-empty snapshot if the
        //   reload captured a mid-flight state that never reached commit.
        //   Either way, passing `EchoTracker.empty()` on the null branch is
        //   safe: `commitTrackerToMeta(empty)` is a no-op, so echoProgress is
        //   preserved. A non-empty fallback tracker here would double-count;
        //   this is accepted as a known belt-and-braces limitation of the
        //   crash-recovery flow (the player's actual lived counters win).
        const fallbackTracker = gs.echoTracker ?? EchoTracker.empty();
        const metaWithProgress = commitTrackerToMeta(currentMetaState(), fallbackTracker);
        const bardo = runBardoFlow(gs.runState, metaWithProgress, mult, ECHO_REGISTRY);
        useGameStore.getState().setBardoResult(bardo);
        useGameStore.getState().setEchoTracker(null);
        hydrateMeta(bardo.meta);
        saveMeta(sm, bardo.meta);
        useGameStore.getState().setPhase(GamePhase.BARDO);
        return buildBardoPayload();
      }
      throw new Error('beginBardo: no bardo state — character is still alive');
    },

    async spendKarma(upgradeId) {
      const gs = useGameStore.getState();
      if (!gs.bardoResult) {
        throw new Error('spendKarma: no active bardo session');
      }
      const upgrade = getUpgradeById(upgradeId);
      if (!upgrade) throw new Error(`spendKarma: unknown upgrade ${upgradeId}`);

      const meta = currentMetaState();
      const next = purchaseUpgrade(meta, upgradeId);
      if (!next) {
        throw new Error(`spendKarma: cannot purchase ${upgradeId} (locked, unaffordable, or already owned)`);
      }
      hydrateMeta(next);
      saveMeta(sm, next);
      return buildBardoPayload();
    },

    async reincarnate() {
      clearRun(sm);
      useGameStore.getState().resetRun();
      useGameStore.getState().setPhase(GamePhase.CREATION);
      return buildCreationPayload();
    },

    listAnchors() {
      return buildCreationPayload();
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

    getLineage() {
      return useMetaStore.getState().lineage;
    },

    getLineageSnapshot(): LineageSnapshot {
      const meta = currentMetaState();
      const sorted = [...meta.lineage].sort((a, b) => b.lifeIndex - a.lifeIndex);
      const entries: LineageEntryView[] = sorted.map((entry) => {
        const anchor = getAnchorById(entry.anchorId);
        const echoes = entry.echoesUnlockedThisLife.map((id) => {
          const e = ECHO_REGISTRY.get(id);
          return { id, name: e?.name ?? id };
        });
        return {
          lifeIndex: entry.lifeIndex,
          name: entry.name,
          anchorId: entry.anchorId,
          anchorName: anchor?.name ?? entry.anchorId,
          birthYear: entry.birthYear,
          deathYear: entry.deathYear,
          yearsLived: entry.yearsLived,
          realmReached: entry.realmReached,
          deathCause: entry.deathCause,
          karmaEarned: entry.karmaEarned,
          echoesUnlockedThisLife: echoes,
          corePath: entry.corePath,
          techniqueCount: entry.techniquesLearned.length,
        };
      });
      return { entries };
    },

    getCodexSnapshot(): CodexSnapshot {
      const meta = currentMetaState();
      const witnessed = meta.memoriesWitnessed;
      const manifested = new Set(meta.memoriesManifested);
      const unlockedEchoes = new Set(meta.echoesUnlocked);
      const unlockedAnchors = new Set(meta.unlockedAnchors);

      const echoes = ECHO_REGISTRY.all().map<CodexEchoEntry>((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        tier: e.tier,
        unlocked: unlockedEchoes.has(e.id),
        unlockHint: describeUnlockCondition(e.unlockCondition),
        effectsSummary: summarizeEffects(e.effects),
      }));

      const memories = MEMORY_REGISTRY.all().map<CodexMemoryEntry>((m) => {
        const count = witnessed[m.id] ?? 0;
        const level: CodexMemoryEntry['level'] = count <= 0
          ? 'unseen'
          : memoryLevelOf(count);
        const witnessFlavour = level === 'unseen' ? null : (m.witnessFlavour[level as 'fragment' | 'partial' | 'complete'] ?? null);
        return {
          id: m.id,
          name: m.name,
          description: m.description,
          element: m.element,
          level,
          witnessFlavour,
          manifested: manifested.has(m.id),
          manifestFlavour: manifested.has(m.id) ? m.manifestFlavour : null,
        };
      });

      const anchors = DEFAULT_ANCHORS.map<CodexAnchorEntry>((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        unlocked: a.unlock === 'default' || unlockedAnchors.has(a.id),
        unlockHint: describeAnchorUnlock(a.unlock),
        karmaMultiplier: a.karmaMultiplier,
      }));

      const seenTech = new Set(meta.seenTechniques);
      // "learned" reflects current life if any; if no live run, fall back to lineage's most-recent entry's techniquesLearned.
      const learnedSet = new Set<string>(
        useGameStore.getState().runState?.learnedTechniques
        ?? (meta.lineage.length > 0 ? meta.lineage[meta.lineage.length - 1]!.techniquesLearned : []),
      );
      const techniques = TECHNIQUE_REGISTRY.all().map<CodexTechniqueEntry>((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        grade: t.grade,
        seen: seenTech.has(t.id) || learnedSet.has(t.id),
        learned: learnedSet.has(t.id),
      }));

      return { echoes, memories, anchors, techniques };
    },
  };
}

/**
 * Test-only: eagerly load all gameplay content (techniques, items, echoes, memories,
 * Azure Peaks region+events+snippets) and populate the live-binding registries.
 * Equivalent to what `beginLife` does at the start of each life.
 * Call this in test `beforeEach` or test body before asserting on registry contents.
 */
export async function __loadGameplayContent(): Promise<void> {
  return ensureAzurePeaksLoaded();
}
