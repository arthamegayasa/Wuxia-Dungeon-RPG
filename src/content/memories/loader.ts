// Validated loader for memory packs → MemoryDef[]. Source: docs/spec/design.md §7.3, §9.9.
import { MemoryDef, MemoryPackSchema } from '@/content/schema';

export function loadMemories(raw: unknown): ReadonlyArray<MemoryDef> {
  const parsed = MemoryPackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`loadMemories: invalid memory pack — ${parsed.error.message}`);
  }
  const seen = new Set<string>();
  for (const m of parsed.data.memories) {
    if (seen.has(m.id)) {
      throw new Error(`loadMemories: duplicate memory id: ${m.id}`);
    }
    seen.add(m.id);
  }
  return parsed.data.memories;
}
