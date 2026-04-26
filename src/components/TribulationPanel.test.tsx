import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TribulationPanel } from './TribulationPanel';

const samplePayload = {
  pillarId: 'tribulation_i' as const,
  phases: [
    { phaseId: 'heart_demon',    success: true,  chance: 70, roll: 22 },
    { phaseId: 'first_thunder',  success: true,  chance: 60, roll: 38 },
    { phaseId: 'second_thunder', success: false, chance: 45, roll: 88 },
    { phaseId: 'third_thunder',  success: false, chance: 30, roll: 99 },
  ],
  fatal: false,
};

describe('TribulationPanel', () => {
  it('renders all four phase rows with phase id, chance, roll, and success indicator', () => {
    render(<TribulationPanel payload={samplePayload} onContinue={() => {}} />);
    expect(screen.getByText(/heart demon/i)).toBeInTheDocument();
    expect(screen.getByText(/first thunder/i)).toBeInTheDocument();
    expect(screen.getByText(/second thunder/i)).toBeInTheDocument();
    expect(screen.getByText(/third thunder/i)).toBeInTheDocument();
    const successMarkers = screen.getAllByLabelText(/passed/i);
    const failMarkers = screen.getAllByLabelText(/failed/i);
    expect(successMarkers).toHaveLength(2);
    expect(failMarkers).toHaveLength(2);
  });
  it('shows "Tribulation Endured" for non-fatal outcome', () => {
    render(<TribulationPanel payload={samplePayload} onContinue={() => {}} />);
    expect(screen.getByText(/tribulation endured/i)).toBeInTheDocument();
  });
  it('fires onContinue on button click', async () => {
    const onContinue = vi.fn();
    render(<TribulationPanel payload={samplePayload} onContinue={onContinue} />);
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
