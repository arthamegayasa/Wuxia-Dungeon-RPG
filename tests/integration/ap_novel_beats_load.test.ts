import { describe, it, expect } from 'vitest';
import { loadAzurePeaksContent, __resetAzurePeaksCache } from '@/services/azurePeaksLoader';

describe('Phase 2C-3b: AP novel beat files load via lazy chunk', () => {
  it('lazy-loaded AP content includes all 20 new novel beats', async () => {
    __resetAzurePeaksCache();
    const ap = await loadAzurePeaksContent();
    const beatIds = ap.events.filter((e) => e.id.startsWith('AP_BEAT_')).map((e) => e.id);
    expect(beatIds.length).toBeGreaterThanOrEqual(20);
    // Spot-check categories:
    expect(beatIds).toContain('AP_BEAT_WEATHER_MOUNTAIN_MIST');
    expect(beatIds).toContain('AP_BEAT_ROUTINE_INNER_COURT_MEDITATION');
    expect(beatIds).toContain('AP_BEAT_ATMOSPHERE_MASTER_LECTURE');
    expect(beatIds).toContain('AP_BEAT_INNER_SENIOR_COMPARISON');
    expect(beatIds).toContain('AP_BEAT_DREAM_CLIFF_FALL');
  });

  it('all 20 beats are kind: beat with single Continue choice', async () => {
    __resetAzurePeaksCache();
    const ap = await loadAzurePeaksContent();
    const beats = ap.events.filter((e) => e.id.startsWith('AP_BEAT_'));
    for (const e of beats) {
      expect(e.kind).toBe('beat');
      expect(e.choices).toHaveLength(1);
      expect(e.choices[0]!.id).toBe('continue');
    }
  });
});
