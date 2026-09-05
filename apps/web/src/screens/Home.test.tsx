import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Home } from './Home.js';
import { StoreProvider } from '../state/store.js';

function renderHome(): void {
  render(
    <StoreProvider>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </StoreProvider>,
  );
}

describe('Home (§11)', () => {
  beforeEach(() => localStorage.clear());

  it('renders the pitch and a Play call to action', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    const play = screen.getByRole('link', { name: /play maiden/i });
    expect(play).toHaveAttribute('href', '/format');
  });

  it('explains the game loop', () => {
    renderHome();
    expect(screen.getByText(/Roll three historical World Cup squads/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Invincible/i).length).toBeGreaterThan(0);
  });
});
