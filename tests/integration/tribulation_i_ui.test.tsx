// Phase 2B-3 Task 22: Tribulation I focused UI integration test.
// Verifies that an event whose outcome carries `attempt_realm_crossing
// qc9_to_foundation` causes the bridge to stamp a TribulationPayload onto
// the next TurnPreview, which PlayScreen then surfaces via TribulationPanel.
// The Continue button dismisses the panel without killing the character
// (Phase 2B uses `non_fatal` mode by default).

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App, __resetEngineSingleton, __setEngineOverride } from '@/App';
import {
  createEngineBridge,
  __testInsertEvent,
} from '@/services/engineBridge';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';
import { GamePhase, Realm } from '@/engine/core/Types';

describe('Phase 2B-3: Tribulation I UI fires + dismisses', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
    __resetEngineSingleton();
  });

  it(
    'fires the TribulationPanel when player triggers qc9_to_foundation outcome',
    { timeout: 30000 },
    async () => {
      // Inject the synthetic Foundation-attempt event before the App mounts so
      // it is in the global pool from turn one. Weight 9999 dominates the YP
      // pool (~720 weight) once the character's QC9 state allows selection.
      __testInsertEvent({
        id: 'test_qc9_foundation_event',
        category: 'training',
        version: 1,
        weight: 9999,
        conditions: {},
        timeCost: 'INSTANT',
        text: { intro: ['You stand at the edge.'] },
        choices: [
          {
            id: 'attempt_foundation',
            label: 'Attempt Foundation',
            timeCost: 'INSTANT',
            outcomes: {
              SUCCESS: {
                narrativeKey: 'foundation_attempt',
                stateDeltas: [{ kind: 'attempt_realm_crossing', transition: 'qc9_to_foundation' }],
              },
              FAILURE: {
                narrativeKey: 'foundation_attempt',
                stateDeltas: [{ kind: 'attempt_realm_crossing', transition: 'qc9_to_foundation' }],
              },
            },
          },
        ],
        repeat: 'unlimited',
      });

      const engine = createEngineBridge({ now: () => 7 });
      __setEngineOverride(engine);
      render(<App />);

      // Title -> New Life -> pick Peasant Farmer -> Begin Life.
      await waitFor(() =>
        expect(screen.getByText(/thousand deaths/i)).toBeInTheDocument(),
      );
      await userEvent.click(screen.getByRole('button', { name: /new life/i }));
      await waitFor(() =>
        expect(screen.getByText(/choose your birth/i)).toBeInTheDocument(),
      );
      await userEvent.click(screen.getByText(/peasant farmer/i));
      await userEvent.type(screen.getByLabelText(/name/i), 'Tribulator');
      await userEvent.click(screen.getByRole('button', { name: /begin life/i }));

      // Wait for PlayScreen to render with the first preview (auto-peeked
      // by App.onBegin after beginLife resolves).
      await waitFor(() =>
        expect(useGameStore.getState().phase).toBe(GamePhase.PLAYING),
      );
      await waitFor(() => {
        const buttons = screen
          .queryAllByRole('button')
          .filter((b) => !(b as HTMLButtonElement).disabled)
          .filter(
            (b) =>
              !/^(character|inventory)$/i.test((b.textContent ?? '').trim()),
          );
        expect(buttons.length).toBeGreaterThan(0);
      });

      // Helper: stamp QC9 + cultivationProgress=100 onto current runState.
      // Does NOT clear pendingEventId — that would break resolveChoice.
      // The OutcomeApplier preserves realm/qiCondensationLayer/cultivationProgress
      // for benign deltas (hp/qi/karma/age), so the QC9 state survives a click.
      function injectQc9State(): void {
        const gs = useGameStore.getState();
        if (!gs.runState) return;
        useGameStore.setState({
          runState: {
            ...gs.runState,
            character: {
              ...gs.runState.character,
              realm: Realm.QI_CONDENSATION,
              qiCondensationLayer: 9,
              cultivationProgress: 100,
            },
          },
        });
      }

      // Click through up to 30 turns, re-injecting QC9 state before each click
      // so that the post-resolveChoice auto-peek sees a QC9 character and the
      // synthetic event (weight 9999) wins selection. Stop as soon as the
      // Foundation-attempt button appears.
      let foundationButton: HTMLElement | null = null;
      for (let i = 0; i < 30; i++) {
        // Inject BEFORE checking for the button so that any state mutation
        // from a prior outcome (e.g. realm change) is reset.
        injectQc9State();

        // After re-injection the DOM hasn't re-rendered, but a previous
        // auto-peek may already have selected our synthetic event — check
        // for the button.
        foundationButton = screen.queryByRole('button', {
          name: /attempt foundation/i,
        });
        if (foundationButton) break;

        // Otherwise click the first available choice button to advance one turn.
        const buttons = screen
          .queryAllByRole('button')
          .filter((b) => !(b as HTMLButtonElement).disabled)
          .filter(
            (b) =>
              !/^(character|inventory)$/i.test((b.textContent ?? '').trim()),
          );
        if (buttons.length === 0) {
          await waitFor(() => {
            const bs = screen
              .queryAllByRole('button')
              .filter((b) => !(b as HTMLButtonElement).disabled);
            expect(bs.length).toBeGreaterThan(0);
          });
          continue;
        }
        await userEvent.click(buttons[0]!);
        if (useGameStore.getState().phase === GamePhase.BARDO) {
          throw new Error(
            'Character died before synthetic Foundation event was selected',
          );
        }
      }

      expect(foundationButton, 'Foundation-attempt button never appeared').not.toBeNull();
      expect(useGameStore.getState().phase).toBe(GamePhase.PLAYING);

      // Click the Foundation attempt button.
      await userEvent.click(foundationButton!);

      // Tribulation panel must appear.
      await waitFor(() =>
        expect(screen.getByText(/the heavens stir/i)).toBeInTheDocument(),
      );
      expect(screen.getByText(/heart demon/i)).toBeInTheDocument();
      expect(screen.getByText(/first thunder/i)).toBeInTheDocument();
      expect(screen.getByText(/second thunder/i)).toBeInTheDocument();
      expect(screen.getByText(/third thunder/i)).toBeInTheDocument();

      // Dismiss via the panel's Continue button.
      await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));
      expect(screen.queryByText(/the heavens stir/i)).not.toBeInTheDocument();

      // Game continues — character is alive (non-fatal in 2B).
      expect(useGameStore.getState().runState!.deathCause).toBeNull();
    },
  );
});
