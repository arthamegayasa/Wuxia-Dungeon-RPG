import { describe, it, expect } from 'vitest';
import { loadEvents } from '../loader';
import opportunity from './opportunity.json';

describe('yellow_plains opportunity events', () => {
  const events = loadEvents(opportunity);

  it('has at least 8 events', () => {
    expect(events.length).toBeGreaterThanOrEqual(8);
  });

  it('every id matches /^YP_OPP_/', () => {
    for (const e of events) {
      expect(e.id).toMatch(/^YP_OPP_/);
    }
  });

  it('all events declare yellow_plains region', () => {
    for (const e of events) {
      expect(e.conditions.regions).toContain('yellow_plains');
    }
  });

  it('all choices have non-empty outcomes', () => {
    for (const e of events) {
      expect(e.choices.length).toBeGreaterThan(0);
      for (const c of e.choices) {
        expect(Object.keys(c.outcomes).length).toBeGreaterThan(0);
      }
    }
  });

  it('no $[CHAR_NAME]', () => {
    expect(JSON.stringify(opportunity)).not.toContain('$[CHAR_NAME]');
  });
});
