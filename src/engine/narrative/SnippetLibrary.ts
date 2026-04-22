// Snippet library + tag-biased pick.
// Source: docs/spec/design.md §6.3.

import { IRng } from '@/engine/core/RNG';
import { SnippetLibrarySchema, SnippetEntry } from '@/content/schema';

export interface SnippetLibrary {
  has(key: string): boolean;
  get(key: string): ReadonlyArray<SnippetEntry> | undefined;
}

const TAG_MATCH_BIAS = 10;  // matching entries get their weight multiplied

export function createSnippetLibrary(raw: unknown): SnippetLibrary {
  const parsed = SnippetLibrarySchema.parse(raw);
  const map = new Map<string, ReadonlyArray<SnippetEntry>>(
    Object.entries(parsed),
  );
  return {
    has: (key) => map.has(key),
    get: (key) => map.get(key),
  };
}

/**
 * Weighted pick from the library with optional tag bias.
 * - Entries matching any preferred tag get weight × TAG_MATCH_BIAS.
 * - Entries without a weight default to 1.
 * - Returns null if the key doesn't exist or has no entries.
 */
export function pickSnippet(
  lib: SnippetLibrary,
  key: string,
  preferredTags: ReadonlyArray<string>,
  rng: IRng,
): string | null {
  const entries = lib.get(key);
  if (!entries || entries.length === 0) return null;

  function effectiveWeight(e: SnippetEntry): number {
    const base = e.weight ?? 1;
    if (preferredTags.length === 0) return base;
    if (!e.tags || e.tags.length === 0) return base;
    const hit = preferredTags.some((t) => e.tags!.includes(t));
    return hit ? base * TAG_MATCH_BIAS : base;
  }

  const picked = rng.weightedPick(entries, effectiveWeight);
  return picked.text;
}
