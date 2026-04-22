// Per-life name registry. Once a slot is named, subsequent lookups return the cached name.
// Immutable — writes return a new registry.
// Source: docs/spec/design.md §6.7 (NameRegistry paragraph).

import { IRng } from '@/engine/core/RNG';

export interface NameRegistry {
  readonly slots: Readonly<Record<string, string>>;
}

export function createNameRegistry(): NameRegistry {
  return { slots: {} };
}

function slotKey(archetype: string, slotId: string): string {
  return `${archetype}:${slotId}`;
}

export interface ResolveNameResult {
  name: string;
  registry: NameRegistry;
}

export function resolveName(
  reg: NameRegistry,
  archetype: string,
  slotId: string,
  generator: (rng: IRng) => string,
  rng: IRng,
): ResolveNameResult {
  const key = slotKey(archetype, slotId);
  const cached = reg.slots[key];
  if (cached !== undefined) {
    return { name: cached, registry: reg };
  }
  const name = generator(rng);
  return {
    name,
    registry: { slots: { ...reg.slots, [key]: name } },
  };
}
