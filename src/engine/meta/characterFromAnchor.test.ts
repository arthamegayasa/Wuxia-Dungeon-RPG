import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { getAnchorById } from './Anchor';
import { resolveAnchor } from './AnchorResolver';
import { characterFromAnchor } from './characterFromAnchor';

describe('characterFromAnchor', () => {
  const anchor = getAnchorById('peasant_farmer')!;

  it('produces a Character with anchor-driven attributes and age', () => {
    const rng = createRng(1);
    const resolved = resolveAnchor(anchor, rng);
    const { character, runState } = characterFromAnchor({
      resolved, name: 'Lin Wei', runSeed: 42, rng,
    });

    // Body baseline 10 + adjustment [0,10] → [10, 20]
    expect(character.attributes.Body).toBeGreaterThanOrEqual(10);
    expect(character.attributes.Body).toBeLessThanOrEqual(20);
    expect(character.ageDays).toBe(resolved.ageDays);
    expect(character.flags).toContain('peasant_birth');

    expect(runState.region).toBe(resolved.region);
    expect(runState.year).toBe(resolved.year);
    expect(runState.runSeed).toBe(42);
  });

  it('is deterministic', () => {
    const rng1 = createRng(7);
    const resolved1 = resolveAnchor(anchor, rng1);
    const out1 = characterFromAnchor({ resolved: resolved1, name: 't', runSeed: 9, rng: rng1 });

    const rng2 = createRng(7);
    const resolved2 = resolveAnchor(anchor, rng2);
    const out2 = characterFromAnchor({ resolved: resolved2, name: 't', runSeed: 9, rng: rng2 });

    expect(out1.character.attributes).toEqual(out2.character.attributes);
    expect(out1.character.spiritRoot).toEqual(out2.character.spiritRoot);
  });

  it('copies startingItems into runState.inventory', () => {
    // Mock an anchor with a starting item
    const withItem = {
      ...anchor,
      spawn: {
        ...anchor.spawn,
        startingItems: [{ id: 'rice_bowl', count: 1 }],
      },
    };
    const rng = createRng(1);
    const resolved = resolveAnchor(withItem, rng);
    const { runState } = characterFromAnchor({ resolved, name: 't', runSeed: 1, rng });
    expect(runState.inventory.find((i) => i.id === 'rice_bowl')?.count).toBe(1);
  });
});
