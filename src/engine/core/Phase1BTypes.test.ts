import { describe, it, expect } from 'vitest';
import {
  CHECK_CATEGORIES,
  OUTCOME_TIER_ORDER,
  TIME_COST_DAYS,
  OutcomeTier,
  TimeCost,
} from './Types';

describe('Phase 1B primitive tables', () => {
  it('CHECK_CATEGORIES lists all canonical categories from spec §5.8', () => {
    expect(CHECK_CATEGORIES).toEqual([
      'brute_force', 'melee_skill', 'qi_combat', 'dodge_flee',
      'social_persuade', 'social_intimidate', 'social_seduce',
      'deception', 'insight_puzzle', 'resist_mental', 'resist_poison',
      'cultivation_attempt', 'survival', 'lore_scholarship',
    ]);
  });

  it('OUTCOME_TIER_ORDER runs from CRIT_SUCCESS down to CRIT_FAILURE', () => {
    expect(OUTCOME_TIER_ORDER).toEqual([
      'CRIT_SUCCESS', 'SUCCESS', 'PARTIAL', 'FAILURE', 'CRIT_FAILURE',
    ] as OutcomeTier[]);
  });

  it('TIME_COST_DAYS maps each TimeCost to a [min, max] day range per spec §2.5', () => {
    expect(TIME_COST_DAYS.INSTANT).toEqual([0, 0]);
    expect(TIME_COST_DAYS.SHORT).toEqual([1, 7]);
    expect(TIME_COST_DAYS.MEDIUM).toEqual([30, 90]);
    expect(TIME_COST_DAYS.LONG).toEqual([180, 540]);
    expect(TIME_COST_DAYS.EPOCH).toEqual([1095, 3650]);
  });

  it('TIME_COST_DAYS covers every TimeCost bucket', () => {
    const all: TimeCost[] = ['INSTANT', 'SHORT', 'MEDIUM', 'LONG', 'EPOCH'];
    for (const k of all) {
      expect(TIME_COST_DAYS[k]).toBeDefined();
      const [min, max] = TIME_COST_DAYS[k];
      expect(min).toBeLessThanOrEqual(max);
    }
  });
});
