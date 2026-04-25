// Discriminated union of state mutations produced by outcomes.
// Every kind is applied by OutcomeApplier (Task 9).

import { MeridianId, Stat } from '@/engine/core/Types';

export type StateDelta =
  | { kind: 'hp_delta'; amount: number }
  | { kind: 'qi_delta'; amount: number }
  | { kind: 'insight_delta'; amount: number }
  | { kind: 'attribute_delta'; stat: Stat; amount: number }
  | { kind: 'flag_set'; flag: string }
  | { kind: 'flag_clear'; flag: string }
  | { kind: 'world_flag_set'; flag: string }
  | { kind: 'world_flag_clear'; flag: string }
  | { kind: 'cultivation_progress_delta'; amount: number }
  | { kind: 'meditation_progress'; base: number; insightBonus?: number }
  | { kind: 'item_add'; id: string; count: number }
  | { kind: 'item_remove'; id: string; count: number }
  | { kind: 'technique_learn'; id: string }
  | { kind: 'meridian_open'; id: MeridianId }
  | { kind: 'karma_delta'; amount: number }
  | { kind: 'notice_delta'; amount: number }
  | { kind: 'age_delta_days'; amount: number }
  // Phase 2B-2 Task 20: realm-gate events dispatch into RealmCrossing helpers.
  | { kind: 'attempt_realm_crossing'; transition: 'bt9_to_qs' | 'qs_to_qc1' | 'qc_sublayer' | 'qc9_to_foundation' }
  // Phase 2B-2 Task 21: region-transition events update runState.region.
  | { kind: 'region_change'; regionId: string };

export const STATE_DELTA_KINDS = [
  'hp_delta', 'qi_delta', 'insight_delta', 'attribute_delta',
  'flag_set', 'flag_clear', 'world_flag_set', 'world_flag_clear',
  'cultivation_progress_delta', 'meditation_progress', 'item_add', 'item_remove',
  'technique_learn', 'meridian_open',
  'karma_delta', 'notice_delta',
  'age_delta_days',
  'attempt_realm_crossing',
  'region_change',
] as const;

export function isStateDelta(v: unknown): v is StateDelta {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.kind !== 'string') return false;
  if (!(STATE_DELTA_KINDS as readonly string[]).includes(o.kind)) return false;

  switch (o.kind) {
    case 'hp_delta':
    case 'qi_delta':
    case 'insight_delta':
    case 'cultivation_progress_delta':
    case 'karma_delta':
    case 'notice_delta':
    case 'age_delta_days':
      return typeof o.amount === 'number';
    case 'meditation_progress':
      return typeof o.base === 'number' &&
        (o.insightBonus === undefined || typeof o.insightBonus === 'number');
    case 'attribute_delta':
      return typeof o.amount === 'number' && typeof o.stat === 'string';
    case 'flag_set':
    case 'flag_clear':
    case 'world_flag_set':
    case 'world_flag_clear':
      return typeof o.flag === 'string';
    case 'item_add':
    case 'item_remove':
      return typeof o.id === 'string' && typeof o.count === 'number';
    case 'technique_learn':
      return typeof o.id === 'string';
    case 'meridian_open':
      return typeof o.id === 'number';
    case 'attempt_realm_crossing':
      return typeof o.transition === 'string' &&
        ['bt9_to_qs', 'qs_to_qc1', 'qc_sublayer', 'qc9_to_foundation'].includes(o.transition as string);
    case 'region_change':
      return typeof o.regionId === 'string' && o.regionId.length > 0;
    default:
      return false;
  }
}
