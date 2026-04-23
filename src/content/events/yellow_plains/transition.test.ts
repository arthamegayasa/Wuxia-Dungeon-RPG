import { describe, it, expect } from 'vitest';
import { loadEvents } from '../loader';
import transition from './transition.json';

describe('yellow_plains transition events', () => {
  const events = loadEvents(transition);

  it('has at least 2 events', () => {
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it('every id matches /^YP_TRANS_/', () => {
    for (const e of events) {
      expect(e.id).toMatch(/^YP_TRANS_/);
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
    expect(JSON.stringify(transition)).not.toContain('$[CHAR_NAME]');
  });

  it('YP_TRANS_OLD_AGE exists with minAge >= 60', () => {
    const e = events.find((x) => x.id === 'YP_TRANS_OLD_AGE');
    expect(e).toBeDefined();
    expect(e!.conditions.minAge ?? 0).toBeGreaterThanOrEqual(60);
  });
});
