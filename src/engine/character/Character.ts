// The Character record + factory + pure mutation helpers.
// All mutations return a NEW character object.

import { CorePathId, MeridianId, Realm } from '@/engine/core/Types';
import { IRng } from '@/engine/core/RNG';
import { AttributeMap, hpMax, qiMax } from './Attribute';
import { SpiritRoot, rollSpiritRoot, spiritRootMultipliers } from './SpiritRoot';
import { detectCorePath } from './CorePath';

/** Insight cap by realm — spec §4.3. */
const INSIGHT_CAP_BY_REALM: Record<Realm, number> = {
  [Realm.MORTAL]: 100,
  [Realm.BODY_TEMPERING]: 100,
  [Realm.QI_SENSING]: 300,
  [Realm.QI_CONDENSATION]: 300,
  [Realm.FOUNDATION]: 800,
  [Realm.CORE]: 2000,
  [Realm.NASCENT_SOUL]: 5000,
  [Realm.SOUL_TRANSFORMATION]: 15000,
  [Realm.VOID_REFINEMENT]: 50000,
  [Realm.IMMORTAL]: Number.POSITIVE_INFINITY,
};

export interface Character {
  readonly name: string;
  readonly attributes: Readonly<AttributeMap>;
  readonly spiritRoot: SpiritRoot;
  readonly realm: Realm;
  readonly bodyTemperingLayer: number;  // 0 when not yet in Body Tempering; 1..9 inside it
  readonly qiCondensationLayer: number; // 0 when not yet in Qi Condensation; 1..9 inside it
  readonly ageDays: number;

  readonly hp: number;
  readonly hpMax: number;
  readonly qi: number;
  readonly qiMax: number;
  readonly insight: number;
  readonly insightCap: number;

  /** Progress within the current sub-layer (or the current realm, if no sub-layers). 0..100. */
  readonly cultivationProgress: number;

  readonly openMeridians: ReadonlyArray<MeridianId>;   // opening order preserved
  readonly corePath: CorePathId | null;

  /** Soul Echo ids applied at birth. Effects already folded into stats/hp/insightCap. */
  readonly echoes: ReadonlyArray<string>;

  /** Lifetime-persistent flags set by events. Phase 1D wires these. */
  readonly flags: ReadonlyArray<string>;
}

export interface CreateCharacterArgs {
  name: string;
  attributes: AttributeMap;
  rng: IRng;
  /** Optional: starting age in days (default 0). */
  startingAgeDays?: number;
}

type CharacterCore = Omit<Character, 'hpMax' | 'qiMax' | 'insightCap' | 'hp' | 'qi' | 'insight' | 'cultivationProgress'> & {
  hp?: number;
  qi?: number;
  insight?: number;
  cultivationProgress?: number;
};

function recomputeDerived(c: CharacterCore): Character {
  const mult = spiritRootMultipliers(c.spiritRoot);
  const newHpMax = hpMax({ body: c.attributes.Body, bodyTemperingLayer: c.bodyTemperingLayer });
  const newQiMax = qiMax({
    spirit: c.attributes.Spirit,
    openMeridians: c.openMeridians.length,
    rootMultiplier: mult.absorption,
  });
  const newInsightCap = INSIGHT_CAP_BY_REALM[c.realm];
  const nextHp      = Math.max(0, Math.min(newHpMax, c.hp ?? newHpMax));
  const nextQi      = Math.max(0, Math.min(newQiMax, c.qi ?? 0));
  const nextInsight = Math.max(0, Math.min(newInsightCap, c.insight ?? 0));
  return {
    ...c,
    cultivationProgress: c.cultivationProgress ?? 0,
    hpMax: newHpMax,
    qiMax: newQiMax,
    insightCap: newInsightCap,
    hp: nextHp,
    qi: nextQi,
    insight: nextInsight,
  };
}

export function createCharacter(args: CreateCharacterArgs): Character {
  const spiritRoot = rollSpiritRoot(args.rng);
  const base: CharacterCore = {
    name: args.name,
    attributes: { ...args.attributes },
    spiritRoot,
    realm: Realm.MORTAL,
    bodyTemperingLayer: 0,
    qiCondensationLayer: 0,
    ageDays: args.startingAgeDays ?? 0,
    cultivationProgress: 0,
    hp: undefined,
    qi: 0,
    insight: 0,
    openMeridians: [] as ReadonlyArray<MeridianId>,
    corePath: null as CorePathId | null,
    echoes: [] as ReadonlyArray<string>,
    flags: [] as ReadonlyArray<string>,
  };
  return recomputeDerived(base);
}

export function applyHp(c: Character, delta: number): Character {
  const nextHp = Math.max(0, Math.min(c.hpMax, c.hp + delta));
  return { ...c, hp: nextHp };
}

export function applyQi(c: Character, delta: number): Character {
  const nextQi = Math.max(0, Math.min(c.qiMax, c.qi + delta));
  return { ...c, qi: nextQi };
}

export function applyInsight(c: Character, delta: number): Character {
  const nextInsight = Math.max(0, Math.min(c.insightCap, c.insight + delta));
  return { ...c, insight: nextInsight };
}

export function ageDays(c: Character, days: number): Character {
  if (days < 0) throw new Error('ageDays: delta must be non-negative');
  return { ...c, ageDays: c.ageDays + days };
}

/** Internal helper used by later subsystems (breakthrough, meridian open) to re-derive state. */
export function refreshDerived(c: Character): Character {
  return recomputeDerived(c);
}

/** Attach a flag if not already present. Pure; returns new character. */
export function withFlag(c: Character, flag: string): Character {
  if (c.flags.includes(flag)) return c;
  return { ...c, flags: [...c.flags, flag] };
}

/** Update the opening-order meridian list and re-detect Core Path + re-derive. */
export function withOpenedMeridian(c: Character, id: MeridianId): Character {
  if (c.openMeridians.includes(id)) return c;
  const nextOrder = [...c.openMeridians, id];
  const path = detectCorePath(nextOrder);
  return recomputeDerived({
    ...c,
    openMeridians: nextOrder,
    corePath: path,
  });
}
