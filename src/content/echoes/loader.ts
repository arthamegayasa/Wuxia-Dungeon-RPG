// Validated loader for echo packs → EchoDef[]. Source: docs/spec/design.md §7.2, §9.8.
import { EchoDef, EchoPackSchema } from '@/content/schema';

export function loadEchoes(raw: unknown): ReadonlyArray<EchoDef> {
  const parsed = EchoPackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`loadEchoes: invalid echo pack — ${parsed.error.message}`);
  }
  const seen = new Set<string>();
  for (const e of parsed.data.echoes) {
    if (seen.has(e.id)) {
      throw new Error(`loadEchoes: duplicate echo id: ${e.id}`);
    }
    seen.add(e.id);
  }
  return parsed.data.echoes;
}
