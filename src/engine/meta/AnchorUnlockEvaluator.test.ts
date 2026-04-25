import { describe, it, expect } from 'vitest';
import { evaluateAnchorUnlocks } from './AnchorUnlockEvaluator';
import { createEmptyMetaState } from './MetaState';
import { LifeSummary } from './KarmicInsightRules';
import { Realm, DeathCause } from '@/engine/core/Types';

const summary = (overrides: Partial<LifeSummary> = {}): LifeSummary => ({
  yearsLived: 30,
  realmReached: Realm.MORTAL,
  maxBodyTemperingLayer: 0,
  deathCause: 'old_age' as DeathCause,
  vowsUnfulfilled: 0,
  diedProtectingOther: false,
  firstTimeFlags: [],
  anchorMultiplier: 1.0,
  inLifeKarmaDelta: 0,
  ...overrides,
});

describe('evaluateAnchorUnlocks', () => {
  it('returns ["martial_family"] when summary.maxBodyTemperingLayer >= 5', () => {
    const meta = createEmptyMetaState();
    const out = evaluateAnchorUnlocks({
      meta,
      summary: summary({ maxBodyTemperingLayer: 5 }),
      diedThisLifeFlags: [],
    });
    expect(out).toContain('martial_family');
  });

  it('does not unlock martial_family when BT layer is 4', () => {
    const out = evaluateAnchorUnlocks({
      meta: createEmptyMetaState(),
      summary: summary({ maxBodyTemperingLayer: 4 }),
      diedThisLifeFlags: [],
    });
    expect(out).not.toContain('martial_family');
  });

  it('returns ["scholars_son"] when flag read_ten_tomes_one_life is set', () => {
    const out = evaluateAnchorUnlocks({
      meta: createEmptyMetaState(),
      summary: summary(),
      diedThisLifeFlags: ['read_ten_tomes_one_life'],
    });
    expect(out).toContain('scholars_son');
  });

  it('returns ["outer_disciple"] when flag befriend_sect_disciple is set', () => {
    const out = evaluateAnchorUnlocks({
      meta: createEmptyMetaState(),
      summary: summary(),
      diedThisLifeFlags: ['befriend_sect_disciple'],
    });
    expect(out).toContain('outer_disciple');
  });

  it('does not double-list anchors already unlocked', () => {
    const meta = { ...createEmptyMetaState(), unlockedAnchors: ['true_random', 'peasant_farmer', 'martial_family'] };
    const out = evaluateAnchorUnlocks({
      meta,
      summary: summary({ maxBodyTemperingLayer: 5 }),
      diedThisLifeFlags: [],
    });
    expect(out).not.toContain('martial_family');
  });

  it('returns the empty array when no anchor unlocks fire', () => {
    const out = evaluateAnchorUnlocks({
      meta: createEmptyMetaState(),
      summary: summary(),
      diedThisLifeFlags: [],
    });
    expect(out).toEqual([]);
  });
});
