// Phase 2B-3 Task 23 — full UI 3-life integration test.
// Drives the App through 3 successive lives via real DOM clicks. Per life:
//   1. Pick first non-locked anchor on Creation.
//   2. Click choice buttons until BARDO (dismissing any in-flight Tribulation
//      panels via their Continue button).
//   3. Open Codex → Techniques tab → assert it has either learned techniques,
//      seen techniques, or the empty-state message (proves the tab renders).
//   4. Open Lineage → assert this life's name shows up.
//   5. Click Reincarnate.
// After 3 lives, lineage has 3 entries and meta lifeCount === 3.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App, __resetEngineSingleton, __setEngineOverride } from '@/App';
import { createEngineBridge } from '@/services/engineBridge';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';
import { GamePhase } from '@/engine/core/Types';

describe('Phase 2B-3: full UI 3-life loop covers Codex Techniques tab + Lineage entries', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
    __resetEngineSingleton();
  });

  it(
    'runs 3 lives via the UI and verifies Codex Techniques tab + Lineage entries',
    { timeout: 240000 },
    async () => {
      const engine = createEngineBridge({ now: () => 2 });
      __setEngineOverride(engine);
      render(<App />);

      await waitFor(() =>
        expect(screen.getByText(/thousand deaths/i)).toBeInTheDocument(),
      );
      await userEvent.click(screen.getByRole('button', { name: /new life/i }));

      for (let life = 1; life <= 3; life++) {
        await waitFor(() =>
          expect(screen.getByText(/choose your birth/i)).toBeInTheDocument(),
        );
        // Pick the first available (non-locked) known anchor.
        const anchorMatcher =
          /peasant farmer|sect initiate|martial family|scholar|outer disciple/i;
        const anchorButtons = screen
          .queryAllByRole('button')
          .filter(
            (b) =>
              !(b as HTMLButtonElement).disabled &&
              anchorMatcher.test(b.textContent ?? ''),
          );
        expect(anchorButtons.length).toBeGreaterThan(0);
        await userEvent.click(anchorButtons[0]!);

        const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
        if (nameInput.value === '') {
          await userEvent.type(nameInput, `Soul${life}`);
        }
        await userEvent.click(screen.getByRole('button', { name: /begin life/i }));

        // Run choices to death, dismissing Tribulation panels along the way.
        // Cap at 1500 iterations — the YP/AP content + life-tick should reach
        // BARDO well within that.
        for (let i = 0; i < 1500; i++) {
          if (useGameStore.getState().phase === GamePhase.BARDO) break;

          // Tribulation panel? Click Continue (dismiss).
          const tribContinue = screen.queryByRole('button', { name: /^continue$/i });
          if (tribContinue && screen.queryByText(/the heavens stir/i)) {
            await userEvent.click(tribContinue);
            continue;
          }

          // Otherwise click the first available choice button. Filter out
          // overlay-toggle buttons (Character / Inventory) and the Codex /
          // Lineage navigation buttons that appear on TitleScreen — but these
          // shouldn't render during PLAYING.
          const buttons = screen
            .queryAllByRole('button')
            .filter((b) => !(b as HTMLButtonElement).disabled)
            .filter(
              (b) =>
                !/^(character|inventory|codex|lineage)$/i.test(
                  (b.textContent ?? '').trim(),
                ),
            );
          if (buttons.length === 0) continue;
          await userEvent.click(buttons[0]!);
        }
        expect(useGameStore.getState().phase).toBe(GamePhase.BARDO);
        await waitFor(() =>
          expect(screen.getByText(/the bardo/i)).toBeInTheDocument(),
        );

        // Open Codex Techniques tab.
        await userEvent.click(screen.getByRole('button', { name: /codex/i }));
        await waitFor(() =>
          expect(screen.getByRole('heading', { name: /^Codex$/ })).toBeInTheDocument(),
        );
        await userEvent.click(screen.getByRole('tab', { name: /techniques/i }));
        // The registry holds 10 techniques regardless of in-life learning, so
        // the panel either renders learned-technique cards (named "Iron…",
        // "Still Water…", "Severing Edge…", "Howling Storm…", "Blood Ember…",
        // "Thousand Mirrors…", "Common Qi…", "Novice Fireball", "Golden Bell…",
        // "Wind-Walking…") or, for un-seen entries, the locked silhouette
        // ("— locked —" / "A technique not yet seen by the soul"). Empty
        // registry → "No techniques catalogued.". Any one of these proves the
        // tab rendered.
        const techMatches = screen.queryAllByText(
          /iron|still water|severing|howling|blood ember|thousand mirrors|common qi|novice fireball|golden bell|wind-walking|locked|no techniques catalogued|not yet seen by the soul/i,
        );
        expect(techMatches.length).toBeGreaterThan(0);
        await userEvent.click(screen.getByRole('button', { name: /back/i }));

        // Open Lineage and verify life shows up.
        await userEvent.click(screen.getByRole('button', { name: /lineage/i }));
        await waitFor(() =>
          expect(screen.getByRole('heading', { name: /^Lineage$/ })).toBeInTheDocument(),
        );
        expect(screen.getByText(new RegExp(`Soul${life}`))).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /back/i }));

        // Reincarnate.
        await userEvent.click(screen.getByRole('button', { name: /reincarnate/i }));
      }

      // Final assertions.
      const snap = engine.getLineageSnapshot();
      expect(snap.entries).toHaveLength(3);
      expect(useMetaStore.getState().lifeCount).toBe(3);
    },
  );
});
