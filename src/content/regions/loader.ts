// Validated loader for region packs → RegionDef[]. Source: docs/spec/design.md §7.2, §8.1.
import { RegionDef, RegionPackSchema } from '@/content/schema';

export function loadRegions(raw: unknown): ReadonlyArray<RegionDef> {
  const parsed = RegionPackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`loadRegions: invalid region pack — ${parsed.error.message}`);
  }
  const seen = new Set<string>();
  for (const r of parsed.data.regions) {
    if (seen.has(r.id)) {
      throw new Error(`loadRegions: duplicate region id: ${r.id}`);
    }
    seen.add(r.id);
  }
  return parsed.data.regions;
}
