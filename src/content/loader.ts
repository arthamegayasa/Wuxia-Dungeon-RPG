import { ContentPack, ContentPackSchema } from './schema';

export function loadContentPack(raw: unknown): ContentPack {
  const result = ContentPackSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`invalid content pack: ${issues}`);
  }
  return result.data;
}
