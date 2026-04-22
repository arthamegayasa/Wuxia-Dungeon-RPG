// Technique types + choice-bonus resolver.
// Source: docs/spec/design.md §4.7, §9.5.

import { CorePathId, Element, Realm } from '@/engine/core/Types';

export type TechniqueGrade = 'mortal' | 'yellow' | 'profound' | 'earth' | 'heaven' | 'immortal';

export type TechniqueEffect =
  | { kind: 'choice_bonus'; category: string; bonus: number }
  | { kind: 'qi_regen'; amount: number }
  | { kind: 'insight_gain_per_meditation'; amount: number };

export interface TechniqueDef {
  id: string;
  name: string;
  grade: TechniqueGrade;
  element: Element;
  coreAffinity: ReadonlyArray<CorePathId>;
  requires: {
    realm?: Realm;
    meridians?: ReadonlyArray<number>;
    openMeridianCount?: number;
  };
  qiCost: number;
  insightCost?: number;
  effects: ReadonlyArray<TechniqueEffect>;
  description: string;
}

/**
 * Sum all `choice_bonus` contributions across the character's learned techniques
 * for a specific category.
 */
export function resolveTechniqueBonus(
  techniques: ReadonlyArray<TechniqueDef>,
  category: string,
): number {
  let total = 0;
  for (const t of techniques) {
    for (const eff of t.effects) {
      if (eff.kind === 'choice_bonus' && eff.category === category) {
        total += eff.bonus;
      }
    }
  }
  return total;
}
