// Region registry — canonical lookup by id.
// Mirrors TechniqueRegistry / ItemRegistry pattern from Phase 2B-1.
// Source: docs/spec/design.md §8.1.

import { RegionDef } from '@/content/schema';

export class RegionRegistry {
  private readonly byIdMap: ReadonlyMap<string, RegionDef>;
  private readonly order: ReadonlyArray<RegionDef>;

  private constructor(order: ReadonlyArray<RegionDef>) {
    const map = new Map<string, RegionDef>();
    for (const r of order) {
      if (map.has(r.id)) throw new Error(`RegionRegistry: duplicate id ${r.id}`);
      map.set(r.id, r);
    }
    this.byIdMap = map;
    this.order = order;
  }

  static empty(): RegionRegistry { return new RegionRegistry([]); }
  static fromList(defs: ReadonlyArray<RegionDef>): RegionRegistry { return new RegionRegistry(defs); }
  all(): ReadonlyArray<RegionDef> { return this.order; }
  byId(id: string): RegionDef | null { return this.byIdMap.get(id) ?? null; }
  has(id: string): boolean { return this.byIdMap.has(id); }
}
