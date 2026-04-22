import { describe, it, expect } from 'vitest';
import { STATS } from '@/engine/core/Types';
import {
  clampAttribute,
  addAttribute,
  zeroAttributes,
  hpMax,
  qiMax,
} from './Attribute';

describe('clampAttribute', () => {
  it('clamps to [0, 100]', () => {
    expect(clampAttribute(-5)).toBe(0);
    expect(clampAttribute(0)).toBe(0);
    expect(clampAttribute(50)).toBe(50);
    expect(clampAttribute(100)).toBe(100);
    expect(clampAttribute(500)).toBe(100);
  });

  it('rounds to nearest integer', () => {
    expect(clampAttribute(42.4)).toBe(42);
    expect(clampAttribute(42.6)).toBe(43);
  });
});

describe('addAttribute', () => {
  it('adds and clamps', () => {
    expect(addAttribute(90, 20)).toBe(100);
    expect(addAttribute(10, -50)).toBe(0);
    expect(addAttribute(40, 15)).toBe(55);
  });
});

describe('zeroAttributes', () => {
  it('returns a map with every stat at 0', () => {
    const z = zeroAttributes();
    for (const s of STATS) expect(z[s]).toBe(0);
  });
});

describe('hpMax', () => {
  it('baseline: 30 + Body*2 + bodyTemperingLayer*10', () => {
    expect(hpMax({ body: 0, bodyTemperingLayer: 0 })).toBe(30);
    expect(hpMax({ body: 10, bodyTemperingLayer: 0 })).toBe(50);
    expect(hpMax({ body: 10, bodyTemperingLayer: 3 })).toBe(80);
    expect(hpMax({ body: 50, bodyTemperingLayer: 9 })).toBe(220);
  });

  it('never returns below 1', () => {
    expect(hpMax({ body: -100, bodyTemperingLayer: 0 })).toBeGreaterThanOrEqual(1);
  });

  it('rounds to integer', () => {
    expect(Number.isInteger(hpMax({ body: 15, bodyTemperingLayer: 2 }))).toBe(true);
  });
});

describe('qiMax', () => {
  // per spec §3.4: Spirit × (1 + openMeridians × 0.15) × rootMultiplier
  it('baseline with zero root returns 0', () => {
    expect(qiMax({ spirit: 50, openMeridians: 0, rootMultiplier: 0 })).toBe(0);
  });

  it('scales linearly with spirit × rootMultiplier', () => {
    expect(qiMax({ spirit: 10, openMeridians: 0, rootMultiplier: 1 })).toBe(10);
    expect(qiMax({ spirit: 10, openMeridians: 0, rootMultiplier: 2 })).toBe(20);
  });

  it('adds 15% per open meridian', () => {
    // 10 * (1 + 4*0.15) * 1.0 = 10 * 1.6 = 16
    expect(qiMax({ spirit: 10, openMeridians: 4, rootMultiplier: 1 })).toBe(16);
  });

  it('returns integer', () => {
    expect(Number.isInteger(qiMax({ spirit: 33, openMeridians: 5, rootMultiplier: 1.3 }))).toBe(true);
  });
});
