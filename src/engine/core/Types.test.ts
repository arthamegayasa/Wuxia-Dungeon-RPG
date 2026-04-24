import { describe, it, expect } from 'vitest';
import { noticeTierFor, GamePhase } from './Types';

describe('noticeTierFor', () => {
  it.each([
    [0,   'baseline'],
    [9,   'baseline'],
    [10,  'awakening'],
    [24,  'awakening'],
    [25,  'noticed'],
    [49,  'noticed'],
    [50,  'marked'],
    [74,  'marked'],
    [75,  'watched'],
    [99,  'watched'],
    [100, 'heir_of_void'],
    [250, 'heir_of_void'],
  ])('value %i maps to %s', (value, expected) => {
    expect(noticeTierFor(value)).toBe(expected);
  });
});

describe('GamePhase enum', () => {
  it('contains LINEAGE for the lineage screen route', () => {
    expect(GamePhase.LINEAGE).toBe('LINEAGE');
  });
});
