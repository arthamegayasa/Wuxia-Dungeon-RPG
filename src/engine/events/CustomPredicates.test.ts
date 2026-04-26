import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createCharacter, refreshDerived } from '@/engine/character/Character';
import { Realm } from '@/engine/core/Types';
import type { EvalContext } from './ConditionEvaluator';
import { CUSTOM_PREDICATES } from './CustomPredicates';

const ATTRS = { Body: 20, Mind: 15, Spirit: 10, Agility: 12, Charm: 8, Luck: 30 };

function makeCtx(overrides: {
  realm?: string;
  bodyTemperingLayer?: number;
  qiCondensationLayer?: number;
  cultivationProgress?: number;
  learnedTechniques?: string[];
}): EvalContext {
  const base = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
  const character = refreshDerived({
    ...base,
    realm: (overrides.realm ?? base.realm) as Realm,
    bodyTemperingLayer: overrides.bodyTemperingLayer ?? base.bodyTemperingLayer,
    qiCondensationLayer: overrides.qiCondensationLayer ?? base.qiCondensationLayer,
    cultivationProgress: overrides.cultivationProgress ?? base.cultivationProgress,
  });
  return {
    character,
    worldFlags: [],
    region: 'azure_peaks',
    locale: 'unnamed',
    year: 1000,
    season: 'spring',
    heavenlyNotice: 0,
    ageYears: 20,
    learnedTechniques: overrides.learnedTechniques ?? [],
  };
}

describe('CUSTOM_PREDICATES (Phase 2B-2 Task 20)', () => {
  describe('bt9_cultivation_full', () => {
    it('returns true for BT9 with full cultivation bar', () => {
      const ctx = makeCtx({ realm: 'body_tempering', bodyTemperingLayer: 9, cultivationProgress: 100 });
      expect(CUSTOM_PREDICATES.bt9_cultivation_full(ctx)).toBe(true);
    });

    it('returns false for BT9 with partial bar', () => {
      const ctx = makeCtx({ realm: 'body_tempering', bodyTemperingLayer: 9, cultivationProgress: 50 });
      expect(CUSTOM_PREDICATES.bt9_cultivation_full(ctx)).toBe(false);
    });

    it('returns false for BT8 (wrong layer)', () => {
      const ctx = makeCtx({ realm: 'body_tempering', bodyTemperingLayer: 8, cultivationProgress: 100 });
      expect(CUSTOM_PREDICATES.bt9_cultivation_full(ctx)).toBe(false);
    });

    it('returns false for qi_sensing realm', () => {
      const ctx = makeCtx({ realm: 'qi_sensing', cultivationProgress: 100 });
      expect(CUSTOM_PREDICATES.bt9_cultivation_full(ctx)).toBe(false);
    });
  });

  describe('qs_no_techniques', () => {
    it('returns true for QS realm with no techniques learned', () => {
      const ctx = makeCtx({ realm: 'qi_sensing', learnedTechniques: [] });
      expect(CUSTOM_PREDICATES.qs_no_techniques(ctx)).toBe(true);
    });

    it('returns false when techniques have been learned', () => {
      const ctx = makeCtx({ realm: 'qi_sensing', learnedTechniques: ['common_qi_circulation'] });
      expect(CUSTOM_PREDICATES.qs_no_techniques(ctx)).toBe(false);
    });

    it('returns false for body_tempering realm (wrong realm)', () => {
      const ctx = makeCtx({ realm: 'body_tempering', learnedTechniques: [] });
      expect(CUSTOM_PREDICATES.qs_no_techniques(ctx)).toBe(false);
    });
  });

  describe('qs_with_techniques_full', () => {
    it('returns true for QS realm, 1 technique, full bar', () => {
      const ctx = makeCtx({ realm: 'qi_sensing', learnedTechniques: ['common_qi_circulation'], cultivationProgress: 100 });
      expect(CUSTOM_PREDICATES.qs_with_techniques_full(ctx)).toBe(true);
    });

    it('returns false with technique but partial bar', () => {
      const ctx = makeCtx({ realm: 'qi_sensing', learnedTechniques: ['common_qi_circulation'], cultivationProgress: 80 });
      expect(CUSTOM_PREDICATES.qs_with_techniques_full(ctx)).toBe(false);
    });

    it('returns false with full bar but no techniques', () => {
      const ctx = makeCtx({ realm: 'qi_sensing', learnedTechniques: [], cultivationProgress: 100 });
      expect(CUSTOM_PREDICATES.qs_with_techniques_full(ctx)).toBe(false);
    });
  });

  describe('qc5_full', () => {
    it('returns true for QC layer 5, full bar', () => {
      const ctx = makeCtx({ realm: 'qi_condensation', qiCondensationLayer: 5, cultivationProgress: 100 });
      expect(CUSTOM_PREDICATES.qc5_full(ctx)).toBe(true);
    });

    it('returns false for QC layer 4', () => {
      const ctx = makeCtx({ realm: 'qi_condensation', qiCondensationLayer: 4, cultivationProgress: 100 });
      expect(CUSTOM_PREDICATES.qc5_full(ctx)).toBe(false);
    });

    it('returns false for QC layer 5 but partial bar', () => {
      const ctx = makeCtx({ realm: 'qi_condensation', qiCondensationLayer: 5, cultivationProgress: 75 });
      expect(CUSTOM_PREDICATES.qc5_full(ctx)).toBe(false);
    });
  });

  describe('qc9_full', () => {
    it('returns true for QC layer 9, full bar', () => {
      const ctx = makeCtx({ realm: 'qi_condensation', qiCondensationLayer: 9, cultivationProgress: 100 });
      expect(CUSTOM_PREDICATES.qc9_full(ctx)).toBe(true);
    });

    it('returns false for QC layer 8', () => {
      const ctx = makeCtx({ realm: 'qi_condensation', qiCondensationLayer: 8, cultivationProgress: 100 });
      expect(CUSTOM_PREDICATES.qc9_full(ctx)).toBe(false);
    });

    it('returns false for QC layer 9 but partial bar', () => {
      const ctx = makeCtx({ realm: 'qi_condensation', qiCondensationLayer: 9, cultivationProgress: 90 });
      expect(CUSTOM_PREDICATES.qc9_full(ctx)).toBe(false);
    });
  });
});
