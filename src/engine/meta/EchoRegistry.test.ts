import { describe, it, expect } from 'vitest';
import { EchoRegistry, EMPTY_ECHO_REGISTRY } from './EchoRegistry';
import { SoulEcho } from './SoulEcho';

const fakeEcho: SoulEcho = {
  id: 'fake_echo',
  name: 'Fake Echo',
  description: 'for tests',
  tier: 'fragment',
  unlockCondition: { kind: 'flag_set', flag: 'test_flag' },
  effects: [],
  conflicts: [],
  reveal: 'birth',
};

describe('EchoRegistry', () => {
  it('empty registry returns empty list', () => {
    expect(EMPTY_ECHO_REGISTRY.all()).toEqual([]);
    expect(EMPTY_ECHO_REGISTRY.get('anything')).toBeUndefined();
  });

  it('fromList registers echoes and finds them by id', () => {
    const reg = EchoRegistry.fromList([fakeEcho]);
    expect(reg.get('fake_echo')).toBe(fakeEcho);
    expect(reg.all()).toEqual([fakeEcho]);
  });

  it('rejects duplicate ids', () => {
    expect(() => EchoRegistry.fromList([fakeEcho, fakeEcho])).toThrow(/duplicate echo id/i);
  });
});
