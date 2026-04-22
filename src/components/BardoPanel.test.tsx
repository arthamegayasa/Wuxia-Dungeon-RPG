import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BardoPanel } from './BardoPanel';

const PAYLOAD = {
  lifeIndex: 1,
  years: 42,
  realm: 'mortal',
  deathCause: 'old_age',
  karmaEarned: 14,
  karmaBreakdown: {
    yearsLived: 4,
    realm: 0,
    deathCause: 5,
    vows: 0,
    diedProtecting: 0,
    achievements: 5,
    inLifeDelta: 0,
  },
  karmaBalance: 14,
  ownedUpgrades: [],
  availableUpgrades: [
    { id: 'awakened_soul_1', name: 'Awakened Soul I', description: '10% re-roll',
      cost: 80, affordable: false, requirementsMet: true, owned: false },
    { id: 'heavenly_patience_1', name: 'Heavenly Patience I', description: 'Insight cap +20',
      cost: 100, affordable: false, requirementsMet: true, owned: false },
  ],
};

describe('BardoPanel', () => {
  it('renders the life summary card', () => {
    render(<BardoPanel payload={PAYLOAD} onBuyUpgrade={() => {}} onReincarnate={() => {}} />);
    expect(screen.getByText(/life 1/i)).toBeInTheDocument();
    expect(screen.getByText(/42 years/i)).toBeInTheDocument();
    expect(screen.getByText(/old_age/i)).toBeInTheDocument();
    expect(screen.getByText(/mortal/i)).toBeInTheDocument();
  });

  it('shows the karma earned and karma balance', () => {
    render(<BardoPanel payload={PAYLOAD} onBuyUpgrade={() => {}} onReincarnate={() => {}} />);
    expect(screen.getByText(/karma earned/i)).toBeInTheDocument();
    expect(screen.getByText(/14/)).toBeInTheDocument();
  });

  it('lists every available upgrade with an affordability indicator', () => {
    render(<BardoPanel payload={PAYLOAD} onBuyUpgrade={() => {}} onReincarnate={() => {}} />);
    expect(screen.getByText(/awakened soul i/i)).toBeInTheDocument();
    expect(screen.getByText(/heavenly patience i/i)).toBeInTheDocument();
  });

  it('disables the purchase button when unaffordable', () => {
    render(<BardoPanel payload={PAYLOAD} onBuyUpgrade={() => {}} onReincarnate={() => {}} />);
    const btn = screen.getByRole('button', { name: /awakened soul i/i });
    expect(btn).toBeDisabled();
  });

  it('enables the purchase button when affordable + requirements met', () => {
    const affordable = {
      ...PAYLOAD,
      karmaBalance: 200,
      availableUpgrades: [{ ...PAYLOAD.availableUpgrades[0], affordable: true }],
    };
    render(<BardoPanel payload={affordable} onBuyUpgrade={() => {}} onReincarnate={() => {}} />);
    const btn = screen.getByRole('button', { name: /awakened soul i/i });
    expect(btn).not.toBeDisabled();
  });

  it('calls onBuyUpgrade with the id when a purchase button is clicked', async () => {
    const onBuy = vi.fn();
    const affordable = {
      ...PAYLOAD,
      availableUpgrades: [{ ...PAYLOAD.availableUpgrades[0], affordable: true }],
    };
    render(<BardoPanel payload={affordable} onBuyUpgrade={onBuy} onReincarnate={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /awakened soul i/i }));
    expect(onBuy).toHaveBeenCalledWith('awakened_soul_1');
  });

  it('calls onReincarnate when the reincarnate button is clicked', async () => {
    const onRe = vi.fn();
    render(<BardoPanel payload={PAYLOAD} onBuyUpgrade={() => {}} onReincarnate={onRe} />);
    await userEvent.click(screen.getByRole('button', { name: /reincarnate/i }));
    expect(onRe).toHaveBeenCalledOnce();
  });
});
