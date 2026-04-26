// Tests for azurePeaksLoader lazy-load module. Phase 2B-2 Task 24.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadAzurePeaksContent, __resetAzurePeaksCache } from './azurePeaksLoader';

describe('loadAzurePeaksContent (Phase 2B-2 Task 24)', () => {
  beforeEach(() => __resetAzurePeaksCache());

  it('loads the Azure Peaks region', async () => {
    const ap = await loadAzurePeaksContent();
    expect(ap.region.id).toBe('azure_peaks');
    expect(ap.region.qiDensity).toBe(1.5);
  });

  it('loads at least 35 events', async () => {
    const ap = await loadAzurePeaksContent();
    expect(ap.events.length).toBeGreaterThanOrEqual(35);
  });

  it('caches the promise across calls', () => {
    const p1 = loadAzurePeaksContent();
    const p2 = loadAzurePeaksContent();
    expect(p1).toBe(p2);
  });

  it('cache resets after __resetAzurePeaksCache', () => {
    const p1 = loadAzurePeaksContent();
    __resetAzurePeaksCache();
    const p2 = loadAzurePeaksContent();
    expect(p1).not.toBe(p2);
  });

  it('snippets contain the QS awakening leaf', async () => {
    const ap = await loadAzurePeaksContent();
    expect(ap.snippets.has('realm.qi_sensing.awaken')).toBe(true);
  });

  it('all events have a string id', async () => {
    const ap = await loadAzurePeaksContent();
    for (const evt of ap.events) {
      expect(typeof evt.id).toBe('string');
      expect(evt.id.length).toBeGreaterThan(0);
    }
  });

  it('techniques array is non-empty', async () => {
    const ap = await loadAzurePeaksContent();
    expect(ap.techniques.length).toBeGreaterThan(0);
  });

  it('items array is non-empty', async () => {
    const ap = await loadAzurePeaksContent();
    expect(ap.items.length).toBeGreaterThan(0);
  });

  it('echoes array is non-empty', async () => {
    const ap = await loadAzurePeaksContent();
    expect(ap.echoes.length).toBeGreaterThan(0);
  });

  it('memories array is non-empty', async () => {
    const ap = await loadAzurePeaksContent();
    expect(ap.memories.length).toBeGreaterThan(0);
  });
});
