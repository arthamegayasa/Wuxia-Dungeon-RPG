import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodexScreen } from './CodexScreen';
import type { CodexSnapshot } from '@/services/engineBridge';

const EMPTY: CodexSnapshot = { echoes: [], memories: [], anchors: [], techniques: [] };

const POPULATED: CodexSnapshot = {
  echoes: [
    { id: 'iron_body', name: 'Iron Body', description: 'Your bones remember the forge.', tier: 'partial', unlocked: true, unlockHint: 'Reach Body Tempering 5', effectsSummary: '+20% HP · +10% body cultivation' },
    { id: 'sword_memory', name: 'Sword Memory', description: 'A blade you cannot recall.', tier: 'fragment', unlocked: false, unlockHint: 'Make 100+ sword choices across lives', effectsSummary: '+15 melee' },
  ],
  memories: [
    { id: 'frost_palm_severing', name: 'Frost Palm Severing', description: 'A cold edge.', element: 'water', level: 'partial', witnessFlavour: 'memory.witness.frost_palm_severing.partial', manifested: false, manifestFlavour: null },
    { id: 'silent_waters_scripture', name: 'Scripture of Silent Waters', description: 'Pages drift.', element: 'water', level: 'unseen', witnessFlavour: null, manifested: false, manifestFlavour: null },
  ],
  anchors: [
    { id: 'peasant_farmer', name: 'Peasant Farmer', description: 'Born to the soil.', unlocked: true, unlockHint: 'Available from the start', karmaMultiplier: 1.0 },
    { id: 'martial_family', name: 'Martial Family', description: 'Hard fists.', unlocked: false, unlockHint: 'Reach Body Tempering 5 in any past life', karmaMultiplier: 0.9 },
  ],
  techniques: [],
};

describe('CodexScreen', () => {
  it('renders three tabs: Memories, Echoes, Anchors', () => {
    render(<CodexScreen snapshot={EMPTY} onBack={() => {}} />);
    expect(screen.getByRole('tab', { name: /memories/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /echoes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /anchors/i })).toBeInTheDocument();
  });

  it('shows an empty-state hint on each tab when nothing is populated', () => {
    render(<CodexScreen snapshot={EMPTY} onBack={() => {}} />);
    // Default tab is Memories per spec.
    expect(screen.getByText(/seen nowhere yet/i)).toBeInTheDocument();
  });

  it('renders unlocked echoes with effect summary; locked echoes as silhouettes with hint', async () => {
    render(<CodexScreen snapshot={POPULATED} onBack={() => {}} />);
    await userEvent.click(screen.getByRole('tab', { name: /echoes/i }));
    expect(screen.getByText('Iron Body')).toBeInTheDocument();
    expect(screen.getByText(/\+20% HP · \+10% body cultivation/)).toBeInTheDocument();
    // Locked echo: name hidden, hint shown.
    expect(screen.queryByText('Sword Memory')).not.toBeInTheDocument();
    expect(screen.getByText(/100\+ sword choices/)).toBeInTheDocument();
  });

  it('renders memory tab with level badge and silhouettes for unseen memories', async () => {
    render(<CodexScreen snapshot={POPULATED} onBack={() => {}} />);
    // Default tab is Memories.
    expect(screen.getByText('Frost Palm Severing')).toBeInTheDocument();
    expect(screen.getByText(/partial/i)).toBeInTheDocument();
    // Unseen: name silhouetted.
    expect(screen.queryByText('Scripture of Silent Waters')).not.toBeInTheDocument();
  });

  it('renders anchors tab with unlock hint for locked anchors', async () => {
    render(<CodexScreen snapshot={POPULATED} onBack={() => {}} />);
    await userEvent.click(screen.getByRole('tab', { name: /anchors/i }));
    expect(screen.getByText('Peasant Farmer')).toBeInTheDocument();
    expect(screen.queryByText('Martial Family')).not.toBeInTheDocument();
    expect(screen.getByText(/body tempering 5 in any past life/i)).toBeInTheDocument();
  });

  it('calls onBack when the back button is clicked', async () => {
    const onBack = vi.fn();
    render(<CodexScreen snapshot={EMPTY} onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
