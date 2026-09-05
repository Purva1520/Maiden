import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamValidation } from './TeamValidation.js';
import { validValidation, invalidValidation } from '../dev-fixtures/index.js';

describe('TeamValidation (§21)', () => {
  it('shows XI Ready when the engine reports valid', () => {
    render(<TeamValidation validation={validValidation} hasPlayers />);
    expect(screen.getByText('XI Ready')).toBeInTheDocument();
    expect(screen.getByText('Bowling options')).toBeInTheDocument();
  });

  it('surfaces the engine error for an invalid XI', () => {
    render(<TeamValidation validation={invalidValidation} hasPlayers />);
    // The first engine error becomes the status banner.
    expect(screen.getByText(/INSUFFICIENT_BOWLING_OPTIONS/)).toBeInTheDocument();
  });

  it('prompts to select players when empty', () => {
    render(<TeamValidation validation={null} hasPlayers={false} />);
    expect(screen.getByText(/Select players/i)).toBeInTheDocument();
  });
});
