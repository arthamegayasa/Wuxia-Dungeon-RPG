import { describe, it, expect } from 'vitest';
import {
  StateDelta,
  STATE_DELTA_KINDS,
  isStateDelta,
} from './StateDelta';

describe('StateDelta', () => {
  it('STATE_DELTA_KINDS lists every kind', () => {
    expect(STATE_DELTA_KINDS).toEqual([
      'hp_delta', 'qi_delta', 'insight_delta', 'attribute_delta',
      'flag_set', 'flag_clear', 'world_flag_set', 'world_flag_clear',
      'cultivation_progress_delta', 'item_add', 'item_remove',
      'technique_learn', 'meridian_open',
      'karma_delta', 'notice_delta',
      'age_delta_days',
    ]);
  });

  it('isStateDelta recognises each concrete shape', () => {
    const deltas: StateDelta[] = [
      { kind: 'hp_delta', amount: -10 },
      { kind: 'qi_delta', amount: 5 },
      { kind: 'insight_delta', amount: 3 },
      { kind: 'attribute_delta', stat: 'Body', amount: 1 },
      { kind: 'flag_set', flag: 'met_master' },
      { kind: 'flag_clear', flag: 'shamed_this_year' },
      { kind: 'world_flag_set', flag: 'drought_active' },
      { kind: 'world_flag_clear', flag: 'drought_active' },
      { kind: 'cultivation_progress_delta', amount: 15 },
      { kind: 'item_add', id: 'water_flask', count: 1 },
      { kind: 'item_remove', id: 'water_flask', count: 1 },
      { kind: 'technique_learn', id: 'TECH_IRON_SHIRT_NOVICE' },
      { kind: 'meridian_open', id: 3 },
      { kind: 'karma_delta', amount: -10 },
      { kind: 'notice_delta', amount: 2 },
      { kind: 'age_delta_days', amount: 30 },
    ];
    for (const d of deltas) expect(isStateDelta(d)).toBe(true);
  });

  it('isStateDelta rejects malformed shapes', () => {
    expect(isStateDelta(null)).toBe(false);
    expect(isStateDelta({})).toBe(false);
    expect(isStateDelta({ kind: 'banana', amount: 1 })).toBe(false);
    expect(isStateDelta({ kind: 'hp_delta' })).toBe(false); // missing amount
    expect(isStateDelta({ kind: 'attribute_delta', amount: 1 })).toBe(false); // missing stat
  });
});
