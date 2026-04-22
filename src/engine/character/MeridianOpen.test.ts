import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { rollMeridianOpen, OpenAttemptArgs } from './MeridianOpen';

function baseArgs(overrides: Partial<OpenAttemptArgs> = {}): OpenAttemptArgs {
  return {
    meridianId: 1,       // Lung, low risk
    mind: 0,
    techniqueBonus: 0,
    masterBonus: 0,
    impatiencePenalty: 0,
    noticePenalty: 0,
    rng: createRng(1),
    ...overrides,
  };
}

describe('rollMeridianOpen', () => {
  it('is deterministic for the same seed and inputs', () => {
    const a = rollMeridianOpen(baseArgs({ rng: createRng(42) }));
    const b = rollMeridianOpen(baseArgs({ rng: createRng(42) }));
    expect(a).toEqual(b);
  });

  it('succeeds most of the time for a low-risk meridian with high Mind', () => {
    // Lung baseRisk=10, Mind=60 → effective risk = 10 - 30 = 0 (clamped to >=1)
    const rng = createRng(100);
    let successes = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const res = rollMeridianOpen({
        meridianId: 1, mind: 60, techniqueBonus: 0, masterBonus: 0,
        impatiencePenalty: 0, noticePenalty: 0, rng,
      });
      if (res.success) successes++;
    }
    expect(successes / N).toBeGreaterThan(0.97);
  });

  it('mostly fails for a very-high-risk meridian with no mitigation', () => {
    // Triple Burner baseRisk=40, Mind=0 → effective 40% deviation
    const rng = createRng(200);
    let failures = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const res = rollMeridianOpen({
        meridianId: 10, mind: 0, techniqueBonus: 0, masterBonus: 0,
        impatiencePenalty: 0, noticePenalty: 0, rng,
      });
      if (!res.success) failures++;
    }
    // Expect ~40% failure — loose bounds
    expect(failures / N).toBeGreaterThan(0.30);
    expect(failures / N).toBeLessThan(0.50);
  });

  it('Mind reduces deviation chance by 0.5 per point', () => {
    // Hand-verify the formula: risk_used = max(1, base - mind*0.5 - tech - master + imp + notice)
    // For Lung (base 10), mind 20, others 0 → risk_used = 10 - 10 = 0 → clamped to 1
    const rng = createRng(300);
    let successes = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      const res = rollMeridianOpen({
        meridianId: 1, mind: 20, techniqueBonus: 0, masterBonus: 0,
        impatiencePenalty: 0, noticePenalty: 0, rng,
      });
      if (res.success) successes++;
    }
    expect(successes / N).toBeGreaterThan(0.95);
  });

  it('technique + master bonuses reduce deviation chance further', () => {
    // High-risk Kidney (base 30), mind 0, tech 15, master 20 → risk_used = 30 - 35 → clamped to 1
    const rng = createRng(400);
    let successes = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      const res = rollMeridianOpen({
        meridianId: 8, mind: 0, techniqueBonus: 15, masterBonus: 20,
        impatiencePenalty: 0, noticePenalty: 0, rng,
      });
      if (res.success) successes++;
    }
    expect(successes / N).toBeGreaterThan(0.95);
  });

  it('impatience and notice penalties increase deviation chance', () => {
    // Lung (base 10), no mind, impatience 20, notice 10 → risk_used = 40
    const rng = createRng(500);
    let failures = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const res = rollMeridianOpen({
        meridianId: 1, mind: 0, techniqueBonus: 0, masterBonus: 0,
        impatiencePenalty: 20, noticePenalty: 10, rng,
      });
      if (!res.success) failures++;
    }
    expect(failures / N).toBeGreaterThan(0.30);
  });

  it('effective risk is clamped to [1, 95]', () => {
    // Impossible amount of bonus shouldn't drive risk below 1 → always some failure chance
    const rngA = createRng(600);
    let failureSeen = false;
    for (let i = 0; i < 2000 && !failureSeen; i++) {
      const res = rollMeridianOpen({
        meridianId: 1, mind: 500, techniqueBonus: 500, masterBonus: 500,
        impatiencePenalty: 0, noticePenalty: 0, rng: rngA,
      });
      if (!res.success) failureSeen = true;
    }
    expect(failureSeen).toBe(true);

    // Conversely, absurd penalties should not exceed 95% failure
    const rngB = createRng(601);
    let successSeen = false;
    for (let i = 0; i < 200 && !successSeen; i++) {
      const res = rollMeridianOpen({
        meridianId: 10, mind: 0, techniqueBonus: 0, masterBonus: 0,
        impatiencePenalty: 500, noticePenalty: 500, rng: rngB,
      });
      if (res.success) successSeen = true;
    }
    expect(successSeen).toBe(true);
  });
});
