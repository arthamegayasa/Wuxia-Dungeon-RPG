import { describe, it, expect } from 'vitest';
import { checkCategoryFromEvent } from './CheckCategoryFromEvent';

describe('checkCategoryFromEvent (Phase 2B-2 Task 13)', () => {
  it('maps life.daily to survival', () => {
    expect(checkCategoryFromEvent('life.daily')).toBe('survival');
  });

  it('maps life.training to cultivation_attempt', () => {
    expect(checkCategoryFromEvent('life.training')).toBe('cultivation_attempt');
  });

  it('maps life.danger to dodge_flee', () => {
    expect(checkCategoryFromEvent('life.danger')).toBe('dodge_flee');
  });

  it('maps life.danger.combat to melee_skill', () => {
    expect(checkCategoryFromEvent('life.danger.combat')).toBe('melee_skill');
  });

  it('maps life.social.rivalry to social_intimidate', () => {
    expect(checkCategoryFromEvent('life.social.rivalry')).toBe('social_intimidate');
  });

  it('maps bare "meditation" (Yellow Plains) to cultivation_attempt', () => {
    expect(checkCategoryFromEvent('meditation')).toBe('cultivation_attempt');
  });

  it('falls back to lore_scholarship for unknown categories', () => {
    expect(checkCategoryFromEvent('weird.unknown')).toBe('lore_scholarship');
  });
});
