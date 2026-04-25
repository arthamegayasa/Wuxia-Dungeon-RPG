// Technique registry — canonical lookup by id + learnability gate.
// Mirrors EchoRegistry / MemoryRegistry pattern from Phase 2A.
// Source: docs/spec/design.md §4.7, §9.5.

import { Character } from '@/engine/character/Character';
import { REALM_ORDER, Realm } from '@/engine/core/Types';
import { TechniqueDef } from './Technique';

export type CanLearnResult =
  | { ok: true }
  | { ok: false; reason: string };

function realmRank(r: Realm): number {
  return REALM_ORDER.indexOf(r);
}

export class TechniqueRegistry {
  private readonly byIdMap: ReadonlyMap<string, TechniqueDef>;
  private readonly order: ReadonlyArray<TechniqueDef>;

  private constructor(order: ReadonlyArray<TechniqueDef>) {
    const map = new Map<string, TechniqueDef>();
    for (const t of order) {
      if (map.has(t.id)) {
        throw new Error(`TechniqueRegistry: duplicate id ${t.id}`);
      }
      map.set(t.id, t);
    }
    this.byIdMap = map;
    this.order = order;
  }

  static empty(): TechniqueRegistry {
    return new TechniqueRegistry([]);
  }

  static fromList(defs: ReadonlyArray<TechniqueDef>): TechniqueRegistry {
    return new TechniqueRegistry(defs);
  }

  all(): ReadonlyArray<TechniqueDef> {
    return this.order;
  }

  byId(id: string): TechniqueDef | null {
    return this.byIdMap.get(id) ?? null;
  }

  canLearn(c: Character, id: string): CanLearnResult {
    const t = this.byId(id);
    if (!t) return { ok: false, reason: `unknown technique ${id}` };

    const req = t.requires;
    if (req.realm !== undefined) {
      if (realmRank(c.realm) < realmRank(req.realm)) {
        return {
          ok: false,
          reason: `requires realm ${req.realm} (have ${c.realm})`,
        };
      }
    }
    if (req.openMeridianCount !== undefined) {
      if (c.openMeridians.length < req.openMeridianCount) {
        return {
          ok: false,
          reason: `requires ${req.openMeridianCount} open meridians (have ${c.openMeridians.length})`,
        };
      }
    }
    if (req.meridians && req.meridians.length > 0) {
      for (const m of req.meridians) {
        if (!c.openMeridians.includes(m as any)) {
          return { ok: false, reason: `requires meridian ${m} open` };
        }
      }
    }
    return { ok: true };
  }
}
