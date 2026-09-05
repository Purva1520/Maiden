import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerCard } from './PlayerCard.js';
import { samplePlayer, sampleAllrounder } from '../dev-fixtures/index.js';

describe('PlayerCard (§16)', () => {
  it('renders the player, role, rating and historical identity', () => {
    render(<PlayerCard player={samplePlayer} />);
    expect(screen.getByText('Sachin Tendulkar')).toBeInTheDocument();
    expect(screen.getByText('94')).toBeInTheDocument();
    expect(screen.getByText('India')).toBeInTheDocument();
    expect(screen.getByText('2003')).toBeInTheDocument(); // historical badge year
  });

  it('marks an elite card as a Legend (presentation only)', () => {
    render(<PlayerCard player={samplePlayer} />); // batRating 94 → Legend
    expect(screen.getByText(/Legend/)).toBeInTheDocument();
  });

  it('shows both ratings for an all-rounder', () => {
    render(<PlayerCard player={sampleAllrounder} />);
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('74')).toBeInTheDocument();
  });

  it('calls onSelect with the cardId when clicked', async () => {
    const onSelect = vi.fn();
    render(<PlayerCard player={samplePlayer} onSelect={onSelect} />);
    await userEvent.click(screen.getByText('Sachin Tendulkar'));
    expect(onSelect).toHaveBeenCalledWith('sachin_tendulkar__ODI_WC_2003');
  });

  it('does not fire onSelect once selected', async () => {
    const onSelect = vi.fn();
    render(<PlayerCard player={samplePlayer} onSelect={onSelect} selected />);
    await userEvent.click(screen.getByText('Sachin Tendulkar'));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
