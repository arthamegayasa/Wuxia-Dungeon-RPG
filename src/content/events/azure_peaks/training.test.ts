import { describe, it, expect } from 'vitest';
import { loadEvents } from '../loader';
import training from './training.json';

function countDeltas(events: any[], kind: string): number {
  let count = 0;
  for (const e of events) {
    for (const c of e.choices) {
      for (const o of Object.values(c.outcomes)) {
        for (const d of (o as any)?.stateDeltas ?? []) {
          if (d.kind === kind) count++;
        }
      }
    }
  }
  return count;
}

describe('Azure Peaks sect-training events (Phase 2B-2 Task 16)', () => {
  const events = loadEvents(training);

  it('has 6 sect-training events', () => {
    expect(events).toHaveLength(6);
  });

  it('two events emit meridian_open outcomes', () => {
    expect(countDeltas(events as any, 'meridian_open')).toBeGreaterThanOrEqual(2);
  });

  it('two events emit technique_learn outcomes', () => {
    expect(countDeltas(events as any, 'technique_learn')).toBeGreaterThanOrEqual(2);
  });

  it('all event categories under life.training', () => {
    for (const e of events) {
      expect(e.category.startsWith('life.training')).toBe(true);
    }
  });
});
