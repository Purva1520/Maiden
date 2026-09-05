import type { PlayerCard } from './types.js';

/**
 * Creates a deterministic, cricket-sensible default batting order (1 to 11).
 *
 * Rules & Heuristics (§37-§39):
 * 1. Does NOT simply sort by batRating descending (which would risk putting bowlers above allrounders).
 * 2. Positions 1–2: Top-order capable specialist batters (or best available batters).
 * 3. Positions 3–5: Strongest remaining specialist batters, wicketkeeper, and batting all-rounders.
 * 4. Positions 6–7: Remaining all-rounders / lower-middle order.
 * 5. Positions 8–11: Tailenders / specialist bowlers.
 */
export function createDefaultBattingOrder(players: readonly PlayerCard[]): string[] {
  if (players.length === 0) {
    return [];
  }

  // Assign tier based on cricket role
  // Tier 1: Specialist BAT
  // Tier 2: WK
  // Tier 3: ALLROUNDER
  // Tier 4: BOWL
  const getTier = (p: PlayerCard): number => {
    switch (p.role) {
      case 'BAT':
        return 1;
      case 'WK':
        return 2;
      case 'ALLROUNDER':
        return 3;
      case 'BOWL':
        return 4;
      default:
        return 5;
    }
  };

  const getEffectiveBatRating = (p: PlayerCard): number => {
    if (p.batRating !== null) {
      return p.batRating;
    }
    // Fallback based on role for sorting purposes
    switch (p.role) {
      case 'BAT':
        return 65;
      case 'WK':
        return 60;
      case 'ALLROUNDER':
        return 50;
      case 'BOWL':
        return 20;
      default:
        return 30;
    }
  };

  // Sort primarily by role tier, secondarily by effectiveBatRating descending, tertiarily by cardId
  const sorted = [...players].sort((a, b) => {
    const tierA = getTier(a);
    const tierB = getTier(b);
    if (tierA !== tierB) {
      return tierA - tierB;
    }
    const batA = getEffectiveBatRating(a);
    const batB = getEffectiveBatRating(b);
    if (batB !== batA) {
      return batB - batA;
    }
    return a.cardId.localeCompare(b.cardId);
  });

  return sorted.map((p) => p.cardId);
}

/**
 * Swaps positions of two players in the batting order.
 */
export function swapPlayers(
  currentOrder: readonly string[],
  cardIdA: string,
  cardIdB: string,
): string[] {
  const indexA = currentOrder.indexOf(cardIdA);
  const indexB = currentOrder.indexOf(cardIdB);

  if (indexA === -1 || indexB === -1) {
    throw new Error(
      `Cannot swap: one or both players not in batting order (${cardIdA}, ${cardIdB})`,
    );
  }

  const next = [...currentOrder];
  next[indexA] = cardIdB;
  next[indexB] = cardIdA;
  return next;
}

/**
 * Moves a player from one batting position to another, shifting others accordingly.
 */
export function movePlayer(
  currentOrder: readonly string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  if (
    fromIndex < 0 ||
    fromIndex >= currentOrder.length ||
    toIndex < 0 ||
    toIndex >= currentOrder.length
  ) {
    throw new Error(
      `Cannot move player: index out of bounds (from: ${fromIndex}, to: ${toIndex}, length: ${currentOrder.length})`,
    );
  }

  const next = [...currentOrder];
  const [removed] = next.splice(fromIndex, 1);
  if (removed !== undefined) {
    next.splice(toIndex, 0, removed);
  }
  return next;
}

/**
 * Validates whether a proposed batting order is complete and legal for the selected XI.
 */
export function validateBattingOrder(
  order: readonly string[],
  selectedPlayerCardIds: readonly string[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (order.length !== selectedPlayerCardIds.length) {
    errors.push(
      `Batting order length (${order.length}) does not match selected player count (${selectedPlayerCardIds.length})`,
    );
  }

  const orderSet = new Set(order);
  if (orderSet.size !== order.length) {
    errors.push('Batting order contains duplicate players');
  }

  const selectedSet = new Set(selectedPlayerCardIds);
  for (const cardId of order) {
    if (!selectedSet.has(cardId)) {
      errors.push(`Player ${cardId} in batting order is not in selected XI`);
    }
  }

  for (const cardId of selectedPlayerCardIds) {
    if (!orderSet.has(cardId)) {
      errors.push(`Selected player ${cardId} is missing from batting order`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Replaces the entire batting order with a new list, ensuring completeness.
 */
export function setBattingOrder(
  newOrder: readonly string[],
  selectedPlayerCardIds: readonly string[],
): string[] {
  const check = validateBattingOrder(newOrder, selectedPlayerCardIds);
  if (!check.valid) {
    throw new Error(`Invalid batting order: ${check.errors.join('; ')}`);
  }
  return [...newOrder];
}
