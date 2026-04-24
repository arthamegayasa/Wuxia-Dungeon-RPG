import { describe, it, expect } from 'vitest';
import { loadEvents } from '@/content/events/loader';
import daily from './daily.json';
import training from './training.json';
import social from './social.json';
import danger from './danger.json';
import opportunity from './opportunity.json';
import transition from './transition.json';
import bridge from './bridge.json';
import { loadMemories } from '@/content/memories/loader';
import memPack from '@/content/memories/memories.json';

describe('Phase 2A-2 witness coverage', () => {
  const allEvents = [
    ...loadEvents(daily),
    ...loadEvents(training),
    ...loadEvents(social),
    ...loadEvents(danger),
    ...loadEvents(opportunity),
    ...loadEvents(transition),
    ...loadEvents(bridge),
  ];
  const memories = loadMemories(memPack);

  it('every memory has at least one witness chance across Yellow Plains events', () => {
    const allWitnessRefs = new Set<string>();
    for (const ev of allEvents) {
      for (const ch of ev.choices) {
        const outs = ch.outcomes;
        for (const tier of ['CRIT_SUCCESS', 'SUCCESS', 'PARTIAL', 'FAILURE', 'CRIT_FAILURE'] as const) {
          const o = outs[tier as keyof typeof outs];
          if (o?.witnessMemory) allWitnessRefs.add(o.witnessMemory);
        }
      }
    }
    for (const m of memories) {
      expect(allWitnessRefs.has(m.id)).toBe(true);
    }
  });

  it('has at least 10 witness-annotated outcomes', () => {
    let count = 0;
    for (const ev of allEvents) {
      for (const ch of ev.choices) {
        for (const o of Object.values(ch.outcomes)) {
          if (o?.witnessMemory) count += 1;
        }
      }
    }
    expect(count).toBeGreaterThanOrEqual(10);
  });
});
