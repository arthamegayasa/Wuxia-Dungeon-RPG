import { describe, it, expect } from 'vitest';
import { loadMemories } from './loader';
import pack from './memories.json';
import snippetSource from '@/content/snippets/yellow_plains.json';
import { loadSnippets } from '@/content/snippets/loader';
import { MemoryRegistry } from '@/engine/meta/MemoryRegistry';

describe('canonical memories corpus', () => {
  const list = loadMemories(pack);

  it('contains exactly 5 memories', () => {
    expect(list).toHaveLength(5);
  });

  it('every id is unique', () => {
    expect(new Set(list.map((m) => m.id)).size).toBe(5);
  });

  it('every witness/manifest snippet key exists in the library', () => {
    const lib = loadSnippets(snippetSource);
    for (const m of list) {
      expect(lib.has(m.witnessFlavour.fragment)).toBe(true);
      expect(lib.has(m.witnessFlavour.partial)).toBe(true);
      expect(lib.has(m.witnessFlavour.complete)).toBe(true);
      expect(lib.has(m.manifestFlavour)).toBe(true);
    }
  });

  it('builds a valid registry', () => {
    const reg = MemoryRegistry.fromList(list);
    expect(reg.get('frost_palm_severing')).toBeDefined();
  });

  it('manifest flags are unique and match id pattern', () => {
    const flags = list.map((m) => m.manifestFlag);
    expect(new Set(flags).size).toBe(5);
    for (const m of list) {
      expect(m.manifestFlag).toBe(`remembered_${m.id}`);
    }
  });
});
