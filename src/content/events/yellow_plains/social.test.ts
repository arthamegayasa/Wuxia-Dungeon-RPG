import { describe, it, expect } from 'vitest';
import { loadEvents } from '../loader';
import social from './social.json';

describe('yellow_plains social events', () => {
  const events = loadEvents(social);

  it('has at least 10 events', () => {
    expect(events.length).toBeGreaterThanOrEqual(10);
  });

  it('every id matches /^YP_SOCIAL_/', () => {
    for (const e of events) {
      expect(e.id).toMatch(/^YP_SOCIAL_/);
    }
  });

  it('all events declare yellow_plains region', () => {
    for (const e of events) {
      expect(e.conditions.regions).toContain('yellow_plains');
    }
  });

  it('all choices have non-empty outcomes', () => {
    for (const e of events) {
      for (const c of e.choices) {
        expect(Object.keys(c.outcomes).length).toBeGreaterThan(0);
      }
    }
  });

  it('no $[CHAR_NAME]', () => {
    expect(JSON.stringify(social)).not.toContain('$[CHAR_NAME]');
  });

  it('at least one event has a minAge condition', () => {
    const hasIt = events.some((e) => e.conditions.minAge !== undefined);
    expect(hasIt).toBe(true);
  });

  it('at least one event is once_per_life', () => {
    expect(events.some((e) => e.repeat === 'once_per_life')).toBe(true);
  });
});
