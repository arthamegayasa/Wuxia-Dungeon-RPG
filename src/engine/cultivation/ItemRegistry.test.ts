import { describe, it, expect } from 'vitest';
import { ItemRegistry, ItemDef, isManual } from './ItemRegistry';

const PILL: ItemDef = {
  id: 'p', name: 'P', type: 'pill', grade: 'mortal', stackable: true,
  effects: [], description: '',
};

const MANUAL: ItemDef = {
  id: 'm', name: 'M', type: 'manual', grade: 'yellow', stackable: false,
  effects: [], description: '', teaches: 'tech_x', completeness: 0.5,
};

describe('ItemRegistry', () => {
  it('empty: all() is []', () => {
    expect(ItemRegistry.empty().all()).toEqual([]);
  });

  it('fromList: byId works', () => {
    const r = ItemRegistry.fromList([PILL, MANUAL]);
    expect(r.byId('p')).toBe(PILL);
    expect(r.byId('m')).toBe(MANUAL);
    expect(r.byId('?')).toBeNull();
  });

  it('throws on duplicate ids', () => {
    expect(() => ItemRegistry.fromList([PILL, PILL])).toThrow(/duplicate/i);
  });

  it('isManual narrows correctly', () => {
    expect(isManual(PILL)).toBe(false);
    expect(isManual(MANUAL)).toBe(true);
    if (isManual(MANUAL)) {
      expect(MANUAL.teaches).toBe('tech_x');
    }
  });
});
