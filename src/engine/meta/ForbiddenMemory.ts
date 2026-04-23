// Forbidden Memory types + level utility. Source: docs/spec/design.md §7.3.

import { Realm } from '@/engine/core/Types';

export type MemoryElement = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'void';
export type MemoryLevel = 'fragment' | 'partial' | 'complete';

export interface MemoryRequirements {
  readonly minMeridians?: number;
  readonly minRealm?: Realm | string;
}

export interface ForbiddenMemory {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly element: MemoryElement;
  readonly witnessFlavour: Readonly<Record<MemoryLevel, string>>;
  readonly manifestFlavour: string;
  readonly manifestInsightBonus: number;
  readonly manifestFlag: string;
  readonly requirements: MemoryRequirements;
}

export function memoryLevelOf(lifetimeWitnesses: number): MemoryLevel {
  if (lifetimeWitnesses <= 0) {
    throw new Error(`memoryLevelOf requires a positive count, got ${lifetimeWitnesses}`);
  }
  if (lifetimeWitnesses <= 2) return 'fragment';
  if (lifetimeWitnesses <= 6) return 'partial';
  return 'complete';
}

export function memoryLevelNumber(level: MemoryLevel): number {
  switch (level) {
    case 'fragment': return 1;
    case 'partial': return 2;
    case 'complete': return 3;
  }
}
