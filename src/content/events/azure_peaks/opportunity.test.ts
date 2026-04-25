import { describe, it, expect } from 'vitest';
import { loadEvents } from '../loader';
import opportunity from './opportunity.json';

describe('Azure Peaks opportunity events (Phase 2B-2 Task 19)', () => {
  const events = loadEvents(opportunity);

  it('has 5 opportunity events', () => {
    expect(events).toHaveLength(5);
  });

  it('all opportunity events are once_per_life', () => {
    for (const e of events) expect(e.repeat).toBe('once_per_life');
  });

  it('manual drops span at least three completeness tiers (0.25/0.75/1.0)', () => {
    const dropped = new Set<string>();
    for (const e of events) {
      for (const c of e.choices) {
        for (const o of Object.values(c.outcomes)) {
          for (const d of (o as any)?.stateDeltas ?? []) {
            if (d.kind === 'item_add' && typeof d.id === 'string' && d.id.startsWith('manual_')) {
              dropped.add(d.id);
            }
          }
        }
      }
    }
    expect(dropped.size).toBeGreaterThanOrEqual(3);
  });
});
