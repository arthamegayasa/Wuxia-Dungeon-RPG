// Custom predicate registry for ConditionEvaluator.
// Phase 2B-2 Task 20: realm-gate event predicates.
//
// Each predicate receives the full EvalContext and returns a boolean.
// ConditionEvaluator looks up predicates by name; unknown names fail closed.

import type { EvalContext } from './ConditionEvaluator';

export type CustomPredicate = (ctx: EvalContext) => boolean;

export const CUSTOM_PREDICATES: Record<string, CustomPredicate> = {
  /** Body Tempering 9, cultivation bar at 100. Gate for QS awakening attempt. */
  bt9_cultivation_full: (ctx) =>
    ctx.character.realm === 'body_tempering'
    && ctx.character.bodyTemperingLayer === 9
    && (ctx.character.cultivationProgress ?? 0) >= 100,

  /** Qi Sensing realm with zero learned techniques. Gate for first technique event. */
  qs_no_techniques: (ctx) =>
    ctx.character.realm === 'qi_sensing'
    && (ctx.learnedTechniques ?? []).length === 0,

  /** Qi Sensing realm, at least 1 technique learned, cultivation bar full.
   *  Gate for Qi Condensation entry attempt. */
  qs_with_techniques_full: (ctx) =>
    ctx.character.realm === 'qi_sensing'
    && (ctx.learnedTechniques ?? []).length >= 1
    && (ctx.character.cultivationProgress ?? 0) >= 100,

  /** Qi Condensation layer 5, cultivation bar full. Gate for QC5 trial. */
  qc5_full: (ctx) =>
    ctx.character.realm === 'qi_condensation'
    && ctx.character.qiCondensationLayer === 5
    && (ctx.character.cultivationProgress ?? 0) >= 100,

  /** Qi Condensation layer 9, cultivation bar full. Gate for Tribulation I setup. */
  qc9_full: (ctx) =>
    ctx.character.realm === 'qi_condensation'
    && ctx.character.qiCondensationLayer === 9
    && (ctx.character.cultivationProgress ?? 0) >= 100,
};
