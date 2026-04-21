import { describe, it, expect } from 'vitest';
import { createMigrator, Migration } from './Migrator';

interface V1 { name: string }
interface V2 { name: string; age: number }
interface V3 { fullName: string; age: number }

describe('Migrator', () => {
  it('returns input untouched when already at current version', () => {
    const m = createMigrator<V3>({ currentVersion: 3, migrations: [] });
    const out = m.migrate({ fullName: 'Lin', age: 20 }, 3);
    expect(out).toEqual({ fullName: 'Lin', age: 20 });
  });

  it('runs a chain of migrations 1 -> 2 -> 3', () => {
    const v1to2: Migration<V1, V2> = { from: 1, to: 2, transform: (v) => ({ ...v, age: 0 }) };
    const v2to3: Migration<V2, V3> = { from: 2, to: 3, transform: (v) => ({ fullName: v.name, age: v.age }) };
    const m = createMigrator<V3>({ currentVersion: 3, migrations: [v1to2, v2to3] });
    const out = m.migrate({ name: 'Lin' }, 1);
    expect(out).toEqual({ fullName: 'Lin', age: 0 });
  });

  it('throws on missing step in the chain', () => {
    const v1to2: Migration<V1, V2> = { from: 1, to: 2, transform: (v) => ({ ...v, age: 0 }) };
    // No 2->3 registered.
    const m = createMigrator<V3>({ currentVersion: 3, migrations: [v1to2] });
    expect(() => m.migrate({ name: 'Lin' }, 1))
      .toThrow(/no migration from 2 to 3/i);
  });

  it('throws if source version > current', () => {
    const m = createMigrator({ currentVersion: 2, migrations: [] });
    expect(() => m.migrate({}, 5))
      .toThrow(/save version 5.*newer than current 2/i);
  });

  it('throws if source version < 1', () => {
    const m = createMigrator({ currentVersion: 2, migrations: [] });
    expect(() => m.migrate({}, 0))
      .toThrow(/invalid save version 0/i);
  });

  it('allows registering migrations out of order', () => {
    const v2to3: Migration<V2, V3> = { from: 2, to: 3, transform: (v) => ({ fullName: v.name, age: v.age }) };
    const v1to2: Migration<V1, V2> = { from: 1, to: 2, transform: (v) => ({ ...v, age: 10 }) };
    const m = createMigrator<V3>({ currentVersion: 3, migrations: [v2to3, v1to2] });
    const out = m.migrate({ name: 'Hua' }, 1);
    expect(out).toEqual({ fullName: 'Hua', age: 10 });
  });
});
