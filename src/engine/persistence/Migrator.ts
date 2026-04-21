// Chained save-schema migrator. See docs/spec/design.md §10.4.

export interface Migration<From = unknown, To = unknown> {
  from: number;
  to: number;
  transform: (old: From) => To;
}

export interface MigratorOptions {
  currentVersion: number;
  migrations: Migration<any, any>[];
}

export interface Migrator<TCurrent = unknown> {
  migrate(data: unknown, fromVersion: number): TCurrent;
}

export function createMigrator<TCurrent = unknown>(opts: MigratorOptions): Migrator<TCurrent> {
  // Index migrations by source version.
  const byFrom = new Map<number, Migration>();
  for (const m of opts.migrations) {
    if (m.to !== m.from + 1) {
      throw new Error(`migration must be single-step: got ${m.from} -> ${m.to}`);
    }
    if (byFrom.has(m.from)) {
      throw new Error(`duplicate migration registered from version ${m.from}`);
    }
    byFrom.set(m.from, m);
  }

  function migrate(data: unknown, fromVersion: number): TCurrent {
    if (!Number.isInteger(fromVersion) || fromVersion < 1) {
      throw new Error(`invalid save version ${fromVersion}`);
    }
    if (fromVersion > opts.currentVersion) {
      throw new Error(
        `save version ${fromVersion} is newer than current ${opts.currentVersion}`,
      );
    }
    let current: unknown = data;
    let v = fromVersion;
    while (v < opts.currentVersion) {
      const step = byFrom.get(v);
      if (!step) {
        throw new Error(`no migration from ${v} to ${v + 1}`);
      }
      current = step.transform(current);
      v += 1;
    }
    return current as TCurrent;
  }

  return { migrate };
}
