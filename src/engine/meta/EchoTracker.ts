// Life-scoped echo progress counters. Immutable API. Committed to MetaState on death.

import type { MetaState } from './MetaState';

export type EchoProgress = Readonly<Record<string, number>>;

export function emptyEchoProgress(): EchoProgress {
  return Object.freeze({});
}

export function mergeEchoProgress(base: EchoProgress, delta: EchoProgress): EchoProgress {
  const out: Record<string, number> = { ...base };
  for (const [k, v] of Object.entries(delta)) {
    out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

export class EchoTracker {
  private constructor(private readonly counters: ReadonlyMap<string, number>) {}

  static empty(): EchoTracker {
    return new EchoTracker(new Map());
  }

  get(key: string): number {
    return this.counters.get(key) ?? 0;
  }

  increment(key: string, by: number = 1): EchoTracker {
    const next = new Map(this.counters);
    next.set(key, (this.counters.get(key) ?? 0) + by);
    return new EchoTracker(next);
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }
}

/**
 * Phase 2A-2 Task 10: fold a life-scoped tracker snapshot into `meta.echoProgress`.
 *
 * The bridge calls this at death — after the last `resolveChoice` sets a
 * `deathCause` and before `runBardoFlow` runs — so `EchoUnlocker` (reading
 * `nextMeta.echoProgress` inside BardoFlow) observes this life's `choice_cat.*`
 * counters immediately. Kept out of `runBardoFlow` deliberately: that function's
 * signature is stable from Task 9, and threading a tracker arg through it would
 * scope-creep Task 10.
 */
export function commitTrackerToMeta(meta: MetaState, tracker: EchoTracker): MetaState {
  return {
    ...meta,
    echoProgress: mergeEchoProgress(meta.echoProgress, tracker.snapshot()),
  };
}
