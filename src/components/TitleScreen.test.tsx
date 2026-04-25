import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TitleScreen } from './TitleScreen';

describe('TitleScreen', () => {
  it('renders the game title', () => {
    render(<TitleScreen onNewGame={() => {}} onContinue={() => {}} onOpenCodex={() => {}} onOpenLineage={() => {}} hasSave={false} />);
    expect(screen.getByText(/thousand deaths/i)).toBeInTheDocument();
  });

  it('disables Continue when no save', () => {
    render(<TitleScreen onNewGame={() => {}} onContinue={() => {}} onOpenCodex={() => {}} onOpenLineage={() => {}} hasSave={false} />);
    const btn = screen.getByRole('button', { name: /continue/i });
    expect(btn).toBeDisabled();
  });

  it('enables Continue when a save exists', () => {
    render(<TitleScreen onNewGame={() => {}} onContinue={() => {}} onOpenCodex={() => {}} onOpenLineage={() => {}} hasSave={true} />);
    const btn = screen.getByRole('button', { name: /continue/i });
    expect(btn).not.toBeDisabled();
  });

  it('calls onNewGame when New Life clicked', async () => {
    const onNewGame = vi.fn();
    render(<TitleScreen onNewGame={onNewGame} onContinue={() => {}} onOpenCodex={() => {}} onOpenLineage={() => {}} hasSave={false} />);
    await userEvent.click(screen.getByRole('button', { name: /new life/i }));
    expect(onNewGame).toHaveBeenCalledOnce();
  });

  it('calls onOpenLineage when the Lineage button is clicked', async () => {
    const onOpenLineage = vi.fn();
    render(<TitleScreen
      hasSave={false}
      onNewGame={() => {}}
      onContinue={() => {}}
      onOpenCodex={() => {}}
      onOpenLineage={onOpenLineage}
    />);
    await userEvent.click(screen.getByRole('button', { name: /lineage/i }));
    expect(onOpenLineage).toHaveBeenCalledOnce();
  });
});
