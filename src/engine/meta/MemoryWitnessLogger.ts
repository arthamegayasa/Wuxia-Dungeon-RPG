// Per-life witness dedup + commit to MetaState on death. Source: docs/spec/design.md §7.3.

import { RunState } from '@/engine/events/RunState';
import { MetaState } from './MetaState';

export function logWitness(rs: RunState, techniqueId: string): RunState {
  if (rs.memoriesWitnessedThisLife.includes(techniqueId)) return rs;
  return {
    ...rs,
    memoriesWitnessedThisLife: [...rs.memoriesWitnessedThisLife, techniqueId],
  };
}

export function commitWitnesses(meta: MetaState, thisLifeIds: ReadonlyArray<string>): MetaState {
  if (thisLifeIds.length === 0) return meta;
  const next: Record<string, number> = { ...meta.memoriesWitnessed };
  for (const id of thisLifeIds) {
    next[id] = (next[id] ?? 0) + 1;
  }
  return { ...meta, memoriesWitnessed: next };
}
