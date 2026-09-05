import { describe, expect, it } from 'vitest';
import {
  getBowlingOptions,
  isBowlingOption,
  isTopOrderCapable,
} from '../../team/bowlingOptions.js';
import { createTestPlayerCard, createValidTestXI } from './fixtures.js';

describe('Bowling Options (§42, §43, §64, §77)', () => {
  it('identifies specialist bowlers and all-rounders as bowling options', () => {
    const bowler = createTestPlayerCard({
      playerId: 'glenn_mcgrath',
      cardId: 'glenn_mcgrath__ODI_WC_2007',
      playerName: 'Glenn McGrath',
      role: 'BOWL',
      bowlRating: 94,
    });
    const allrounder = createTestPlayerCard({
      playerId: 'yuvraj_singh',
      cardId: 'yuvraj_singh__ODI_WC_2011',
      playerName: 'Yuvraj Singh',
      role: 'ALLROUNDER',
      bowlRating: 75,
    });
    const batter = createTestPlayerCard({
      playerId: 'virender_sehwag',
      cardId: 'virender_sehwag__ODI_WC_2011',
      playerName: 'Virender Sehwag',
      role: 'BAT',
      bowlRating: null,
    });
    const keeper = createTestPlayerCard({
      playerId: 'ms_dhoni',
      cardId: 'ms_dhoni__ODI_WC_2011',
      playerName: 'MS Dhoni',
      role: 'WK',
      wicketkeeper: true,
      bowlRating: null,
    });

    expect(isBowlingOption(bowler)).toBe(true);
    expect(isBowlingOption(allrounder)).toBe(true);
    expect(isBowlingOption(batter)).toBe(false);
    expect(isBowlingOption(keeper)).toBe(false);
  });

  it('identifies top-order capable players properly', () => {
    const batter = createTestPlayerCard({
      playerId: 'sachin_tendulkar',
      cardId: 'sachin_tendulkar__ODI_WC_2011',
      playerName: 'Sachin Tendulkar',
      role: 'BAT',
    });
    const keeper = createTestPlayerCard({
      playerId: 'ms_dhoni',
      cardId: 'ms_dhoni__ODI_WC_2011',
      playerName: 'MS Dhoni',
      role: 'WK',
      wicketkeeper: true,
    });
    const bowler = createTestPlayerCard({
      playerId: 'zaheer_khan',
      cardId: 'zaheer_khan__ODI_WC_2011',
      playerName: 'Zaheer Khan',
      role: 'BOWL',
    });

    expect(isTopOrderCapable(batter)).toBe(true);
    expect(isTopOrderCapable(keeper)).toBe(true);
    expect(isTopOrderCapable(bowler)).toBe(false);
  });

  it('partitions bowling options into primary (specialist) and secondary (allrounders)', () => {
    const xi = createValidTestXI();
    const result = getBowlingOptions(xi);

    // In createValidTestXI, there are:
    // 5 specialist bowlers (Harbhajan, Zaheer, McGrath, Munaf, Shoaib)
    // 3 secondary bowling options (Yuvraj, Watson, and Tendulkar with bowlRating 42)
    expect(result.primary.length).toBe(5);
    expect(result.secondary.length).toBe(3);
    expect(result.all.length).toBe(8);

    expect(result.primary.every((b) => b.isSpecialist)).toBe(true);
    expect(result.secondary.every((b) => !b.isSpecialist)).toBe(true);
  });

  it('does not count duplicate canonical players twice toward bowling capacity', () => {
    const bowler2007 = createTestPlayerCard({
      playerId: 'zaheer_khan',
      cardId: 'zaheer_khan__ODI_WC_2007',
      playerName: 'Zaheer Khan',
      role: 'BOWL',
      bowlRating: 88,
    });
    const bowler2011 = createTestPlayerCard({
      playerId: 'zaheer_khan',
      cardId: 'zaheer_khan__ODI_WC_2011',
      playerName: 'Zaheer Khan',
      role: 'BOWL',
      bowlRating: 90,
    });

    const result = getBowlingOptions([bowler2007, bowler2011]);
    expect(result.all.length).toBe(1);
  });
});
