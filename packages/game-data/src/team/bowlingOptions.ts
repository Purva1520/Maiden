import type { BowlingOption, PlayerCard } from './types.js';

/**
 * Source of truth for whether a player card represents a viable bowling option.
 *
 * A player is a bowling option if:
 * 1. Their designated role is 'BOWL' (specialist bowler), OR
 * 2. Their designated role is 'ALLROUNDER' (all-rounder), OR
 * 3. They have an explicit, non-null bowling rating of at least 30.
 *
 * Pure specialist batters and wicketkeepers without bowling roles or skills
 * are not bowling options.
 */
export function isBowlingOption(player: PlayerCard): boolean {
  if (player.role === 'BOWL' || player.role === 'ALLROUNDER') {
    return true;
  }
  if (player.bowlRating !== null && player.bowlRating >= 30) {
    return true;
  }
  return false;
}

/**
 * Source of truth for whether a player card is capable of opening / batting in the top order (positions 1-3).
 *
 * Batsmen and top-order capable wicketkeepers satisfy this requirement.
 */
export function isTopOrderCapable(player: PlayerCard): boolean {
  return player.role === 'BAT' || player.role === 'WK';
}

/**
 * Computes the bowling options from a collection of player cards,
 * partitioning into primary (specialist bowlers) and secondary (all-rounders / part-timers).
 *
 * Canonical duplicates are deduplicated so each real-world player contributes at most one bowling option.
 */
export function getBowlingOptions(players: readonly PlayerCard[]): {
  primary: readonly BowlingOption[];
  secondary: readonly BowlingOption[];
  all: readonly BowlingOption[];
} {
  const seenPlayerIds = new Set<string>();
  const primary: BowlingOption[] = [];
  const secondary: BowlingOption[] = [];

  for (const player of players) {
    if (!isBowlingOption(player)) {
      continue;
    }
    if (seenPlayerIds.has(player.playerId)) {
      continue;
    }
    seenPlayerIds.add(player.playerId);

    const isSpecialist = player.role === 'BOWL';
    const opt: BowlingOption = {
      playerId: player.playerId,
      cardId: player.cardId,
      playerName: player.playerName,
      bowlRating: player.bowlRating,
      role: player.role,
      isSpecialist,
    };

    if (isSpecialist) {
      primary.push(opt);
    } else {
      secondary.push(opt);
    }
  }

  // Sort deterministically: highest bowlRating first, then name
  const sortFn = (a: BowlingOption, b: BowlingOption) => {
    const rateA = a.bowlRating ?? (a.isSpecialist ? 75 : 60);
    const rateB = b.bowlRating ?? (b.isSpecialist ? 75 : 60);
    if (rateB !== rateA) return rateB - rateA;
    return a.playerName.localeCompare(b.playerName);
  };

  primary.sort(sortFn);
  secondary.sort(sortFn);

  return {
    primary,
    secondary,
    all: [...primary, ...secondary],
  };
}
