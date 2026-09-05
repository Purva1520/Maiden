import type { PlayerCard, XIFormation } from './types.js';
import { isBowlingOption } from './bowlingOptions.js';

/**
 * Builds the structural cricket formation metadata for an XI.
 *
 * Captures batting brackets (top order, middle order, lower order, tail)
 * and bowling breakdown (wicketkeepers, bowling options, specialist bowlers, all-rounders).
 */
export function buildFormation(
  players: readonly PlayerCard[],
  battingOrder: readonly string[],
): XIFormation {
  const playerMap = new Map(players.map((p) => [p.cardId, p]));

  const topOrder = battingOrder.slice(0, 2);
  const middleOrder = battingOrder.slice(2, 5);
  const lowerOrder = battingOrder.slice(5, 7);
  const tail = battingOrder.slice(7, 11);

  const wicketkeepers: string[] = [];
  const bowlingOptions: string[] = [];
  const specialistBowlers: string[] = [];
  const allRounders: string[] = [];

  for (const cardId of battingOrder) {
    const p = playerMap.get(cardId);
    if (!p) continue;

    if (p.wicketkeeper) {
      wicketkeepers.push(cardId);
    }
    if (isBowlingOption(p)) {
      bowlingOptions.push(cardId);
    }
    if (p.role === 'BOWL') {
      specialistBowlers.push(cardId);
    }
    if (p.role === 'ALLROUNDER') {
      allRounders.push(cardId);
    }
  }

  return {
    topOrder,
    middleOrder,
    lowerOrder,
    tail,
    wicketkeepers,
    bowlingOptions,
    specialistBowlers,
    allRounders,
  };
}
