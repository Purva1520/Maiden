/**
 * Deterministic fixtures for UI development and tests (§50, §63). These are
 * shaped exactly like the domain models but are NOT production game data — never
 * import them into runtime screens.
 */
import type { PlayerCard, XIValidationResult, Standings, MatchResult } from '../lib/domain.js';

export const samplePlayer: PlayerCard = {
  playerId: 'sachin_tendulkar',
  cardId: 'sachin_tendulkar__ODI_WC_2003',
  playerName: 'Sachin Tendulkar',
  format: 'ODI',
  tournamentId: 'ODI_WC_2003',
  year: 2003,
  teamName: 'India',
  role: 'BAT',
  wicketkeeper: false,
  participated: true,
  batRating: 94,
  bowlRating: null,
  ratingVersion: 'v1',
};

export const sampleAllrounder: PlayerCard = {
  playerId: 'jacques_kallis',
  cardId: 'jacques_kallis__ODI_WC_1999',
  playerName: 'Jacques Kallis',
  format: 'ODI',
  tournamentId: 'ODI_WC_1999',
  year: 1999,
  teamName: 'South Africa',
  role: 'ALLROUNDER',
  wicketkeeper: false,
  participated: true,
  batRating: 88,
  bowlRating: 74,
  ratingVersion: 'v1',
};

export const validValidation: XIValidationResult = {
  valid: true,
  checks: {
    playerCount: { valid: true, actual: 11, required: 11 },
    wicketkeeper: { valid: true, count: 1, required: 1 },
    bowlingOptions: { valid: true, actual: 6, required: 5 },
    topOrder: { valid: true, actual: 3, required: 2 },
    duplicatePlayers: { valid: true },
    captain: { valid: true, captainId: 'c1' },
    battingOrder: { valid: true, length: 11 },
  },
  errors: [],
  warnings: [],
};

export const invalidValidation: XIValidationResult = {
  valid: false,
  checks: {
    playerCount: { valid: true, actual: 11, required: 11 },
    wicketkeeper: { valid: true, count: 1, required: 1 },
    bowlingOptions: { valid: false, actual: 4, required: 5 },
    topOrder: { valid: true, actual: 2, required: 2 },
    duplicatePlayers: { valid: true },
    captain: { valid: false, captainId: null },
    battingOrder: { valid: true, length: 11 },
  },
  errors: ['XI requires at least 5 bowling options; found 4 (INSUFFICIENT_BOWLING_OPTIONS).'],
  warnings: [],
};

export const sampleStandings: Standings = {
  recalculatedAtFixtureIndex: 4,
  table: [
    mkStanding('opp1', 'Australia 2007', false, 2, 0, 4, 120, 1),
    mkStanding('user', 'Maiden XI', true, 1, 1, 2, -10, 2),
    mkStanding('opp2', 'India 2011', false, 1, 1, 2, -30, 3),
    mkStanding('opp3', 'Pakistan 1999', false, 0, 2, 0, -80, 4),
  ],
};

function mkStanding(
  teamId: string,
  teamName: string,
  isUser: boolean,
  wins: number,
  losses: number,
  points: number,
  rd: number,
  position: number,
): Standings['table'][number] {
  return {
    teamId,
    teamName,
    isUser,
    played: wins + losses,
    wins,
    losses,
    ties: 0,
    points,
    runsFor: 500,
    runsAgainst: 500 - rd,
    wicketsFor: 10,
    wicketsAgainst: 10,
    ballsFor: 300,
    ballsAgainst: 300,
    runDifferential: rd,
    qualified: position <= 4,
    position,
  };
}

/** Minimal two-ball innings that ends on a wicket — exercises the wicket view. */
export const tinyMatch: MatchResult = {
  format: 'T20',
  teamA: { id: 'A', name: 'Team A' },
  teamB: { id: 'B', name: 'Team B' },
  toss: { winnerId: 'A', winnerName: 'Team A', decision: 'bat' },
  seed: 1,
  simulationVersion: 'v1',
  configVersion: 'v1',
  result: {
    type: 'WIN_BY_RUNS',
    winnerId: 'A',
    winnerName: 'Team A',
    marginRuns: 4,
    marginWickets: null,
    ballsRemaining: null,
    text: 'Team A won by 4 runs',
  },
  innings1: {
    inningsNumber: 1,
    battingTeamId: 'A',
    battingTeamName: 'Team A',
    bowlingTeamId: 'B',
    runs: 4,
    wickets: 1,
    legalBalls: 2,
    allOut: false,
    targetReached: false,
    battingCard: [],
    bowlingCard: [],
    fallOfWickets: [],
    events: [],
  },
  innings2: {
    inningsNumber: 2,
    battingTeamId: 'B',
    battingTeamName: 'Team B',
    bowlingTeamId: 'A',
    runs: 0,
    wickets: 1,
    legalBalls: 1,
    allOut: false,
    targetReached: false,
    battingCard: [],
    bowlingCard: [],
    fallOfWickets: [],
    events: [],
  },
  events: [
    {
      type: 'DELIVERY',
      inningsNumber: 1,
      over: 0,
      ball: 1,
      batter: 'Alpha',
      bowler: 'Zeta',
      outcome: 'FOUR',
      runs: 4,
      scoreAfter: '4/0',
    },
    // Wicket ball: engine records scoreAfter with the *pre-wicket* wicket count.
    {
      type: 'DELIVERY',
      inningsNumber: 1,
      over: 0,
      ball: 2,
      batter: 'Alpha',
      bowler: 'Zeta',
      outcome: 'WICKET',
      runs: 0,
      scoreAfter: '4/0',
    },
  ],
};
