import { describe, it, expect } from 'vitest';
import { loadEvents } from '../loader';
import { loadItems } from '@/content/items/loader';
import itemsJson from '@/content/items/items.json';
import yp_daily from './daily.json';
import yp_training from './training.json';
import yp_social from './social.json';
import yp_danger from './danger.json';
import yp_opportunity from './opportunity.json';
import yp_meditation from './meditation.json';
import yp_transition from './transition.json';
import yp_bridge from './bridge.json';

describe('Yellow Plains item-id backfill (Phase 2B-2 Task 23)', () => {
  const itemIds = new Set(loadItems(itemsJson).map((i) => i.id));

  const allEvents = [
    ...loadEvents(yp_daily),
    ...loadEvents(yp_training),
    ...loadEvents(yp_social),
    ...loadEvents(yp_danger),
    ...loadEvents(yp_opportunity),
    ...loadEvents(yp_meditation),
    ...loadEvents(yp_transition),
    ...loadEvents(yp_bridge),
  ];

  it('every item_add / item_remove id in Yellow Plains events resolves in ItemRegistry', () => {
    const seen = new Set<string>();
    for (const e of allEvents) {
      for (const c of e.choices) {
        for (const o of Object.values(c.outcomes)) {
          for (const d of (o as any)?.stateDeltas ?? []) {
            if (d.kind === 'item_add' || d.kind === 'item_remove') {
              seen.add(d.id);
              expect(
                itemIds.has(d.id),
                `event ${e.id} references missing item id: ${d.id}`
              ).toBe(true);
            }
          }
        }
      }
    }
    // Confirm at least one Phase 1 backfill item was exercised:
    const hasBackfill =
      seen.has('spiritual_stone') ||
      seen.has('minor_healing_pill') ||
      seen.has('silver_pouch');
    expect(hasBackfill).toBe(true);
  });

  it('every requiresItem in Yellow Plains conditions resolves in ItemRegistry', () => {
    for (const e of allEvents) {
      for (const id of e.conditions.requiresItem ?? []) {
        expect(itemIds.has(id), `event ${e.id} requires missing item: ${id}`).toBe(
          true
        );
      }
      for (const c of e.choices) {
        for (const id of c.preconditions?.requiresItem ?? []) {
          expect(
            itemIds.has(id),
            `choice ${c.id} (event ${e.id}) requires missing item: ${id}`
          ).toBe(true);
        }
      }
    }
  });
});
