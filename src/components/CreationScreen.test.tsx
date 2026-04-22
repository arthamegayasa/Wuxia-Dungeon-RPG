import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreationScreen } from './CreationScreen';

const ANCHORS = [
  { id: 'peasant_farmer', name: 'Peasant Farmer', description: 'Born to the soil.' },
  { id: 'true_random', name: 'True Random', description: 'Let the Heavens decide.' },
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
});
