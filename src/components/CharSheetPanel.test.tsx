import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharSheetPanel } from './CharSheetPanel';

const baseProps = {
  corePath: 'iron_mountain',
  corePathRevealedThisTurn: false,
  techniques: [{ id: 'iron_body_fist', name: 'Iron Body Fist' }],
  openMeridians: [1, 4, 7],
  onClose: () => {},
};

describe('CharSheetPanel', () => {
  it('renders core path badge, technique list, and open meridian count', () => {
    render(<CharSheetPanel {...baseProps} />);
    expect(screen.getByText(/iron mountain/i)).toBeInTheDocument();
    expect(screen.getByText(/iron body fist/i)).toBeInTheDocument();
    expect(screen.getByText(/3 meridians open/i)).toBeInTheDocument();
  });
  it('fires onClose on close button click', async () => {
    const onClose = vi.fn();
    render(<CharSheetPanel {...baseProps} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
