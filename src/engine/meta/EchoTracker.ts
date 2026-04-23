// Life-scoped echo progress counters. Immutable API. Committed to MetaState on death.

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
