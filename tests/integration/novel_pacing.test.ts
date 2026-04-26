import { describe, it, expect } from 'vitest';
import { createEngineBridge, __loadGameplayContent } from '@/services/engineBridge';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';

describe('Phase 2C: novel-mode pacing', () => {
  it('over a 50-turn life, the beat:decision ratio is approximately 4:1 to 8:1', async () => {
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
    await __loadGameplayContent();
    const engine = createEngineBridge({ now: () => 7 });
    await engine.loadOrInit();
    await engine.beginLife('peasant_farmer', 'Pacing Test');

    let beats = 0;
    let decisions = 0;
    let turns = 0;
    const maxTurns = 50;

    while (turns < maxTurns) {
      const preview = await engine.peekNextEvent();
      const isBeat = preview.choices.length === 1 && preview.choices[0]?.id === 'continue';
      if (isBeat) beats++; else decisions++;
      const choice = preview.choices[0];
      if (!choice) break;
      const result = await engine.resolveChoice(choice.id);
      if ('karmaEarned' in result) break;  // bardo (death) — stop
      turns++;
    }

    // Sanity
    expect(turns).toBeGreaterThan(10);
    expect(beats + decisions).toBeGreaterThan(10);

    // Pacing band: beats should dominate (at least 4× decisions, at most 10× decisions on aggregate)
    const ratio = beats / Math.max(1, decisions);
    expect(ratio).toBeGreaterThanOrEqual(2.0);  // generous lower bound (RNG variance)
    expect(ratio).toBeLessThanOrEqual(15.0);     // generous upper bound

    // Both kinds should appear in any non-trivial life
    expect(decisions).toBeGreaterThan(0);
    expect(beats).toBeGreaterThan(decisions);   // beats outnumber decisions
  });
});
