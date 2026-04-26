import { useState } from 'react';
import type { CodexSnapshot, CodexEchoEntry, CodexMemoryEntry, CodexAnchorEntry, CodexTechniqueEntry } from '@/services/engineBridge';

export interface CodexScreenProps {
  snapshot: CodexSnapshot;
  onBack: () => void;
}

type Tab = 'memories' | 'echoes' | 'anchors' | 'techniques';

export function CodexScreen({ snapshot, onBack }: CodexScreenProps) {
  const [tab, setTab] = useState<Tab>('memories');

  return (
    <div className="min-h-screen bg-ink-950 text-parchment-100 flex flex-col items-center py-8 font-serif">
      <div className="w-full max-w-3xl px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl text-jade-300">Codex</h2>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 border border-parchment-700 rounded hover:border-parchment-500"
          >
            Back
          </button>
        </div>

        <div role="tablist" className="flex gap-2 mb-6 border-b border-parchment-800">
          {(['memories', 'echoes', 'anchors', 'techniques'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 capitalize transition border-b-2 -mb-px ${
                tab === t
                  ? 'border-jade-400 text-jade-300'
                  : 'border-transparent text-parchment-400 hover:text-parchment-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'memories' && <MemoriesTab memories={snapshot.memories} />}
        {tab === 'echoes' && <EchoesTab echoes={snapshot.echoes} />}
        {tab === 'anchors' && <AnchorsTab anchors={snapshot.anchors} />}
        {tab === 'techniques' && <TechniquesTab techniques={snapshot.techniques} />}
      </div>
    </div>
  );
}

function MemoriesTab({ memories }: { memories: ReadonlyArray<CodexMemoryEntry> }) {
  if (memories.length === 0 || memories.every((m) => m.level === 'unseen')) {
    return <p className="text-parchment-500 italic">Seen nowhere yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {memories.map((m) => (
        <li
          key={m.id}
          className={`border rounded p-4 ${
            m.level === 'unseen'
              ? 'border-ash-800 bg-ink-900/40 text-ash-500'
              : 'border-parchment-700 bg-ink-900'
          }`}
        >
          {m.level === 'unseen' ? (
            <>
              <div className="text-lg italic">— unseen —</div>
              <div className="text-xs">A memory the soul has not yet brushed against.</div>
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-lg text-jade-300">{m.name}</span>
                <span className="text-xs uppercase tracking-wide text-parchment-500">
                  {m.level}{m.manifested ? ' · recalled' : ''}
                </span>
              </div>
              <div className="text-sm text-parchment-300 mt-1">{m.description}</div>
              <div className="text-xs text-parchment-500 italic mt-2">Element: {m.element}</div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function EchoesTab({ echoes }: { echoes: ReadonlyArray<CodexEchoEntry> }) {
  if (echoes.length === 0) {
    return <p className="text-parchment-500 italic">No echoes catalogued.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {echoes.map((e) => (
        <li
          key={e.id}
          className={`border rounded p-4 ${
            e.unlocked ? 'border-jade-700 bg-ink-900' : 'border-ash-800 bg-ink-900/40 text-ash-500'
          }`}
        >
          {e.unlocked ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-lg text-jade-300">{e.name}</span>
                <span className="text-xs uppercase tracking-wide text-parchment-500">{e.tier}</span>
              </div>
              <div className="text-sm text-parchment-300 mt-1">{e.description}</div>
              <div className="text-xs text-parchment-500 italic mt-2">{e.effectsSummary}</div>
            </>
          ) : (
            <>
              <div className="text-lg italic">— locked —</div>
              <div className="text-xs">{e.unlockHint}</div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function AnchorsTab({ anchors }: { anchors: ReadonlyArray<CodexAnchorEntry> }) {
  if (anchors.length === 0) {
    return <p className="text-parchment-500 italic">No anchors known.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {anchors.map((a) => (
        <li
          key={a.id}
          className={`border rounded p-4 ${
            a.unlocked ? 'border-jade-700 bg-ink-900' : 'border-ash-800 bg-ink-900/40 text-ash-500'
          }`}
        >
          {a.unlocked ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-lg text-jade-300">{a.name}</span>
                <span className="text-xs text-parchment-500">×{a.karmaMultiplier.toFixed(2)} karma</span>
              </div>
              <div className="text-sm text-parchment-300 mt-1">{a.description}</div>
            </>
          ) : (
            <>
              <div className="text-lg italic">— locked —</div>
              <div className="text-xs">{a.unlockHint}</div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function TechniquesTab({ techniques }: { techniques: ReadonlyArray<CodexTechniqueEntry> }) {
  if (techniques.length === 0) {
    return <p className="text-parchment-500 italic">No techniques catalogued.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {techniques.map((t) => (
        <li
          key={t.id}
          className={`border rounded p-4 ${
            t.seen ? 'border-parchment-700 bg-ink-900' : 'border-ash-800 bg-ink-900/40 text-ash-500'
          }`}
        >
          {t.seen ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-lg text-jade-300">{t.name}</span>
                <span className="text-xs uppercase tracking-wide text-parchment-500">
                  <span>{t.grade}</span>
                  {' · '}
                  <span>{t.learned ? 'learned' : 'seen'}</span>
                </span>
              </div>
              <div className="text-sm text-parchment-300 mt-1">{t.description}</div>
            </>
          ) : (
            <>
              <div className="text-lg italic">— locked —</div>
              <div className="text-xs">A technique not yet seen by the soul.</div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
