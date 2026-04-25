import { useEffect, useState } from 'react';
import { GamePhase } from '@/engine/core/Types';
import {
  createEngineBridge, EngineBridge, TurnPreview, BardoPayload,
  CodexSnapshot, LineageSnapshot, CreationAnchorView,
} from '@/services/engineBridge';
import { useGameStore } from '@/state/gameStore';
import { TitleScreen } from '@/components/TitleScreen';
import { CreationScreen } from '@/components/CreationScreen';
import { PlayScreen } from '@/components/PlayScreen';
import { BardoPanel } from '@/components/BardoPanel';
import { CodexScreen } from '@/components/CodexScreen';
import { LineageScreen } from '@/components/LineageScreen';

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
  const [anchors, setAnchors] = useState<ReadonlyArray<CreationAnchorView>>([]);
  const [codexSnap, setCodexSnap] = useState<CodexSnapshot | null>(null);
  const [lineageSnap, setLineageSnap] = useState<LineageSnapshot | null>(null);
  const [returnPhase, setReturnPhase] = useState<GamePhase>(GamePhase.TITLE);

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
      const preview = await getEngine().peekNextEvent();
      setPreview(preview);
    } finally {
      setIsLoading(false);
    }
  }

  async function onBegin(anchorId: string, name: string) {
    setIsLoading(true);
    try {
      await getEngine().beginLife(anchorId, name);
      const preview = await getEngine().peekNextEvent();
      setPreview(preview);
    } finally {
      setIsLoading(false);
    }
  }

  async function onChoose(choiceId: string) {
    setIsLoading(true);
    try {
      const next = await getEngine().resolveChoice(choiceId);
      if ('karmaEarned' in next) {
        setBardoPayload(next);
      } else {
        setPreview(next);
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

  function openCodex() {
    setReturnPhase(useGameStore.getState().phase);
    setCodexSnap(getEngine().getCodexSnapshot());
    useGameStore.getState().setPhase(GamePhase.CODEX);
  }

  function openLineage() {
    setReturnPhase(useGameStore.getState().phase);
    setLineageSnap(getEngine().getLineageSnapshot());
    useGameStore.getState().setPhase(GamePhase.LINEAGE);
  }

  function closeOverlay() {
    useGameStore.getState().setPhase(returnPhase);
    setCodexSnap(null);
    setLineageSnap(null);
  }

  if (phase === GamePhase.TITLE) {
    return (
      <TitleScreen
        hasSave={hasSave}
        onNewGame={onNewGame}
        onContinue={onContinue}
        onOpenCodex={openCodex}
        onOpenLineage={openLineage}
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
        onOpenCodex={openCodex}
        onOpenLineage={openLineage}
        isLoading={isLoading}
      />
    );
  }
  if (phase === GamePhase.CODEX && codexSnap) {
    return <CodexScreen snapshot={codexSnap} onBack={closeOverlay} />;
  }
  if (phase === GamePhase.LINEAGE && lineageSnap) {
    return <LineageScreen snapshot={lineageSnap} onBack={closeOverlay} />;
  }

  // Transitional fallback - occurs briefly between phase change and state sync.
  return (
    <div className="min-h-screen bg-ink-950 text-parchment-400 flex items-center justify-center font-serif">
      <span>...</span>
    </div>
  );
}

export default App;
