import { simulateMatch, type Team as SimulatorTeam } from '@maiden/simulator';
import { toSimulatorTeam } from '../team/adapter.js';
import type { CricketFormat, MaidenTeam } from '../team/types.js';
import type {
  CampaignMatchRecord,
  CampaignOpponent,
  CampaignResult,
  CampaignRulesConfig,
  CampaignState,
  Fixture,
  ThrashingConfig,
} from './types.js';
import {
  CampaignAlreadyStartedError,
  CampaignCompletedError,
  FixtureAlreadyPlayedError,
  InvalidCampaignStateError,
  NoNextFixtureError,
  UnsupportedCampaignVersionError,
  getFormatCampaignRules,
  loadCampaignRules,
} from './rules.js';
import { generateHistoricalOpponents } from './opponentGenerator.js';
import {
  generateFinalFixture,
  generateRoundRobinFixtures,
  generateSemifinalFixtures,
} from './fixtures.js';
import { createInitialStandings, updateStandings } from './standings.js';
import { determineSemifinalPairings, isUserQualified, resolveKnockoutWinner } from './knockout.js';
import { resolveChampionship } from './final.js';
import { evaluateCampaignAchievements, isMatchThrashing } from './achievements.js';

export const CAMPAIGN_SCHEMA_VERSION = 1;

/**
 * Creates a new Maiden World Cup campaign (§6, §7, §48, §87).
 */
export function createCampaign(
  userTeam: MaidenTeam,
  format: CricketFormat,
  seed: number,
  rulesConfig: CampaignRulesConfig = loadCampaignRules(),
): CampaignState {
  if (userTeam.format !== format) {
    throw new InvalidCampaignStateError(
      `User team format (${userTeam.format}) does not match campaign format (${format})`,
    );
  }

  if (userTeam.players.length !== 11) {
    throw new InvalidCampaignStateError(
      `User team must have exactly 11 players; received ${userTeam.players.length}`,
    );
  }

  const campaignId = `campaign_${format.toLowerCase()}_${seed}`;

  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    campaignId,
    format,
    seed,
    campaignRulesVersion: rulesConfig.version,
    userTeam,
    opponents: [],
    fixtures: [],
    currentFixtureIndex: 0,
    completedMatches: [],
    standings: { table: [], recalculatedAtFixtureIndex: 0 },
    status: 'NOT_STARTED',
    result: null,
  };
}

/**
 * Initializes and starts the campaign: generates historical opponents, initial standings, and round-robin fixtures (§20–§23).
 */
export function startCampaign(
  state: CampaignState,
  rulesConfig: CampaignRulesConfig = loadCampaignRules(),
): CampaignState {
  if (state.status !== 'NOT_STARTED') {
    throw new CampaignAlreadyStartedError(`Cannot start campaign in status: ${state.status}`);
  }

  const formatRules = getFormatCampaignRules(state.format, rulesConfig);
  const neededOpponents = formatRules.groupTeams - 1; // 7 opponents for 8 teams

  const opponents = generateHistoricalOpponents(state.format, state.seed, neededOpponents);

  const allTeams = [
    { id: state.userTeam.teamId, name: state.userTeam.name, isUser: true },
    ...opponents.map((o) => ({ id: o.opponentId, name: o.displayName, isUser: false })),
  ];

  const standings = createInitialStandings(allTeams);
  const fixtures = generateRoundRobinFixtures(
    state.userTeam.teamId,
    state.userTeam.name,
    opponents,
    state.seed,
  );

  return {
    ...state,
    opponents,
    fixtures,
    standings,
    status: 'GROUP_STAGE',
  };
}

/**
 * Simulates a single fixture using Phase 6/7 simulateMatch() (§26, §27, §64, §66).
 */
export function executeFixture(
  fixture: Fixture,
  userTeam: MaidenTeam,
  opponentsMap: ReadonlyMap<string, CampaignOpponent>,
  format: CricketFormat,
  thrashingConfig: ThrashingConfig,
): CampaignMatchRecord {
  const getSimTeam = (teamId: string, teamName: string): SimulatorTeam => {
    if (teamId === userTeam.teamId) {
      return toSimulatorTeam(userTeam);
    }
    const opp = opponentsMap.get(teamId);
    if (!opp) {
      throw new Error(`Team ${teamId} (${teamName}) not found in opponents or user team.`);
    }
    return opp.team;
  };

  const teamA = getSimTeam(fixture.homeTeamId, fixture.homeTeamName);
  const teamB = getSimTeam(fixture.awayTeamId, fixture.awayTeamName);

  const matchResult = simulateMatch({
    format,
    teamA,
    teamB,
    seed: fixture.matchSeed,
  });

  const inn1 = matchResult.innings1;
  const inn2 = matchResult.innings2;

  // Determine scores for home and away teams
  const homeIsInn1 = inn1.battingTeamId === fixture.homeTeamId;
  const homeInn = homeIsInn1 ? inn1 : inn2;
  const awayInn = homeIsInn1 ? inn2 : inn1;

  const homeScore = {
    runs: homeInn.runs,
    wickets: homeInn.wickets,
    balls: homeInn.legalBalls,
  };
  const awayScore = {
    runs: awayInn.runs,
    wickets: awayInn.wickets,
    balls: awayInn.legalBalls,
  };

  const isTie = matchResult.result.type === 'TIE';
  const winnerId = matchResult.result.winnerId;
  const winnerName = matchResult.result.winnerName;

  const userInvolved =
    fixture.homeTeamId === userTeam.teamId || fixture.awayTeamId === userTeam.teamId;
  const userWon = userInvolved && winnerId === userTeam.teamId;

  const userScore = userInvolved
    ? fixture.homeTeamId === userTeam.teamId
      ? homeScore
      : awayScore
    : undefined;
  const opponentScore = userInvolved
    ? fixture.homeTeamId === userTeam.teamId
      ? awayScore
      : homeScore
    : undefined;

  let marginType: 'RUNS' | 'WICKETS' | 'TIE' = 'TIE';
  let marginValue = 0;
  let ballsRemaining = 0;

  if (matchResult.result.type === 'WIN_BY_RUNS') {
    marginType = 'RUNS';
    marginValue = matchResult.result.marginRuns ?? 0;
  } else if (matchResult.result.type === 'WIN_BY_WICKETS') {
    marginType = 'WICKETS';
    marginValue = matchResult.result.marginWickets ?? 0;
    ballsRemaining = matchResult.result.ballsRemaining ?? 0;
  }

  const isThrashing = isMatchThrashing(
    { userWon, marginType, marginValue, ballsRemaining },
    thrashingConfig,
  );

  return {
    fixtureId: fixture.fixtureId,
    stage: fixture.stage,
    matchNumber: fixture.matchNumber,
    matchSeed: fixture.matchSeed,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    homeTeamName: fixture.homeTeamName,
    awayTeamName: fixture.awayTeamName,
    winnerId,
    winnerName,
    isTie,
    userInvolved,
    userWon,
    homeScore,
    awayScore,
    userScore,
    opponentScore,
    marginType,
    marginValue,
    ballsRemaining,
    isThrashing,
    fullResult: userInvolved ? matchResult : undefined,
    summaryText: matchResult.result.text,
  };
}

function calculateCampaignStats(completedMatches: readonly CampaignMatchRecord[]): {
  matchesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  runsScored: number;
  runsConceded: number;
  runDifferential: number;
  wicketsTaken: number;
  wicketsLost: number;
} {
  const userMatches = completedMatches.filter((m) => m.userInvolved);
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let runsScored = 0;
  let runsConceded = 0;
  let wicketsTaken = 0;
  let wicketsLost = 0;

  for (const m of userMatches) {
    if (m.isTie) {
      ties += 1;
    } else if (m.userWon) {
      wins += 1;
    } else {
      losses += 1;
    }

    if (m.userScore && m.opponentScore) {
      runsScored += m.userScore.runs;
      runsConceded += m.opponentScore.runs;
      wicketsLost += m.userScore.wickets;
      wicketsTaken += m.opponentScore.wickets;
    }
  }

  return {
    matchesPlayed: userMatches.length,
    wins,
    losses,
    ties,
    runsScored,
    runsConceded,
    runDifferential: runsScored - runsConceded,
    wicketsTaken,
    wicketsLost,
  };
}

/**
 * Plays the next set of fixtures in the campaign (§58–§60).
 *
 * In Group Stage: plays the next round (user match + round's background matches), updating standings.
 * In Knockout: plays the semifinals, advancing winners.
 * In Final: plays the final and resolves Champion/Invincible/Golden Invincible.
 */
export function playNextMatch(
  state: CampaignState,
  rulesConfig: CampaignRulesConfig = loadCampaignRules(),
): CampaignState {
  if (state.status === 'COMPLETED' || state.status === 'ELIMINATED') {
    throw new CampaignCompletedError(
      `Campaign has already terminated with status: ${state.status}`,
    );
  }

  if (state.status === 'NOT_STARTED') {
    state = startCampaign(state, rulesConfig);
  }

  const formatRules = getFormatCampaignRules(state.format, rulesConfig);
  const oppMap = new Map<string, CampaignOpponent>(state.opponents.map((o) => [o.opponentId, o]));

  // --- STAGE 1: GROUP STAGE ---
  if (state.status === 'GROUP_STAGE') {
    // Find the next uncompleted round
    const uncompleted = state.fixtures.filter((f) => f.status === 'SCHEDULED');
    if (uncompleted.length === 0) {
      throw new NoNextFixtureError('No scheduled group fixtures found.');
    }

    const nextRoundNumber = uncompleted[0]!.round;
    const roundFixtures = state.fixtures.filter(
      (f) => f.round === nextRoundNumber && f.status === 'SCHEDULED',
    );

    let updatedStandings = { ...state.standings };
    const newRecords: CampaignMatchRecord[] = [];
    const updatedFixtures = [...state.fixtures];

    for (const fixture of roundFixtures) {
      if (fixture.status === 'COMPLETED') {
        throw new FixtureAlreadyPlayedError(fixture.fixtureId);
      }

      const record = executeFixture(
        fixture,
        state.userTeam,
        oppMap,
        state.format,
        formatRules.thrashing,
      );
      newRecords.push(record);

      updatedStandings = updateStandings(
        updatedStandings,
        record,
        rulesConfig.points,
        formatRules.qualifiers,
      );

      const fIdx = updatedFixtures.findIndex((f) => f.fixtureId === fixture.fixtureId);
      if (fIdx !== -1) {
        updatedFixtures[fIdx] = {
          ...fixture,
          status: 'COMPLETED',
          result: record,
        };
      }
    }

    const allCompleted = [...state.completedMatches, ...newRecords];
    const remainingGroup = updatedFixtures.filter(
      (f) => f.stage === 'GROUP' && f.status === 'SCHEDULED',
    );

    // If group stage is fully completed, determine qualification
    if (remainingGroup.length === 0) {
      const userQualified = isUserQualified(updatedStandings, state.userTeam.teamId);

      if (!userQualified) {
        const stats = calculateCampaignStats(allCompleted);
        const achievements = evaluateCampaignAchievements([], formatRules, false);

        const result: CampaignResult = {
          status: 'ELIMINATED',
          champion: false,
          invincible: false,
          goldenInvincible: false,
          matchesPlayed: stats.matchesPlayed,
          wins: stats.wins,
          losses: stats.losses,
          ties: stats.ties,
          runsScored: stats.runsScored,
          runsConceded: stats.runsConceded,
          runDifferential: stats.runDifferential,
          wicketsTaken: stats.wicketsTaken,
          wicketsLost: stats.wicketsLost,
          qualificationStageReached: 'GROUP',
          achievements: achievements.achievements,
          rulesVersion: state.campaignRulesVersion,
          completedAt: new Date().toISOString(),
        };

        return {
          ...state,
          fixtures: updatedFixtures,
          completedMatches: allCompleted,
          standings: updatedStandings,
          currentFixtureIndex: allCompleted.length,
          status: 'ELIMINATED',
          result,
        };
      }

      // User qualified! Schedule semifinals
      const pairings = determineSemifinalPairings(updatedStandings);
      const sfFixtures = generateSemifinalFixtures(
        pairings.sf1.home,
        pairings.sf2.home,
        pairings.sf2.away,
        pairings.sf1.away,
        state.userTeam.teamId,
        state.seed,
        updatedFixtures.length + 1,
      );

      return {
        ...state,
        fixtures: [...updatedFixtures, ...sfFixtures],
        completedMatches: allCompleted,
        standings: updatedStandings,
        currentFixtureIndex: allCompleted.length,
        status: 'KNOCKOUT',
      };
    }

    return {
      ...state,
      fixtures: updatedFixtures,
      completedMatches: allCompleted,
      standings: updatedStandings,
      currentFixtureIndex: allCompleted.length,
      status: 'GROUP_STAGE',
    };
  }

  // --- STAGE 2: KNOCKOUT (SEMIFINALS) ---
  if (state.status === 'KNOCKOUT') {
    const sfFixtures = state.fixtures.filter(
      (f) => f.stage === 'SEMIFINAL' && f.status === 'SCHEDULED',
    );
    if (sfFixtures.length === 0) {
      throw new NoNextFixtureError('No scheduled semifinal fixtures found.');
    }

    const standingMap = new Map(state.standings.table.map((s) => [s.teamId, s]));
    const newRecords: CampaignMatchRecord[] = [];
    const updatedFixtures = [...state.fixtures];
    const finalists: { id: string; name: string }[] = [];

    for (const fixture of sfFixtures) {
      const record = executeFixture(
        fixture,
        state.userTeam,
        oppMap,
        state.format,
        formatRules.thrashing,
      );
      newRecords.push(record);

      const homeStanding = standingMap.get(fixture.homeTeamId)!;
      const awayStanding = standingMap.get(fixture.awayTeamId)!;
      const { winnerId, winnerName } = resolveKnockoutWinner(record, homeStanding, awayStanding);
      finalists.push({ id: winnerId, name: winnerName });

      const fIdx = updatedFixtures.findIndex((f) => f.fixtureId === fixture.fixtureId);
      if (fIdx !== -1) {
        updatedFixtures[fIdx] = {
          ...fixture,
          status: 'COMPLETED',
          result: record,
        };
      }
    }

    const allCompleted = [...state.completedMatches, ...newRecords];
    const userSFRecord = newRecords.find((r) => r.userInvolved);
    const userWonSF = Boolean(userSFRecord && userSFRecord.winnerId === state.userTeam.teamId);

    if (!userWonSF) {
      const stats = calculateCampaignStats(allCompleted);
      const userMatches = allCompleted.filter((m) => m.userInvolved);
      const achievements = evaluateCampaignAchievements(userMatches, formatRules, false);

      const result: CampaignResult = {
        status: 'ELIMINATED',
        champion: false,
        invincible: false,
        goldenInvincible: false,
        matchesPlayed: stats.matchesPlayed,
        wins: stats.wins,
        losses: stats.losses,
        ties: stats.ties,
        runsScored: stats.runsScored,
        runsConceded: stats.runsConceded,
        runDifferential: stats.runDifferential,
        wicketsTaken: stats.wicketsTaken,
        wicketsLost: stats.wicketsLost,
        qualificationStageReached: 'SEMIFINAL',
        achievements: achievements.achievements,
        rulesVersion: state.campaignRulesVersion,
        completedAt: new Date().toISOString(),
      };

      return {
        ...state,
        fixtures: updatedFixtures,
        completedMatches: allCompleted,
        currentFixtureIndex: allCompleted.length,
        status: 'ELIMINATED',
        result,
      };
    }

    // User won SF! Schedule Final
    const [finalist1, finalist2] = finalists;
    const finalFixture = generateFinalFixture(
      finalist1!,
      finalist2!,
      state.userTeam.teamId,
      state.seed,
      updatedFixtures.length + 1,
    );

    return {
      ...state,
      fixtures: [...updatedFixtures, finalFixture],
      completedMatches: allCompleted,
      currentFixtureIndex: allCompleted.length,
      status: 'FINAL',
    };
  }

  // --- STAGE 3: FINAL ---
  if (state.status === 'FINAL') {
    const finalFixture = state.fixtures.find(
      (f) => f.stage === 'FINAL' && f.status === 'SCHEDULED',
    );
    if (!finalFixture) {
      throw new NoNextFixtureError('No scheduled final fixture found.');
    }

    const record = executeFixture(
      finalFixture,
      state.userTeam,
      oppMap,
      state.format,
      formatRules.thrashing,
    );
    const allCompleted = [...state.completedMatches, record];

    const updatedFixtures = state.fixtures.map((f) =>
      f.fixtureId === finalFixture.fixtureId
        ? { ...f, status: 'COMPLETED' as const, result: record }
        : f,
    );

    const { userIsChampion } = resolveChampionship(record, state.userTeam.teamId);
    const userMatches = allCompleted.filter((m) => m.userInvolved);
    const stats = calculateCampaignStats(allCompleted);
    const achievements = evaluateCampaignAchievements(userMatches, formatRules, userIsChampion);

    const oppTeamId =
      finalFixture.homeTeamId === state.userTeam.teamId
        ? finalFixture.awayTeamId
        : finalFixture.homeTeamId;
    const oppTeamName =
      finalFixture.homeTeamId === state.userTeam.teamId
        ? finalFixture.awayTeamName
        : finalFixture.homeTeamName;

    const result: CampaignResult = {
      status: userIsChampion ? 'CHAMPION' : 'ELIMINATED',
      champion: userIsChampion,
      invincible: achievements.invincible,
      goldenInvincible: achievements.goldenInvincible,
      matchesPlayed: stats.matchesPlayed,
      wins: stats.wins,
      losses: stats.losses,
      ties: stats.ties,
      runsScored: stats.runsScored,
      runsConceded: stats.runsConceded,
      runDifferential: stats.runDifferential,
      wicketsTaken: stats.wicketsTaken,
      wicketsLost: stats.wicketsLost,
      qualificationStageReached: userIsChampion ? 'CHAMPION' : 'FINAL',
      finalOpponentId: oppTeamId,
      finalOpponentName: oppTeamName,
      finalMatch: record,
      achievements: achievements.achievements,
      rulesVersion: state.campaignRulesVersion,
      completedAt: new Date().toISOString(),
    };

    return {
      ...state,
      fixtures: updatedFixtures,
      completedMatches: allCompleted,
      currentFixtureIndex: allCompleted.length,
      status: userIsChampion ? 'COMPLETED' : 'ELIMINATED',
      result,
    };
  }

  throw new InvalidCampaignStateError(`Unrecognized campaign status: ${state.status}`);
}

/**
 * Loops and plays through the entire campaign until completion or elimination (§148).
 */
export function playEntireCampaign(
  initialState: CampaignState,
  rulesConfig: CampaignRulesConfig = loadCampaignRules(),
): CampaignState {
  let state = initialState;
  while (state.status !== 'COMPLETED' && state.status !== 'ELIMINATED') {
    state = playNextMatch(state, rulesConfig);
  }
  return state;
}

/**
 * Validates campaign structural and data integrity (§140).
 */
export function validateCampaign(state: CampaignState): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (state.completedMatches.length > state.fixtures.length) {
    errors.push('Completed match count exceeds total fixtures count.');
  }

  const userMatches = state.completedMatches.filter((m) => m.userInvolved);
  let userWins = 0;
  let userLosses = 0;
  let userTies = 0;

  for (const m of userMatches) {
    if (m.isTie) userTies++;
    else if (m.userWon) userWins++;
    else userLosses++;
  }

  if (state.result) {
    if (state.result.wins !== userWins) {
      errors.push(
        `Result wins (${state.result.wins}) does not match match record wins (${userWins}).`,
      );
    }
    if (state.result.losses !== userLosses) {
      errors.push(
        `Result losses (${state.result.losses}) does not match match record losses (${userLosses}).`,
      );
    }
    if (state.result.ties !== userTies) {
      errors.push(
        `Result ties (${state.result.ties}) does not match match record ties (${userTies}).`,
      );
    }
    if (state.result.champion && state.status !== 'COMPLETED') {
      errors.push('Result is marked Champion but campaign status is not COMPLETED.');
    }
    if (state.result.invincible && !state.result.champion) {
      errors.push('Result is marked Invincible but team is not Champion.');
    }
    if (state.result.goldenInvincible && !state.result.invincible) {
      errors.push('Result is marked Golden Invincible but team is not Invincible.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Serializes campaign state to JSON (§6, §100, §172).
 */
export function serializeCampaign(state: CampaignState): string {
  return JSON.stringify(state, null, 2);
}

/**
 * Deserializes campaign state from JSON (§6, §100, §172).
 */
export function deserializeCampaign(json: string): CampaignState {
  const obj = JSON.parse(json);
  if (!obj || typeof obj !== 'object') {
    throw new InvalidCampaignStateError('Invalid campaign JSON');
  }
  if (obj.schemaVersion !== CAMPAIGN_SCHEMA_VERSION) {
    throw new UnsupportedCampaignVersionError(
      `Unsupported campaign schema version: ${obj.schemaVersion} (supported: ${CAMPAIGN_SCHEMA_VERSION})`,
    );
  }
  return obj as CampaignState;
}
