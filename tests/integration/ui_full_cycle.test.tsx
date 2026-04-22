import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { useGameStore } from '@/state/gameStore';
import { useMetaStore } from '@/state/metaStore';
import { GamePhase } from '@/engine/core/Types';

describe('UI integration: full cycle', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().reset();
    useMetaStore.getState().reset();
  });

  it('flows from Title -> Creation -> Play -> Bardo -> Creation via clicks', { timeout: 30000 }, async () => {
    render(<App />);

    // Title -> New Life
    await waitFor(() => expect(screen.getByText(/thousand deaths/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /new life/i }));

    // Creation -> pick anchor + name + Begin
    await waitFor(() => expect(screen.getByText(/choose your birth/i)).toBeInTheDocument());
    await userEvent.click(screen.getByText(/peasant farmer/i));
    await userEvent.type(screen.getByLabelText(/name/i), 'Lin Wei');
    await userEvent.click(screen.getByRole('button', { name: /begin life/i }));

    // Play - status strip should show Lin Wei
    await waitFor(() => expect(screen.getByText(/lin wei/i)).toBeInTheDocument());

    // Spam choices until the character dies.
    for (let i = 0; i < 600; i++) {
      if (useGameStore.getState().phase === GamePhase.BARDO) break;
      const buttons = screen.queryAllByRole('button');
      // Filter out navigation buttons (back, new life, continue, codex).
      const choiceBtn = buttons.find((b) =>
        b.textContent && !/back|new life|continue|codex/i.test(b.textContent),
      );
      if (!choiceBtn) continue;
      await userEvent.click(choiceBtn);
    }

    expect(useGameStore.getState().phase).toBe(GamePhase.BARDO);

    // Bardo -> Reincarnate
    await waitFor(() => expect(screen.getByText(/the bardo/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /reincarnate/i }));

    // Back at Creation
    await waitFor(() => expect(screen.getByText(/choose your birth/i)).toBeInTheDocument());
  });
});
