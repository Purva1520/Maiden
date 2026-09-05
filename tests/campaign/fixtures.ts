/**
 * Test fixtures and helpers for Phase 9 Campaign tests.
 */
import {
  createGame,
  finalizeXI,
  selectPlayerInDraft,
  setCaptainInDraft,
} from '../../team/gameState.js';
import type { MaidenTeam } from '../../team/types.js';
import { createValidTestXI } from '../team/fixtures.js';
import type {
  CampaignMatchRecord,
  CampaignOpponent,
  Fixture,
  Standing,
} from '../../campaign/types.js';
import { toSimulatorTeam } from '../../team/adapter.js';

export function createValidTestMaidenTeam(
  format: 'ODI' | 'T20' = 'ODI',
  name = 'Maiden All-Stars',
): MaidenTeam {
  const validXI = createValidTestXI();
  let state = createGame(format, 849273);
  state = {
    ...state,
    availablePool: validXI,
    status: 'DRAFTING',
  };

  for (const player of validXI) {
    state = selectPlayerInDraft(state, player.cardId);
  }
  state = setCaptainInDraft(state, 'ms_dhoni__ODI_WC_2011');

  const { team } = finalizeXI(state, name);
  return team;
}

export function createTestOpponent(overrides?: Partial<CampaignOpponent>): CampaignOpponent {
  const team = createValidTestMaidenTeam('ODI', overrides?.displayName ?? 'Australia 2007');
  const simTeam = toSimulatorTeam(team);

  return {
    opponentId: overrides?.opponentId ?? 'opp_aus_2007',
    historicalTeamId: overrides?.historicalTeamId ?? 'Australia',
    historicalTournamentId: overrides?.historicalTournamentId ?? 'ODI_WC_2007',
    year: overrides?.year ?? 2007,
    format: overrides?.format ?? 'ODI',
    displayName: overrides?.displayName ?? 'Australia 2007',
    team: simTeam,
    roster: team.players,
    ...overrides,
  };
}

export function createTestFixture(overrides?: Partial<Fixture>): Fixture {
  return {
    fixtureId: 'grp_r1_m1',
    stage: 'GROUP',
    matchNumber: 1,
    round: 1,
    homeTeamId: 'user_team',
    awayTeamId: 'opp_aus_2007',
    homeTeamName: 'Maiden All-Stars',
    awayTeamName: 'Australia 2007',
    status: 'SCHEDULED',
    matchSeed: 12345,
    isUserMatch: true,
    ...overrides,
  };
}

export function createTestMatchRecord(
  overrides?: Partial<CampaignMatchRecord>,
): CampaignMatchRecord {
  return {
    fixtureId: 'grp_r1_m1',
    stage: 'GROUP',
    matchNumber: 1,
    matchSeed: 12345,
    homeTeamId: 'user_team',
    awayTeamId: 'opp_aus_2007',
    homeTeamName: 'Maiden All-Stars',
    awayTeamName: 'Australia 2007',
    winnerId: 'user_team',
    winnerName: 'Maiden All-Stars',
    isTie: false,
    userInvolved: true,
    userWon: true,
    homeScore: { runs: 280, wickets: 6, balls: 300 },
    awayScore: { runs: 215, wickets: 10, balls: 266 },
    userScore: { runs: 280, wickets: 6, balls: 300 },
    opponentScore: { runs: 215, wickets: 10, balls: 266 },
    marginType: 'RUNS',
    marginValue: 65,
    ballsRemaining: 0,
    isThrashing: true,
    summaryText: 'Maiden All-Stars won by 65 runs',
    ...overrides,
  };
}

export function createMockStanding(
  teamId: string,
  teamName: string,
  overrides?: Partial<Standing>,
): Standing {
  return {
    position: 1,
    teamId,
    teamName,
    isUser: teamId === 'user_team',
    played: 7,
    wins: 7,
    losses: 0,
    ties: 0,
    points: 14,
    runsFor: 1950,
    runsAgainst: 1520,
    wicketsFor: 70,
    wicketsAgainst: 42,
    ballsFor: 2100,
    ballsAgainst: 2040,
    runDifferential: 430,
    qualified: true,
    ...overrides,
  };
}
