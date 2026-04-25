import { describe, it, expect } from 'vitest';
import { EchoRegistry } from './EchoRegistry';
import { evaluateUnlocks, UnlockContext } from './EchoUnlocker';
import { SoulEcho } from './SoulEcho';
import { createEmptyMetaState } from './MetaState';

const ironBody: SoulEcho = {
  id: 'iron_body', name: 'Iron Body', description: '',
  tier: 'fragment',
  unlockCondition: { kind: 'reach_realm', realm: 'body_tempering', sublayer: 5 },
  effects: [], conflicts: [], reveal: 'birth',
};

const farmer: SoulEcho = {
  id: 'farmers_eye', name: "Farmer's Eye", description: '',
  tier: 'fragment',
  unlockCondition: { kind: 'lives_as_anchor_max_age', anchor: 'peasant_farmer', lives: 2 },
  effects: [], conflicts: [], reveal: 'birth',
};

describe('evaluateUnlocks', () => {
  const reg = EchoRegistry.fromList([ironBody, farmer]);

  it('returns empty when no conditions met', () => {
    const ctx: UnlockContext = {
      meta: createEmptyMetaState(),
      finalRealm: 'mortal',
      finalBodyTemperingLayer: 0,
      diedOfOldAge: false,
      yearsLived: 30,
      diedThisLifeFlags: [],
      anchorThisLife: 'peasant_farmer',
      echoProgressCumulative: {},
      dominantRegionThisLife: 'yellow_plains',
      regionStreakByRegion: { yellow_plains: 1 },
    };
    expect(evaluateUnlocks(reg, ctx)).toEqual([]);
  });

  it('unlocks iron_body when finalBodyTemperingLayer >= 5', () => {
    const ctx: UnlockContext = {
      meta: createEmptyMetaState(),
      finalRealm: 'body_tempering',
      finalBodyTemperingLayer: 5,
      diedOfOldAge: false,
      yearsLived: 40,
      diedThisLifeFlags: [],
      anchorThisLife: 'peasant_farmer',
      echoProgressCumulative: {},
      dominantRegionThisLife: 'yellow_plains',
      regionStreakByRegion: { yellow_plains: 1 },
    };
    expect(evaluateUnlocks(reg, ctx)).toContain('iron_body');
  });

  it('does not re-unlock already-unlocked echoes', () => {
    const meta = { ...createEmptyMetaState(), echoesUnlocked: ['iron_body'] };
    const ctx: UnlockContext = {
      meta,
      finalRealm: 'body_tempering',
      finalBodyTemperingLayer: 9,
      diedOfOldAge: false,
      yearsLived: 40,
      diedThisLifeFlags: [],
      anchorThisLife: 'peasant_farmer',
      echoProgressCumulative: {},
      dominantRegionThisLife: 'yellow_plains',
      regionStreakByRegion: { yellow_plains: 1 },
    };
    expect(evaluateUnlocks(reg, ctx)).not.toContain('iron_body');
  });

  it('unlocks farmers_eye after 2 max-age peasant lives (meta.lineage tracks anchor usage)', () => {
    const meta = {
      ...createEmptyMetaState(),
      lineage: [
        { lifeIndex: 1, name: 'A', anchorId: 'peasant_farmer', birthYear: 0, deathYear: 90, yearsLived: 90, realmReached: 'mortal', deathCause: 'old_age', karmaEarned: 10, echoesUnlockedThisLife: [] },
        { lifeIndex: 2, name: 'B', anchorId: 'peasant_farmer', birthYear: 0, deathYear: 88, yearsLived: 88, realmReached: 'mortal', deathCause: 'old_age', karmaEarned: 10, echoesUnlockedThisLife: [] },
      ],
    };
    const ctx: UnlockContext = {
      meta,
      finalRealm: 'mortal',
      finalBodyTemperingLayer: 0,
      diedOfOldAge: true,
      yearsLived: 85,
      diedThisLifeFlags: [],
      anchorThisLife: 'peasant_farmer',
      echoProgressCumulative: {},
      dominantRegionThisLife: 'yellow_plains',
      regionStreakByRegion: { yellow_plains: 1 },
    };
    expect(evaluateUnlocks(reg, ctx)).toContain('farmers_eye');
  });
});
