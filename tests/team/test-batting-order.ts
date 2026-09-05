import { describe, expect, it } from 'vitest';
import {
  createDefaultBattingOrder,
  movePlayer,
  swapPlayers,
  validateBattingOrder,
} from '../../team/battingOrder.js';
import { createValidTestXI } from './fixtures.js';

describe('Batting Order (§36–§41, §76)', () => {
  it('creates a cricket-sensible default batting order with batters at the top and bowlers at the bottom', () => {
    const xi = createValidTestXI();
    const order = createDefaultBattingOrder(xi);

    expect(order).toHaveLength(11);
    expect(new Set(order).size).toBe(11);

    const playerMap = new Map(xi.map((p) => [p.cardId, p]));
    const firstTwo = [playerMap.get(order[0]!)!, playerMap.get(order[1]!)!];
    const lastThree = [
      playerMap.get(order[8]!)!,
      playerMap.get(order[9]!)!,
      playerMap.get(order[10]!)!,
    ];

    // First two must be top-order batters (BAT or WK)
    expect(firstTwo.every((p) => p.role === 'BAT' || p.role === 'WK')).toBe(true);

    // Tailenders must be specialist bowlers
    expect(lastThree.every((p) => p.role === 'BOWL')).toBe(true);
  });

  it('swaps two player positions successfully', () => {
    const xi = createValidTestXI();
    const order = createDefaultBattingOrder(xi);

    const pos0 = order[0]!;
    const pos1 = order[1]!;

    const swapped = swapPlayers(order, pos0, pos1);
    expect(swapped[0]).toBe(pos1);
    expect(swapped[1]).toBe(pos0);

    const validation = validateBattingOrder(
      swapped,
      xi.map((p) => p.cardId),
    );
    expect(validation.valid).toBe(true);
  });

  it('moves a player position and shifts intermediate players', () => {
    const xi = createValidTestXI();
    const order = createDefaultBattingOrder(xi);

    const moved = movePlayer(order, 0, 4);
    expect(moved[4]).toBe(order[0]);
    expect(moved[0]).toBe(order[1]);

    const validation = validateBattingOrder(
      moved,
      xi.map((p) => p.cardId),
    );
    expect(validation.valid).toBe(true);
  });

  it('detects duplicate players in a proposed batting order', () => {
    const xi = createValidTestXI();
    const order = createDefaultBattingOrder(xi);
    const badOrder = [...order];
    badOrder[1] = badOrder[0]!; // duplicate first player

    const validation = validateBattingOrder(
      badOrder,
      xi.map((p) => p.cardId),
    );
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('duplicate'))).toBe(true);
  });

  it('detects missing players in a proposed batting order', () => {
    const xi = createValidTestXI();
    const order = createDefaultBattingOrder(xi).slice(0, 10); // only 10

    const validation = validateBattingOrder(
      order,
      xi.map((p) => p.cardId),
    );
    expect(validation.valid).toBe(false);
  });
});
