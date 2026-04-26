const PATH_LABELS: Record<string, string> = {
  iron_mountain: 'Iron Mountain',
  severing_edge: 'Severing Edge',
  still_water: 'Still Water',
  howling_storm: 'Howling Storm',
  blood_ember: 'Blood Ember',
  root_and_bough: 'Root and Bough',
  thousand_mirrors: 'Thousand Mirrors',
  hollow_vessel: 'Hollow Vessel',
  shattered_path: 'Shattered Path',
};

export interface CorePathBadgeProps {
  corePath: string | null;
  revealedThisTurn: boolean;
}

export function CorePathBadge({ corePath, revealedThisTurn }: CorePathBadgeProps) {
  const label = corePath ? (PATH_LABELS[corePath] ?? corePath) : 'Wandering';
  const shimmer = revealedThisTurn ? 'animate-pulse ring-1 ring-jade-400/60' : '';
  return (
    <div
      data-testid="core-path-badge"
      className={`inline-flex items-center gap-2 px-3 py-1 border border-jade-700 rounded text-sm text-jade-300 ${shimmer}`}
    >
      <span className="uppercase text-xs text-parchment-500">Path</span>
      <span>{label}</span>
    </div>
  );
}
