import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreationScreen } from './CreationScreen';

const ANCHORS = [
  { id: 'peasant_farmer', name: 'Peasant Farmer', description: 'Born to the soil.', locked: false, unlockHint: 'Available from the start', freshlyUnlocked: false },
  { id: 'true_random', name: 'True Random', description: 'Let the Heavens decide.', locked: false, unlockHint: 'Available from the start', freshlyUnlocked: false },
  { id: 'martial_family', name: 'Martial Family', description: 'Hard fists.', locked: true, unlockHint: 'Reach Body Tempering 5 in any past life', freshlyUnlocked: false },
  { id: 'scholars_son', name: "Scholar's Son", description: 'Books.', locked: true, unlockHint: 'Read 10 tomes in one life', freshlyUnlocked: false },
];

describe('CreationScreen', () => {
  it('renders every available anchor', () => {
    render(<CreationScreen anchors={ANCHORS} onBegin={() => {}} onBack={() => {}} />);
    expect(screen.getByText('Peasant Farmer')).toBeInTheDocument();
    expect(screen.getByText('True Random')).toBeInTheDocument();
  });

  it('disables Begin Life until an anchor is selected and a name entered', async () => {
    render(<CreationScreen anchors={ANCHORS} onBegin={() => {}} onBack={() => {}} />);
    const begin = screen.getByRole('button', { name: /begin life/i });
    expect(begin).toBeDisabled();

    await userEvent.click(screen.getByText('Peasant Farmer'));
    // Name still empty
    expect(begin).toBeDisabled();

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.type(nameInput, 'Lin Wei');
    expect(begin).not.toBeDisabled();
  });

  it('calls onBegin with the selected anchor and trimmed name', async () => {
    const onBegin = vi.fn();
    render(<CreationScreen anchors={ANCHORS} onBegin={onBegin} onBack={() => {}} />);
    await userEvent.click(screen.getByText('Peasant Farmer'));
    await userEvent.type(screen.getByLabelText(/name/i), '  Lin Wei  ');
    await userEvent.click(screen.getByRole('button', { name: /begin life/i }));
    expect(onBegin).toHaveBeenCalledWith('peasant_farmer', 'Lin Wei');
  });

  it('calls onBack when the back button is clicked', async () => {
    const onBack = vi.fn();
    render(<CreationScreen anchors={ANCHORS} onBegin={() => {}} onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows a loading state and disables inputs when isLoading=true', () => {
    render(<CreationScreen anchors={ANCHORS} onBegin={() => {}} onBack={() => {}} isLoading />);
    expect(screen.getByRole('button', { name: /begin life/i })).toBeDisabled();
  });

  it('renders locked anchors as silhouettes and disables their selection', async () => {
    render(<CreationScreen anchors={ANCHORS} onBegin={() => {}} onBack={() => {}} />);
    // Silhouette text appears.
    expect(screen.getByText(/reach body tempering 5 in any past life/i)).toBeInTheDocument();
    // Locked names are NOT in the document.
    expect(screen.queryByText('Martial Family')).not.toBeInTheDocument();
    // Click the silhouette: selection should not change. Find the locked card by hint.
    const lockedCard = screen.getByText(/reach body tempering 5/i).closest('button')!;
    expect(lockedCard).toBeDisabled();
  });

  it('renders freshly-unlocked anchors with a shimmer indicator', () => {
    const fresh = ANCHORS.map((a) =>
      a.id === 'martial_family' ? { ...a, locked: false, freshlyUnlocked: true } : a,
    );
    render(<CreationScreen anchors={fresh} onBegin={() => {}} onBack={() => {}} />);
    const card = screen.getByText('Martial Family').closest('button')!;
    expect(card.className).toMatch(/shimmer|animate-pulse/i);
  });
});
