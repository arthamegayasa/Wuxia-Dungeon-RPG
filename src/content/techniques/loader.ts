// Validated loader for technique packs → TechniqueRawDef[].
// Source: docs/spec/design.md §4.7, §9.5.
import { TechniqueRawDef, TechniquePackSchema } from '@/content/schema';

export function loadTechniques(raw: unknown): ReadonlyArray<TechniqueRawDef> {
  const parsed = TechniquePackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`loadTechniques: invalid technique pack — ${parsed.error.message}`);
  }
  const seen = new Set<string>();
  for (const t of parsed.data.techniques) {
    if (seen.has(t.id)) {
      throw new Error(`loadTechniques: duplicate technique id: ${t.id}`);
    }
    seen.add(t.id);
  }
  return parsed.data.techniques;
}
