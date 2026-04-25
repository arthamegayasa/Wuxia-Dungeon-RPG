import { describe, it, expect } from 'vitest';
import { loadEvents } from '../loader';
import daily from './daily.json';

describe('Azure Peaks daily events (Phase 2B-2 Task 15)', () => {
  const events = loadEvents(daily);
  it('has 8 daily events', () => {
    expect(events).toHaveLength(8);
  });
  it('all events scoped to azure_peaks', () => {
    for (const e of events) {
      expect(e.conditions.regions).toContain('azure_peaks');
    }
  });
  it('three events drive cultivation via meditation_progress', () => {
    let count = 0;
    for (const e of events) {
      for (const c of e.choices) {
        for (const o of Object.values(c.outcomes)) {
          if (o?.stateDeltas?.some((d: any) => d.kind === 'meditation_progress')) {
            count++;
          }
        }
      }
    }
    expect(count).toBeGreaterThanOrEqual(3);
  });
  it('all event ids prefix AP_DAILY_', () => {
    for (const e of events) {
      expect(e.id.startsWith('AP_DAILY_')).toBe(true);
    }
  });
});
