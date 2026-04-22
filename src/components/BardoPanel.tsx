import { Fragment } from 'react';

export interface BardoPanelProps {
  payload: {
    lifeIndex: number;
    years: number;
    realm: string;
    deathCause: string;
    karmaEarned: number;
    karmaBreakdown: Record<string, number>;
    karmaBalance: number;
    ownedUpgrades: ReadonlyArray<string>;
    availableUpgrades: ReadonlyArray<{
      id: string; name: string; description: string; cost: number;
      affordable: boolean; requirementsMet: boolean; owned: boolean;
    }>;
  };
  onBuyUpgrade: (upgradeId: string) => void | Promise<void>;
  onReincarnate: () => void | Promise<void>;
  isLoading?: boolean;
}

export function BardoPanel({ payload, onBuyUpgrade, onReincarnate, isLoading }: BardoPanelProps) {
  return (
    <div className="min-h-screen bg-ink-950 text-parchment-100 flex flex-col items-center py-12 font-serif">
      <h2 className="text-3xl mb-8 text-jade-300">The Bardo</h2>

      {/* Life summary card */}
      <section className="w-full max-w-2xl bg-ink-900 border border-parchment-800 rounded p-6 mb-6">
        <h3 className="text-xl mb-2">Life {payload.lifeIndex}</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-parchment-300">
          <dt>Years lived</dt><dd>{payload.years} years</dd>
          <dt>Final realm</dt><dd>{payload.realm}</dd>
          <dt>Cause of death</dt><dd>{payload.deathCause}</dd>
        </dl>
      </section>

      {/* Karma breakdown */}
      <section className="w-full max-w-2xl bg-ink-900 border border-parchment-800 rounded p-6 mb-6">
        <h3 className="text-xl mb-4">
          {`Karma earned: ${payload.karmaEarned} · Balance: ${payload.karmaBalance}`}
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-parchment-400 text-sm">
          {Object.entries(payload.karmaBreakdown).map(([k, v]) => (
            <Fragment key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </Fragment>
          ))}
        </dl>
      </section>

      {/* Upgrade shop */}
      <section className="w-full max-w-2xl bg-ink-900 border border-parchment-800 rounded p-6 mb-6">
        <h3 className="text-xl mb-4">Karmic Upgrades</h3>
        <div className="flex flex-col gap-2">
          {payload.availableUpgrades.map((u) => {
            const disabled = isLoading || u.owned || !u.affordable || !u.requirementsMet;
            return (
              <button
                key={u.id}
                type="button"
                disabled={disabled}
                onClick={() => onBuyUpgrade(u.id)}
                className={`text-left px-4 py-3 border rounded transition
                  ${u.owned
                    ? 'border-jade-600 bg-ink-800 opacity-60'
                    : disabled
                      ? 'border-parchment-800 opacity-40 cursor-not-allowed'
                      : 'border-parchment-700 hover:border-jade-400'}`}
              >
                <div className="flex justify-between">
                  <span className="text-jade-200">{u.name}</span>
                  <span className="text-parchment-500">
                    {u.owned ? 'owned' : !u.requirementsMet ? 'locked' : `${u.cost} karma`}
                  </span>
                </div>
                <div className="text-sm text-parchment-400">{u.description}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Reincarnate */}
      <button
        type="button"
        disabled={isLoading}
        onClick={onReincarnate}
        className="px-6 py-3 bg-jade-600 text-ink-950 rounded hover:bg-jade-500 disabled:opacity-40"
      >
        Reincarnate
      </button>
    </div>
  );
}
