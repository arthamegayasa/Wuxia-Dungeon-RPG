import { describe, it, expect } from 'vitest';
import {
  computeDominantMood,
  moodScores,
  zeroMoodInputs,
  MoodInputs,
  MoodScores,
} from './Mood';

describe('zeroMoodInputs', () => {
  it('returns all zeros', () => {
    const z = zeroMoodInputs();
    for (const v of Object.values(z)) expect(v).toBe(0);
  });
});

describe('moodScores', () => {
  it('empty inputs produce all-zero scores', () => {
    const s = moodScores(zeroMoodInputs());
    expect(s.sorrow).toBe(0);
    expect(s.rage).toBe(0);
    expect(s.serenity).toBe(0);
    expect(s.paranoia).toBe(0);
    expect(s.resolve).toBe(0);
    expect(s.melancholy).toBe(0);
  });

  it('spec §6.4 formula: sorrow = recentRegrets*2 + unreturnedDebts', () => {
    const s = moodScores({ ...zeroMoodInputs(), recentRegrets: 3, unreturnedDebts: 2 });
    expect(s.sorrow).toBe(8);
  });

  it('rage = recentBetrayals*3 + humiliationsThisYear', () => {
    const s = moodScores({ ...zeroMoodInputs(), recentBetrayals: 2, humiliationsThisYear: 1 });
    expect(s.rage).toBe(7);
  });

  it('serenity = recentMeditationEpochs*2 + resolvedVows', () => {
    const s = moodScores({ ...zeroMoodInputs(), recentMeditationEpochs: 4, resolvedVows: 2 });
    expect(s.serenity).toBe(10);
  });

  it('paranoia = recentCloseDeaths*2 + heavenlyNoticeTier', () => {
    const s = moodScores({ ...zeroMoodInputs(), recentCloseDeaths: 1, heavenlyNoticeTier: 3 });
    expect(s.paranoia).toBe(5);
  });

  it('resolve = recentBreakthroughs*2 + mastershipsAcquired', () => {
    const s = moodScores({ ...zeroMoodInputs(), recentBreakthroughs: 2, mastershipsAcquired: 1 });
    expect(s.resolve).toBe(5);
  });

  it('melancholy = yearsAlone*0.5 + wintersInSeclusion', () => {
    const s = moodScores({ ...zeroMoodInputs(), yearsAlone: 10, wintersInSeclusion: 2 });
    expect(s.melancholy).toBe(7);
  });
});

describe('computeDominantMood', () => {
  it('returns serenity when all inputs are zero (default quiet baseline)', () => {
    expect(computeDominantMood(zeroMoodInputs())).toBe('serenity');
  });

  it('returns the single highest scorer', () => {
    expect(computeDominantMood({ ...zeroMoodInputs(), recentRegrets: 5 })).toBe('sorrow');
    expect(computeDominantMood({ ...zeroMoodInputs(), recentBetrayals: 3 })).toBe('rage');
    expect(computeDominantMood({ ...zeroMoodInputs(), recentBreakthroughs: 5 })).toBe('resolve');
  });

  it('ties resolve to a stable, documented priority order', () => {
    // Priority (tie-break order): resolve > serenity > sorrow > rage > paranoia > melancholy
    const m = computeDominantMood({ ...zeroMoodInputs(), recentRegrets: 1, recentBreakthroughs: 1 });
    // sorrow = 2, resolve = 2 → resolve wins on priority
    expect(m).toBe('resolve');
  });
});

describe('computeDominantMood with deltas (Phase 2B-2 Task 10)', () => {
  it('returns serenity when no deltas (existing behavior preserved)', () => {
    expect(computeDominantMood(zeroMoodInputs())).toBe('serenity');
    expect(computeDominantMood(zeroMoodInputs(), {})).toBe('serenity');
  });

  it('positive serenity delta with zero inputs → serenity (already baseline)', () => {
    expect(computeDominantMood(zeroMoodInputs(), { serenity: 5 })).toBe('serenity');
  });

  it('positive rage delta beats baseline serenity', () => {
    expect(computeDominantMood(zeroMoodInputs(), { rage: 3 })).toBe('rage');
  });

  it('rage delta is summed with existing rage score', () => {
    const inputs = { ...zeroMoodInputs(), recentBetrayals: 1 }; // rage = 3
    // Baseline: rage 3 dominates over baseline serenity. Add +2 → rage 5 still wins.
    expect(computeDominantMood(inputs, { rage: 2 })).toBe('rage');
  });

  it('multiple deltas combined; resolve wins ties via PRIORITY', () => {
    expect(computeDominantMood(zeroMoodInputs(), { sorrow: 3, resolve: 3 })).toBe('resolve');
  });
});
