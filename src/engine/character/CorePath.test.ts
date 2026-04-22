import { describe, it, expect } from 'vitest';
import { detectCorePath } from './CorePath';

describe('detectCorePath', () => {
  it('returns null when fewer than 3 meridians opened', () => {
    expect(detectCorePath([])).toBeNull();
    expect(detectCorePath([1])).toBeNull();
    expect(detectCorePath([1, 3])).toBeNull();
  });

  it('iron_mountain = Stomach + Lung + Bladder', () => {
    expect(detectCorePath([3, 1, 7])).toBe('iron_mountain');
    expect(detectCorePath([1, 3, 7])).toBe('iron_mountain'); // order-insensitive
  });

  it('severing_edge = Heart + Small Intestine + Liver', () => {
    expect(detectCorePath([5, 6, 12])).toBe('severing_edge');
  });

  it('still_water = Kidney + Bladder + Spleen', () => {
    expect(detectCorePath([8, 7, 4])).toBe('still_water');
  });

  it('howling_storm = Gallbladder + Lung + Heart', () => {
    expect(detectCorePath([11, 1, 5])).toBe('howling_storm');
  });

  it('blood_ember = Heart + Pericardium + Triple Burner', () => {
    expect(detectCorePath([5, 9, 10])).toBe('blood_ember');
  });

  it('root_and_bough = Liver + Gallbladder + Spleen', () => {
    expect(detectCorePath([12, 11, 4])).toBe('root_and_bough');
  });

  it('thousand_mirrors = Liver + Spleen + Kidney', () => {
    expect(detectCorePath([12, 4, 8])).toBe('thousand_mirrors');
  });

  it('hollow_vessel when all three share the same element (no named match)', () => {
    // Metal: Lung, Large Intestine. Only two metal meridians exist — can't form Hollow.
    // Fire: Heart(5), Small Intestine(6), Pericardium(9), Triple Burner(10).
    expect(detectCorePath([6, 9, 10])).toBe('hollow_vessel');   // 3 fire, no named match
    // Wood: Gallbladder(11), Liver(12) — only 2 wood. Can't form Hollow with 3.
    // Water: Bladder(7), Kidney(8) — only 2. Can't form Hollow.
    // Earth: Stomach(3), Spleen(4) — only 2. Can't form Hollow.
    // Only fire has >= 3 meridians.
  });

  it('shattered_path when three distinct elements with no named match', () => {
    // Lung(metal) + Stomach(earth) + Heart(fire) — no named path matches this set.
    expect(detectCorePath([1, 3, 5])).toBe('shattered_path');
  });

  it('returns null when two meridians share element but third differs and no named match', () => {
    // Lung(metal) + Large Intestine(metal) + Stomach(earth) — not all same, not all distinct, not named
    expect(detectCorePath([1, 2, 3])).toBeNull();
  });

  it('uses only the first three opened meridians, ignoring the rest', () => {
    // First three [3,1,7] → iron_mountain. Extras should be ignored.
    expect(detectCorePath([3, 1, 7, 5, 8, 12])).toBe('iron_mountain');
  });

  it('named path beats hollow when set is both a named match and same-element', () => {
    // No spec named-path set uses 3 same-element meridians, but verify precedence semantics
    // by asserting named matches are checked first. If future data changes, this guards it.
    // blood_ember = Heart(fire) + Pericardium(fire) + Triple Burner(fire) is all fire!
    // So blood_ember is both named AND all-fire. Named must win.
    expect(detectCorePath([5, 9, 10])).toBe('blood_ember');
  });
});
