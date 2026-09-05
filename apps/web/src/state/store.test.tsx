import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StoreProvider } from './store.js';
import { Home } from '../screens/Home.js';

function renderApp(): void {
  render(
    <StoreProvider>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </StoreProvider>,
  );
}

/** Never trust localStorage (Phase 12 §71). Corrupt saves must recover to fresh. */
describe('save recovery (§71)', () => {
  beforeEach(() => localStorage.clear());

  it('starts fresh when the save is not valid JSON', () => {
    localStorage.setItem('maiden_save_v1', '{not valid json');
    renderApp();
    expect(screen.getByRole('link', { name: /play maiden/i })).toBeInTheDocument();
  });

  it('discards a save with a mismatched schema version', () => {
    localStorage.setItem(
      'maiden_save_v1',
      JSON.stringify({ version: 999, format: 'ODI', gameState: {}, campaign: {} }),
    );
    renderApp();
    // Fresh state → the primary CTA is Play, not Resume.
    expect(screen.getByRole('link', { name: /play maiden/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /resume game/i })).not.toBeInTheDocument();
  });

  it('restores a valid save (shows Resume)', () => {
    localStorage.setItem(
      'maiden_save_v1',
      JSON.stringify({
        version: 1,
        format: 'ODI',
        seed: 42,
        gameState: { rolledTeams: [{ tournamentId: 't' }] },
        team: null,
        campaign: null,
        viewMatchIndex: null,
      }),
    );
    renderApp();
    expect(screen.getByRole('link', { name: /resume game/i })).toBeInTheDocument();
  });
});
