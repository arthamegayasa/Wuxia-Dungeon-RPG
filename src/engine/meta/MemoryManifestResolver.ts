// Forbidden Memory manifestation roll. Source: docs/spec/design.md §7.3.
// 2A decision C: manifest grants insight + flag (no technique registry yet).

import { createRng } from '@/engine/core/RNG';
import { RunState } from '@/engine/events/RunState';
import { MetaState } from './MetaState';
import { MemoryRegistry } from './MemoryRegistry';
import { memoryLevelOf, memoryLevelNumber } from './ForbiddenMemory';

export const MANIFEST_ATTEMPTS_PER_LIFE = 3;

export interface ManifestArgs {
  runState: RunState;
  meta: MetaState;
  registry: MemoryRegistry;
}

export interface ManifestResult {
  runState: RunState;
  manifested: ReadonlyArray<string>;
}

function studentOfTheWheelLevel(meta: MetaState): number {
  for (let lvl = 3; lvl >= 1; lvl -= 1) {
    if (meta.ownedUpgrades.includes(`student_of_the_wheel_${lvl}`)) return lvl;
  }
  return 0;
}

function manifestChance(
  meta: MetaState,
  character: RunState['character'],
  lifetimeWitnesses: number,
): number {
  const lvl = memoryLevelNumber(memoryLevelOf(lifetimeWitnesses));
  const sotwLevel = studentOfTheWheelLevel(meta);
  const raw =
    2
    + character.attributes.Mind * 0.1
    + character.insight * 0.01
    + lvl * 5
    + sotwLevel * 25;
  return Math.max(1, Math.min(60, raw));
}

function manifestSeed(runSeed: number, turn: number): number {
  let h = runSeed ^ 0x9e3779b9;
  h = Math.imul(h ^ (turn + 0x85ebca6b), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  return h || 1;
}

export function rollManifest(args: ManifestArgs): ManifestResult {
  const { runState, meta, registry } = args;

  if (runState.manifestAttemptsThisLife >= MANIFEST_ATTEMPTS_PER_LIFE) {
    return { runState, manifested: [] };
  }

  const witnessed = Object.entries(meta.memoriesWitnessed)
    .filter(([id, count]) => count > 0 && registry.has(id))
    .map(([id, count]) => ({ id, count }))
    .filter(({ id }) => !runState.memoriesManifestedThisLife.includes(id));

  const nextAttempts = runState.manifestAttemptsThisLife + 1;

  if (witnessed.length === 0) {
    return {
      runState: { ...runState, manifestAttemptsThisLife: nextAttempts },
      manifested: [],
    };
  }

  witnessed.sort((a, b) => a.id.localeCompare(b.id));

  const rng = createRng(manifestSeed(runState.runSeed, runState.turn));
  const manifested: string[] = [];
  let character = runState.character;
  const manifestFlags: string[] = [];

  for (const { id, count } of witnessed) {
    const chance = manifestChance(meta, character, count);
    const roll = rng.intRange(1, 100);
    if (roll <= chance) {
      const mem = registry.get(id)!;
      manifested.push(id);
      character = {
        ...character,
        insight: Math.min(character.insightCap, character.insight + mem.manifestInsightBonus),
      };
      manifestFlags.push(mem.manifestFlag);
    }
  }

  const finalCharacter = {
    ...character,
    flags: [
      ...character.flags,
      ...manifestFlags.filter((f) => !character.flags.includes(f)),
    ],
  };

  return {
    runState: {
      ...runState,
      character: finalCharacter,
      manifestAttemptsThisLife: nextAttempts,
      memoriesManifestedThisLife: [...runState.memoriesManifestedThisLife, ...manifested],
    },
    manifested,
  };
}
