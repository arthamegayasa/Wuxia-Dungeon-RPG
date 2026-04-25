import { describe, it, expect } from 'vitest';
import { loadEvents } from '../loader';
import danger from './danger.json';

describe('Azure Peaks danger events (Phase 2B-2 Task 18)', () => {
  const events = loadEvents(danger);

  it('has 5 danger events', () => {
    expect(events).toHaveLength(5);
  });

  it('all events under life.danger*', () => {
    for (const e of events) {
      expect(e.category.startsWith('life.danger')).toBe(true);
    }
  });

  it('at least 3 events expose a CRIT_FAILURE deathCause path', () => {
    let count = 0;
    for (const e of events) {
      for (const c of e.choices) {
        if ((c.outcomes as any).CRIT_FAILURE?.deathCause) count++;
      }
    }
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it('rival_sect_incursion exposes unlockedBy: flee_mounted_pursuer', () => {
    const e = events.find((x) => x.id === 'AP_DANGER_RIVAL_SECT_INCURSION')!;
    const ch = e.choices.find((c) => (c as any).unlockedBy === 'flee_mounted_pursuer');
    expect(ch).toBeDefined();
  });
});
