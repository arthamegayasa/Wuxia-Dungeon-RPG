import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayScreen } from './PlayScreen';

const PREVIEW = {
  narrative: 'A crow landed on the fence post.',
  name: 'Lin Wei',
  ageYears: 12,
  hpCurrent: 50,
  hpMax: 60,
  qiCurrent: 10,
  qiMax: 20,
  realm: 'mortal',
  insight: 3,
  choices: [
    { id: 'ch_walk', label: 'Walk on.' },
    { id: 'ch_chase', label: 'Chase it.' },
  ],
  region: 'azure_peaks',
  regionName: 'Azure Peaks',
  corePath: null,
  corePathRevealedThisTurn: false,
  learnedTechniques: [],
  inventory: [],
  openMeridians: [],
};

describe('PlayScreen', () => {
  it('renders the narrative', () => {
    render(<PlayScreen preview={PREVIEW} onChoose={() => {}} />);
    expect(screen.getByText(/crow landed/i)).toBeInTheDocument();
  });

  it('renders the status strip', () => {
    render(<PlayScreen preview={PREVIEW} onChoose={() => {}} />);
    expect(screen.getByText(/lin wei/i)).toBeInTheDocument();
    expect(screen.getByText(/age 12/i)).toBeInTheDocument();
    expect(screen.getByText(/50 *\/ *60/i)).toBeInTheDocument();
    expect(screen.getByText(/mortal/i)).toBeInTheDocument();
  });

  it('renders every choice as a button', () => {
    render(<PlayScreen preview={PREVIEW} onChoose={() => {}} />);
    expect(screen.getByRole('button', { name: /walk on/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /chase it/i })).toBeInTheDocument();
  });

  it('calls onChoose with the choice id when a button is clicked', async () => {
    const onChoose = vi.fn();
    render(<PlayScreen preview={PREVIEW} onChoose={onChoose} />);
    await userEvent.click(screen.getByRole('button', { name: /chase it/i }));
    expect(onChoose).toHaveBeenCalledWith('ch_chase');
  });

  it('disables all choices when isLoading', () => {
    render(<PlayScreen preview={PREVIEW} onChoose={() => {}} isLoading />);
    for (const btn of screen.getAllByRole('button')) {
      expect(btn).toBeDisabled();
    }
  });

  it('shows a hint when the preview has zero choices (transitional state)', () => {
    render(
      <PlayScreen
        preview={{ ...PREVIEW, choices: [] }}
        onChoose={() => {}}
      />,
    );
    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
  });
});

describe('Phase 2B-3: PlayScreen region indicator', () => {
  it('renders the region name in the header', () => {
    render(<PlayScreen preview={PREVIEW} onChoose={() => {}} />);
    expect(screen.getByText(/azure peaks/i)).toBeInTheDocument();
  });
});
