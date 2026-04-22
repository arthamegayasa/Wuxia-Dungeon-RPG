// Static metadata for the 12 meridians.
// Source: docs/spec/design.md §3.3.

import { Element, MeridianId, Stat } from '@/engine/core/Types';

export type RiskTier = 'low' | 'medium' | 'high' | 'very_high';

/** Base deviation chance (%) for each risk tier. */
export function meridianRiskTier(tier: RiskTier): number {
  switch (tier) {
    case 'low':       return 10;
    case 'medium':    return 20;
    case 'high':      return 30;
    case 'very_high': return 40;
  }
}

export interface MeridianDef {
  id: MeridianId;
  name: string;
  element: Element;
  baseRisk: number; // percent, already resolved
  /** Stat bonuses applied when this meridian is opened. */
  statBonuses: Partial<Record<Stat, number>>;
  /** Flat HP-max bonus on open. */
  hpMaxBonus?: number;
  /** Flat qi-capacity multiplier bonus on open (stacks additively with the 0.15/meridian scaling). */
  qiMultBonus?: number;
}

export const MERIDIAN_DEFS: readonly MeridianDef[] = [
  { id: 1,  name: 'Lung',             element: 'metal', baseRisk: meridianRiskTier('low'),       statBonuses: { Body: 2 } },
  { id: 2,  name: 'Large Intestine',  element: 'metal', baseRisk: meridianRiskTier('low'),       statBonuses: { Body: 2 } },
  { id: 3,  name: 'Stomach',          element: 'earth', baseRisk: meridianRiskTier('low'),       statBonuses: { Body: 2 }, hpMaxBonus: 15 },
  { id: 4,  name: 'Spleen',           element: 'earth', baseRisk: meridianRiskTier('medium'),    statBonuses: { Spirit: 2 } },
  { id: 5,  name: 'Heart',            element: 'fire',  baseRisk: meridianRiskTier('high'),      statBonuses: { Spirit: 2, Charm: 1 } },
  { id: 6,  name: 'Small Intestine',  element: 'fire',  baseRisk: meridianRiskTier('medium'),    statBonuses: { Agility: 2 } },
  { id: 7,  name: 'Bladder',          element: 'water', baseRisk: meridianRiskTier('low'),       statBonuses: { Body: 1, Spirit: 1 } },
  { id: 8,  name: 'Kidney',           element: 'water', baseRisk: meridianRiskTier('high'),      statBonuses: { Spirit: 2, Mind: 1 } },
  { id: 9,  name: 'Pericardium',      element: 'fire',  baseRisk: meridianRiskTier('high'),      statBonuses: { Spirit: 2 } },
  { id: 10, name: 'Triple Burner',    element: 'fire',  baseRisk: meridianRiskTier('very_high'), statBonuses: {},                    qiMultBonus: 0.10 },
  { id: 11, name: 'Gallbladder',      element: 'wood',  baseRisk: meridianRiskTier('medium'),    statBonuses: { Charm: 1, Body: 1 } },
  { id: 12, name: 'Liver',            element: 'wood',  baseRisk: meridianRiskTier('medium'),    statBonuses: { Mind: 1, Spirit: 1 } },
] as const;

export function meridianDef(id: MeridianId): MeridianDef {
  const d = MERIDIAN_DEFS.find((m) => m.id === id);
  if (!d) throw new Error(`unknown meridian id: ${id}`);
  return d;
}
