import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { getAnchorById } from './Anchor';
import { DEFAULT_ANCHORS } from '@/engine/meta/Anchor';
import { resolveAnchor } from './AnchorResolver';
import { characterFromAnchor } from './characterFromAnchor';
import { EchoRegistry } from './EchoRegistry';
import { EMPTY_ECHO_REGISTRY } from '@/engine/meta/EchoRegistry';
import { createEmptyMetaState } from './MetaState';
import type { SoulEcho } from './SoulEcho';

describe('characterFromAnchor', () => {
  const anchor = getAnchorById('peasant_farmer')!;
  const emptyRegistry = EchoRegistry.fromList([]);
  const emptyMeta = createEmptyMetaState();

  it('produces a Character with anchor-driven attributes and age', () => {
    const rng = createRng(1);
    const resolved = resolveAnchor(anchor, rng);
    const { character, runState } = characterFromAnchor({
      resolved, name: 'Lin Wei', runSeed: 42, rng,
      meta: emptyMeta, echoRegistry: emptyRegistry,
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
    const out1 = characterFromAnchor({
      resolved: resolved1, name: 't', runSeed: 9, rng: rng1,
      meta: emptyMeta, echoRegistry: emptyRegistry,
    });

    const rng2 = createRng(7);
    const resolved2 = resolveAnchor(anchor, rng2);
    const out2 = characterFromAnchor({
      resolved: resolved2, name: 't', runSeed: 9, rng: rng2,
      meta: emptyMeta, echoRegistry: emptyRegistry,
    });

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
    const { runState } = characterFromAnchor({
      resolved, name: 't', runSeed: 1, rng,
      meta: emptyMeta, echoRegistry: emptyRegistry,
    });
    expect(runState.inventory.find((i) => i.id === 'rice_bowl')?.count).toBe(1);
  });

  it('sets runState.birthYear = spawn year minus starting age years', () => {
    const rng = createRng(42);
    // Resolve a real anchor with deterministic seed; assert the math.
    const peasantAnchor = DEFAULT_ANCHORS.find((a) => a.id === 'peasant_farmer')!;
    const resolved = resolveAnchor(peasantAnchor, rng);

    const meta = createEmptyMetaState();
    const result = characterFromAnchor({
      resolved, name: 'Lin Wei', runSeed: 1, rng: createRng(7),
      meta, echoRegistry: EMPTY_ECHO_REGISTRY,
    });

    const startingAgeYears = Math.floor(resolved.ageDays / 365);
    expect(result.runState.birthYear).toBe(resolved.year - startingAgeYears);
  });
});

describe('characterFromAnchor — echo integration', () => {
  it('rolls and applies an unlocked echo to the returned character', () => {
    const ironBody: SoulEcho = {
      id: 'iron_body', name: 'Iron Body', description: '',
      tier: 'fragment',
      unlockCondition: { kind: 'flag_set', flag: 'x' },
      effects: [{ kind: 'hp_mult', mult: 1.2 }],
      conflicts: [], reveal: 'birth',
    };
    const reg = EchoRegistry.fromList([ironBody]);
    const meta = { ...createEmptyMetaState(), echoesUnlocked: ['iron_body'] };

    const anchor = getAnchorById('peasant_farmer')!;
    const resolved = resolveAnchor(anchor, createRng(1));
    const { character } = characterFromAnchor({
      resolved,
      name: 'Test',
      runSeed: 1,
      rng: createRng(1),
      meta,
      echoRegistry: reg,
    });

    expect(character.echoes).toEqual(['iron_body']);
    expect(character.hpMax).toBeGreaterThan(10);
  });

  it('returns a character with empty echoes when meta has none unlocked', () => {
    const reg = EchoRegistry.fromList([]);
    const meta = createEmptyMetaState();
    const anchor = getAnchorById('peasant_farmer')!;
    const resolved = resolveAnchor(anchor, createRng(1));
    const { character } = characterFromAnchor({
      resolved, name: 'Test', runSeed: 1, rng: createRng(1),
      meta, echoRegistry: reg,
    });
    expect(character.echoes).toEqual([]);
  });
});
