import type { TribulationPayload } from '@/services/engineBridge';

const PHASE_LABELS: Record<string, string> = {
  heart_demon: 'Heart Demon',
  first_thunder: 'First Thunder',
  second_thunder: 'Second Thunder',
  third_thunder: 'Third Thunder',
};

export interface TribulationPanelProps {
  payload: TribulationPayload;
  onContinue: () => void;
}

export function TribulationPanel({ payload, onContinue }: TribulationPanelProps) {
  return (
    <div className="fixed inset-0 bg-ink-950/90 flex items-center justify-center z-50 font-serif">
      <div className="bg-ink-900 border border-jade-700 rounded p-8 w-full max-w-2xl">
        <h2 className="text-3xl text-jade-300 mb-2 text-center">The Heavens Stir</h2>
        <p className="text-center text-parchment-400 mb-6 italic">
          Foundation refining begins. Four trials must be endured.
        </p>

        <ol className="flex flex-col gap-3 mb-6">
          {payload.phases.map((p) => (
            <li
              key={p.phaseId}
              className={`border rounded p-4 ${
                p.success ? 'border-jade-700 bg-ink-900' : 'border-rose-700 bg-ink-900/60'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-lg text-parchment-100">
                  {PHASE_LABELS[p.phaseId] ?? p.phaseId}
                </span>
                {p.success ? (
                  <span aria-label="Passed" className="text-jade-300 text-xl">✓</span>
                ) : (
                  <span aria-label="Failed" className="text-rose-300 text-xl">✗</span>
                )}
              </div>
              <div className="text-xs text-parchment-500 mt-1">
                rolled {p.roll} vs chance {p.chance}
              </div>
            </li>
          ))}
        </ol>

        <p className="text-center mb-6">
          {payload.fatal ? (
            <span className="text-rose-300 text-xl">The body shatters.</span>
          ) : (
            <span className="text-jade-300 text-xl">Tribulation Endured.</span>
          )}
        </p>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={onContinue}
            className="px-6 py-3 bg-jade-600 text-ink-950 rounded hover:bg-jade-500"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
