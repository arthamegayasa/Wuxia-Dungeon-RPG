import { CorePathBadge } from './CorePathBadge';
import { TechniqueList } from './TechniqueList';
import type { TurnPreviewTechnique } from '@/services/engineBridge';

export interface CharSheetPanelProps {
  corePath: string | null;
  corePathRevealedThisTurn: boolean;
  techniques: ReadonlyArray<TurnPreviewTechnique>;
  openMeridians: ReadonlyArray<number>;
  onClose: () => void;
}

export function CharSheetPanel(props: CharSheetPanelProps) {
  return (
    <div className="fixed inset-0 bg-ink-950/80 flex items-center justify-center z-40 font-serif">
      <div className="bg-ink-900 border border-parchment-700 rounded p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl text-jade-300">Character</h3>
          <button
            type="button"
            onClick={props.onClose}
            className="px-3 py-1 border border-parchment-700 rounded hover:border-parchment-500"
          >
            Close
          </button>
        </div>

        <section className="mb-4">
          <CorePathBadge
            corePath={props.corePath}
            revealedThisTurn={props.corePathRevealedThisTurn}
          />
        </section>

        <section className="mb-4">
          <h4 className="text-sm uppercase tracking-wide text-parchment-500 mb-1">Meridians</h4>
          <p className="text-parchment-300 text-sm">
            {props.openMeridians.length} meridians open
          </p>
        </section>

        <section>
          <h4 className="text-sm uppercase tracking-wide text-parchment-500 mb-1">Techniques</h4>
          <TechniqueList techniques={props.techniques} />
        </section>
      </div>
    </div>
  );
}
