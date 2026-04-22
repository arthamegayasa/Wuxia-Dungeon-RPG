// Validated loader for anchor content packs. Source: docs/spec/design.md §9.
import { z } from 'zod';
import { AnchorDef, AnchorSchema } from '@/engine/meta/Anchor';

const AnchorPackSchema = z.object({
  version: z.literal(1),
  anchors: z.array(AnchorSchema).min(1),
});

export function loadAnchors(raw: unknown): ReadonlyArray<AnchorDef> {
  const parsed = AnchorPackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`loadAnchors: invalid anchor pack — ${parsed.error.message}`);
  }
  return parsed.data.anchors;
}
