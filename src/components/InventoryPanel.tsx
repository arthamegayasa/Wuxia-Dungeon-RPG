import type { TurnPreviewItem } from '@/services/engineBridge';

const TYPE_HEADINGS: Record<TurnPreviewItem['itemType'], string> = {
  pill: 'Pills',
  manual: 'Manuals',
  weapon: 'Weapons',
  armor: 'Armor',
  talisman: 'Talismans',
  misc: 'Misc',
};

const TYPE_ORDER: ReadonlyArray<TurnPreviewItem['itemType']> =
  ['pill', 'manual', 'weapon', 'armor', 'talisman', 'misc'];

export interface InventoryPanelProps {
  items: ReadonlyArray<TurnPreviewItem>;
  onClose: () => void;
}

export function InventoryPanel({ items, onClose }: InventoryPanelProps) {
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: items.filter((i) => i.itemType === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="fixed inset-0 bg-ink-950/80 flex items-center justify-center z-40 font-serif">
      <div className="bg-ink-900 border border-parchment-700 rounded p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl text-jade-300">Inventory</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 border border-parchment-700 rounded hover:border-parchment-500"
          >
            Close
          </button>
        </div>
        {grouped.length === 0 ? (
          <p className="text-parchment-500 italic">Inventory is empty.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {grouped.map((g) => (
              <section key={g.type}>
                <h4 className="text-sm uppercase tracking-wide text-parchment-500 mb-1">
                  {TYPE_HEADINGS[g.type]}
                </h4>
                <ul className="flex flex-col gap-1">
                  {g.items.map((it) => (
                    <li key={it.id} className="flex justify-between text-parchment-200">
                      <span>{it.name}</span>
                      <span className="text-parchment-500">×{it.count}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
