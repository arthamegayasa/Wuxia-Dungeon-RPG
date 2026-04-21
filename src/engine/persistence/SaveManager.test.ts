import { describe, it, expect, beforeEach } from 'vitest';
import { createSaveManager, SaveEnvelope } from './SaveManager';

interface Demo { greeting: string; count: number }

describe('SaveManager', () => {
  let sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });

  beforeEach(() => {
    localStorage.clear();
    sm = createSaveManager({ storage: () => localStorage, gameVersion: '0.1.0' });
  });

  it('returns null when key not present', () => {
    expect(sm.load<Demo>('wdr.run')).toBeNull();
  });

  it('round-trips data through envelope', () => {
    sm.save<Demo>('wdr.run', { greeting: 'hello', count: 3 }, 1);
    const env = sm.load<Demo>('wdr.run');
    expect(env).not.toBeNull();
    expect(env!.schemaVersion).toBe(1);
    expect(env!.gameVersion).toBe('0.1.0');
    expect(env!.data).toEqual({ greeting: 'hello', count: 3 });
    expect(typeof env!.createdAt).toBe('string');
    expect(typeof env!.updatedAt).toBe('string');
  });

  it('preserves createdAt across subsequent saves but updates updatedAt', async () => {
    sm.save<Demo>('wdr.run', { greeting: 'a', count: 1 }, 1);
    const first = sm.load<Demo>('wdr.run')!;
    // Sleep a millisecond so updatedAt differs reliably.
    await new Promise((r) => setTimeout(r, 2));
    sm.save<Demo>('wdr.run', { greeting: 'b', count: 2 }, 1);
    const second = sm.load<Demo>('wdr.run')!;
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).not.toBe(first.updatedAt);
    expect(second.data.greeting).toBe('b');
  });

  it('uses atomic swap (tmp key cleared after save)', () => {
    sm.save<Demo>('wdr.run', { greeting: 'x', count: 0 }, 1);
    expect(localStorage.getItem('wdr.run.__tmp__')).toBeNull();
    expect(localStorage.getItem('wdr.run')).not.toBeNull();
  });

  it('recovers from a leftover tmp key (prior crash) on next load', () => {
    // Simulate prior crash: tmp present, main missing.
    const env: SaveEnvelope<Demo> = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gameVersion: '0.1.0',
      data: { greeting: 'rescued', count: 9 },
    };
    localStorage.setItem('wdr.run.__tmp__', JSON.stringify(env));
    const loaded = sm.load<Demo>('wdr.run');
    expect(loaded?.data).toEqual({ greeting: 'rescued', count: 9 });
    // Recovery promoted tmp to main.
    expect(localStorage.getItem('wdr.run')).not.toBeNull();
    expect(localStorage.getItem('wdr.run.__tmp__')).toBeNull();
  });

  it('clear removes both main and tmp', () => {
    sm.save<Demo>('wdr.run', { greeting: 'bye', count: 0 }, 1);
    localStorage.setItem('wdr.run.__tmp__', 'leftover');
    sm.clear('wdr.run');
    expect(localStorage.getItem('wdr.run')).toBeNull();
    expect(localStorage.getItem('wdr.run.__tmp__')).toBeNull();
  });

  it('throws on malformed JSON in stored envelope', () => {
    localStorage.setItem('wdr.run', 'not-json{');
    expect(() => sm.load<Demo>('wdr.run')).toThrow(/corrupt/i);
  });

  it('throws on envelope missing required fields', () => {
    localStorage.setItem('wdr.run', JSON.stringify({ hello: 'world' }));
    expect(() => sm.load<Demo>('wdr.run')).toThrow(/invalid envelope/i);
  });
});
