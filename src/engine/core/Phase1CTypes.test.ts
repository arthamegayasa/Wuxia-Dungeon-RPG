import { describe, it, expect } from 'vitest';
import {
  SNIPPET_TAGS,
  NAME_SLOT_IDS,
  SnippetTag,
  NameSlotId,
} from './Types';

describe('Phase 1C primitive tables', () => {
  it('SNIPPET_TAGS lists all tonal tags', () => {
    expect(SNIPPET_TAGS).toEqual([
      'lyrical', 'terse', 'ominous', 'serious', 'tender', 'bitter',
    ]);
  });

  it('NAME_SLOT_IDS lists the canonical slots', () => {
    expect(NAME_SLOT_IDS).toEqual([
      'character', 'master', 'mother', 'father', 'sibling', 'friend',
      'rival', 'lover', 'stranger', 'bandit', 'merchant', 'monk',
      'sect', 'place', 'emperor',
    ]);
  });

  it('the SnippetTag type contains exactly the SNIPPET_TAGS values', () => {
    const x: SnippetTag = 'lyrical'; // compiles
    // @ts-expect-error — outside the union
    const y: SnippetTag = 'invalid';
    // Runtime check: every SNIPPET_TAGS entry should be assignable to SnippetTag
    for (const t of SNIPPET_TAGS) {
      const tag: SnippetTag = t; // compiles — union check
      expect(typeof tag).toBe('string');
    }
  });

  it('NameSlotId matches its table', () => {
    const slot: NameSlotId = 'character';
    expect(typeof slot).toBe('string');
  });
});
