import { describe, it, expect } from 'vitest';
import { Realm } from '@/engine/core/Types';
import { realmMeta, lifespanCapDays } from './RealmMeta';

describe('realmMeta', () => {
  it('Mortal: no sub-layers, 60 years', () => {
    const m = realmMeta(Realm.MORTAL);
    expect(m.subLayers).toBe(0);
    expect(m.lifespanYears).toBe(60);
    expect(m.insightCap).toBe(100);
    expect(m.tribulationGate).toBe(false);
  });

  it('Body Tempering: 9 sub-layers, 80 years', () => {
    const m = realmMeta(Realm.BODY_TEMPERING);
    expect(m.subLayers).toBe(9);
    expect(m.lifespanYears).toBe(80);
    expect(m.insightCap).toBe(100);
    expect(m.tribulationGate).toBe(false);
  });

  it('Qi Sensing: no sub-layers, 100 years', () => {
    const m = realmMeta(Realm.QI_SENSING);
    expect(m.subLayers).toBe(0);
    expect(m.lifespanYears).toBe(100);
    expect(m.insightCap).toBe(300);
  });

  it('Qi Condensation: 9 sub-layers, 120 years', () => {
    const m = realmMeta(Realm.QI_CONDENSATION);
    expect(m.subLayers).toBe(9);
    expect(m.lifespanYears).toBe(120);
    expect(m.insightCap).toBe(300);
  });

  it('Foundation through Immortal — lifespans escalate per spec §4.1', () => {
    expect(realmMeta(Realm.FOUNDATION).lifespanYears).toBe(200);
    expect(realmMeta(Realm.CORE).lifespanYears).toBe(500);
    expect(realmMeta(Realm.NASCENT_SOUL).lifespanYears).toBe(1000);
    expect(realmMeta(Realm.SOUL_TRANSFORMATION).lifespanYears).toBe(3000);
    expect(realmMeta(Realm.VOID_REFINEMENT).lifespanYears).toBe(10_000);
    expect(realmMeta(Realm.IMMORTAL).lifespanYears).toBe(Number.POSITIVE_INFINITY);
  });

  it('tribulation gate flags for realms 4+', () => {
    expect(realmMeta(Realm.FOUNDATION).tribulationGate).toBe(true);
    expect(realmMeta(Realm.CORE).tribulationGate).toBe(true);
    expect(realmMeta(Realm.NASCENT_SOUL).tribulationGate).toBe(true);
  });

  it('lifespanCapDays converts years × 365', () => {
    expect(lifespanCapDays(Realm.MORTAL)).toBe(60 * 365);
    expect(lifespanCapDays(Realm.BODY_TEMPERING)).toBe(80 * 365);
    expect(lifespanCapDays(Realm.IMMORTAL)).toBe(Number.POSITIVE_INFINITY);
  });
});
