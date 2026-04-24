import { describe, it, expect } from 'vitest';
import { loadSnippets } from './loader';
import yp from './yellow_plains.json';

describe('yellow_plains snippet pack', () => {
  const lib = loadSnippets(yp);

  it('has at least 80 distinct snippet keys', () => {
    const data = (yp as any).leaves as Record<string, unknown[]>;
    expect(Object.keys(data).length).toBeGreaterThanOrEqual(80);
  });

  it('every entry has non-empty text', () => {
    const data = (yp as any).leaves as Record<string, Array<{ text: string }>>;
    for (const entries of Object.values(data)) {
      for (const e of entries) {
        expect(e.text.length).toBeGreaterThan(0);
      }
    }
  });

  it('covers weather / terrain / time / npc / emotion / action / reflection domains', () => {
    const data = (yp as any).leaves as Record<string, unknown>;
    const keys = Object.keys(data);
    const domains = ['weather.', 'terrain.yellow_plains.', 'time.', 'npc.', 'emotion.', 'action.', 'reflection.'];
    for (const prefix of domains) {
      expect(keys.some((k) => k.startsWith(prefix))).toBe(true);
    }
  });

  it('references no undefined variables (only CHARACTER | REGION | SEASON | REALM)', () => {
    const data = (yp as any).leaves as Record<string, Array<{ text: string }>>;
    const ALLOWED = /^(CHARACTER|REGION|SEASON|REALM)$/;
    const VAR_RE = /\[([A-Z_][A-Z0-9_]*)\]/g;
    for (const entries of Object.values(data)) {
      for (const e of entries) {
        for (const m of e.text.matchAll(VAR_RE)) {
          expect(ALLOWED.test(m[1]!)).toBe(true);
        }
      }
    }
  });

  it('lib.has + lib.get agree for every authored key', () => {
    const data = (yp as any).leaves as Record<string, unknown>;
    for (const k of Object.keys(data)) {
      expect(lib.has(k)).toBe(true);
      expect(lib.get(k)!.length).toBeGreaterThan(0);
    }
  });

  it('has all 12 reflection keys for Phase 2A-2 interior-thought injection', () => {
    const moods = ['sorrow', 'rage', 'serenity', 'paranoia', 'resolve', 'melancholy'] as const;
    const realms = ['mortal', 'body_tempering'] as const;
    for (const m of moods) {
      for (const r of realms) {
        expect(lib.has(`reflection.${m}.${r}`)).toBe(true);
      }
    }
  });

  it('has anchor-opener snippets for all 3 new anchors', () => {
    expect(lib.has('anchor.opener.martial_family.1')).toBe(true);
    expect(lib.has('anchor.opener.scholars_son.1')).toBe(true);
    expect(lib.has('anchor.opener.outer_disciple.1')).toBe(true);
  });
});
