import { describe, it, expect } from 'vitest';
import { createEngineBridge } from './engineBridge';
import { GamePhase } from '@/engine/core/Types';

describe('engineBridge stubs', () => {
  it('loadOrInit returns TITLE by default', async () => {
    const engine = createEngineBridge();
    const out = await engine.loadOrInit();
    expect(out.phase).toBe(GamePhase.TITLE);
    expect(out.turn).toBeUndefined();
  });

  it('getMetaSummary returns zeroed defaults', () => {
    const engine = createEngineBridge();
    const meta = engine.getMetaSummary();
    expect(meta.karmicInsight).toBe(0);
    expect(meta.lifeCount).toBe(0);
    expect(meta.heavenlyNotice).toBe(0);
  });

  it('getLineage returns empty array', () => {
    expect(createEngineBridge().getLineage()).toEqual([]);
  });

  it('unimplemented actions throw a clear not-implemented error', async () => {
    const engine = createEngineBridge();
    await expect(engine.beginLife('true_random', 'Lin')).rejects.toThrow(/not implemented/i);
    await expect(engine.chooseAction('x')).rejects.toThrow(/not implemented/i);
    await expect(engine.beginBardo()).rejects.toThrow(/not implemented/i);
  });
});
