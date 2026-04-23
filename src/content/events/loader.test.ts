import { describe, it, expect } from 'vitest';
import { loadEvents } from './loader';
import smokeJson from './yellow_plains/__smoke.json';

describe('loadEvents', () => {
  it('parses the smoke event pack', () => {
    const events = loadEvents(smokeJson);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.id).toBeDefined();
  });

  it('returns fully validated EventDef objects', () => {
    const events = loadEvents(smokeJson);
    for (const e of events) {
      expect(e.choices.length).toBeGreaterThan(0);
      expect(e.weight).toBeGreaterThan(0);
      expect(e.timeCost).toBeDefined();
    }
  });

  it('throws on an envelope without an events array', () => {
    expect(() => loadEvents({ version: 1 })).toThrow(/events/i);
  });

  it('throws on an event with a missing required field (id)', () => {
    const bad = {
      version: 1,
      events: [{
        category: 'test', version: 1, weight: 1,
        conditions: {}, timeCost: 'SHORT',
        text: { intro: ['x'] },
        choices: [{
          id: 'ch', label: 'Go.', timeCost: 'SHORT',
          outcomes: { SUCCESS: { narrativeKey: 'ok' } },
        }],
        repeat: 'unlimited',
      }],
    };
    expect(() => loadEvents(bad)).toThrow();
  });

  it('throws on an unknown timeCost value', () => {
    const bad = {
      version: 1,
      events: [{
        id: 'x', category: 'test', version: 1, weight: 1,
        conditions: {}, timeCost: 'NEVER',
        text: { intro: ['x'] },
        choices: [{
          id: 'ch', label: 'Go.', timeCost: 'NEVER',
          outcomes: { SUCCESS: { narrativeKey: 'ok' } },
        }],
        repeat: 'unlimited',
      }],
    };
    expect(() => loadEvents(bad)).toThrow();
  });
});
