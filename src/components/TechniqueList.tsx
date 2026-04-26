import type { TurnPreviewTechnique } from '@/services/engineBridge';

export interface TechniqueListProps {
  techniques: ReadonlyArray<TurnPreviewTechnique>;
}

export function TechniqueList({ techniques }: TechniqueListProps) {
  if (techniques.length === 0) {
    return (
      <div className="text-parchment-500 italic text-sm">No techniques learned.</div>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {techniques.map((t) => (
        <li key={t.id} className="text-parchment-200">
          · {t.name}
        </li>
      ))}
    </ul>
  );
}
