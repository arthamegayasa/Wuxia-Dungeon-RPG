// Seeded deterministic PRNG. Mulberry32 chosen for:
//   - tiny state (32 bits)
//   - easy to serialise
//   - adequate statistical quality for game decisions
// Cryptographic strength NOT a requirement; determinism IS.
//
// Every random decision in the engine MUST go through this module.
// Direct calls to Math.random() are forbidden at build time (see eslint rule in a later task).

import { hashSeed } from '@/utils/hash';

export interface RngState {
  readonly seed: number; // original seed, for reference
  readonly cursor: number; // advanced on each next()
}

export interface IRng {
  next(): number;                           // [0, 1)
  d100(): number;                           // [1, 100]
  intRange(lo: number, hi: number): number; // inclusive both ends
  pick<T>(arr: readonly T[]): T;
  weightedPick<T>(items: readonly T[], weightOf: (t: T) => number): T;
  derive(...parts: Array<string | number>): IRng;
  state(): RngState;
  /** For tests / debugging only. Not part of the engine contract. */
  next_nth(n: number): number;
}

export class Rng implements IRng {
  private s: number;

  constructor(private readonly original: number, cursor: number) {
    // Mulberry32 state is a 32-bit int.
    this.s = cursor >>> 0;
  }

  static fromState(state: RngState): Rng {
    return new Rng(state.seed, state.cursor);
  }

  next(): number {
    // Mulberry32
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  d100(): number {
    return Math.floor(this.next() * 100) + 1;
  }

  intRange(lo: number, hi: number): number {
    if (hi < lo) throw new Error(`intRange: hi (${hi}) < lo (${lo})`);
    const span = hi - lo + 1;
    return lo + Math.floor(this.next() * span);
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('pick: empty array');
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  weightedPick<T>(items: readonly T[], weightOf: (t: T) => number): T {
    if (items.length === 0) throw new Error('weightedPick: empty items');
    let total = 0;
    for (const it of items) {
      const w = weightOf(it);
      if (w < 0) throw new Error('weightedPick: negative weight');
      total += w;
    }
    if (total <= 0) throw new Error('weightedPick: total weight = 0');
    let roll = this.next() * total;
    for (const it of items) {
      roll -= weightOf(it);
      if (roll <= 0) return it;
    }
    // Floating-point fallthrough
    return items[items.length - 1]!;
  }

  derive(...parts: Array<string | number>): IRng {
    const childSeed = hashSeed(this.s, ...parts);
    return new Rng(childSeed, childSeed);
  }

  state(): RngState {
    return { seed: this.original, cursor: this.s };
  }

  next_nth(n: number): number {
    let last = 0;
    for (let i = 0; i < n; i++) last = this.next();
    return last;
  }
}

export function createRng(seed: number): IRng {
  const s = (seed | 0) >>> 0;
  return new Rng(s, s);
}

/**
 * Derive a sub-stream RNG from a base seed + a label. Pure function of
 * (baseSeed, label). Used by Phase 2B to split peek vs resolve RNG streams
 * so repeated peeks don't drift.
 */
export function derivedRng(baseSeed: number, label: string): IRng {
  let h = baseSeed | 0;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x85ebca6b);
    h ^= h >>> 16;
  }
  return createRng(h >>> 0);
}
