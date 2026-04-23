// Real engineBridge — adapter from UI → engine. Source: docs/spec/design.md §2, §11.

import { GamePhase, CheckCategory } from '@/engine/core/Types';
import { SaveManager, createSaveManager } from '@/engine/persistence/SaveManager';
import { loadRun, saveRun, clearRun } from '@/engine/persistence/RunSave';
import {
  MetaState, loadMeta, saveMeta, LineageEntrySummary, purchaseUpgrade,
} from '@/engine/meta/MetaState';
import { getAnchorById, DEFAULT_ANCHORS } from '@/engine/meta/Anchor';
import { resolveAnchor } from '@/engine/meta/AnchorResolver';
import { characterFromAnchor } from '@/engine/meta/characterFromAnchor';
import { createRng } from '@/engine/core/RNG';
import {
  createStreakState, recordOutcome, computeStreakBonus, computeWorldMaliceBuff, tickBuff,
} from '@/engine/choices/StreakTracker';
import { SnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { createNameRegistry } from '@/engine/narrative/NameRegistry';
import { computeDominantMood, zeroMoodInputs } from '@/engine/narrative/Mood';
import { renderEvent, CompositionContext } from '@/engine/narrative/Composer';
import { selectEvent } from '@/engine/events/EventSelector';
import { resolveCheck } from '@/engine/choices/ChoiceResolver';
import { resolveOutcome } from '@/engine/choices/OutcomeResolver';
import { applyOutcome } from '@/engine/events/OutcomeApplier';
import { advanceTurn } from '@/engine/events/AgeTick';
import { resolveTechniqueBonus } from '@/engine/cultivation/Technique';
import { computeMoodBonus } from '@/engine/narrative/MoodBonus';
import { runBardoFlow } from '@/engine/bardo/BardoFlow';
// NB: runTurn is no longer used — replaced by peekNextEvent + resolveChoice split.
import { DEFAULT_UPGRADES, getUpgradeById } from '@/engine/meta/KarmicUpgrade';
import { loadEvents } from '@/content/events/loader';
import { loadSnippets } from '@/content/snippets/loader';
import { EventDef } from '@/content/schema';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';

import dailyJson from '@/content/events/yellow_plains/daily.json';
import trainingJson from '@/content/events/yellow_plains/training.json';
import socialJson from '@/content/events/yellow_plains/social.json';
import dangerJson from '@/content/events/yellow_plains/danger.json';
import opportunityJson from '@/content/events/yellow_plains/opportunity.json';
import transitionJson from '@/content/events/yellow_plains/transition.json';
import ypSnippets from '@/content/snippets/yellow_plains.json';

// Phase 1D-3 Task 10: Yellow Plains content pool. Flattens all authored regional
// packs (~50 events) into one selectable array. Snippet library is the single
// Yellow Plains pack (~80 leaves) that backs narrative composition.
const ALL_EVENTS: ReadonlyArray<EventDef> = [
  ...loadEvents(dailyJson),
  ...loadEvents(trainingJson),
  ...loadEvents(socialJson),
  ...loadEvents(dangerJson),
  ...loadEvents(opportunityJson),
  ...loadEvents(transitionJson),
];
const DEFAULT_LIBRARY: SnippetLibrary = loadSnippets(ypSnippets);

export interface LoadOrInitResult {
  phase: GamePhase;
  hasSave: boolean;
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
}

export interface CreationPayload {
  availableAnchors: ReadonlyArray<{ id: string; name: string; description: string }>;
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

export interface CodexSnapshot {
  memories: readonly string[];
  echoes: readonly string[];
  anchors: readonly string[];
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
  getCodex(): CodexSnapshot;
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
  return {
    characterName: gs.runState.character.name,
    region: gs.runState.region,
    season: gs.runState.season,
    realm: gs.runState.character.realm,
    dominantMood: computeDominantMood(zeroMoodInputs()),
    turnIndex: gs.runState.turn,
    runSeed: gs.runState.runSeed,
    extraVariables: {},
  };
}

export function createEngineBridge(opts: BridgeOpts = {}): EngineBridge {
  const sm = opts.saveManager ?? createSaveManager({
    storage: () => localStorage, gameVersion: '0.1.0',
  });
  // Snippet library used by the Composer. Phase 1D-3 Task 10 wires the authored
  // Yellow Plains corpus (~80 leaves) as the default. Tests/adapters can still
  // override via opts.library for determinism.
  const library = opts.library ?? DEFAULT_LIBRARY;
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
  ): TurnPreview {
    const gs = useGameStore.getState();
    if (!gs.runState) throw new Error('buildTurnPreview: no runState in store');
    const rs = gs.runState;
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
  function doPeek(): TurnPreview {
    const gs = useGameStore.getState();
    if (!gs.runState || !gs.streak || !gs.nameRegistry) {
      throw new Error('peekNextEvent: no active run in store');
    }

    // Cached peek: re-render the already-selected event.
    if (gs.runState.pendingEventId) {
      const cached = findEventById(ALL_EVENTS, gs.runState.pendingEventId);
      if (cached) {
        const peekRng = createRng(
          ((gs.runState.rngState?.cursor ?? gs.runState.runSeed) + 1) & 0xffffffff,
        );
        const narrative = renderEvent(
          cached,
          compositionContextFromStore(gs),
          library,
          gs.nameRegistry,
          peekRng,
        );
        return buildTurnPreview(
          narrative,
          cached.choices.map((c) => ({ id: c.id, label: c.label })),
        );
      }
      // Stale cache — fall through to a fresh selection.
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

    const narrative = renderEvent(
      selected,
      compositionContextFromStore(gs),
      library,
      gs.nameRegistry,
      rng,
    );

    // Cache the selection on runState. NOTE: we do NOT advance the rngState
    // cursor here — resolveChoice will seed its own rng off the same cursor so
    // peek+resolve collectively consume the same RNG bits as the old chooseAction
    // did. The rngState we write is therefore identical to the current one.
    const nextRun = { ...gs.runState, pendingEventId: selected.id };
    useGameStore.getState().updateRun(nextRun, gs.streak, gs.nameRegistry);
    saveRun(sm, nextRun);

    return buildTurnPreview(
      narrative,
      selected.choices.map((c) => ({ id: c.id, label: c.label })),
    );
  }

  function buildBardoPayload(): BardoPayload {
    const gs = useGameStore.getState();
    const meta = currentMetaState();
    if (!gs.bardoResult) throw new Error('buildBardoPayload: no bardoResult in store');
    const br = gs.bardoResult;
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

      const spawnRng = createRng(now() & 0xffffffff);
      const resolved = resolveAnchor(anchor, spawnRng);
      const runSeed = spawnRng.intRange(0, 0x7fffffff);
      const { character, runState } = characterFromAnchor({
        resolved, name: chosenName, runSeed, rng: spawnRng,
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

      // Seed the turn RNG off the run's current cursor so replays are deterministic.
      // Fall back to runSeed if (somehow) cursor is absent.
      const seedCursor = gs.runState.rngState?.cursor ?? gs.runState.runSeed;
      const rng = createRng(seedCursor & 0xffffffff);

      // Phase 1D-1 zero-placeholders: technique registry, inventory effects, echoes,
      // and memories don't exist yet. resolveTechniqueBonus([]) → 0; itemBonus /
      // echoBonus / memoryBonus wired in Phase 2+. NOT bugs.
      const dominantMood = computeDominantMood(zeroMoodInputs());
      const techBonus = choice.check?.techniqueBonusCategory
        ? resolveTechniqueBonus([], choice.check.techniqueBonusCategory)
        : 0;
      const moodBonus = choice.check?.techniqueBonusCategory
        ? computeMoodBonus(dominantMood, choice.check.techniqueBonusCategory as CheckCategory)
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
      // composition uses the state the player just acted on. Uses the same rng as
      // the check — composer is deterministic off the current cursor.
      const narrative = renderEvent(
        pending,
        compositionContextFromStore(gs),
        library,
        gs.nameRegistry,
        rng,
      );

      // Apply outcome, then append to thisLifeSeenEvents AND clear pendingEventId.
      // Ordering: applyOutcome does a shallow merge on RunState; the spread after
      // ensures our fields win.
      let nextRunState = applyOutcome(gs.runState, outcome);
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

      useGameStore.getState().updateRun(nextRunState, nextStreak, gs.nameRegistry);
      useGameStore.getState().setTurnResult({
        eventId: pending.id,
        choiceId,
        tier: checkResult.tier,
        narrative,
        nextRunState,
        nextStreak,
        nextNameRegistry: gs.nameRegistry,
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

      // Still alive — auto-peek the next event for the UI.
      return doPeek();
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
        const bardo = runBardoFlow(gs.runState, currentMetaState(), mult);
        useGameStore.getState().setBardoResult(bardo);
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
      return {
        availableAnchors: DEFAULT_ANCHORS
          .filter((a) => a.unlock === 'default'
            || useMetaStore.getState().unlockedAnchors.includes(a.id))
          .map((a) => ({ id: a.id, name: a.name, description: a.description })),
      };
    },

    listAnchors() {
      const meta = currentMetaState();
      const available = DEFAULT_ANCHORS.filter((a) =>
        a.unlock === 'default' || meta.unlockedAnchors.includes(a.id),
      );
      return {
        availableAnchors: available.map((a) => ({
          id: a.id, name: a.name, description: a.description,
        })),
      };
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

    getCodex() {
      const m = useMetaStore.getState();
      return {
        memories: m.unlockedMemories,
        echoes: m.unlockedEchoes,
        anchors: m.unlockedAnchors,
      };
    },
  };
}
