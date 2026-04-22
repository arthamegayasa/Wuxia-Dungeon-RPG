import { describe, it, expect } from 'vitest';
import {
  createStreakState,
  recordOutcome,
  computeStreakBonus,
  computeWorldMaliceBuff,
  tickBuff,
} from './StreakTracker';

describe('StreakTracker', () => {
  it('starts at zero state', () => {
    const s = createStreakState();
    expect(s.consecutiveFailures).toBe(0);
    expect(s.consecutiveCritSuccesses).toBe(0);
    expect(s.worldMaliceBuff).toBeNull();
    expect(computeStreakBonus(s)).toBe(0);
  });

  it('records FAILURE and increments consecutiveFailures', () => {
    let s = createStreakState();
    s = recordOutcome(s, 'FAILURE');
    expect(s.consecutiveFailures).toBe(1);
    s = recordOutcome(s, 'FAILURE');
    s = recordOutcome(s, 'FAILURE');
    s = recordOutcome(s, 'FAILURE');
    expect(s.consecutiveFailures).toBe(4);
  });

  it('resets consecutiveFailures on SUCCESS or CRIT_SUCCESS', () => {
    let s = createStreakState();
    s = recordOutcome(s, 'FAILURE');
    s = recordOutcome(s, 'FAILURE');
    s = recordOutcome(s, 'SUCCESS');
    expect(s.consecutiveFailures).toBe(0);
  });

  it('computeStreakBonus returns +10 after 4 consecutive failures', () => {
    let s = createStreakState();
    for (let i = 0; i < 4; i++) s = recordOutcome(s, 'FAILURE');
    expect(computeStreakBonus(s)).toBe(10);
  });

  it('computeStreakBonus returns 0 after 3 failures (not yet 4)', () => {
    let s = createStreakState();
    for (let i = 0; i < 3; i++) s = recordOutcome(s, 'FAILURE');
    expect(computeStreakBonus(s)).toBe(0);
  });

  it('CRIT_FAILURE does not count toward the +10 bonus', () => {
    // Per spec §5.6, "rolled FAILURE on 4 consecutive non-trivial checks" — interpret as regular FAILURE.
    let s = createStreakState();
    for (let i = 0; i < 4; i++) s = recordOutcome(s, 'CRIT_FAILURE');
    expect(computeStreakBonus(s)).toBe(0);
  });

  it('records CRIT_SUCCESS and increments consecutiveCritSuccesses', () => {
    let s = createStreakState();
    s = recordOutcome(s, 'CRIT_SUCCESS');
    s = recordOutcome(s, 'CRIT_SUCCESS');
    s = recordOutcome(s, 'CRIT_SUCCESS');
    expect(s.consecutiveCritSuccesses).toBe(3);
  });

  it('3 consecutive CRIT_SUCCESSes activate a worldMaliceBuff for 5 turns', () => {
    let s = createStreakState();
    s = recordOutcome(s, 'CRIT_SUCCESS');
    s = recordOutcome(s, 'CRIT_SUCCESS');
    s = recordOutcome(s, 'CRIT_SUCCESS');
    expect(s.worldMaliceBuff).toEqual({ value: 3, turnsRemaining: 5 });
  });

  it('any non-CRIT_SUCCESS breaks the crit streak', () => {
    let s = createStreakState();
    s = recordOutcome(s, 'CRIT_SUCCESS');
    s = recordOutcome(s, 'SUCCESS');
    expect(s.consecutiveCritSuccesses).toBe(0);
  });

  it('tickBuff decrements turnsRemaining and clears buff at 0', () => {
    let s = createStreakState();
    for (let i = 0; i < 3; i++) s = recordOutcome(s, 'CRIT_SUCCESS');
    expect(s.worldMaliceBuff?.turnsRemaining).toBe(5);
    for (let i = 0; i < 4; i++) s = tickBuff(s);
    expect(s.worldMaliceBuff?.turnsRemaining).toBe(1);
    s = tickBuff(s);
    expect(s.worldMaliceBuff).toBeNull();
  });

  it('computeWorldMaliceBuff returns value when buff active, 0 otherwise', () => {
    let s = createStreakState();
    expect(computeWorldMaliceBuff(s)).toBe(0);
    for (let i = 0; i < 3; i++) s = recordOutcome(s, 'CRIT_SUCCESS');
    expect(computeWorldMaliceBuff(s)).toBe(3);
  });
});
