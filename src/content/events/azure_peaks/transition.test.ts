import { describe, it, expect } from 'vitest';
import { loadEvents } from '../loader';
import transition from './transition.json';

describe('Azure Peaks transition events (Phase 2B-2 Task 21)', () => {
  const events = loadEvents(transition);

  it('has 5 transition events', () => {
    expect(events).toHaveLength(5);
  });

  it('every transition event has at least one region_change outcome', () => {
    for (const e of events) {
      let found = false;
      for (const c of e.choices) {
        for (const o of Object.values(c.outcomes)) {
          for (const d of (o as any)?.stateDeltas ?? []) {
            if (d.kind === 'region_change') { found = true; break; }
          }
          if (found) break;
        }
        if (found) break;
      }
      expect(found, `${e.id} has no region_change outcome`).toBe(true);
    }
  });

  it('descend_to_plains targets yellow_plains', () => {
    const e = events.find((x) => x.id === 'AP_TRANSITION_DESCEND_TO_PLAINS')!;
    expect(e).toBeDefined();
    const targets = new Set<string>();
    for (const c of e.choices) {
      for (const o of Object.values(c.outcomes)) {
        for (const d of (o as any)?.stateDeltas ?? []) {
          if (d.kind === 'region_change') targets.add(d.regionId);
        }
      }
    }
    expect(targets.has('yellow_plains')).toBe(true);
  });

  it('return_to_peaks requires sect_disciple flag', () => {
    const e = events.find((x) => x.id === 'AP_TRANSITION_RETURN_TO_PEAKS')!;
    expect(e).toBeDefined();
    expect(e.conditions.characterFlags?.require).toContain('sect_disciple');
  });

  it('AP_TRANSITION_WANDERING_MASTER_VISIT is once_per_life', () => {
    const e = events.find((x) => x.id === 'AP_TRANSITION_WANDERING_MASTER_VISIT')!;
    expect(e).toBeDefined();
    expect(e.repeat).toBe('once_per_life');
  });

  it('descend_to_plains is only in azure_peaks region', () => {
    const e = events.find((x) => x.id === 'AP_TRANSITION_DESCEND_TO_PLAINS')!;
    expect(e.conditions.regions).toEqual(['azure_peaks']);
  });

  it('return_to_peaks is only in yellow_plains region', () => {
    const e = events.find((x) => x.id === 'AP_TRANSITION_RETURN_TO_PEAKS')!;
    expect(e.conditions.regions).toEqual(['yellow_plains']);
  });

  it('cross-region events appear in both regions', () => {
    const crossRegionIds = [
      'AP_TRANSITION_CROSS_REGION_ENCOUNTER',
      'AP_TRANSITION_WANDERING_MASTER_VISIT',
      'AP_TRANSITION_SECT_PILGRIMAGE',
    ];
    for (const id of crossRegionIds) {
      const e = events.find((x) => x.id === id)!;
      expect(e).toBeDefined();
      expect(e.conditions.regions).toContain('yellow_plains');
      expect(e.conditions.regions).toContain('azure_peaks');
    }
  });

  it('all transition events are categorised as life.transition', () => {
    for (const e of events) {
      expect(e.category).toBe('life.transition');
    }
  });

  it('sect_pilgrimage requires sect_disciple flag', () => {
    const e = events.find((x) => x.id === 'AP_TRANSITION_SECT_PILGRIMAGE')!;
    expect(e).toBeDefined();
    expect(e.conditions.characterFlags?.require).toContain('sect_disciple');
  });

  it('wandering_master_visit sets seen_technique flag on crit success', () => {
    const e = events.find((x) => x.id === 'AP_TRANSITION_WANDERING_MASTER_VISIT')!;
    const flagSets = new Set<string>();
    for (const c of e.choices) {
      const critSuccess = c.outcomes['CRIT_SUCCESS'];
      if (critSuccess) {
        for (const d of (critSuccess as any)?.stateDeltas ?? []) {
          if (d.kind === 'flag_set') flagSets.add(d.flag as string);
        }
      }
    }
    expect([...flagSets].some((f) => f.startsWith('seen_technique_'))).toBe(true);
  });
});
