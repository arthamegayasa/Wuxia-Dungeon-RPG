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
import { createRng } from '@/engine/core/RNG';
import { createStreakState } from '@/engine/choices/StreakTracker';
import { createSnippetLibrary, SnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { createNameRegistry } from '@/engine/narrative/NameRegistry';
import { computeDominantMood, zeroMoodInputs } from '@/engine/narrative/Mood';
import { runTurn } from '@/engine/core/GameLoop';
import { runBardoFlow } from '@/engine/bardo/BardoFlow';
import { DEFAULT_UPGRADES, getUpgradeById } from '@/engine/meta/KarmicUpgrade';
import { FIXTURE_EVENTS } from '@/content/events/fixture';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';

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
  chooseAction(choiceId: string): Promise<TurnPreview | BardoPayload>;
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

export function createEngineBridge(opts: BridgeOpts = {}): EngineBridge {
  const sm = opts.saveManager ?? createSaveManager({
    storage: () => localStorage, gameVersion: '0.1.0',
  });
  // Snippet library used by the Composer inside runTurn. An empty library is fine
  // for the 1D-2 fixture events: their intro lines use `$[CHAR_NAME]` which falls
  // back to an empty string when absent. Phase 1D-3 will author a real corpus.
  const library = opts.library ?? createSnippetLibrary({});
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

    async chooseAction(choiceId) {
      const gs = useGameStore.getState();
      if (!gs.runState || !gs.streak || !gs.nameRegistry) {
        throw new Error('chooseAction: no active run in store');
      }

      // Seed the turn RNG off the run's current cursor so replays are deterministic.
      // Fall back to runSeed if (somehow) cursor is absent.
      const seedCursor = gs.runState.rngState?.cursor ?? gs.runState.runSeed;
      const rng = createRng(seedCursor & 0xffffffff);

      const tr = runTurn(
        {
          runState: gs.runState,
          streak: gs.streak,
          events: FIXTURE_EVENTS,
          library,
          nameRegistry: gs.nameRegistry,
          lifetimeSeenEvents: gs.lifetimeSeenEvents,
          dominantMood: computeDominantMood(zeroMoodInputs()),
        },
        choiceId,
        rng,
      );

      // GameLoop.runTurn does not write the advanced RNG cursor back into
      // nextRunState.rngState, so without this fix-up every subsequent chooseAction
      // would re-seed from the same cursor and roll identical outcomes every turn.
      // The bridge owns its own determinism contract, so we snapshot the rng here.
      const advancedState = rng.state();
      const nextRunState = {
        ...tr.nextRunState,
        rngState: { seed: gs.runState.rngState?.seed ?? gs.runState.runSeed, cursor: advancedState.cursor },
      };

      useGameStore.getState().updateRun(nextRunState, tr.nextStreak, tr.nextNameRegistry);
      useGameStore.getState().setTurnResult({ ...tr, nextRunState });
      useGameStore.getState().appendSeenEvent(tr.eventId);
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

      // Still alive — return the current event's choices as the next preview.
      const activeEvent = FIXTURE_EVENTS.find((e) => e.id === tr.eventId)!;
      return buildTurnPreview(
        tr.narrative,
        activeEvent.choices.map((c) => ({ id: c.id, label: c.label })),
      );
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
