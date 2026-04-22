import { useState } from 'react';

export interface CreationScreenProps {
  anchors: ReadonlyArray<{ id: string; name: string; description: string }>;
  defaultName?: string;
  onBegin: (anchorId: string, name: string) => void | Promise<void>;
  onBack: () => void;
  isLoading?: boolean;
}

export function CreationScreen(props: CreationScreenProps) {
  const [selectedAnchor, setSelectedAnchor] = useState<string | null>(null);
  const [name, setName] = useState(props.defaultName ?? '');

  const trimmed = name.trim();
  const canBegin = !!selectedAnchor && trimmed.length > 0 && !props.isLoading;

  return (
    <div className="min-h-screen bg-ink-950 text-parchment-100 flex flex-col items-center justify-center p-8 font-serif">
      <h2 className="text-3xl mb-2">Choose Your Birth</h2>
      <p className="text-parchment-300 mb-8 max-w-xl text-center">
        The soul you were is gone. Which womb receives it?
      </p>

      <div className="w-full max-w-2xl flex flex-col gap-3 mb-6">
        {props.anchors.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setSelectedAnchor(a.id)}
            disabled={props.isLoading}
            className={`text-left px-4 py-3 border rounded transition
              ${selectedAnchor === a.id
                ? 'border-jade-400 bg-ink-800'
                : 'border-parchment-700 hover:border-parchment-500'}`}
          >
            <div className="text-xl text-jade-300">{a.name}</div>
            <div className="text-sm text-parchment-400">{a.description}</div>
          </button>
        ))}
      </div>

      <div className="w-full max-w-2xl mb-6">
        <label htmlFor="char-name" className="block text-sm text-parchment-400 mb-1">
          Name
        </label>
        <input
          id="char-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={props.isLoading}
          className="w-full px-3 py-2 bg-ink-900 border border-parchment-700 rounded
                     text-parchment-100 focus:border-jade-400 focus:outline-none"
          placeholder="Lin Wei"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={props.onBack}
          className="px-4 py-2 border border-parchment-700 rounded hover:border-parchment-500"
        >
          Back
        </button>
        <button
          type="button"
          disabled={!canBegin}
          onClick={() => props.onBegin(selectedAnchor!, trimmed)}
          className="px-6 py-2 bg-jade-600 text-ink-950 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-jade-500"
        >
          Begin Life
        </button>
      </div>
    </div>
  );
}
