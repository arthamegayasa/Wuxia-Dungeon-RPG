import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InventoryPanel } from './InventoryPanel';

describe('InventoryPanel', () => {
  it('renders an empty-state message when no items', () => {
    render(<InventoryPanel items={[]} onClose={() => {}} />);
    expect(screen.getByText(/empty/i)).toBeInTheDocument();
  });
  it('groups items by itemType with headings', () => {
    render(
      <InventoryPanel
        items={[
          { id: 'minor_healing_pill', name: 'Minor Healing Pill', count: 3, itemType: 'pill' },
          { id: 'iron_will_manual', name: 'Iron Will Manual',    count: 1, itemType: 'manual' },
          { id: 'silver_pouch',     name: 'Silver Pouch',        count: 5, itemType: 'misc' },
        ]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/pills/i)).toBeInTheDocument();
    expect(screen.getByText(/manuals/i)).toBeInTheDocument();
    expect(screen.getByText(/misc/i)).toBeInTheDocument();
    expect(screen.getByText(/minor healing pill/i)).toBeInTheDocument();
    expect(screen.getByText(/×3/)).toBeInTheDocument();
  });
  it('fires onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(<InventoryPanel items={[]} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
