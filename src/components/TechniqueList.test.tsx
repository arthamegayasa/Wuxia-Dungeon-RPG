import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TechniqueList } from './TechniqueList';

describe('TechniqueList', () => {
  it('renders an empty-state message when none', () => {
    render(<TechniqueList techniques={[]} />);
    expect(screen.getByText(/no techniques learned/i)).toBeInTheDocument();
  });
  it('lists technique names with id keys', () => {
    render(
      <TechniqueList
        techniques={[
          { id: 'iron_body_fist', name: 'Iron Body Fist' },
          { id: 'still_water_breath', name: 'Still Water Breath' },
        ]}
      />,
    );
    expect(screen.getByText(/iron body fist/i)).toBeInTheDocument();
    expect(screen.getByText(/still water breath/i)).toBeInTheDocument();
  });
});
