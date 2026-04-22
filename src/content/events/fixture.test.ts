import { describe, it, expect } from 'vitest';
import { FIXTURE_EVENTS } from './fixture';
import { EventSchema } from '@/content/schema';

describe('FIXTURE_EVENTS', () => {
  it('has at least 3 events', () => {
    expect(FIXTURE_EVENTS.length).toBeGreaterThanOrEqual(3);
  });

  it('every fixture event validates against EventSchema', () => {
    for (const ev of FIXTURE_EVENTS) {
      const res = EventSchema.safeParse(ev);
      expect(res.success).toBe(true);
    }
  });

  it('at least one event can produce a non-fatal outcome and at least one can cause death', () => {
    const hasFatal = FIXTURE_EVENTS.some((ev) =>
      ev.choices.some((c) =>
        Object.values(c.outcomes).some((o: any) => o.deathCause != null),
      ),
    );
    expect(hasFatal).toBe(true);
  });

  it('all fixture events declare yellow_plains in regions', () => {
    for (const ev of FIXTURE_EVENTS) {
      expect(ev.conditions?.regions).toContain('yellow_plains');
    }
  });
});
