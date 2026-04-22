export interface PlayScreenProps {
  preview: {
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
  };
  onChoose: (choiceId: string) => void | Promise<void>;
  isLoading?: boolean;
}

export function PlayScreen({ preview, onChoose, isLoading }: PlayScreenProps) {
  return (
    <div className="min-h-screen bg-ink-950 text-parchment-100 flex flex-col font-serif">
      <header className="border-b border-parchment-800 bg-ink-900 px-6 py-3 flex justify-between items-center text-sm">
        <div>
          <span className="text-jade-300 mr-3">{preview.name}</span>
          <span className="text-parchment-400">age {preview.ageYears}</span>
        </div>
        <div className="flex gap-4 text-parchment-300">
          <span>HP {preview.hpCurrent} / {preview.hpMax}</span>
          <span>Qi {preview.qiCurrent} / {preview.qiMax}</span>
          <span>Insight {preview.insight}</span>
          <span className="uppercase text-parchment-500">{preview.realm}</span>
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
    </div>
  );
}
