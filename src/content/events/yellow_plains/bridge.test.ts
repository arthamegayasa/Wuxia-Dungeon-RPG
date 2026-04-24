import { describe, it, expect } from 'vitest';
import { loadEvents } from '@/content/events/loader';
import bridge from './bridge.json';

describe('Phase 2A-2 anchor-bridging events', () => {
  const events = loadEvents(bridge);
  const ids = events.map((e) => e.id);

  it('includes 2 events per new anchor (6 total)', () => {
    expect(ids).toContain('YP_BRIDGE_MARTIAL_MORNING_DRILL');
    expect(ids).toContain('YP_BRIDGE_MARTIAL_SPAR_WITH_ELDER');
    expect(ids).toContain('YP_BRIDGE_SCHOLARS_LIBRARY');
    expect(ids).toContain('YP_BRIDGE_SCHOLARS_TUTOR_ASSESSMENT');
    expect(ids).toContain('YP_BRIDGE_OUTER_CHORES');
    expect(ids).toContain('YP_BRIDGE_OUTER_OVERHEARD_LESSON');
  });

  it('every event requires its anchor flag via characterFlags.require', () => {
    const flagFor: Record<string, string> = {
      YP_BRIDGE_MARTIAL_MORNING_DRILL: 'from_martial_family',
      YP_BRIDGE_MARTIAL_SPAR_WITH_ELDER: 'from_martial_family',
      YP_BRIDGE_SCHOLARS_LIBRARY: 'literate',
      YP_BRIDGE_SCHOLARS_TUTOR_ASSESSMENT: 'literate',
      YP_BRIDGE_OUTER_CHORES: 'outer_sect_member',
      YP_BRIDGE_OUTER_OVERHEARD_LESSON: 'outer_sect_member',
    };
    for (const e of events) {
      const required = e.conditions.characterFlags?.require ?? [];
      expect(required).toContain(flagFor[e.id]);
    }
  });

  it('every event declares a yellow_plains region and an age window', () => {
    for (const e of events) {
      expect(e.conditions.regions).toContain('yellow_plains');
      expect(e.conditions.minAge).toBeGreaterThan(0);
      expect(e.conditions.maxAge).toBeGreaterThanOrEqual(e.conditions.minAge ?? 0);
    }
  });

  it('YP_BRIDGE_OUTER_OVERHEARD_LESSON witnesses silent_waters_scripture on SUCCESS', () => {
    const e = events.find((x) => x.id === 'YP_BRIDGE_OUTER_OVERHEARD_LESSON');
    expect(e).toBeDefined();
    const succ = e!.choices[0].outcomes.SUCCESS;
    expect(succ.witnessMemory).toBe('silent_waters_scripture');
  });

  it('YP_BRIDGE_SCHOLARS_TUTOR_ASSESSMENT sets tutor_favor on SUCCESS and tutor_suspicion on FAILURE', () => {
    const e = events.find((x) => x.id === 'YP_BRIDGE_SCHOLARS_TUTOR_ASSESSMENT');
    expect(e).toBeDefined();
    const succDeltas = e!.choices[0].outcomes.SUCCESS.stateDeltas ?? [];
    const failDeltas = e!.choices[0].outcomes.FAILURE.stateDeltas ?? [];
    const succFlags = succDeltas
      .filter((d) => d.kind === 'flag_set')
      .map((d) => (d as { flag: string }).flag);
    const failFlags = failDeltas
      .filter((d) => d.kind === 'flag_set')
      .map((d) => (d as { flag: string }).flag);
    expect(succFlags).toContain('tutor_favor');
    expect(failFlags).toContain('tutor_suspicion');
  });
});
