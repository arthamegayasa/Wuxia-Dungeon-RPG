// Item + Manual registry.
// Source: docs/spec/design.md §9.6, §9.7.

export type ItemType = 'pill' | 'manual' | 'weapon' | 'armor' | 'talisman' | 'misc';
export type ItemGrade = 'mortal' | 'yellow' | 'profound' | 'earth' | 'heaven' | 'immortal';

export type ItemEffect =
  | { kind: 'heal_hp'; amount: number }
  | { kind: 'restore_qi'; amount: number }
  | { kind: 'pill_bonus'; amount: number }
  | { kind: 'insight_gain'; amount: number }
  | { kind: 'deviation_risk'; delta: number }
  | { kind: 'choice_bonus'; category: string; bonus: number };

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  grade: ItemGrade;
  stackable: boolean;
  effects: ReadonlyArray<ItemEffect>;
  description: string;
  weight?: number;
  // Manual-only — present iff `type === 'manual'`:
  teaches?: string;
  completeness?: 0.25 | 0.5 | 0.75 | 1.0;
  readerRequires?: { minMind?: number; minInsight?: number };
}

/** Type guard: narrows an ItemDef to the manual-required fields present. */
export function isManual(i: ItemDef): i is ItemDef & {
  type: 'manual'; teaches: string; completeness: 0.25 | 0.5 | 0.75 | 1.0;
} {
  return i.type === 'manual' && typeof i.teaches === 'string' && i.completeness !== undefined;
}

export class ItemRegistry {
  private readonly byIdMap: ReadonlyMap<string, ItemDef>;
  private readonly order: ReadonlyArray<ItemDef>;

  private constructor(order: ReadonlyArray<ItemDef>) {
    const map = new Map<string, ItemDef>();
    for (const i of order) {
      if (map.has(i.id)) throw new Error(`ItemRegistry: duplicate id ${i.id}`);
      map.set(i.id, i);
    }
    this.byIdMap = map;
    this.order = order;
  }

  static empty(): ItemRegistry {
    return new ItemRegistry([]);
  }

  static fromList(defs: ReadonlyArray<ItemDef>): ItemRegistry {
    return new ItemRegistry(defs);
  }

  all(): ReadonlyArray<ItemDef> { return this.order; }

  byId(id: string): ItemDef | null {
    return this.byIdMap.get(id) ?? null;
  }
}
