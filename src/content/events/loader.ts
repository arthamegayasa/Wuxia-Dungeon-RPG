// Validated loader for Yellow Plains event packs. Source: docs/spec/design.md §9.
import { z } from 'zod';
import { EventDef, EventSchema } from '@/content/schema';

const EventPackSchema = z.object({
  version: z.literal(1),
  events: z.array(EventSchema).min(1),
});

export function loadEvents(raw: unknown): ReadonlyArray<EventDef> {
  const parsed = EventPackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`loadEvents: invalid event pack — ${parsed.error.message}`);
  }
  return parsed.data.events;
}

/** Helper for callers loading multiple JSON files: flatten into one array. */
export function flattenEventPacks(packs: ReadonlyArray<unknown>): ReadonlyArray<EventDef> {
  const all: EventDef[] = [];
  for (const raw of packs) {
    all.push(...loadEvents(raw));
  }
  return all;
}
