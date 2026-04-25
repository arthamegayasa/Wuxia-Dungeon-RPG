import { describe, it, expect } from 'vitest';
import { loadEvents } from '../loader';
import social from './social.json';

describe('Azure Peaks sect-social events (Phase 2B-2 Task 17)', () => {
  const events = loadEvents(social);

  it('has 6 sect-social events', () => {
    expect(events).toHaveLength(6);
  });

  it('senior_brother event sets befriend_sect_disciple flag (closes 2A-3 unlock gap)', () => {
    const e = events.find((x) => x.id === 'AP_SOCIAL_SENIOR_BROTHER_MENTOR')!;
    let found = false;
    for (const c of e.choices) {
      for (const o of Object.values(c.outcomes)) {
        for (const d of (o as any)?.stateDeltas ?? []) {
          if (d.kind === 'flag_set' && d.flag === 'befriend_sect_disciple') found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('faction_lean has at least 2 choices', () => {
    const e = events.find((x) => x.id === 'AP_SOCIAL_FACTION_LEAN')!;
    expect(e.choices.length).toBeGreaterThanOrEqual(2);
  });

  it('all events under life.social*', () => {
    for (const e of events) {
      expect(e.category.startsWith('life.social')).toBe(true);
    }
  });
});
