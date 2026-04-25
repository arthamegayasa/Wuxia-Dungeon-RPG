import { describe, it, expect } from 'vitest';
import {
  computePartialManualRisk,
  resolvePartialManualLearn,
  PartialManualFailureSeverity,
} from './PartialManualLearn';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';

describe('computePartialManualRisk (Phase 2B-1 Task 9)', () => {
  const baseArgs = {
    baseRisk: 60, completeness: 1.0 as const,
    mind: 0, insight: 0, realm: Realm.BODY_TEMPERING, minRealm: undefined,
  };

  it('complete (1.0) → 0 risk', () => {
    expect(computePartialManualRisk(baseArgs)).toBe(0);
  });

  it('fragment (0.25) → highest risk', () => {
    const r = computePartialManualRisk({ ...baseArgs, completeness: 0.25 });
    expect(r).toBeCloseTo(33.75, 1);
  });

  it('partial (0.5) → mid risk', () => {
    const r = computePartialManualRisk({ ...baseArgs, completeness: 0.5 });
    expect(r).toBe(15);
  });

  it('0.75 → low risk', () => {
    const r = computePartialManualRisk({ ...baseArgs, completeness: 0.75 });
    expect(r).toBeCloseTo(3.75, 1);
  });

  it('Mind + Insight lower the risk', () => {
    const r = computePartialManualRisk({
      ...baseArgs, completeness: 0.25, mind: 20, insight: 40,
    });
    expect(r).toBeCloseTo(25.75, 1);
  });

  it('realm < minRealm adds 40 penalty', () => {
    const r = computePartialManualRisk({
      ...baseArgs, completeness: 0.5, realm: Realm.MORTAL, minRealm: Realm.QI_SENSING,
    });
    expect(r).toBe(55);
  });

  it('clamps to [0, 95]', () => {
    const high = computePartialManualRisk({
      baseRisk: 200, completeness: 0.25, mind: 0, insight: 0,
      realm: Realm.MORTAL, minRealm: Realm.FOUNDATION,
    });
    expect(high).toBe(95);

    const low = computePartialManualRisk({
      baseRisk: 10, completeness: 0.75, mind: 100, insight: 100,
      realm: Realm.BODY_TEMPERING,
    });
    expect(low).toBe(0);
  });
});

describe('resolvePartialManualLearn (Phase 2B-1 Task 9)', () => {
  it('0% risk → always success, no severity', () => {
    const rng = createRng(1);
    const r = resolvePartialManualLearn({ risk: 0, rng });
    expect(r.success).toBe(true);
    expect(r.severity).toBeNull();
  });

  it('95% risk → high chance of failure (shape check)', () => {
    const rng = createRng(1);
    const r = resolvePartialManualLearn({ risk: 95, rng });
    expect(['tremor', 'scar', 'cripple', null]).toContain(r.severity);
    expect(typeof r.success).toBe('boolean');
  });

  it('severity bands tremor (1-50) / scar (51-80) / cripple (81-95) all reachable', () => {
    const counts: Record<string, number> = { tremor: 0, scar: 0, cripple: 0, success: 0 };
    for (let seed = 1; seed <= 500; seed++) {
      const r = resolvePartialManualLearn({ risk: 95, rng: createRng(seed) });
      if (r.success) counts.success++;
      else counts[r.severity ?? 'unknown']!++;
    }
    expect(counts.tremor).toBeGreaterThan(0);
    expect(counts.scar).toBeGreaterThan(0);
    expect(counts.cripple).toBeGreaterThan(0);
  });
});
