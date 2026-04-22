import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('has a jsdom environment', () => {
    expect(typeof window).toBe('object');
    expect(typeof localStorage).toBe('object');
  });
});
