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
