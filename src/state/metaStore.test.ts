import { describe, it, expect, beforeEach } from 'vitest';
import { useMetaStore } from './metaStore';

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
