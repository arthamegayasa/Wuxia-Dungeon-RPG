import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BardoPanel } from './BardoPanel';

const basePayload = {
  lifeIndex: 1,
  years: 30,
  realm: 'Mortal',
  deathCause: 'old_age',
  karmaEarned: 5,
  karmaBreakdown: {},
  karmaBalance: 5,
  ownedUpgrades: [],
  availableUpgrades: [],
  manifestedThisLife: [],
  witnessedThisLife: [],
  echoesUnlockedThisLife: [],
  corePath: null,
  techniquesLearnedThisLife: [],
};

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
  manifestedThisLife: [],
  witnessedThisLife: [],
  echoesUnlockedThisLife: [],
  corePath: null,
  techniquesLearnedThisLife: [],
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

  it('renders the manifested-memory reveal section when present', () => {
    render(<BardoPanel
      payload={{
        ...basePayload,
        manifestedThisLife: [{ id: 'frost_palm_severing', name: 'Frost Palm Severing', level: 'partial', manifestFlavour: 'memory.manifest.frost_palm_severing.1' }],
        witnessedThisLife: [],
        echoesUnlockedThisLife: [],
      }}
      onBuyUpgrade={() => {}}
      onReincarnate={() => {}}
    />);
    expect(screen.getByText(/you remembered/i)).toBeInTheDocument();
    expect(screen.getByText('Frost Palm Severing')).toBeInTheDocument();
  });

  it('renders the witnessed-memory compact list', () => {
    render(<BardoPanel
      payload={{
        ...basePayload,
        manifestedThisLife: [],
        witnessedThisLife: [{ id: 'silent_waters_scripture', name: 'Scripture of Silent Waters', level: 'fragment' }],
        echoesUnlockedThisLife: [],
      }}
      onBuyUpgrade={() => {}}
      onReincarnate={() => {}}
    />);
    expect(screen.getByText(/you saw/i)).toBeInTheDocument();
    expect(screen.getByText(/scripture of silent waters/i)).toBeInTheDocument();
  });

  it('renders the echo-unlock cards for echoes unlocked this life', () => {
    render(<BardoPanel
      payload={{
        ...basePayload,
        manifestedThisLife: [],
        witnessedThisLife: [],
        echoesUnlockedThisLife: [{ id: 'iron_body', name: 'Iron Body', description: 'Your bones remember.' }],
      }}
      onBuyUpgrade={() => {}}
      onReincarnate={() => {}}
    />);
    expect(screen.getByText(/iron body/i)).toBeInTheDocument();
  });

  it('hides each reveal section when its array is empty', () => {
    render(<BardoPanel
      payload={{ ...basePayload, manifestedThisLife: [], witnessedThisLife: [], echoesUnlockedThisLife: [] }}
      onBuyUpgrade={() => {}}
      onReincarnate={() => {}}
    />);
    expect(screen.queryByText(/you remembered/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/you saw/i)).not.toBeInTheDocument();
  });

  it('renders Codex and Lineage entry buttons that fire callbacks', async () => {
    const onOpenCodex = vi.fn();
    const onOpenLineage = vi.fn();
    render(<BardoPanel
      payload={{ ...basePayload, manifestedThisLife: [], witnessedThisLife: [], echoesUnlockedThisLife: [] }}
      onBuyUpgrade={() => {}}
      onReincarnate={() => {}}
      onOpenCodex={onOpenCodex}
      onOpenLineage={onOpenLineage}
    />);
    await userEvent.click(screen.getByRole('button', { name: /codex/i }));
    await userEvent.click(screen.getByRole('button', { name: /lineage/i }));
    expect(onOpenCodex).toHaveBeenCalledOnce();
    expect(onOpenLineage).toHaveBeenCalledOnce();
  });
});

describe('Phase 2B-3: BardoPanel reveals techniques + core path', () => {
  it('shows the learned techniques list when techniquesLearnedThisLife is non-empty', () => {
    render(<BardoPanel
      payload={{
        ...basePayload,
        techniquesLearnedThisLife: [
          { id: 'iron_body_fist', name: 'Iron Body Fist', description: 'Hardens the dantian wall.' },
        ],
      }}
      onBuyUpgrade={() => {}}
      onReincarnate={() => {}}
    />);
    expect(screen.getByText(/techniques learned/i)).toBeInTheDocument();
    expect(screen.getByText(/iron body fist/i)).toBeInTheDocument();
  });
  it('shows the locked core path when corePath is set', () => {
    render(<BardoPanel
      payload={{ ...basePayload, corePath: 'iron_mountain' }}
      onBuyUpgrade={() => {}}
      onReincarnate={() => {}}
    />);
    expect(screen.getByText(/core path/i)).toBeInTheDocument();
    expect(screen.getByText(/iron mountain/i)).toBeInTheDocument();
  });
  it('omits the core path section when corePath is null', () => {
    render(<BardoPanel
      payload={{ ...basePayload, corePath: null }}
      onBuyUpgrade={() => {}}
      onReincarnate={() => {}}
    />);
    // Look for a heading specifically — "core path" must not appear as a section heading.
    expect(screen.queryByRole('heading', { name: /^core path$/i })).not.toBeInTheDocument();
  });
});
