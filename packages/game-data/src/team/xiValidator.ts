import type { PlayerCard, XIValidationResult } from './types.js';
import type { TeamRules } from './rules.js';
import { isBowlingOption, isTopOrderCapable } from './bowlingOptions.js';

/**
 * Validates whether a proposed team satisfies Maiden Playing XI constraints (§22–§31, §61–§67).
 *
 * Hard Constraints:
 * 1. Exactly 11 players.
 * 2. At least 1 wicketkeeper (metadata `wicketkeeper === true`).
 * 3. At least 5 bowling options (`isBowlingOption(p)`).
 * 4. At least 2 top-order capable players (`isTopOrderCapable(p)`).
 * 5. No duplicate canonical players (same real person across multiple historical cards).
 * 6. Exactly 1 captain selected, who must belong to the final XI.
 * 7. Batting order of exactly 11 players containing every selected player exactly once.
 *
 * Soft Warnings:
 * - Structural feedback that does not invalidate the XI (e.g. minimal bowling depth, single wicketkeeper).
 */
export function validateXI(
  players: readonly PlayerCard[],
  captainId: string | null,
  battingOrder: readonly string[],
  rules: TeamRules,
): XIValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Player count
  const playerCountValid = players.length === rules.xiSize;
  if (players.length < rules.xiSize) {
    errors.push(
      `XI has ${players.length} players; exactly ${rules.xiSize} required (XI_TOO_SMALL).`,
    );
  } else if (players.length > rules.xiSize) {
    errors.push(
      `XI has ${players.length} players; exactly ${rules.xiSize} required (XI_TOO_LARGE).`,
    );
  }

  // 2. Canonical player duplicate check (same real person cannot occupy two slots)
  const canonicalPlayerIds = new Set<string>();
  let hasDuplicateCanonical = false;
  for (const p of players) {
    if (canonicalPlayerIds.has(p.playerId)) {
      hasDuplicateCanonical = true;
      errors.push(
        `Duplicate player identity: ${p.playerName} (${p.playerId}) selected multiple times (DUPLICATE_PLAYER).`,
      );
    }
    canonicalPlayerIds.add(p.playerId);
  }

  // 3. Wicketkeeper check (unique canonical wicketkeepers)
  const wkPlayers = players.filter((p) => p.wicketkeeper);
  const uniqueWkIds = new Set(wkPlayers.map((p) => p.playerId));
  const wkCount = uniqueWkIds.size;
  const wkValid = wkCount >= rules.minWicketkeepers;
  if (!wkValid) {
    errors.push(
      `XI requires at least ${rules.minWicketkeepers} wicketkeeper; found ${wkCount} (NO_WICKETKEEPER).`,
    );
  } else if (wkCount === 1) {
    warnings.push('Only 1 wicketkeeper in squad (minimal keeping cover).');
  }

  // 4. Bowling options check (unique canonical bowling options)
  const bowlingOptions = players.filter((p) => isBowlingOption(p));
  const uniqueBowlerIds = new Set(bowlingOptions.map((p) => p.playerId));
  const bowlingOptionsCount = uniqueBowlerIds.size;
  const bowlingValid = bowlingOptionsCount >= rules.minBowlingOptions;
  if (!bowlingValid) {
    errors.push(
      `XI requires at least ${rules.minBowlingOptions} bowling options; found ${bowlingOptionsCount} (INSUFFICIENT_BOWLING_OPTIONS).`,
    );
  } else if (bowlingOptionsCount === rules.minBowlingOptions) {
    warnings.push(`Exactly ${rules.minBowlingOptions} bowling options (no sixth-bowler cover).`);
  }

  // 5. Top order check (unique canonical top-order capable players)
  const topOrderPlayers = players.filter((p) => isTopOrderCapable(p));
  const uniqueTopOrderIds = new Set(topOrderPlayers.map((p) => p.playerId));
  const topOrderCount = uniqueTopOrderIds.size;
  const topOrderValid = topOrderCount >= rules.minTopOrder;
  if (!topOrderValid) {
    errors.push(
      `XI requires at least ${rules.minTopOrder} top-order capable players; found ${topOrderCount} (INSUFFICIENT_TOP_ORDER).`,
    );
  }

  // 6. Captain validation
  let captainValid = false;
  if (!captainId) {
    errors.push('No captain selected; a captain from the XI must be designated (INVALID_CAPTAIN).');
  } else {
    const captainInXI = players.some((p) => p.cardId === captainId);
    if (!captainInXI) {
      errors.push(
        `Selected captain (${captainId}) is not part of the playing XI (INVALID_CAPTAIN).`,
      );
    } else {
      captainValid = true;
    }
  }

  // 7. Batting order validation
  let battingOrderValid = false;
  if (battingOrder.length !== rules.xiSize) {
    errors.push(
      `Batting order has ${battingOrder.length} players; expected ${rules.xiSize} (INVALID_BATTING_ORDER).`,
    );
  } else {
    const orderSet = new Set(battingOrder);
    if (orderSet.size !== rules.xiSize) {
      errors.push('Batting order contains duplicates (INVALID_BATTING_ORDER).');
    } else {
      const selectedCards = new Set(players.map((p) => p.cardId));
      let mismatch = false;
      for (const cardId of battingOrder) {
        if (!selectedCards.has(cardId)) {
          mismatch = true;
          errors.push(
            `Player ${cardId} in batting order is not in selected XI (INVALID_BATTING_ORDER).`,
          );
        }
      }
      if (!mismatch) {
        battingOrderValid = true;
      }
    }
  }

  const valid = errors.length === 0;

  return {
    valid,
    checks: {
      playerCount: {
        valid: playerCountValid,
        actual: players.length,
        required: rules.xiSize,
      },
      wicketkeeper: {
        valid: wkValid,
        count: wkCount,
        required: rules.minWicketkeepers,
      },
      bowlingOptions: {
        valid: bowlingValid,
        actual: bowlingOptionsCount,
        required: rules.minBowlingOptions,
      },
      topOrder: {
        valid: topOrderValid,
        actual: topOrderCount,
        required: rules.minTopOrder,
      },
      duplicatePlayers: {
        valid: !hasDuplicateCanonical,
      },
      captain: {
        valid: captainValid,
        captainId,
      },
      battingOrder: {
        valid: battingOrderValid,
        length: battingOrder.length,
      },
    },
    errors,
    warnings,
  };
}
