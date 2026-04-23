import { describe, it, expect } from 'vitest';
import { substituteAdjectives, DEFAULT_ADJECTIVE_DICT } from './MoodAdjectiveDict';

describe('substituteAdjectives', () => {
  it('returns text unchanged when mood has no substitutions', () => {
    const out = substituteAdjectives('The warm wind blew steady.', 'serenity', DEFAULT_ADJECTIVE_DICT);
    // serenity maps 'warm' -> 'gentle'; 'steady' has no key; sentence still varies.
    // But the default dict includes 'warm.serenity' = 'gentle', so the "unchanged" case
    // is actually a mood that has NO entry for any word in the text. Use a mood-free test.
    const out2 = substituteAdjectives('The quiet pond.', 'resolve', DEFAULT_ADJECTIVE_DICT);
    expect(typeof out).toBe('string'); // at minimum doesn't throw
    // For resolve, quiet has no entry -> returns unchanged
    expect(out2).toBe('The quiet pond.');
  });

  it('substitutes "warm" with "lonely" under melancholy', () => {
    const out = substituteAdjectives('The warm wind blew steady.', 'melancholy', DEFAULT_ADJECTIVE_DICT);
    expect(out).toBe('The lonely wind blew steady.');
  });

  it('respects word boundaries (does not touch "warmth")', () => {
    const out = substituteAdjectives('The warmth carried her voice.', 'melancholy', DEFAULT_ADJECTIVE_DICT);
    expect(out).toBe('The warmth carried her voice.');
  });

  it('preserves sentence-initial capitalization', () => {
    const out = substituteAdjectives('Warm rain fell.', 'rage', DEFAULT_ADJECTIVE_DICT);
    expect(out).toBe('Stifling rain fell.');
  });

  it('handles multiple adjectives in one pass', () => {
    const out = substituteAdjectives(
      'The warm night was quiet.',
      'melancholy',
      DEFAULT_ADJECTIVE_DICT,
    );
    expect(out).toContain('lonely');
    expect(out).toContain('hollow');
  });
});
