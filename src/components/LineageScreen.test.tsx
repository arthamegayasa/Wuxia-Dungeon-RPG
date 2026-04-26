import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LineageScreen } from './LineageScreen';
import type { LineageSnapshot } from '@/services/engineBridge';

const EMPTY: LineageSnapshot = { entries: [] };

const POPULATED: LineageSnapshot = {
  entries: [
    {
      lifeIndex: 2,
      name: 'Lin Wei',
      anchorId: 'martial_family',
      anchorName: 'Martial Family',
      birthYear: 1000,
      deathYear: 1040,
      yearsLived: 40,
      realmReached: 'Body Tempering 5',
      deathCause: 'tribulation',
      karmaEarned: 80,
      echoesUnlockedThisLife: [{ id: 'iron_body', name: 'Iron Body' }],
      corePath: 'iron_mountain',
      techniqueCount: 2,
    },
    {
      lifeIndex: 1,
      name: 'Hu',
      anchorId: 'peasant_farmer',
      anchorName: 'Peasant Farmer',
      birthYear: 0,            // pre-v3 entry
      deathYear: 0,
      yearsLived: 30,
      realmReached: 'Mortal',
      deathCause: 'sickness',
      karmaEarned: 25,
      echoesUnlockedThisLife: [],
      corePath: null,
      techniqueCount: 0,
    },
  ],
};

describe('LineageScreen', () => {
  it('renders an empty-state hint when there are no past lives', () => {
    render(<LineageScreen snapshot={EMPTY} onBack={() => {}} />);
    expect(screen.getByText(/no lives yet/i)).toBeInTheDocument();
  });

  it('renders one card per lineage entry, most recent first', () => {
    render(<LineageScreen snapshot={POPULATED} onBack={() => {}} />);
    expect(screen.getByText(/Lin Wei/)).toBeInTheDocument();
    expect(screen.getByText(/Hu$/)).toBeInTheDocument();
    expect(screen.getByText(/Body Tempering 5/)).toBeInTheDocument();
  });

  it('shows year range when birthYear>0, falls back to "Years lived" otherwise', () => {
    render(<LineageScreen snapshot={POPULATED} onBack={() => {}} />);
    expect(screen.getByText(/1000.*1040/)).toBeInTheDocument();
    expect(screen.getByText(/Years lived: 30/)).toBeInTheDocument();
  });

  it('lists echoes unlocked this life when present', () => {
    render(<LineageScreen snapshot={POPULATED} onBack={() => {}} />);
    expect(screen.getByText(/iron body/i)).toBeInTheDocument();
  });

  it('calls onBack when the back button is clicked', async () => {
    const onBack = vi.fn();
    render(<LineageScreen snapshot={EMPTY} onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('Phase 2B-3: LineageScreen shows corePath + techniqueCount', () => {
  it('renders core path and technique count on each LifeCard', () => {
    const snap = {
      entries: [{
        lifeIndex: 1,
        name: 'Lin Wei',
        anchorId: 'sect_initiate',
        anchorName: 'Sect Initiate',
        birthYear: 100,
        deathYear: 145,
        yearsLived: 45,
        realmReached: 'qi_condensation',
        deathCause: 'old age',
        karmaEarned: 12,
        echoesUnlockedThisLife: [],
        corePath: 'iron_mountain',
        techniqueCount: 3,
      }],
    };
    render(<LineageScreen snapshot={snap} onBack={() => {}} />);
    expect(screen.getByText(/iron mountain/i)).toBeInTheDocument();
    expect(screen.getByText(/3 techniques/i)).toBeInTheDocument();
  });
});
