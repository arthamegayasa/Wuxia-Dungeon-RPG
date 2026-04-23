import { describe, it, expect } from 'vitest';
import { loadEvents } from '../loader';
import danger from './danger.json';

describe('yellow_plains danger events', () => {
  const events = loadEvents(danger);

  it('has at least 8 events', () => {
    expect(events.length).toBeGreaterThanOrEqual(8);
  });

  it('every id matches /^YP_DANGER_/', () => {
    for (const e of events) {
      expect(e.id).toMatch(/^YP_DANGER_/);
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
    expect(JSON.stringify(danger)).not.toContain('$[CHAR_NAME]');
  });

  it('at least one outcome sets a deathCause', () => {
    const found = events.some((e) =>
      e.choices.some((c) => {
        const tiers = c.outcomes;
        return (
          tiers.CRIT_SUCCESS?.deathCause ||
          tiers.SUCCESS?.deathCause ||
          tiers.PARTIAL?.deathCause ||
          tiers.FAILURE?.deathCause ||
          tiers.CRIT_FAILURE?.deathCause
        );
      })
    );
    expect(found).toBe(true);
  });
});
