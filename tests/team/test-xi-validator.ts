import { describe, expect, it } from 'vitest';
import { BASE_TEAM_RULES } from '../../team/rules.js';
import { validateXI } from '../../team/xiValidator.js';
import { createTestPlayerCard, createValidTestXI } from './fixtures.js';

describe('XI Validator (§22–§31, §75)', () => {
  it('validates a complete, legal Playing XI', () => {
    const xi = createValidTestXI();
    const order = xi.map((p) => p.cardId);
    const captainId = 'ms_dhoni__ODI_WC_2011';

    const result = validateXI(xi, captainId, order, BASE_TEAM_RULES);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.checks.playerCount.valid).toBe(true);
    expect(result.checks.wicketkeeper.valid).toBe(true);
    expect(result.checks.bowlingOptions.valid).toBe(true);
    expect(result.checks.topOrder.valid).toBe(true);
    expect(result.checks.captain.valid).toBe(true);
    expect(result.checks.battingOrder.valid).toBe(true);
  });

  it('rejects an XI with fewer than 11 players (10 players)', () => {
    const xi = createValidTestXI().slice(0, 10);
    const order = xi.map((p) => p.cardId);
    const result = validateXI(xi, xi[0]!.cardId, order, BASE_TEAM_RULES);

    expect(result.valid).toBe(false);
    expect(result.checks.playerCount.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('XI_TOO_SMALL'))).toBe(true);
  });

  it('rejects an XI with more than 11 players (12 players)', () => {
    const xi = createValidTestXI();
    const extra = createTestPlayerCard({
      playerId: 'extra_player',
      cardId: 'extra_player__ODI_WC_2011',
      playerName: 'Extra Player',
    });
    const xi12 = [...xi, extra];
    const order = xi12.map((p) => p.cardId);
    const result = validateXI(xi12, xi[0]!.cardId, order, BASE_TEAM_RULES);

    expect(result.valid).toBe(false);
    expect(result.checks.playerCount.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('XI_TOO_LARGE'))).toBe(true);
  });

  it('rejects an XI with zero wicketkeepers', () => {
    const xi = createValidTestXI().map((p) => {
      if (p.wicketkeeper) {
        return createTestPlayerCard({
          ...p,
          role: 'BAT',
          wicketkeeper: false,
        });
      }
      return p;
    });
    const order = xi.map((p) => p.cardId);
    const result = validateXI(xi, xi[0]!.cardId, order, BASE_TEAM_RULES);

    expect(result.valid).toBe(false);
    expect(result.checks.wicketkeeper.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('NO_WICKETKEEPER'))).toBe(true);
  });

  it('rejects an XI with insufficient bowling options (fewer than 5)', () => {
    const xi = createValidTestXI().map((p, idx) => {
      // Convert all bowlers into pure batters except 3
      if (idx > 2 && idx < 9) {
        return createTestPlayerCard({
          ...p,
          role: 'BAT',
          bowlRating: null,
        });
      }
      return p;
    });
    const order = xi.map((p) => p.cardId);
    const result = validateXI(xi, xi[0]!.cardId, order, BASE_TEAM_RULES);

    expect(result.valid).toBe(false);
    expect(result.checks.bowlingOptions.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('INSUFFICIENT_BOWLING_OPTIONS'))).toBe(true);
  });

  it('rejects an XI with fewer than 2 top-order capable players', () => {
    // Make 10 players specialist bowlers and 1 wicketkeeper
    const xi = createValidTestXI().map((p, idx) => {
      if (idx === 0) return p; // 1 top order batter
      if (idx === 4) return p; // 1 WK (WK is top-order capable)
      return createTestPlayerCard({
        ...p,
        role: 'BOWL',
        bowlRating: 80,
      });
    });
    // Now convert the WK to a bowler with wicketkeeper=true (still 1 WK, but only 1 top order capable)
    const xiWith1TopOrder = xi.map((p, idx) => {
      if (idx === 4) {
        return createTestPlayerCard({
          ...p,
          role: 'BOWL', // BOWL is not top order capable
          wicketkeeper: true,
          bowlRating: 80,
        });
      }
      return p;
    });
    const order = xiWith1TopOrder.map((p) => p.cardId);
    const result = validateXI(xiWith1TopOrder, xiWith1TopOrder[0]!.cardId, order, BASE_TEAM_RULES);

    expect(result.valid).toBe(false);
    expect(result.checks.topOrder.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('INSUFFICIENT_TOP_ORDER'))).toBe(true);
  });

  it('rejects duplicate canonical player identities in the XI', () => {
    const xi = createValidTestXI();
    // Replace last player with a duplicate of the first player (different cardId, same playerId)
    const duplicate = createTestPlayerCard({
      playerId: xi[0]!.playerId,
      cardId: `${xi[0]!.playerId}__ODI_WC_2003`,
      playerName: xi[0]!.playerName,
    });
    const xiWithDup = [...xi.slice(0, 10), duplicate];
    const order = xiWithDup.map((p) => p.cardId);

    const result = validateXI(xiWithDup, xi[0]!.cardId, order, BASE_TEAM_RULES);
    expect(result.valid).toBe(false);
    expect(result.checks.duplicatePlayers.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('DUPLICATE_PLAYER'))).toBe(true);
  });

  it('rejects a captain who is not in the XI', () => {
    const xi = createValidTestXI();
    const order = xi.map((p) => p.cardId);
    const externalCaptain = 'wasim_akram__ODI_WC_1992';

    const result = validateXI(xi, externalCaptain, order, BASE_TEAM_RULES);
    expect(result.valid).toBe(false);
    expect(result.checks.captain.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('INVALID_CAPTAIN'))).toBe(true);
  });

  it('rejects a null captain', () => {
    const xi = createValidTestXI();
    const order = xi.map((p) => p.cardId);

    const result = validateXI(xi, null, order, BASE_TEAM_RULES);
    expect(result.valid).toBe(false);
    expect(result.checks.captain.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('INVALID_CAPTAIN'))).toBe(true);
  });
});
