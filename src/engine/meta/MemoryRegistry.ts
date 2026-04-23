// In-memory Forbidden Memory registry. Phase 2A-1 ships empty; content loader in 2A-2.

import { ForbiddenMemory } from './ForbiddenMemory';

export class MemoryRegistry {
  private readonly byId: ReadonlyMap<string, ForbiddenMemory>;

  private constructor(byId: Map<string, ForbiddenMemory>) {
    this.byId = byId;
  }

  static fromList(memories: ReadonlyArray<ForbiddenMemory>): MemoryRegistry {
    const map = new Map<string, ForbiddenMemory>();
    for (const m of memories) {
      if (map.has(m.id)) {
        throw new Error(`duplicate memory id: ${m.id}`);
      }
      map.set(m.id, m);
    }
    return new MemoryRegistry(map);
  }

  get(id: string): ForbiddenMemory | undefined {
    return this.byId.get(id);
  }

  all(): ReadonlyArray<ForbiddenMemory> {
    return Array.from(this.byId.values());
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }
}

export const EMPTY_MEMORY_REGISTRY: MemoryRegistry = MemoryRegistry.fromList([]);
