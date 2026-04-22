import { describe, it, expect } from 'vitest';
import { OutcomeTable, Outcome } from '@/content/schema';
import { resolveOutcome } from './OutcomeResolver';

const full: OutcomeTable = {
  CRIT_SUCCESS: { narrativeKey: 'cs' },
  SUCCESS:      { narrativeKey: 's' },
  PARTIAL:      { narrativeKey: 'p' },
  FAILURE:      { narrativeKey: 'f' },
  CRIT_FAILURE: { narrativeKey: 'cf' },
};

const minimal: OutcomeTable = {
  SUCCESS: { narrativeKey: 's' },
  FAILURE: { narrativeKey: 'f' },
};

describe('resolveOutcome', () => {
  it('returns exact tier when present', () => {
    expect(resolveOutcome(full, 'CRIT_SUCCESS').narrativeKey).toBe('cs');
    expect(resolveOutcome(full, 'SUCCESS').narrativeKey).toBe('s');
    expect(resolveOutcome(full, 'PARTIAL').narrativeKey).toBe('p');
    expect(resolveOutcome(full, 'FAILURE').narrativeKey).toBe('f');
    expect(resolveOutcome(full, 'CRIT_FAILURE').narrativeKey).toBe('cf');
  });

  it('CRIT_SUCCESS falls back to SUCCESS when missing', () => {
    const r = resolveOutcome(minimal, 'CRIT_SUCCESS');
    expect(r.narrativeKey).toBe('s');
  });

  it('CRIT_FAILURE falls back to FAILURE when missing', () => {
    const r = resolveOutcome(minimal, 'CRIT_FAILURE');
    expect(r.narrativeKey).toBe('f');
  });

  it('PARTIAL falls back to SUCCESS when missing', () => {
    const r = resolveOutcome(minimal, 'PARTIAL');
    expect(r.narrativeKey).toBe('s');
  });

  it('never crosses success/fail boundary: FAILURE never falls back to SUCCESS', () => {
    // If only SUCCESS and FAILURE are defined, no cross-boundary fallback.
    const r = resolveOutcome(minimal, 'FAILURE');
    expect(r.narrativeKey).toBe('f');
  });

  it('PARTIAL fallback prefers SUCCESS side (per spec §5.4: "one level toward SUCCESS or FAILURE")', () => {
    // PARTIAL straddles — spec says "toward SUCCESS or FAILURE" (never crosses). We resolve toward SUCCESS.
    const table: OutcomeTable = {
      SUCCESS: { narrativeKey: 's' },
      FAILURE: { narrativeKey: 'f' },
      // no PARTIAL
    };
    expect(resolveOutcome(table, 'PARTIAL').narrativeKey).toBe('s');
  });
});
