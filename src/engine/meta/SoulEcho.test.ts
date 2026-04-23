import { describe, it, expect } from 'vitest';
import {
  SoulEcho,
  echoSlotsFor,
  ECHO_SLOTS_BASELINE,
  ECHO_SLOTS_HARD_CAP,
} from './SoulEcho';
import { createEmptyMetaState } from './MetaState';

describe('SoulEcho types', () => {
  it('constructs a minimal echo value', () => {
    const e: SoulEcho = {
      id: 'iron_body',
      name: 'Iron Body',
      description: 'Your flesh remembers tempering.',
      tier: 'fragment',
      unlockCondition: { kind: 'reach_realm', realm: 'body_tempering', sublayer: 5 },
      effects: [{ kind: 'hp_mult', mult: 1.2 }],
      conflicts: [],
      reveal: 'birth',
    };
    expect(e.id).toBe('iron_body');
  });
});

describe('echoSlotsFor', () => {
  it('returns baseline 1 for empty meta', () => {
    const m = createEmptyMetaState();
    expect(echoSlotsFor(m)).toBe(ECHO_SLOTS_BASELINE);
    expect(ECHO_SLOTS_BASELINE).toBe(1);
  });

  it('adds +1 with carry_the_weight level 1', () => {
    const m = { ...createEmptyMetaState(), ownedUpgrades: ['carry_the_weight_1'] };
    expect(echoSlotsFor(m)).toBe(2);
  });

  it('adds +2 with carry_the_weight level 2 (level 1 is prerequisite)', () => {
    const m = { ...createEmptyMetaState(), ownedUpgrades: ['carry_the_weight_1', 'carry_the_weight_2'] };
    expect(echoSlotsFor(m)).toBe(3);
  });

  it('caps at 6 even with absurd counts', () => {
    // Fabricated: high heavenly notice (Phase 3) would add slots; test the clamp.
    const m = { ...createEmptyMetaState(), heavenlyNotice: 999 };
    expect(echoSlotsFor(m)).toBe(ECHO_SLOTS_HARD_CAP);
    expect(ECHO_SLOTS_HARD_CAP).toBe(6);
  });
});
