// Scripted Tribulation I pillar — non-fatal in Phase 2B, fatal in Phase 3+.
// Source: docs/spec/design.md §4.5.

import { IRng } from '@/engine/core/RNG';
import { Character } from '@/engine/character/Character';
import { DeathCause, Stat } from '@/engine/core/Types';
import { PillarEvent } from '@/content/schema';

// Use PillarEventSchema.parse to validate at import time; type-cast via `as PillarEvent`
// because the Zod v4 enum-record inference is exhaustive (known quirk — see CLAUDE.md).
export const TRIBULATION_I: PillarEvent = {
  id: 'tribulation_i',
  phases: [
    { id: 'heart_demon',    checkStats: { Mind: 1, Spirit: 1 } as PillarEvent['phases'][number]['checkStats'],  difficulty: 60, failEffect: 'insight_loss_5' },
    { id: 'first_thunder',  checkStats: { Body: 1, Spirit: 1 } as PillarEvent['phases'][number]['checkStats'],  difficulty: 50, failEffect: 'hp_loss_20' },
    { id: 'second_thunder', checkStats: { Body: 1, Spirit: 1 } as PillarEvent['phases'][number]['checkStats'],  difficulty: 65, failEffect: 'hp_loss_40' },
    { id: 'third_thunder',  checkStats: { Body: 1, Spirit: 1 } as PillarEvent['phases'][number]['checkStats'],  difficulty: 80, failEffect: 'death_or_retry' },
  ],
};

export type TribulationMode = 'non_fatal' | 'fatal';

export interface RunPillarArgs {
  readonly rng: IRng;
  readonly tribulationMode: TribulationMode;
}

export interface PillarPhaseResult {
  readonly phaseId: string;
  readonly success: boolean;
  readonly chance: number;
  readonly roll: number;
}

export interface RunPillarResult {
  readonly character: Character;
  readonly phaseResults: ReadonlyArray<PillarPhaseResult>;
  readonly deathCause?: DeathCause;
}

function phaseChance(c: Character, weights: Partial<Record<Stat, number | undefined>>, difficulty: number): number {
  let sum = 50;
  for (const [stat, w] of Object.entries(weights)) {
    if (w === undefined) continue;
    sum += w * (c.attributes[stat as Stat] ?? 0);
  }
  sum -= difficulty;
  return Math.min(95, Math.max(5, Math.round(sum)));
}

export function runTribulationIPillar(
  c: Character,
  args: RunPillarArgs,
): RunPillarResult {
  let char = c;
  const results: PillarPhaseResult[] = [];
  let death: DeathCause | undefined;

  for (let i = 0; i < TRIBULATION_I.phases.length; i++) {
    const phase = TRIBULATION_I.phases[i]!;
    const chance = phaseChance(char, phase.checkStats, phase.difficulty);
    const roll = args.rng.d100();
    const success = roll <= chance;
    results.push({ phaseId: phase.id, success, chance, roll });

    if (success) continue;

    switch (phase.failEffect) {
      case 'insight_loss_5':
        char = { ...char, insight: Math.max(0, char.insight - 5) };
        break;
      case 'hp_loss_20':
        char = { ...char, hp: Math.max(0, Math.round(char.hp * 0.8)) };
        break;
      case 'hp_loss_40':
        char = { ...char, hp: Math.max(0, Math.round(char.hp * 0.6)) };
        break;
      case 'death_or_retry':
        if (args.tribulationMode === 'fatal') {
          death = 'tribulation';
        }
        break;
    }

    if (death) break;
  }

  return { character: char, phaseResults: results, deathCause: death };
}
