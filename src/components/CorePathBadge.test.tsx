import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/react';
import { CorePathBadge } from './CorePathBadge';

describe('CorePathBadge', () => {
  it('renders "Wandering" when corePath is null', () => {
    render(<CorePathBadge corePath={null} revealedThisTurn={false} />);
    expect(screen.getByText(/wandering/i)).toBeInTheDocument();
  });
  it('renders the path name when set', () => {
    render(<CorePathBadge corePath="iron_mountain" revealedThisTurn={false} />);
    expect(screen.getByText(/iron mountain/i)).toBeInTheDocument();
  });
  it('applies shimmer class when revealedThisTurn is true', () => {
    const { container } = render(<CorePathBadge corePath="severing_edge" revealedThisTurn />);
    const badge = container.querySelector('[data-testid="core-path-badge"]')!;
    expect(badge.className).toMatch(/animate-pulse/);
    expect(badge.className).toMatch(/ring/);
  });
  it('does not apply shimmer when revealedThisTurn is false', () => {
    const { container } = render(<CorePathBadge corePath="severing_edge" revealedThisTurn={false} />);
    const badge = container.querySelector('[data-testid="core-path-badge"]')!;
    expect(badge.className).not.toMatch(/animate-pulse/);
  });
});
