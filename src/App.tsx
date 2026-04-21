import React, { useEffect, useState } from 'react';
import { TitleScreen } from './components/TitleScreen';
import { createEngineBridge, EngineBridge } from './services';
import { GamePhase } from './engine/core/Types';

export default function App(): React.JSX.Element {
  const [engine] = useState<EngineBridge>(() => createEngineBridge());
  const [phase, setPhase] = useState<GamePhase>(GamePhase.TITLE);
  const [hasSave, setHasSave] = useState(false);

  useEffect(() => {
    engine.loadOrInit().then((r) => {
      setPhase(r.phase);
      setHasSave(!!r.turn);
    });
  }, [engine]);

  const handleNewGame = (): void => {
    // Phase 0: stub — advance phase locally so we see the transition fire.
    setPhase(GamePhase.CREATION);
  };
  const handleContinue = (): void => { /* Phase 0 stub */ };
  const handleOpenCodex = (): void => setPhase(GamePhase.CODEX);

  if (phase === GamePhase.TITLE) {
    return (
      <TitleScreen
        hasSave={hasSave}
        onNewGame={handleNewGame}
        onContinue={handleContinue}
        onOpenCodex={handleOpenCodex}
      />
    );
  }

  // Phase 0 placeholder for any non-title phase.
  return (
    <div className="h-full w-full flex items-center justify-center bg-ink-900 text-parchment-100 font-serif">
      <div className="text-center">
        <p className="text-parchment-400 mb-4">
          You have entered the phase: <code className="text-jade-400">{phase}</code>.
        </p>
        <p className="text-parchment-600 italic text-sm">(Phase 0: no content yet. Phase 1 will wire this in.)</p>
        <button
          type="button"
          onClick={() => setPhase(GamePhase.TITLE)}
          className="mt-8 py-2 px-5 border border-parchment-700 text-parchment-300 hover:bg-parchment-900/20"
        >
          Back to Title
        </button>
      </div>
    </div>
  );
}
