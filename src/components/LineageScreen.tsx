import type { LineageSnapshot, LineageEntryView } from '@/services/engineBridge';

export interface LineageScreenProps {
  snapshot: LineageSnapshot;
  onBack: () => void;
}

export function LineageScreen({ snapshot, onBack }: LineageScreenProps) {
  return (
    <div className="min-h-screen bg-ink-950 text-parchment-100 flex flex-col items-center py-8 font-serif">
      <div className="w-full max-w-3xl px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl text-jade-300">Lineage</h2>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 border border-parchment-700 rounded hover:border-parchment-500"
          >
            Back
          </button>
        </div>

        {snapshot.entries.length === 0 ? (
          <p className="text-parchment-500 italic">No lives yet. The wheel has not turned.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {snapshot.entries.map((e) => <LifeCard key={e.lifeIndex} entry={e} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function LifeCard({ entry }: { entry: LineageEntryView }) {
  const yearLine = entry.birthYear > 0
    ? `Year ${entry.birthYear} – ${entry.deathYear}`
    : `Years lived: ${entry.yearsLived}`;
  return (
    <li className="border border-parchment-700 bg-ink-900 rounded p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-lg text-jade-300">
          Life {entry.lifeIndex} — {entry.name}
        </span>
        <span className="text-xs text-parchment-500">{yearLine}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm text-parchment-300">
        <dt>Anchor</dt><dd>{entry.anchorName}</dd>
        <dt>Realm reached</dt><dd>{entry.realmReached}</dd>
        <dt>Cause of death</dt><dd>{entry.deathCause}</dd>
        <dt>Karma earned</dt><dd>{entry.karmaEarned}</dd>
      </dl>
      {entry.echoesUnlockedThisLife.length > 0 && (
        <div className="mt-2 text-xs text-jade-400">
          Echo unlocked this life: {entry.echoesUnlockedThisLife.map((e) => e.name).join(', ')}
        </div>
      )}
    </li>
  );
}
