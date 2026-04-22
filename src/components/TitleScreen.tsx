import React from 'react';

export interface TitleScreenProps {
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
  onOpenCodex: () => void;
}

export function TitleScreen({ hasSave, onNewGame, onContinue, onOpenCodex }: TitleScreenProps): React.JSX.Element {
  return (
    <div className="h-full w-full flex items-center justify-center bg-ink-900 text-parchment-100 font-serif">
      <div className="max-w-xl w-full px-8 text-center">
        <h1 className="text-4xl md:text-5xl mb-2 text-jade-400">
          The Thousand Deaths
        </h1>
        <h2 className="text-xl md:text-2xl mb-12 text-parchment-400 italic">
          of a Would-Be Immortal
        </h2>

        <div className="flex flex-col gap-3 items-stretch">
          <button
            type="button"
            onClick={onNewGame}
            className="py-3 px-6 border border-jade-700 text-jade-300 hover:bg-jade-900/40 transition"
          >
            New Life
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={!hasSave}
            className="py-3 px-6 border border-parchment-700 text-parchment-300 hover:bg-parchment-900/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={onOpenCodex}
            className="py-3 px-6 border border-ash-700 text-ash-300 hover:bg-ash-900/30 transition"
          >
            Codex
          </button>
        </div>

        <p className="mt-16 text-xs text-parchment-600 italic">
          &mdash; The Wheel turns. Patience. &mdash;
        </p>
      </div>
    </div>
  );
}
