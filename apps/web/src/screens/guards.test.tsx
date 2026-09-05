import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StoreProvider } from '../state/store.js';
import { Match } from './Match.js';
import { Campaign } from './Campaign.js';
import { Result } from './Result.js';

function renderScreen(node: React.ReactElement): void {
  render(
    <StoreProvider>
      <MemoryRouter>{node}</MemoryRouter>
    </StoreProvider>,
  );
}

/**
 * Route guards (§114, §159): entering a screen without its prerequisites must
 * show a safe recovery state — never a blank page or a runtime crash.
 */
describe('route guards', () => {
  beforeEach(() => localStorage.clear());

  it('Match without a campaign shows recovery, not a crash', () => {
    renderScreen(<Match />);
    expect(screen.getByText(/no match to display/i)).toBeInTheDocument();
  });

  it('Result without a completed match shows recovery', () => {
    renderScreen(<Result />);
    expect(screen.getByText(/no result to display/i)).toBeInTheDocument();
  });

  it('Campaign without an active campaign shows recovery', () => {
    renderScreen(<Campaign />);
    expect(screen.getByText(/no active campaign/i)).toBeInTheDocument();
  });
});
