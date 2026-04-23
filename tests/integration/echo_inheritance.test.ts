import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { EchoRegistry } from '@/engine/meta/EchoRegistry';
import { SoulEcho, echoSlotsFor } from '@/engine/meta/SoulEcho';
import { rollEchoes } from '@/engine/meta/EchoRoller';
import { applyEchoes } from '@/engine/meta/EchoApplier';
import { createEmptyMetaState } from '@/engine/meta/MetaState';
import { createCharacter } from '@/engine/character/Character';

describe('Echo inheritance — Life N → Life N+1', () => {
  const ironBody: SoulEcho = {
    id: 'iron_body', name: 'Iron Body',
    description: 'Your flesh remembers tempering.',
    tier: 'fragment',
    unlockCondition: { kind: 'reach_realm', realm: 'body_tempering', sublayer: 5 },
    effects: [
      { kind: 'hp_mult', mult: 1.2 },
      { kind: 'body_cultivation_rate_pct', pct: 10 },
    ],
    conflicts: [], reveal: 'birth',
  };

  it('rolls the previously-unlocked echo into the next life and applies effects', () => {
    const registry = EchoRegistry.fromList([ironBody]);
    // Simulate end of Life N: iron_body unlocked.
    const meta = { ...createEmptyMetaState(), echoesUnlocked: ['iron_body'] };

    // Start of Life N+1: roll echoes.
    const slots = echoSlotsFor(meta);
    expect(slots).toBe(1);

    const rng = createRng(100);
    const rolled = rollEchoes({
      registry,
      unlockedIds: meta.echoesUnlocked,
      slotCount: slots,
      rng,
    });
    expect(rolled).toEqual(['iron_body']);

    const rolledEchoes = rolled.map((id) => registry.get(id)!);
    const baseChar = createCharacter({
      name: 'Lin Wei the Second',
      attributes: { Body: 2, Mind: 1, Spirit: 1, Agility: 1, Charm: 1, Luck: 1 },
      rng: createRng(200),
    });
    const applied = applyEchoes(baseChar, rolledEchoes, rolled);

    expect(applied.echoes).toEqual(['iron_body']);
    expect(applied.hpMax).toBeCloseTo(baseChar.hpMax * 1.2, 5);
    expect(applied.hp).toBeCloseTo(baseChar.hp * 1.2, 5);
  });

  it('is deterministic: same seed yields same rolled echoes + effects', () => {
    const registry = EchoRegistry.fromList([ironBody]);
    const meta = { ...createEmptyMetaState(), echoesUnlocked: ['iron_body'] };
    const run = (seed: number) => {
      const rng = createRng(seed);
      return rollEchoes({
        registry,
        unlockedIds: meta.echoesUnlocked,
        slotCount: echoSlotsFor(meta),
        rng,
      });
    };
    expect(run(999)).toEqual(run(999));
  });
});
