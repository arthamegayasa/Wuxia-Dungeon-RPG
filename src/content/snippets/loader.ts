// Validated loader for snippet packs → SnippetLibrary. Source: docs/spec/design.md §6.3.
import { z } from 'zod';
import { SnippetEntrySchema } from '@/content/schema';
import { createSnippetLibrary, SnippetLibrary } from '@/engine/narrative/SnippetLibrary';

const SnippetPackSchema = z.object({
  version: z.literal(1),
  leaves: z.record(z.string(), z.array(SnippetEntrySchema).min(1)),
});

export function loadSnippets(raw: unknown): SnippetLibrary {
  const parsed = SnippetPackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`loadSnippets: invalid snippet pack — ${parsed.error.message}`);
  }
  return createSnippetLibrary(parsed.data.leaves);
}

/** Merge multiple snippet packs into a single library. Later packs append to earlier keys. */
export function mergeSnippetPacks(packs: ReadonlyArray<unknown>): SnippetLibrary {
  const combined: Record<string, Array<z.infer<typeof SnippetEntrySchema>>> = {};
  for (const raw of packs) {
    const parsed = SnippetPackSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`mergeSnippetPacks: invalid pack — ${parsed.error.message}`);
    }
    for (const [k, v] of Object.entries(parsed.data.leaves)) {
      combined[k] = [...(combined[k] ?? []), ...v];
    }
  }
  return createSnippetLibrary(combined);
}
