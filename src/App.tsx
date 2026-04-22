import { useEffect, useState } from 'react';
import { GamePhase } from '@/engine/core/Types';
import { createEngineBridge, EngineBridge, TurnPreview, BardoPayload } from '@/services/engineBridge';
import { useGameStore } from '@/state/gameStore';
import { TitleScreen } from '@/components/TitleScreen';
import { CreationScreen } from '@/components/CreationScreen';
import { PlayScreen } from '@/components/PlayScreen';
import { BardoPanel } from '@/components/BardoPanel';

let engineSingleton: EngineBridge | null = null;
let engineOverride: EngineBridge | null = null;

function getEngine(): EngineBridge {
  if (engineOverride) return engineOverride;
  if (!engineSingleton) engineSingleton = createEngineBridge();
  return engineSingleton;
}

// Test hook: reset the cached engine singleton so each test gets a fresh instance.
// Not intended for production code.
export function __resetEngineSingleton() {
  engineSingleton = null;
  engineOverride = null;
}

// Test hook: pre-register an engine with deterministic opts (e.g. `now: () => 2`).
// The next getEngine() call will return this instance instead of lazily constructing
// one. Not intended for production code.
export function __setEngineOverride(engine: EngineBridge | null) {
  engineOverride = engine;
  engineSingleton = null;
}

export function App() {
  const phase = useGameStore((s) => s.phase);
  const [hasSave, setHasSave] = useState(false);
  const [preview, setPreview] = useState<TurnPreview | null>(null);
  const [bardoPayload, setBardoPayload] = useState<BardoPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [anchors, setAnchors] = useState<
    ReadonlyArray<{ id: string; name: string; description: string }>
  >([]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const engine = getEngine();
      const init = await engine.loadOrInit();
      setHasSave(init.hasSave);
      setAnchors(engine.listAnchors().availableAnchors);
      setIsLoading(false);
    })();
  }, []);

  async function onNewGame() {
    useGameStore.getState().setPhase(GamePhase.CREATION);
    setAnchors(getEngine().listAnchors().availableAnchors);
  }

  async function onContinue() {
    setIsLoading(true);
    try {
      useGameStore.getState().setPhase(GamePhase.PLAYING);
      // Drive one turn to produce a preview from the resumed run. Same retry pattern
      // as onBegin — the selector may land on any fixture event, so try each choice
      // id until one matches.
      for (const choiceId of ['ch_work', 'ch_train', 'ch_fight']) {
        try {
          const next = await getEngine().chooseAction(choiceId);
          if ('karmaEarned' in next) {
            setBardoPayload(next);
            useGameStore.getState().setPhase(GamePhase.BARDO);
          } else {
            setPreview(next);
          }
          break;
        } catch (e: any) {
          if (!/choice.*not found/i.test(e.message)) throw e;
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function onBegin(anchorId: string, name: string) {
    setIsLoading(true);
    try {
      await getEngine().beginLife(anchorId, name);
      // beginLife returns an empty-choice preview by design (Phase 1D-2 simplification).
      // Kick off the first real turn. Try each fixture choice id in turn - the selector
      // may land on FX_BENIGN_DAY, FX_TRAIN_BODY, or FX_BANDIT, so try each.
      for (const choiceId of ['ch_work', 'ch_train', 'ch_fight']) {
        try {
          const next = await getEngine().chooseAction(choiceId);
          if ('karmaEarned' in next) {
            setBardoPayload(next);
          } else {
            setPreview(next);
          }
          break;
        } catch (e: any) {
          if (!/choice.*not found/i.test(e.message)) throw e;
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function onChoose(choiceId: string) {
    setIsLoading(true);
    try {
      // The selector may land on any fixture event, so the requested choiceId
      // might not be valid for the newly-selected event. Try the clicked choice
      // first, then fall back to the other fixture choices until one matches.
      // (Phase 1D-3 will replace this with real event-authoring.)
      const fallbacks = ['ch_work', 'ch_train', 'ch_fight'].filter((c) => c !== choiceId);
      const attempts = [choiceId, ...fallbacks];
      for (const id of attempts) {
        try {
          const next = await getEngine().chooseAction(id);
          if ('karmaEarned' in next) {
            setBardoPayload(next);
          } else {
            setPreview(next);
          }
          break;
        } catch (e: any) {
          if (!/choice.*not found/i.test(e.message)) throw e;
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function onBuyUpgrade(upgradeId: string) {
    setIsLoading(true);
    try {
      const p = await getEngine().spendKarma(upgradeId);
      setBardoPayload(p);
    } finally {
      setIsLoading(false);
    }
  }

  async function onReincarnate() {
    setIsLoading(true);
    try {
      const p = await getEngine().reincarnate();
      setAnchors(p.availableAnchors);
      setPreview(null);
      setBardoPayload(null);
    } finally {
      setIsLoading(false);
    }
  }

  if (phase === GamePhase.TITLE) {
    return (
      <TitleScreen
        hasSave={hasSave}
        onNewGame={onNewGame}
        onContinue={onContinue}
        onOpenCodex={() => {}}
      />
    );
  }
  if (phase === GamePhase.CREATION) {
    return (
      <CreationScreen
        anchors={anchors}
        onBegin={onBegin}
        onBack={() => useGameStore.getState().setPhase(GamePhase.TITLE)}
        isLoading={isLoading}
      />
    );
  }
  if (phase === GamePhase.PLAYING && preview) {
    return <PlayScreen preview={preview} onChoose={onChoose} isLoading={isLoading} />;
  }
  if (phase === GamePhase.BARDO && bardoPayload) {
    return (
      <BardoPanel
        payload={bardoPayload}
        onBuyUpgrade={onBuyUpgrade}
        onReincarnate={onReincarnate}
        isLoading={isLoading}
      />
    );
  }

  // Transitional fallback - occurs briefly between phase change and state sync.
  return (
    <div className="min-h-screen bg-ink-950 text-parchment-400 flex items-center justify-center font-serif">
      <span>...</span>
    </div>
  );
}

export default App;
