import { Fragment } from 'react';
import type { RevealedMemory, RevealedEcho } from '@/services/engineBridge';

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
    manifestedThisLife: ReadonlyArray<RevealedMemory>;
    witnessedThisLife: ReadonlyArray<RevealedMemory>;
    echoesUnlockedThisLife: ReadonlyArray<RevealedEcho>;
  };
  onBuyUpgrade: (upgradeId: string) => void | Promise<void>;
  onReincarnate: () => void | Promise<void>;
  onOpenCodex?: () => void;
  onOpenLineage?: () => void;
  isLoading?: boolean;
}

export function BardoPanel({ payload, onBuyUpgrade, onReincarnate, onOpenCodex, onOpenLineage, isLoading }: BardoPanelProps) {
  return (
    <div className="min-h-screen bg-ink-950 text-parchment-100 flex flex-col items-center py-12 font-serif">
      <h2 className="text-3xl mb-8 text-jade-300">The Bardo</h2>

      {/* Life summary card (unchanged) */}
      <section className="w-full max-w-2xl bg-ink-900 border border-parchment-800 rounded p-6 mb-6">
        <h3 className="text-xl mb-2">Life {payload.lifeIndex}</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-parchment-300">
          <dt>Years lived</dt><dd>{payload.years} years</dd>
          <dt>Final realm</dt><dd>{payload.realm}</dd>
          <dt>Cause of death</dt><dd>{payload.deathCause}</dd>
        </dl>
      </section>

      {/* 10a — Manifested memories */}
      {payload.manifestedThisLife.length > 0 && (
        <section className="w-full max-w-2xl bg-ink-900 border border-jade-700 rounded p-6 mb-6">
          <h3 className="text-xl mb-3 text-jade-300">You remembered…</h3>
          <ul className="flex flex-col gap-2">
            {payload.manifestedThisLife.map((m) => (
              <li key={m.id} className="text-parchment-200">
                <div className="text-lg">{m.name}</div>
                {m.manifestFlavour && (
                  <div className="text-xs italic text-parchment-500">{m.manifestFlavour}</div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 10b — Witnessed memories (compact list) */}
      {payload.witnessedThisLife.length > 0 && (
        <section className="w-full max-w-2xl bg-ink-900 border border-parchment-800 rounded p-6 mb-6">
          <h3 className="text-xl mb-3">You saw:</h3>
          <ul className="text-parchment-300 text-sm">
            {payload.witnessedThisLife.map((m) => (
              <li key={m.id}>· {m.name} ({m.level})</li>
            ))}
          </ul>
        </section>
      )}

      {/* 10c — Echoes unlocked this life */}
      {payload.echoesUnlockedThisLife.length > 0 && (
        <section className="w-full max-w-2xl bg-ink-900 border border-jade-700 rounded p-6 mb-6">
          <h3 className="text-xl mb-3 text-jade-300">A new echo wakes</h3>
          <ul className="flex flex-col gap-3">
            {payload.echoesUnlockedThisLife.map((e) => (
              <li key={e.id} className="border border-jade-800 rounded p-3 bg-ink-900/60">
                <div className="text-lg text-jade-300">{e.name}</div>
                <div className="text-sm text-parchment-300 mt-1">{e.description}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Karma breakdown (unchanged) */}
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

      {/* Upgrade shop (unchanged from Phase 1) */}
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

      {/* Codex / Lineage / Reincarnate */}
      <div className="flex gap-3">
        {onOpenCodex && (
          <button
            type="button"
            onClick={onOpenCodex}
            className="px-4 py-2 border border-parchment-700 rounded hover:border-parchment-500"
          >
            Codex
          </button>
        )}
        {onOpenLineage && (
          <button
            type="button"
            onClick={onOpenLineage}
            className="px-4 py-2 border border-parchment-700 rounded hover:border-parchment-500"
          >
            Lineage
          </button>
        )}
        <button
          type="button"
          disabled={isLoading}
          onClick={onReincarnate}
          className="px-6 py-3 bg-jade-600 text-ink-950 rounded hover:bg-jade-500 disabled:opacity-40"
        >
          Reincarnate
        </button>
      </div>
    </div>
  );
}
