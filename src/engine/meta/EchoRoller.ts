// Roll N echoes from unlocked pool with conflict resolution. Seeded.

import { IRng } from '@/engine/core/RNG';
import { EchoRegistry } from './EchoRegistry';

export interface RollEchoesArgs {
  registry: EchoRegistry;
  unlockedIds: ReadonlyArray<string>;
  slotCount: number;
  rng: IRng;
}

export function rollEchoes(args: RollEchoesArgs): ReadonlyArray<string> {
  const { registry, unlockedIds, slotCount, rng } = args;
  if (slotCount <= 0) return [];

  const pool: string[] = [];
  for (const id of unlockedIds) {
    if (registry.has(id)) pool.push(id);
  }
  if (pool.length === 0) return [];

  const picked: string[] = [];
  const pickedSet = new Set<string>();

  const remaining = [...pool];
  while (picked.length < slotCount && remaining.length > 0) {
    const i = rng.intRange(0, remaining.length - 1);
    const candidateId = remaining[i]!;
    remaining.splice(i, 1);

    const candidate = registry.get(candidateId)!;
    const conflictsWithPicked = candidate.conflicts.some((c) => pickedSet.has(c));
    if (conflictsWithPicked) continue;

    picked.push(candidateId);
    pickedSet.add(candidateId);
  }

  return picked;
}
