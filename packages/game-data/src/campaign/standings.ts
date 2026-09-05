import type { CampaignMatchRecord, PointsConfig, Standing, Standings } from './types.js';

/**
 * Initializes a clean standings table before any group matches are played (§32).
 */
export function createInitialStandings(
  teams: readonly { readonly id: string; readonly name: string; readonly isUser: boolean }[],
): Standings {
  const table: Standing[] = teams.map((t, idx) => ({
    teamId: t.id,
    teamName: t.name,
    isUser: t.isUser,
    played: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    points: 0,
    runsFor: 0,
    runsAgainst: 0,
    wicketsFor: 0,
    wicketsAgainst: 0,
    ballsFor: 0,
    ballsAgainst: 0,
    runDifferential: 0,
    qualified: false,
    position: idx + 1,
  }));

  return {
    table,
    recalculatedAtFixtureIndex: 0,
  };
}

/**
 * Deterministically sorts standings and marks qualifiers (§34, §35, §92).
 *
 * Tie-breakers:
 * 1. Points descending
 * 2. Run differential descending (runsFor - runsAgainst)
 * 3. Total wins descending
 * 4. Team ID ascending (deterministic fallback)
 */
export function sortStandings(table: readonly Standing[], qualifiersCount: number = 4): Standing[] {
  const sorted = [...table].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.runDifferential !== a.runDifferential) return b.runDifferential - a.runDifferential;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.teamId.localeCompare(b.teamId);
  });

  return sorted.map((s, index) => ({
    ...s,
    position: index + 1,
    qualified: index < qualifiersCount,
  }));
}

type MutableStanding = {
  -readonly [K in keyof Standing]: Standing[K];
};

/**
 * Updates standings after a completed match and re-sorts (§33, §68, §91).
 */
export function updateStandings(
  current: Standings,
  record: CampaignMatchRecord,
  pointsConfig: PointsConfig,
  qualifiersCount: number = 4,
): Standings {
  const tableMap = new Map<string, MutableStanding>(current.table.map((s) => [s.teamId, { ...s }]));

  const home = tableMap.get(record.homeTeamId);
  const away = tableMap.get(record.awayTeamId);

  if (!home || !away) {
    throw new Error(
      `Cannot update standings: teams ${record.homeTeamId} or ${record.awayTeamId} not in standings.`,
    );
  }

  // Update match counts and runs
  home.played += 1;
  away.played += 1;

  home.runsFor += record.homeScore.runs;
  home.runsAgainst += record.awayScore.runs;
  home.wicketsFor += record.homeScore.wickets;
  home.wicketsAgainst += record.awayScore.wickets;
  home.ballsFor += record.homeScore.balls;
  home.ballsAgainst += record.awayScore.balls;
  home.runDifferential = home.runsFor - home.runsAgainst;

  away.runsFor += record.awayScore.runs;
  away.runsAgainst += record.homeScore.runs;
  away.wicketsFor += record.awayScore.wickets;
  away.wicketsAgainst += record.homeScore.wickets;
  away.ballsFor += record.awayScore.balls;
  away.ballsAgainst += record.homeScore.balls;
  away.runDifferential = away.runsFor - away.runsAgainst;

  if (record.isTie) {
    home.ties += 1;
    away.ties += 1;
    home.points += pointsConfig.tie;
    away.points += pointsConfig.tie;
  } else if (record.winnerId === home.teamId) {
    home.wins += 1;
    away.losses += 1;
    home.points += pointsConfig.win;
    away.points += pointsConfig.loss;
  } else {
    away.wins += 1;
    home.losses += 1;
    away.points += pointsConfig.win;
    home.points += pointsConfig.loss;
  }

  const updatedTable = Array.from(tableMap.values());
  const sorted = sortStandings(updatedTable, qualifiersCount);

  return {
    table: sorted,
    recalculatedAtFixtureIndex: record.matchNumber,
  };
}
