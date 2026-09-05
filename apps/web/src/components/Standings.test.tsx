import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Standings } from './Standings.js';
import { sampleStandings } from '../dev-fixtures/index.js';

describe('Standings (§26)', () => {
  it('renders every team with points from Phase 9 standings', () => {
    render(<Standings standings={sampleStandings} qualifiers={4} />);
    expect(screen.getByText('Australia 2007')).toBeInTheDocument();
    expect(screen.getByText(/Maiden XI/)).toBeInTheDocument();
    expect(screen.getByText('+120')).toBeInTheDocument();
  });

  it('shows an empty state before the group stage', () => {
    render(<Standings standings={null} qualifiers={4} />);
    expect(screen.getByText(/Standings appear/i)).toBeInTheDocument();
  });
});
