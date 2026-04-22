// Combine a ResolvedAnchor + name + rng into a Character + fresh RunState.
// Baseline attributes: 10 (mid of 0–20 range). Anchor adjustments add on top.

import { Stat } from '@/engine/core/Types';
import { IRng } from '@/engine/core/RNG';
import { Character, createCharacter } from '@/engine/character/Character';
import { addAttribute, AttributeMap } from '@/engine/character/Attribute';
import { createRunState, RunState } from '@/engine/events/RunState';
import { ResolvedAnchor } from './AnchorResolver';

export interface CharacterFromAnchorArgs {
  resolved: ResolvedAnchor;
  name: string;
  runSeed: number;
  rng: IRng;
}

export interface CharacterFromAnchorResult {
  character: Character;
  runState: RunState;
}

const BASELINE_ATTRIBUTE = 10;

export function characterFromAnchor(args: CharacterFromAnchorArgs): CharacterFromAnchorResult {
  const { resolved, name, runSeed, rng } = args;

  const attrs = {} as AttributeMap;
  for (const s of Object.keys(resolved.attributeAdjustments) as Stat[]) {
    attrs[s] = addAttribute(BASELINE_ATTRIBUTE, resolved.attributeAdjustments[s]);
  }

  let character = createCharacter({
    name,
    attributes: attrs,
    rng,
    startingAgeDays: resolved.ageDays,
  });

  for (const flag of resolved.startingFlags) {
    if (!character.flags.includes(flag)) {
      character = { ...character, flags: [...character.flags, flag] };
    }
  }

  const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
  const season = seasons[resolved.year % 4]!;

  const runState = {
    ...createRunState({
      character, runSeed, region: resolved.region,
      year: resolved.year, season,
    }),
    inventory: [...resolved.startingItems],
  };

  return { character, runState };
}
