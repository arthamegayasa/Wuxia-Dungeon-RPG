// Shared plumbing between GameLoop.runTurn and engineBridge.resolveChoice:
//   resolve the character's current technique bonus for a given check category.
// Task 7: swaps in for the empty-array stub both paths previously used.

import { CorePathId } from '@/engine/core/Types';
import { TechniqueRegistry } from '@/engine/cultivation/TechniqueRegistry';
import {
  resolveTechniqueBonusWithAffinity,
  TechniqueDef,
} from '@/engine/cultivation/Technique';

export interface ResolveLearnedTechniqueBonusArgs {
  readonly registry: TechniqueRegistry;
  readonly learnedIds: ReadonlyArray<string>;
  readonly corePath: CorePathId | null;
  readonly category: string;
}

export function resolveLearnedTechniqueBonus(
  args: ResolveLearnedTechniqueBonusArgs,
): number {
  const techniques: TechniqueDef[] = [];
  for (const id of args.learnedIds) {
    const t = args.registry.byId(id);
    if (t) techniques.push(t);
  }
  if (techniques.length === 0) return 0;
  return resolveTechniqueBonusWithAffinity({
    techniques,
    corePath: args.corePath,
    category: args.category,
  });
}
