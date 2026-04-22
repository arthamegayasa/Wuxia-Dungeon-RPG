// The core probability resolver. Source: docs/spec/design.md §5.3.

import { OutcomeTier, Stat } from '@/engine/core/Types';
import { IRng } from '@/engine/core/RNG';
import { Choice } from '@/content/schema';
import { AttributeMap } from '@/engine/character/Attribute';

export interface ResolveArgs {
  /** The check from the Choice. `undefined` means auto-success. */
  check: Choice['check'] | undefined;
  characterStats: Readonly<AttributeMap>;
  characterSkills: Readonly<Record<string, number>>;
  techniqueBonus: number;
  itemBonus: number;
  echoBonus: number;
  memoryBonus: number;
  moodBonus: number;
  worldMalice: number;
  streakBonus: number;
  rng: IRng;
}

export interface ResolveResult {
  tier: OutcomeTier;
  chance: number;       // clamped, integer percent
  roll: number;         // d100 roll, or 0 if auto-success (no check)
  floor: number;
  ceiling: number;
  critBand: number;
  fumbleFloor: number;
  rawChance: number;    // pre-clamp, for debugging
}

function sumWeightedStats(
  weights: Readonly<Partial<Record<Stat, number>>> | undefined,
  stats: Readonly<AttributeMap>,
): number {
  if (!weights) return 0;
  let sum = 0;
  for (const [stat, w] of Object.entries(weights)) {
    if (w === undefined) continue;  // zod v4 quirk — skip unspecified keys
    sum += w * (stats[stat as Stat] ?? 0);
  }
  return sum;
}

function sumWeightedSkills(
  weights: Readonly<Record<string, number>> | undefined,
  skills: Readonly<Record<string, number>>,
): number {
  if (!weights) return 0;
  let sum = 0;
  for (const [name, w] of Object.entries(weights)) {
    sum += w * (skills[name] ?? 0);
  }
  return sum;
}

export function resolveCheck(args: ResolveArgs): ResolveResult {
  // Auto-success path: choices without a check always succeed.
  if (!args.check) {
    return {
      tier: 'SUCCESS',
      chance: 100,
      roll: 0,
      floor: 0,
      ceiling: 100,
      critBand: 0,
      fumbleFloor: 0,
      rawChance: 100,
    };
  }

  const { check } = args;
  const luck = args.characterStats.Luck ?? 0;

  const rawChance =
    check.base
    + sumWeightedStats(check.stats, args.characterStats)
    + sumWeightedSkills(check.skills, args.characterSkills)
    + args.techniqueBonus
    + args.itemBonus
    + args.echoBonus
    + args.memoryBonus
    + args.moodBonus
    + args.streakBonus
    - check.difficulty
    - args.worldMalice;

  const floor   = 5 + luck / 10;
  const ceiling = 95 - args.worldMalice / 5;

  const clampedRaw = Math.min(ceiling, Math.max(floor, rawChance));
  const chance = Math.round(clampedRaw);

  const critBand    = 0.15 + luck * 0.003;
  const fumbleFloor = Math.max(1, Math.round(5 - luck * 0.04));

  const roll = args.rng.d100();

  let tier: OutcomeTier;
  if (roll <= chance * critBand) tier = 'CRIT_SUCCESS';
  else if (roll <= chance)        tier = 'SUCCESS';
  else if (roll <= chance + 15)   tier = 'PARTIAL';
  else if (roll >= 100 - fumbleFloor + 1) tier = 'CRIT_FAILURE';
  else                            tier = 'FAILURE';

  return { tier, chance, roll, floor, ceiling, critBand, fumbleFloor, rawChance };
}
