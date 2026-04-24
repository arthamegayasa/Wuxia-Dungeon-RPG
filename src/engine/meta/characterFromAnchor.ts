// Combine a ResolvedAnchor + name + rng into a Character + fresh RunState.
// Baseline attributes: 10 (mid of 0–20 range). Anchor adjustments add on top.
//
// Phase 2A-2 Task 8: also rolls + applies any unlocked Soul Echoes at spawn.
// Slot count is the authoritative Phase 2A-1 formula (`echoSlotsFor(meta)`).

import { Stat } from '@/engine/core/Types';
import { IRng } from '@/engine/core/RNG';
import { Character, createCharacter } from '@/engine/character/Character';
import { addAttribute, AttributeMap } from '@/engine/character/Attribute';
import { createRunState, RunState } from '@/engine/events/RunState';
import { ResolvedAnchor } from './AnchorResolver';
import { EchoRegistry } from './EchoRegistry';
import { rollEchoes } from './EchoRoller';
import { applyEchoes } from './EchoApplier';
import { echoSlotsFor, SoulEcho } from './SoulEcho';
import { MetaState } from './MetaState';

export interface CharacterFromAnchorArgs {
  resolved: ResolvedAnchor;
  name: string;
  runSeed: number;
  rng: IRng;
  meta: MetaState;
  echoRegistry: EchoRegistry;
}

export interface CharacterFromAnchorResult {
  character: Character;
  runState: RunState;
}

const BASELINE_ATTRIBUTE = 10;

export function characterFromAnchor(args: CharacterFromAnchorArgs): CharacterFromAnchorResult {
  const { resolved, name, runSeed, rng, meta, echoRegistry } = args;

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

  // Phase 2A-2 Task 8: roll + apply Soul Echoes from the player's unlocked pool.
  // `echoSlotsFor(meta)` is the authoritative slot-count source (§7.2 — scales
  // with `carry_the_weight` upgrade tier + heavenly notice). `rollEchoes`
  // handles conflict resolution deterministically against the supplied rng.
  const slots = echoSlotsFor(meta);
  const rolled = rollEchoes({
    registry: echoRegistry,
    unlockedIds: meta.echoesUnlocked,
    slotCount: slots,
    rng,
  });
  const rolledEchoes: SoulEcho[] = [];
  for (const id of rolled) {
    const echo = echoRegistry.get(id);
    if (echo) rolledEchoes.push(echo);
  }
  character = applyEchoes(character, rolledEchoes, rolled);

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
