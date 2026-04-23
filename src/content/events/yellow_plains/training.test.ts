import { describe, it, expect } from 'vitest';
import { loadEvents } from '../loader';
import training from './training.json';

describe('yellow_plains training events', () => {
  const events = loadEvents(training);

  it('has at least 10 events', () => {
    expect(events.length).toBeGreaterThanOrEqual(10);
  });

  it('every event id matches /^YP_TRAIN_/', () => {
    for (const e of events) {
      expect(e.id).toMatch(/^YP_TRAIN_/);
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

  it('no $[CHAR_NAME] anywhere', () => {
    expect(JSON.stringify(training)).not.toContain('$[CHAR_NAME]');
  });

  it('at least one event has a cultivation_progress_delta', () => {
    const hasIt = events.some((e) =>
      e.choices.some((c) =>
        Object.values(c.outcomes).some((o: any) =>
          o.stateDeltas?.some((d: any) => d.kind === 'cultivation_progress_delta'),
        ),
      ),
    );
    expect(hasIt).toBe(true);
  });

  it('at least one event has a meridian_open', () => {
    const hasIt = events.some((e) =>
      e.choices.some((c) =>
        Object.values(c.outcomes).some((o: any) =>
          o.stateDeltas?.some((d: any) => d.kind === 'meridian_open'),
        ),
      ),
    );
    expect(hasIt).toBe(true);
  });
});
