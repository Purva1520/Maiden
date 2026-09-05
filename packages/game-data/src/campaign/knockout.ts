import type { CampaignMatchRecord, Standing, Standings } from './types.js';
import { QualificationError } from './rules.js';

/**
 * Checks whether the user's team is within the qualified group-stage bracket (§38, §69, §93).
 */
export function isUserQualified(standings: Standings, userTeamId: string): boolean {
  const user = standings.table.find((s) => s.teamId === userTeamId);
  return Boolean(user && user.qualified);
}

/**
 * Determines the semifinal pairings based on final group-stage standings (§39, §70, §94).
 *
 * Pairings:
 * - Semifinal 1: 1st place vs 4th place
 * - Semifinal 2: 2nd place vs 3rd place
 */
export function determineSemifinalPairings(standings: Standings): {
  sf1: { home: Standing; away: Standing };
  sf2: { home: Standing; away: Standing };
} {
  const q1 = standings.table[0];
  const q2 = standings.table[1];
  const q3 = standings.table[2];
  const q4 = standings.table[3];

  if (!q1 || !q2 || !q3 || !q4) {
    throw new QualificationError(
      'Cannot determine semifinal pairings: fewer than 4 teams in standings.',
    );
  }

  return {
    sf1: { home: q1, away: q4 },
    sf2: { home: q2, away: q3 },
  };
}

/**
 * Resolves the winner of a knockout match, applying Maiden's tie-breaker if tied (§40, §41).
 *
 * If tied: Team with the higher group-stage rank (lower position number) advances.
 */
export function resolveKnockoutWinner(
  matchRecord: CampaignMatchRecord,
  homeStanding: Standing,
  awayStanding: Standing,
): { winnerId: string; winnerName: string; tiedDecidedByStanding: boolean } {
  if (matchRecord.winnerId) {
    return {
      winnerId: matchRecord.winnerId,
      winnerName: matchRecord.winnerName!,
      tiedDecidedByStanding: false,
    };
  }

  // Tied knockout match (§41)
  const homeAdv = homeStanding.position < awayStanding.position;
  const advancing = homeAdv ? homeStanding : awayStanding;

  return {
    winnerId: advancing.teamId,
    winnerName: advancing.teamName,
    tiedDecidedByStanding: true,
  };
}
