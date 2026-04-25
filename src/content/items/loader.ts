// Validated loader for item packs → ItemRawDef[].
// Source: docs/spec/design.md §9.6, §9.7.
import { ItemRawDef, ItemPackSchema } from '@/content/schema';

export function loadItems(raw: unknown): ReadonlyArray<ItemRawDef> {
  const parsed = ItemPackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`loadItems: invalid item pack — ${parsed.error.message}`);
  }
  const seen = new Set<string>();
  for (const i of parsed.data.items) {
    if (seen.has(i.id)) {
      throw new Error(`loadItems: duplicate item id: ${i.id}`);
    }
    seen.add(i.id);
  }
  return parsed.data.items;
}
