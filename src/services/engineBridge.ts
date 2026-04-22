// Real engineBridge — adapter from UI → engine. Source: docs/spec/design.md §2, §11.

import { GamePhase } from '@/engine/core/Types';
import { SaveManager, createSaveManager } from '@/engine/persistence/SaveManager';
import { loadRun, saveRun } from '@/engine/persistence/RunSave';
import {
  MetaState, loadMeta, LineageEntrySummary,
} from '@/engine/meta/MetaState';
import { getAnchorById, DEFAULT_ANCHORS } from '@/engine/meta/Anchor';
import { resolveAnchor } from '@/engine/meta/AnchorResolver';
import { characterFromAnchor } from '@/engine/meta/characterFromAnchor';
import { createRng } from '@/engine/core/RNG';
import { createStreakState } from '@/engine/choices/StreakTracker';
import { createSnippetLibrary, SnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { createNameRegistry } from '@/engine/narrative/NameRegistry';
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
  // Library reserved for Task 5 (chooseAction narrative composition). Not used yet
  // but we accept + construct it now so the Task 4 signature matches the plan.
  const _library = opts.library ?? createSnippetLibrary({});
  void _library;
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
      const runSeed = Math.floor(Math.random() * 0x7fffffff);
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

    async chooseAction(_choiceId) {
      throw new Error('chooseAction: implemented in Task 5');
    },
    async beginBardo() { throw new Error('beginBardo: implemented in Task 6'); },
    async spendKarma(_upgradeId) { throw new Error('spendKarma: implemented in Task 6'); },
    async reincarnate() { throw new Error('reincarnate: implemented in Task 6'); },

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
