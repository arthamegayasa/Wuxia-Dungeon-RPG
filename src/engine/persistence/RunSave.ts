// RunState persistence under the `wdr.run` key.
// Source: docs/spec/design.md §10.2.

import { RunState } from '@/engine/events/RunState';
import { SaveManager } from './SaveManager';

export const RUN_SCHEMA_VERSION = 1;
const RUN_KEY = 'wdr.run';

export function saveRun(sm: SaveManager, rs: RunState): void {
  sm.save(RUN_KEY, rs, RUN_SCHEMA_VERSION);
}

export function loadRun(sm: SaveManager): RunState | null {
  const env = sm.load<RunState>(RUN_KEY);
  return env?.data ?? null;
}

export function clearRun(sm: SaveManager): void {
  sm.clear(RUN_KEY);
}
