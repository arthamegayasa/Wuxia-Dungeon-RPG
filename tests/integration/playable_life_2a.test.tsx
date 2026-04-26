import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App, __resetEngineSingleton, __setEngineOverride } from '@/App';
import { createEngineBridge } from '@/services/engineBridge';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';
import { GamePhase } from '@/engine/core/Types';

describe('Phase 2A-3 full UI cycle: Title → Codex → Lineage → Life → Bardo (reveal) → Reincarnate', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
    __resetEngineSingleton();
  });

  it('opens Codex (empty), opens Lineage (empty), runs a life, sees Bardo reveal, returns to Creation', { timeout: 30000 }, async () => {
    const engine = createEngineBridge({ now: () => 2 });
    __setEngineOverride(engine);

    render(<App />);

    await waitFor(() => expect(screen.getByText(/thousand deaths/i)).toBeInTheDocument());

    // Open Codex (empty state).
    await userEvent.click(screen.getByRole('button', { name: /codex/i }));
    await waitFor(() => expect(screen.getByText(/^Codex$/)).toBeInTheDocument());
    expect(screen.getByText(/seen nowhere yet/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    await waitFor(() => expect(screen.getByText(/thousand deaths/i)).toBeInTheDocument());

    // Open Lineage (empty state).
    await userEvent.click(screen.getByRole('button', { name: /lineage/i }));
    await waitFor(() => expect(screen.getByText(/^Lineage$/)).toBeInTheDocument());
    expect(screen.getByText(/no lives yet/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    // Start a new life.
    await userEvent.click(screen.getByRole('button', { name: /new life/i }));
    await waitFor(() => expect(screen.getByText(/choose your birth/i)).toBeInTheDocument());

    // Locked anchors render as silhouettes.
    expect(screen.getByText(/reach body tempering 5 in any past life/i)).toBeInTheDocument();

    // Pick peasant farmer.
    await userEvent.click(screen.getByText(/peasant farmer/i));
    await userEvent.type(screen.getByLabelText(/name/i), 'Lin Wei');
    await userEvent.click(screen.getByRole('button', { name: /begin life/i }));

    await waitFor(() => expect(screen.getAllByText(/lin wei/i).length).toBeGreaterThan(0));

    // Run choices to death.
    for (let i = 0; i < 600; i++) {
      if (useGameStore.getState().phase === GamePhase.BARDO) break;
      const buttons = screen.queryAllByRole('button')
        .filter((b) => !(b as HTMLButtonElement).disabled)
        .filter((b) => !/^(character|inventory)$/i.test((b.textContent ?? '').trim()));
      if (buttons.length === 0) continue;
      await userEvent.click(buttons[0]!);
    }
    expect(useGameStore.getState().phase).toBe(GamePhase.BARDO);

    await waitFor(() => expect(screen.getByText(/the bardo/i)).toBeInTheDocument());

    // Bardo: open Lineage, expect 1 entry now.
    await userEvent.click(screen.getByRole('button', { name: /lineage/i }));
    await waitFor(() => expect(screen.getByText(/^Lineage$/)).toBeInTheDocument());
    expect(screen.getByText(/Lin Wei/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    // Bardo: open Codex.
    await userEvent.click(screen.getByRole('button', { name: /codex/i }));
    await waitFor(() => expect(screen.getByText(/^Codex$/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    // Reincarnate.
    await userEvent.click(screen.getByRole('button', { name: /reincarnate/i }));
    await waitFor(() => expect(screen.getByText(/choose your birth/i)).toBeInTheDocument());
  });

  it('runs 5 successive lives through the UI and grows meta state monotonically', { timeout: 90000 }, async () => {
    const engine = createEngineBridge({ now: () => 2 });
    __setEngineOverride(engine);
    render(<App />);

    await waitFor(() => expect(screen.getByText(/thousand deaths/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /new life/i }));

    for (let life = 1; life <= 5; life++) {
      await waitFor(() => expect(screen.getByText(/choose your birth/i)).toBeInTheDocument());
      await userEvent.click(screen.getByText(/peasant farmer/i));

      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
      if (nameInput.value === '') {
        await userEvent.type(nameInput, `Soul${life}`);
      }
      await userEvent.click(screen.getByRole('button', { name: /begin life/i }));

      // Run choices to death.
      for (let i = 0; i < 800; i++) {
        if (useGameStore.getState().phase === GamePhase.BARDO) break;
        const buttons = screen.queryAllByRole('button')
          .filter((b) => !(b as HTMLButtonElement).disabled)
          .filter((b) => !/^(character|inventory)$/i.test((b.textContent ?? '').trim()));
        if (buttons.length === 0) continue;
        await userEvent.click(buttons[0]!);
      }
      expect(useGameStore.getState().phase).toBe(GamePhase.BARDO);
      await waitFor(() => expect(screen.getByText(/the bardo/i)).toBeInTheDocument());

      // Confirm lifeCount monotonically grows.
      expect(useMetaStore.getState().lifeCount).toBe(life);

      // Reincarnate.
      await userEvent.click(screen.getByRole('button', { name: /reincarnate/i }));
    }

    // Final assertion: lineage has 5 entries, most recent first via the snapshot API.
    const snap = engine.getLineageSnapshot();
    expect(snap.entries).toHaveLength(5);
    expect(snap.entries[0].lifeIndex).toBe(5);
    expect(snap.entries[4].lifeIndex).toBe(1);
  });
});
