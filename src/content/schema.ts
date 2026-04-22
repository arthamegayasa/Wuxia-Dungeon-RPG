import { z } from 'zod';

// Phase 0: minimal schema sufficient to prove zod is wired.
// Phase 1 expands with full Event / Choice / Outcome shapes.

export const SnippetEntrySchema = z.object({
  text: z.string().min(1),
  weight: z.number().positive().optional(),
  tags: z.array(z.string()).optional(),
});

export const SnippetLibrarySchema = z.record(z.string(), z.array(SnippetEntrySchema));

// Placeholder Event schema — will be fleshed out in Phase 1.
export const EventStubSchema = z.object({
  id: z.string(),
});

export const ContentPackSchema = z.object({
  version: z.number().int().positive(),
  snippets: SnippetLibrarySchema,
  events: z.array(EventStubSchema),
});

export type ContentPack = z.infer<typeof ContentPackSchema>;
export type SnippetEntry = z.infer<typeof SnippetEntrySchema>;
