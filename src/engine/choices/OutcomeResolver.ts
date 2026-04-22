// Tier → Outcome with fallback. Source: docs/spec/design.md §5.4.

import { OutcomeTier } from '@/engine/core/Types';
import { Outcome, OutcomeTable } from '@/content/schema';

/**
 * Fallback chain per spec §5.4:
 *   CRIT_SUCCESS → SUCCESS (never fails over to FAILURE)
 *   PARTIAL      → SUCCESS (straddles — resolve toward SUCCESS side)
 *   CRIT_FAILURE → FAILURE
 * SUCCESS and FAILURE are guaranteed present in a valid OutcomeTable (schema enforces).
 */
export function resolveOutcome(table: OutcomeTable, tier: OutcomeTier): Outcome {
  const direct = table[tier];
  if (direct !== undefined) return direct;

  switch (tier) {
    case 'CRIT_SUCCESS': return table.SUCCESS;
    case 'PARTIAL':      return table.SUCCESS;
    case 'CRIT_FAILURE': return table.FAILURE;
    // SUCCESS and FAILURE are always present by schema.
    case 'SUCCESS':      return table.SUCCESS;
    case 'FAILURE':      return table.FAILURE;
  }
}
