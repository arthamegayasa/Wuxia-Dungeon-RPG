import { describe, it, expect } from 'vitest';
import { loadEvents } from '../loader';
import realmGate from './realm_gate.json';

describe('Azure Peaks realm-gate events (Phase 2B-2 Task 20)', () => {
  const events = loadEvents(realmGate);

  it('has 5 realm-gate events', () => {
    expect(events).toHaveLength(5);
  });

  it('AP_GATE_QS_AWAKENING uses bt9_cultivation_full predicate', () => {
    const e = events.find((x) => x.id === 'AP_GATE_QS_AWAKENING')!;
    expect(e).toBeDefined();
    expect(e.conditions.customPredicate).toBe('bt9_cultivation_full');
  });

  it('AP_GATE_FIRST_TECHNIQUE_LEARN uses qs_no_techniques predicate', () => {
    const e = events.find((x) => x.id === 'AP_GATE_FIRST_TECHNIQUE_LEARN')!;
    expect(e).toBeDefined();
    expect(e.conditions.customPredicate).toBe('qs_no_techniques');
  });

  it('AP_GATE_QC1_ENTRY uses qs_with_techniques_full predicate', () => {
    const e = events.find((x) => x.id === 'AP_GATE_QC1_ENTRY')!;
    expect(e).toBeDefined();
    expect(e.conditions.customPredicate).toBe('qs_with_techniques_full');
  });

  it('AP_GATE_QC5_TRIAL uses qc5_full predicate', () => {
    const e = events.find((x) => x.id === 'AP_GATE_QC5_TRIAL')!;
    expect(e).toBeDefined();
    expect(e.conditions.customPredicate).toBe('qc5_full');
  });

  it('AP_GATE_QC9_TRIBULATION_SETUP uses qc9_full predicate', () => {
    const e = events.find((x) => x.id === 'AP_GATE_QC9_TRIBULATION_SETUP')!;
    expect(e).toBeDefined();
    expect(e.conditions.customPredicate).toBe('qc9_full');
  });

  it('all realm-gate events have weight >= 150 for selector priority', () => {
    for (const e of events) {
      expect(e.weight).toBeGreaterThanOrEqual(150);
    }
  });

  it('all realm-gate events are in the azure_peaks region', () => {
    for (const e of events) {
      expect(e.conditions.regions).toContain('azure_peaks');
    }
  });

  it('every realm-gate event emits attempt_realm_crossing or technique_learn on at least one outcome', () => {
    for (const e of events) {
      let found = false;
      for (const c of e.choices) {
        for (const o of Object.values(c.outcomes)) {
          for (const d of (o as any)?.stateDeltas ?? []) {
            if (d.kind === 'attempt_realm_crossing' || d.kind === 'technique_learn') {
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (found) break;
      }
      expect(found, `event ${e.id} lacks attempt_realm_crossing or technique_learn`).toBe(true);
    }
  });

  it('all realm-gate events have category starting with life.realm_gate', () => {
    for (const e of events) {
      expect(e.category.startsWith('life.realm_gate')).toBe(true);
    }
  });
});
