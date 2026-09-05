import type { CampaignOpponent, Fixture, FixtureStage } from './types.js';

/**
 * Derives a deterministic match seed from campaign seed, match index, and stage (§25, §67).
 */
export function deriveMatchSeed(
  campaignSeed: number,
  matchNumber: number,
  stage: FixtureStage,
): number {
  const stageMultiplier = stage === 'GROUP' ? 1009 : stage === 'SEMIFINAL' ? 2003 : 3001;
  const hash = Math.imul(campaignSeed ^ (matchNumber * 7919), stageMultiplier);
  return hash >>> 0 || 1;
}

/**
 * Generates the full 8-team round-robin group schedule (28 fixtures across 7 rounds) (§20–§22, §65, §89, §90).
 *
 * Uses the canonical circle method:
 * - 8 teams: Team 0 (User Team) + Teams 1..7 (Opponents).
 * - Team 0 is fixed; Teams 1..7 rotate.
 * - 7 rounds × 4 matches per round = 28 total group fixtures.
 * - Each team plays exactly 7 matches (1 per round).
 */
export function generateRoundRobinFixtures(
  userTeamId: string,
  userTeamName: string,
  opponents: readonly CampaignOpponent[],
  campaignSeed: number,
): Fixture[] {
  if (opponents.length !== 7) {
    throw new Error(
      `Round-robin requires exactly 7 opponents for an 8-team group; received ${opponents.length}`,
    );
  }

  interface TeamInfo {
    id: string;
    name: string;
  }

  const teams: TeamInfo[] = [
    { id: userTeamId, name: userTeamName },
    ...opponents.map((o) => ({ id: o.opponentId, name: o.displayName })),
  ];

  const n = teams.length; // 8
  const rounds = n - 1; // 7
  const matchesPerRound = n / 2; // 4
  const fixtures: Fixture[] = [];

  // Indices: 0 is fixed, 1..7 rotate
  const circle: number[] = teams.map((_, i) => i);

  let overallMatchNumber = 1;

  for (let round = 1; round <= rounds; round++) {
    const roundFixtures: Fixture[] = [];

    for (let i = 0; i < matchesPerRound; i++) {
      const homeIdx = circle[i]!;
      const awayIdx = circle[n - 1 - i]!;

      const home = teams[homeIdx]!;
      const away = teams[awayIdx]!;

      const isUserMatch = home.id === userTeamId || away.id === userTeamId;
      const fixtureId = `grp_r${round}_m${i + 1}`;

      roundFixtures.push({
        fixtureId,
        stage: 'GROUP',
        matchNumber: 0, // Assigned below
        round,
        homeTeamId: home.id,
        awayTeamId: away.id,
        homeTeamName: home.name,
        awayTeamName: away.name,
        status: 'SCHEDULED',
        matchSeed: 0, // Assigned below
        isUserMatch,
      });
    }

    // Sort round fixtures so the user's match appears first in each round for direct player focus
    roundFixtures.sort((a, b) => {
      if (a.isUserMatch && !b.isUserMatch) return -1;
      if (!a.isUserMatch && b.isUserMatch) return 1;
      return a.fixtureId.localeCompare(b.fixtureId);
    });

    for (const f of roundFixtures) {
      const mNum = overallMatchNumber++;
      fixtures.push({
        ...f,
        matchNumber: mNum,
        matchSeed: deriveMatchSeed(campaignSeed, mNum, 'GROUP'),
      });
    }

    // Rotate circle array (keep element 0 fixed, rotate elements 1..n-1)
    const fixed = circle[0]!;
    const rotating = circle.slice(1);
    const last = rotating.pop()!;
    rotating.unshift(last);
    circle.splice(0, n, fixed, ...rotating);
  }

  return fixtures;
}

export type TeamIdentifier =
  | { readonly id: string; readonly name: string }
  | { readonly teamId: string; readonly teamName: string };

function getTeamId(t: TeamIdentifier): string {
  return 'teamId' in t ? t.teamId : t.id;
}

function getTeamName(t: TeamIdentifier): string {
  return 'teamName' in t ? t.teamName : t.name;
}

/**
 * Generates the semifinal fixtures (1st vs 4th, 2nd vs 3rd) (§39, §70, §94).
 */
export function generateSemifinalFixtures(
  qualifier1: TeamIdentifier,
  qualifier2: TeamIdentifier,
  qualifier3: TeamIdentifier,
  qualifier4: TeamIdentifier,
  userTeamId: string,
  campaignSeed: number,
  baseMatchNumber: number = 29,
): [Fixture, Fixture] {
  const q1Id = getTeamId(qualifier1);
  const q1Name = getTeamName(qualifier1);
  const q2Id = getTeamId(qualifier2);
  const q2Name = getTeamName(qualifier2);
  const q3Id = getTeamId(qualifier3);
  const q3Name = getTeamName(qualifier3);
  const q4Id = getTeamId(qualifier4);
  const q4Name = getTeamName(qualifier4);

  // Semifinal 1: 1st vs 4th
  const sf1MatchNum = baseMatchNumber;
  const isUserSF1 = q1Id === userTeamId || q4Id === userTeamId;
  const sf1: Fixture = {
    fixtureId: 'sf_1',
    stage: 'SEMIFINAL',
    matchNumber: sf1MatchNum,
    round: 8,
    homeTeamId: q1Id,
    awayTeamId: q4Id,
    homeTeamName: q1Name,
    awayTeamName: q4Name,
    status: 'SCHEDULED',
    matchSeed: deriveMatchSeed(campaignSeed, sf1MatchNum, 'SEMIFINAL'),
    isUserMatch: isUserSF1,
  };

  // Semifinal 2: 2nd vs 3rd
  const sf2MatchNum = baseMatchNumber + 1;
  const isUserSF2 = q2Id === userTeamId || q3Id === userTeamId;
  const sf2: Fixture = {
    fixtureId: 'sf_2',
    stage: 'SEMIFINAL',
    matchNumber: sf2MatchNum,
    round: 8,
    homeTeamId: q2Id,
    awayTeamId: q3Id,
    homeTeamName: q2Name,
    awayTeamName: q3Name,
    status: 'SCHEDULED',
    matchSeed: deriveMatchSeed(campaignSeed, sf2MatchNum, 'SEMIFINAL'),
    isUserMatch: isUserSF2,
  };

  // If SF2 is user match and SF1 is not, return SF2 first so user match is played first
  return isUserSF2 && !isUserSF1 ? [sf2, sf1] : [sf1, sf2];
}

/**
 * Generates the Final fixture between the two semifinal winners (§42, §71).
 */
export function generateFinalFixture(
  finalist1: TeamIdentifier,
  finalist2: TeamIdentifier,
  userTeamId: string,
  campaignSeed: number,
  matchNumber: number = 31,
): Fixture {
  const f1Id = getTeamId(finalist1);
  const f1Name = getTeamName(finalist1);
  const f2Id = getTeamId(finalist2);
  const f2Name = getTeamName(finalist2);

  const isUserFinal = f1Id === userTeamId || f2Id === userTeamId;
  return {
    fixtureId: 'final',
    stage: 'FINAL',
    matchNumber,
    round: 9,
    homeTeamId: f1Id,
    awayTeamId: f2Id,
    homeTeamName: f1Name,
    awayTeamName: f2Name,
    status: 'SCHEDULED',
    matchSeed: deriveMatchSeed(campaignSeed, matchNumber, 'FINAL'),
    isUserMatch: isUserFinal,
  };
}
