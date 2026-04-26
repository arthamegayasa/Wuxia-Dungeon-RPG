import { useState, useEffect } from 'react';
import { InventoryPanel } from './InventoryPanel';
import { CharSheetPanel } from './CharSheetPanel';
import { TribulationPanel } from './TribulationPanel';
import type { TurnPreview } from '@/services/engineBridge';

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
        <p className="text-lg leading-relaxed mb-8 whitespace-pre-line">
          {preview.narrative}
        </p>

        <div className="w-full flex flex-col gap-2">
          {preview.choices.length === 0 ? (
            <p className="text-parchment-500 italic text-center">Waiting for the world to move…</p>
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
        <InventoryPanel
          items={preview.inventory}
          onClose={() => setInventoryOpen(false)}
        />
      )}
      {charSheetOpen && (
        <CharSheetPanel
          corePath={preview.corePath}
          corePathRevealedThisTurn={preview.corePathRevealedThisTurn}
          techniques={preview.learnedTechniques}
          openMeridians={preview.openMeridians}
          onClose={() => setCharSheetOpen(false)}
        />
      )}
      {showTribulation && preview.tribulation && (
        <TribulationPanel
          payload={preview.tribulation}
          onContinue={() => setTribulationDismissed(true)}
        />
      )}
    </div>
  );
}
