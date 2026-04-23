// In-memory Soul Echo registry. Phase 2A-1 ships empty; content loader in 2A-2.

import { SoulEcho } from './SoulEcho';

export class EchoRegistry {
  private readonly byId: ReadonlyMap<string, SoulEcho>;

  private constructor(byId: Map<string, SoulEcho>) {
    this.byId = byId;
  }

  static fromList(echoes: ReadonlyArray<SoulEcho>): EchoRegistry {
    const map = new Map<string, SoulEcho>();
    for (const e of echoes) {
      if (map.has(e.id)) {
        throw new Error(`duplicate echo id: ${e.id}`);
      }
      map.set(e.id, e);
    }
    return new EchoRegistry(map);
  }

  get(id: string): SoulEcho | undefined {
    return this.byId.get(id);
  }

  all(): ReadonlyArray<SoulEcho> {
    return Array.from(this.byId.values());
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }
}

export const EMPTY_ECHO_REGISTRY: EchoRegistry = EchoRegistry.fromList([]);
