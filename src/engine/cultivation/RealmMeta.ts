// Realm metadata — sub-layer counts, lifespan caps, insight caps, tribulation gates.
// Source: docs/spec/design.md §4.1, §4.3.

import { Realm } from '@/engine/core/Types';

export interface RealmMeta {
  realm: Realm;
  subLayers: number;           // 0 = no sub-layer structure (Mortal, Qi Sensing)
  lifespanYears: number;       // may be +Infinity for Immortal
  insightCap: number;
  tribulationGate: boolean;    // true if entry requires a tribulation pillar
}

const META: Record<Realm, RealmMeta> = {
  [Realm.MORTAL]:              { realm: Realm.MORTAL,              subLayers: 0, lifespanYears: 60,     insightCap: 100,   tribulationGate: false },
  [Realm.BODY_TEMPERING]:      { realm: Realm.BODY_TEMPERING,      subLayers: 9, lifespanYears: 80,     insightCap: 100,   tribulationGate: false },
  [Realm.QI_SENSING]:          { realm: Realm.QI_SENSING,          subLayers: 0, lifespanYears: 100,    insightCap: 300,   tribulationGate: false },
  [Realm.QI_CONDENSATION]:     { realm: Realm.QI_CONDENSATION,     subLayers: 9, lifespanYears: 120,    insightCap: 300,   tribulationGate: false },
  [Realm.FOUNDATION]:          { realm: Realm.FOUNDATION,          subLayers: 3, lifespanYears: 200,    insightCap: 800,   tribulationGate: true  },
  [Realm.CORE]:                { realm: Realm.CORE,                subLayers: 9, lifespanYears: 500,    insightCap: 2000,  tribulationGate: true  },
  [Realm.NASCENT_SOUL]:        { realm: Realm.NASCENT_SOUL,        subLayers: 3, lifespanYears: 1000,   insightCap: 5000,  tribulationGate: true  },
  [Realm.SOUL_TRANSFORMATION]: { realm: Realm.SOUL_TRANSFORMATION, subLayers: 3, lifespanYears: 3000,   insightCap: 15000, tribulationGate: true  },
  [Realm.VOID_REFINEMENT]:     { realm: Realm.VOID_REFINEMENT,     subLayers: 3, lifespanYears: 10000,  insightCap: 50000, tribulationGate: true  },
  [Realm.IMMORTAL]:            { realm: Realm.IMMORTAL,            subLayers: 0, lifespanYears: Number.POSITIVE_INFINITY, insightCap: Number.POSITIVE_INFINITY, tribulationGate: true },
};

export function realmMeta(r: Realm): RealmMeta {
  return META[r];
}

export function lifespanCapDays(r: Realm): number {
  const years = META[r].lifespanYears;
  if (years === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
  return years * 365;
}
