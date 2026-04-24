import { describe, it, expect } from 'vitest';
import { loadEvents } from '@/content/events/loader';
import meditation from './meditation.json';

describe('meditation events', () => {
  const events = loadEvents(meditation);
  it('has 3 events all with category meditation', () => {
    expect(events).toHaveLength(3);
    for (const e of events) expect(e.category).toBe('meditation');
  });
});
