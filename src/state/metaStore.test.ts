import { describe, it, expect, beforeEach } from 'vitest';
import { useMetaStore } from './metaStore';
import { createEmptyMetaState, MetaState } from '@/engine/meta/MetaState';

describe('metaStore', () => {
  beforeEach(() => {
    useMetaStore.getState().reset();
  });

  it('starts with zero karma and empty echoes/memories', () => {
    const s = useMetaStore.getState();
    expect(s.karmicInsight).toBe(0);
    expect(s.unlockedEchoes).toEqual([]);
    expect(s.unlockedMemories).toEqual([]);
    expect(s.heavenlyNotice).toBe(0);
    expect(s.lifeCount).toBe(0);
  });

  it('addKarma increments', () => {
    useMetaStore.getState().addKarma(50);
    useMetaStore.getState().addKarma(25);
    expect(useMetaStore.getState().karmicInsight).toBe(75);
  });

  it('spendKarma requires sufficient balance', () => {
    const s = useMetaStore.getState();
    s.addKarma(100);
    expect(s.spendKarma(30)).toBe(true);
    expect(useMetaStore.getState().karmicInsight).toBe(70);
    expect(useMetaStore.getState().spendKarma(999)).toBe(false);
    expect(useMetaStore.getState().karmicInsight).toBe(70);
  });
});

describe('metaStore hydration', () => {
  beforeEach(() => useMetaStore.getState().reset());

  it('hydrateFromMetaState replaces the store slice with MetaState fields', () => {
    const meta: MetaState = {
      ...createEmptyMetaState(),
      karmaBalance: 150,
      lifeCount: 3,
      ownedUpgrades: ['awakened_soul_1'],
      unlockedAnchors: ['true_random', 'peasant_farmer', 'outer_disciple'],
    };
    useMetaStore.getState().hydrateFromMetaState(meta);
    const s = useMetaStore.getState();
    expect(s.karmicInsight).toBe(150);
    expect(s.lifeCount).toBe(3);
    expect(s.unlockedAnchors).toContain('outer_disciple');
  });

  it('toMetaState round-trips hydrate output as an equivalent MetaState', () => {
    const meta: MetaState = {
      ...createEmptyMetaState(),
      karmaBalance: 80,
      lifeCount: 2,
      ownedUpgrades: ['awakened_soul_1'],
    };
    useMetaStore.getState().hydrateFromMetaState(meta);
    const round = useMetaStore.getState().toMetaState();
    expect(round.karmaBalance).toBe(80);
    expect(round.lifeCount).toBe(2);
    expect(round.ownedUpgrades).toContain('awakened_soul_1');
  });
});
