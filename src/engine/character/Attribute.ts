// Attribute clamping and derived-stat formulas.
// See docs/spec/design.md §3.1, §3.4.

import { Stat, STATS } from '@/engine/core/Types';

export type AttributeMap = Record<Stat, number>;

/** Round to nearest integer, clamp to [0, 100]. */
export function clampAttribute(v: number): number {
  if (v <= 0) return 0;
  if (v >= 100) return 100;
  return Math.round(v);
}

/** Add `delta` to `base`, then clamp. */
export function addAttribute(base: number, delta: number): number {
  return clampAttribute(base + delta);
}

/** All six stats, zeroed. */
export function zeroAttributes(): AttributeMap {
  const out = {} as AttributeMap;
  for (const s of STATS) out[s] = 0;
  return out;
}

/** HP maximum — see spec §3.4 (derived, formula locked here). */
export function hpMax(args: { body: number; bodyTemperingLayer: number }): number {
  const raw = 30 + args.body * 2 + args.bodyTemperingLayer * 10;
  return Math.max(1, Math.round(raw));
}

/** Qi maximum — spec §3.4: Spirit × (1 + openMeridians × 0.15) × rootMultiplier. */
export function qiMax(args: {
  spirit: number;
  openMeridians: number;
  rootMultiplier: number;
}): number {
  const raw = args.spirit * (1 + args.openMeridians * 0.15) * args.rootMultiplier;
  return Math.max(0, Math.round(raw));
}
