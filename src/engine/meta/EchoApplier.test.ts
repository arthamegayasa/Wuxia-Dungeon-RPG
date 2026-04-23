import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createCharacter } from '@/engine/character/Character';
import { applyEchoes } from './EchoApplier';
import { SoulEcho } from './SoulEcho';

const baseAttrs = { Body: 1, Mind: 1, Spirit: 1, Agility: 1, Charm: 1, Luck: 1 };

describe('applyEchoes', () => {
  it('returns character unchanged when no echoes rolled', () => {
    const rng = createRng(1);
    const c = createCharacter({ name: 'Test', attributes: baseAttrs, rng });
    const result = applyEchoes(c, [], []);
    expect(result).toEqual(c);
  });

  it('applies flat stat_mod additively to attribute', () => {
    const rng = createRng(1);
    const c = createCharacter({ name: 'Test', attributes: baseAttrs, rng });
    const echo: SoulEcho = {
      id: 'e1', name: 'e1', description: '', tier: 'fragment',
      unlockCondition: { kind: 'flag_set', flag: 'x' },
      effects: [{ kind: 'stat_mod', stat: 'Body', delta: 3 }],
      conflicts: [], reveal: 'birth',
    };
    const result = applyEchoes(c, [echo], ['e1']);
    expect(result.attributes.Body).toBe(c.attributes.Body + 3);
  });

  it('applies hp_mult as multiplicative on hpMax and scales hp proportionally', () => {
    const rng = createRng(1);
    const c = createCharacter({ name: 'Test', attributes: baseAttrs, rng });
    const echo: SoulEcho = {
      id: 'iron_body', name: 'Iron Body', description: '', tier: 'fragment',
      unlockCondition: { kind: 'flag_set', flag: 'x' },
      effects: [{ kind: 'hp_mult', mult: 1.2 }],
      conflicts: [], reveal: 'birth',
    };
    const result = applyEchoes(c, [echo], ['iron_body']);
    expect(result.hpMax).toBeCloseTo(c.hpMax * 1.2, 5);
    expect(result.hp).toBeCloseTo(c.hp * 1.2, 5);
  });

  it('applies insight_cap_bonus additively', () => {
    const rng = createRng(1);
    const c = createCharacter({ name: 'Test', attributes: baseAttrs, rng });
    const echo: SoulEcho = {
      id: 'vessel', name: 'Vessel', description: '', tier: 'fragment',
      unlockCondition: { kind: 'flag_set', flag: 'x' },
      effects: [{ kind: 'insight_cap_bonus', bonus: 50 }],
      conflicts: [], reveal: 'birth',
    };
    const result = applyEchoes(c, [echo], ['vessel']);
    expect(result.insightCap).toBe(c.insightCap + 50);
  });

  it('sets the echoes[] field to the applied ids', () => {
    const rng = createRng(1);
    const c = createCharacter({ name: 'Test', attributes: baseAttrs, rng });
    const echo: SoulEcho = {
      id: 'e1', name: 'e1', description: '', tier: 'fragment',
      unlockCondition: { kind: 'flag_set', flag: 'x' },
      effects: [], conflicts: [], reveal: 'birth',
    };
    const result = applyEchoes(c, [echo], ['e1']);
    expect(result.echoes).toEqual(['e1']);
  });

  it('applies starting_flag effect to character.flags', () => {
    const rng = createRng(1);
    const c = createCharacter({ name: 'Test', attributes: baseAttrs, rng });
    const echo: SoulEcho = {
      id: 'e1', name: 'e1', description: '', tier: 'fragment',
      unlockCondition: { kind: 'flag_set', flag: 'x' },
      effects: [{ kind: 'starting_flag', flag: 'reborn_marked' }],
      conflicts: [], reveal: 'birth',
    };
    const result = applyEchoes(c, [echo], ['e1']);
    expect(result.flags).toContain('reborn_marked');
  });
});
