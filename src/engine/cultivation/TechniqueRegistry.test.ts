import { describe, it, expect } from 'vitest';
import { TechniqueRegistry } from './TechniqueRegistry';
import { TechniqueDef } from './Technique';
import { Realm } from '@/engine/core/Types';
import { Character, createCharacter } from '@/engine/character/Character';
import { createRng } from '@/engine/core/RNG';

const DEF_A: TechniqueDef = {
  id: 'a', name: 'A', grade: 'mortal', element: 'none',
  coreAffinity: ['any'],
  requires: {}, qiCost: 0, effects: [], description: '',
};

const DEF_B_QS: TechniqueDef = {
  id: 'b', name: 'B', grade: 'mortal', element: 'none',
  coreAffinity: ['iron_mountain'],
  requires: { realm: Realm.QI_SENSING }, qiCost: 0, effects: [], description: '',
};

describe('TechniqueRegistry', () => {
  it('empty registry: all() is [] and byId returns null', () => {
    const r = TechniqueRegistry.empty();
    expect(r.all()).toEqual([]);
    expect(r.byId('a')).toBeNull();
  });

  it('fromList exposes entries by id and in order', () => {
    const r = TechniqueRegistry.fromList([DEF_A, DEF_B_QS]);
    expect(r.all()).toEqual([DEF_A, DEF_B_QS]);
    expect(r.byId('a')).toBe(DEF_A);
    expect(r.byId('missing')).toBeNull();
  });

  it('fromList throws on duplicate ids', () => {
    expect(() => TechniqueRegistry.fromList([DEF_A, DEF_A]))
      .toThrow(/duplicate.*a/i);
  });

  function mortalChar(): Character {
    return createCharacter({
      name: 't',
      attributes: { Body: 5, Mind: 5, Spirit: 5, Agility: 5, Charm: 5, Luck: 5 },
      rng: createRng(1),
    });
  }

  it('canLearn returns {ok:false} when technique requires higher realm', () => {
    const r = TechniqueRegistry.fromList([DEF_B_QS]);
    const c = mortalChar();
    const result = r.canLearn(c, 'b');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/realm/i);
  });

  it('canLearn returns {ok:true} when requires are met', () => {
    const r = TechniqueRegistry.fromList([DEF_A]);
    const c = mortalChar();
    expect(r.canLearn(c, 'a')).toEqual({ ok: true });
  });

  it('canLearn returns {ok:false, reason:"unknown"} for missing id', () => {
    const r = TechniqueRegistry.fromList([DEF_A]);
    const c = mortalChar();
    const result = r.canLearn(c, 'zzz');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/unknown/i);
  });

  it('canLearn enforces openMeridianCount gate', () => {
    const def: TechniqueDef = {
      ...DEF_A, id: 'c', requires: { openMeridianCount: 3 },
    };
    const r = TechniqueRegistry.fromList([def]);
    const c = mortalChar();  // zero open meridians
    const result = r.canLearn(c, 'c');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/meridian/i);
  });

  it('canLearn enforces specific meridians gate', () => {
    const def: TechniqueDef = {
      ...DEF_A, id: 'd', requires: { meridians: [5, 7] },
    };
    const r = TechniqueRegistry.fromList([def]);
    const c = mortalChar();  // zero open meridians
    const result = r.canLearn(c, 'd');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/meridian 5/i);
  });
});
