import { useState, useEffect, lazy, Suspense } from 'react';
import type { TurnPreview } from '@/services/engineBridge';

const InventoryPanel = lazy(() => import('./InventoryPanel').then((m) => ({ default: m.InventoryPanel })));
const CharSheetPanel = lazy(() => import('./CharSheetPanel').then((m) => ({ default: m.CharSheetPanel })));
const TribulationPanel = lazy(() => import('./TribulationPanel').then((m) => ({ default: m.TribulationPanel })));

export interface PlayScreenProps {
  preview: TurnPreview;
  onChoose: (choiceId: string) => void | Promise<void>;
  isLoading?: boolean;
}

export function PlayScreen({ preview, onChoose, isLoading }: PlayScreenProps) {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [charSheetOpen, setCharSheetOpen] = useState(false);
  const [tribulationDismissed, setTribulationDismissed] = useState(false);
  const showTribulation = !!preview.tribulation && !tribulationDismissed;
  useEffect(() => {
    setTribulationDismissed(false);
  }, [preview.tribulation]);

  // Phase 2C: scroll the document to top whenever a new beat/decision narrative
  // arrives so each new paragraph starts at the top of the viewport.
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [preview.narrative]);

  // Phase 2C: detect a beat (single Continue choice) and render a centered
  // Continue button instead of the full choice list.
  const isBeat = preview.choices.length === 1 && preview.choices[0]?.id === 'continue';

  return (
    <div className="min-h-screen bg-ink-950 text-parchment-100 flex flex-col font-serif">
      <header className="border-b border-parchment-800 bg-ink-900 px-6 py-3 flex justify-between items-center text-sm">
        <div className="flex items-center gap-3">
          <span className="text-jade-300">{preview.name}</span>
          <span className="text-parchment-400">age {preview.ageYears}</span>
          <span className="text-parchment-500">· {preview.regionName}</span>
        </div>
        <div className="flex gap-3 items-center text-parchment-300">
          <span>HP {preview.hpCurrent} / {preview.hpMax}</span>
          <span>Qi {preview.qiCurrent} / {preview.qiMax}</span>
          <span>Insight {preview.insight}</span>
          <span className="uppercase text-parchment-500">{preview.realm}</span>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => setCharSheetOpen(true)}
            className="px-2 py-1 border border-parchment-700 rounded hover:border-parchment-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Character
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => setInventoryOpen(true)}
            className="px-2 py-1 border border-parchment-700 rounded hover:border-parchment-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Inventory
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-8 max-w-3xl mx-auto w-full">
        <p className="text-base leading-loose mb-8 whitespace-pre-line max-w-2xl">
          {preview.narrative}
        </p>

        <div className="w-full flex flex-col gap-2">
          {preview.choices.length === 0 ? (
            <p className="text-parchment-500 italic text-center">Waiting for the world to move…</p>
          ) : isBeat ? (
            <div className="flex justify-center">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => onChoose(preview.choices[0]!.id)}
                className="px-8 py-3 bg-jade-700 text-parchment-100 rounded hover:bg-jade-600 disabled:opacity-40 disabled:cursor-not-allowed text-base"
              >
                Continue
              </button>
            </div>
          ) : (
            preview.choices.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={isLoading}
                onClick={() => onChoose(c.id)}
                className="px-4 py-3 border border-parchment-700 rounded text-left hover:border-jade-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {c.label}
              </button>
            ))
          )}
        </div>
      </main>

      {inventoryOpen && (
        <Suspense fallback={null}>
          <InventoryPanel
            items={preview.inventory}
            onClose={() => setInventoryOpen(false)}
          />
        </Suspense>
      )}
      {charSheetOpen && (
        <Suspense fallback={null}>
          <CharSheetPanel
            corePath={preview.corePath}
            corePathRevealedThisTurn={preview.corePathRevealedThisTurn}
            techniques={preview.learnedTechniques}
            openMeridians={preview.openMeridians}
            onClose={() => setCharSheetOpen(false)}
          />
        </Suspense>
      )}
      {showTribulation && preview.tribulation && (
        <Suspense fallback={null}>
          <TribulationPanel
            payload={preview.tribulation}
            onContinue={() => setTribulationDismissed(true)}
          />
        </Suspense>
      )}
    </div>
  );
}
