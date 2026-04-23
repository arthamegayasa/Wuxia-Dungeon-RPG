import { describe, it, expect } from 'vitest';
import { loadEvents } from '../loader';
import daily from './daily.json';

describe('yellow_plains daily events', () => {
  const events = loadEvents(daily);

  it('has at least 12 events', () => {
    expect(events.length).toBeGreaterThanOrEqual(12);
  });

  it('every event has id starting with YP_DAILY_', () => {
    for (const e of events) {
      expect(e.id).toMatch(/^YP_DAILY_/);
    }
  });

  it('all events declare yellow_plains region', () => {
    for (const e of events) {
      expect(e.conditions.regions).toContain('yellow_plains');
    }
  });

  it('all events have at least one choice with non-empty outcomes', () => {
    for (const e of events) {
      expect(e.choices.length).toBeGreaterThan(0);
      for (const c of e.choices) {
        expect(Object.keys(c.outcomes).length).toBeGreaterThan(0);
      }
    }
  });

  it('no event text uses $[CHAR_NAME] (must use $[CHARACTER])', () => {
    const all = JSON.stringify(daily);
    expect(all).not.toContain('$[CHAR_NAME]');
  });
});
