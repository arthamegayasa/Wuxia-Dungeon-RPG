import { describe, it, expect } from 'vitest';
import beatsWeather from '@/content/events/yellow_plains/beats_weather.json';
import beatsRoutine from '@/content/events/yellow_plains/beats_routine.json';
import beatsAtmosphere from '@/content/events/yellow_plains/beats_atmosphere.json';
import beatsInner from '@/content/events/yellow_plains/beats_inner.json';
import beatsDream from '@/content/events/yellow_plains/beats_dream.json';
import { loadEvents } from '@/content/events/loader';

describe('Phase 2C-2b: YP novel beat files load + parse', () => {
  it('all 5 files have valid event packs', () => {
    expect(loadEvents(beatsWeather)).toHaveLength(5);
    expect(loadEvents(beatsRoutine)).toHaveLength(5);
    expect(loadEvents(beatsAtmosphere)).toHaveLength(4);
    expect(loadEvents(beatsInner)).toHaveLength(3);
    expect(loadEvents(beatsDream)).toHaveLength(3);
  });
  it('all 20 events are kind: beat with single Continue choice', () => {
    const all = [
      ...loadEvents(beatsWeather),
      ...loadEvents(beatsRoutine),
      ...loadEvents(beatsAtmosphere),
      ...loadEvents(beatsInner),
      ...loadEvents(beatsDream),
    ];
    expect(all).toHaveLength(20);
    for (const e of all) {
      expect(e.kind).toBe('beat');
      expect(e.choices).toHaveLength(1);
      expect(e.choices[0]!.id).toBe('continue');
      expect(e.choices[0]!.label).toBe('Continue');
    }
  });
  it('all 20 events have at least 3 paragraphs of body text', () => {
    const all = [
      ...loadEvents(beatsWeather),
      ...loadEvents(beatsRoutine),
      ...loadEvents(beatsAtmosphere),
      ...loadEvents(beatsInner),
      ...loadEvents(beatsDream),
    ];
    for (const e of all) {
      const totalParagraphs = (e.text.intro?.length ?? 0) + (e.text.body?.length ?? 0) + (e.text.outro?.length ?? 0);
      expect(totalParagraphs).toBeGreaterThanOrEqual(3);
    }
  });
});
