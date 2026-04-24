import { describe, it, expect } from 'vitest';
import { loadEchoes } from './loader';
import pack from './echoes.json';
import { EchoRegistry } from '@/engine/meta/EchoRegistry';

describe('canonical echoes corpus', () => {
  const list = loadEchoes(pack);

  it('contains exactly 10 echoes', () => {
    expect(list).toHaveLength(10);
  });

  it('every id is unique', () => {
    expect(new Set(list.map((e) => e.id)).size).toBe(10);
  });

  it('builds a valid registry', () => {
    const reg = EchoRegistry.fromList(list);
    expect(reg.get('iron_body')).toBeDefined();
    expect(reg.get('ghost_in_mirror')).toBeDefined();
  });

  it('no conflicts declared in 2A roster (spec §3.1)', () => {
    for (const e of list) {
      expect(e.conflicts).toEqual([]);
    }
  });
});
