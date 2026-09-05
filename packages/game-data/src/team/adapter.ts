import type { Team as SimulatorTeam, PlayerContext } from '@maiden/simulator';
import type { MaidenTeam, PlayerCard, PlayerRole } from './types.js';
import { isBowlingOption } from './bowlingOptions.js';

export function fallbackBatRating(role: PlayerRole): number {
  switch (role) {
    case 'BAT':
      return 65;
    case 'WK':
      return 60;
    case 'ALLROUNDER':
      return 52;
    case 'BOWL':
      return 22;
    default:
      return 35;
  }
}

export function fallbackBowlRating(role: PlayerRole): number {
  switch (role) {
    case 'BOWL':
      return 78;
    case 'ALLROUNDER':
      return 68;
    case 'BAT':
    case 'WK':
      return 50;
    default:
      return 55;
  }
}

/**
 * Adapts a finalized MaidenTeam into an engine-compatible Team for Phase 6/7 simulation (§46, §86, §87).
 *
 * Keeps the simulation engine DB- and game-state-agnostic.
 */
export function toSimulatorTeam(maidenTeam: MaidenTeam): SimulatorTeam {
  const playerMap = new Map<string, PlayerCard>(maidenTeam.players.map((p) => [p.cardId, p]));

  const simulatorPlayers: PlayerContext[] = maidenTeam.battingOrder.map((cardId) => {
    const card = playerMap.get(cardId);
    if (!card) {
      throw new Error(`Player card ${cardId} in batting order is not present in team roster.`);
    }

    const batRating = card.batRating ?? fallbackBatRating(card.role);
    const bowlRating = isBowlingOption(card)
      ? (card.bowlRating ?? fallbackBowlRating(card.role))
      : null;

    return {
      id: card.cardId,
      name: `${card.playerName} (${card.year})`,
      batRating,
      bowlRating,
    };
  });

  return {
    id: maidenTeam.teamId,
    name: maidenTeam.name,
    players: simulatorPlayers,
  };
}
