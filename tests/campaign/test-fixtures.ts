import { describe, expect, it } from 'vitest';
import {
  generateRoundRobinFixtures,
  deriveMatchSeed,
  generateSemifinalFixtures,
  generateFinalFixture,
} from '../../campaign/fixtures.js';
import { createTestOpponent, createMockStanding } from './fixtures.js';

describe('Campaign Fixtures (§23–§28, §72)', () => {
  const userTeamId = 'user_team';
  const userTeamName = 'Maiden XI';

  const mockOpponents = [
    createTestOpponent({ opponentId: 'opp_aus_2007', displayName: 'Australia 2007' }),
    createTestOpponent({ opponentId: 'opp_ind_2011', displayName: 'India 2011' }),
    createTestOpponent({ opponentId: 'opp_pak_1992', displayName: 'Pakistan 1992' }),
    createTestOpponent({ opponentId: 'opp_wi_1975', displayName: 'West Indies 1975' }),
    createTestOpponent({ opponentId: 'opp_eng_2019', displayName: 'England 2019' }),
    createTestOpponent({ opponentId: 'opp_nz_2015', displayName: 'New Zealand 2015' }),
    createTestOpponent({ opponentId: 'opp_sa_1999', displayName: 'South Africa 1999' }),
  ];

  it('generates exactly 28 round-robin fixtures across 7 rounds (4 per round)', () => {
    const fixtures = generateRoundRobinFixtures(userTeamId, userTeamName, mockOpponents, 42);

    expect(fixtures).toHaveLength(28);

    const roundCounts = new Map<number, number>();
    for (const f of fixtures) {
      roundCounts.set(f.round, (roundCounts.get(f.round) ?? 0) + 1);
      expect(f.stage).toBe('GROUP');
      expect(f.status).toBe('SCHEDULED');
      expect(f.matchSeed).toBeGreaterThan(0);
    }

    expect(roundCounts.size).toBe(7);
    for (let r = 1; r <= 7; r++) {
      expect(roundCounts.get(r)).toBe(4);
    }
  });

  it('ensures each team plays exactly once per round (7 matches total each)', () => {
    const fixtures = generateRoundRobinFixtures(userTeamId, userTeamName, mockOpponents, 42);
    const allTeamIds = [userTeamId, ...mockOpponents.map((o) => o.opponentId)];

    for (let round = 1; round <= 7; round++) {
      const roundFixtures = fixtures.filter((f) => f.round === round);
      const teamsInRound = new Set<string>();

      for (const f of roundFixtures) {
        expect(teamsInRound.has(f.homeTeamId)).toBe(false);
        teamsInRound.add(f.homeTeamId);
        expect(teamsInRound.has(f.awayTeamId)).toBe(false);
        teamsInRound.add(f.awayTeamId);
      }

      expect(teamsInRound.size).toBe(8);
      for (const teamId of allTeamIds) {
        expect(teamsInRound.has(teamId)).toBe(true);
      }
    }
  });

  it('ensures the user team plays exactly 7 matches against 7 distinct opponents', () => {
    const fixtures = generateRoundRobinFixtures(userTeamId, userTeamName, mockOpponents, 42);
    const userFixtures = fixtures.filter((f) => f.isUserMatch);

    expect(userFixtures).toHaveLength(7);

    const opponentsFaced = new Set<string>();
    for (const f of userFixtures) {
      const oppId = f.homeTeamId === userTeamId ? f.awayTeamId : f.homeTeamId;
      expect(opponentsFaced.has(oppId)).toBe(false);
      opponentsFaced.add(oppId);
    }

    expect(opponentsFaced.size).toBe(7);
    for (const opp of mockOpponents) {
      expect(opponentsFaced.has(opp.opponentId)).toBe(true);
    }
  });

  it('contains no duplicate head-to-head fixtures across the entire round-robin', () => {
    const fixtures = generateRoundRobinFixtures(userTeamId, userTeamName, mockOpponents, 42);
    const pairKeys = new Set<string>();

    for (const f of fixtures) {
      const sortedPair = [f.homeTeamId, f.awayTeamId].sort().join('::');
      expect(pairKeys.has(sortedPair)).toBe(false);
      pairKeys.add(sortedPair);
    }

    // 8 teams => 8 * 7 / 2 = 28 distinct pairs
    expect(pairKeys.size).toBe(28);
  });

  it('generates deterministic match seeds', () => {
    const seed1 = deriveMatchSeed(12345, 1, 'GROUP');
    const seed2 = deriveMatchSeed(12345, 1, 'GROUP');
    const seed3 = deriveMatchSeed(12345, 2, 'GROUP');
    const seed4 = deriveMatchSeed(12345, 1, 'SEMIFINAL');
    const seed5 = deriveMatchSeed(54321, 1, 'GROUP');

    expect(seed1).toBe(seed2);
    expect(seed1).not.toBe(seed3);
    expect(seed1).not.toBe(seed4);
    expect(seed1).not.toBe(seed5);
    expect(typeof seed1).toBe('number');
  });

  it('creates semifinal fixtures correctly (1v4 and 2v3)', () => {
    const q1 = createMockStanding('team_1', 'First Place', { position: 1 });
    const q2 = createMockStanding('team_2', 'Second Place', { position: 2 });
    const q3 = createMockStanding('team_3', 'Third Place', { position: 3 });
    const q4 = createMockStanding('team_4', 'Fourth Place', { position: 4 });

    const sfs = generateSemifinalFixtures(q1, q2, q3, q4, 'team_1', 999, 29);
    expect(sfs).toHaveLength(2);

    expect(sfs[0]!.fixtureId).toBe('sf_1');
    expect(sfs[0]!.stage).toBe('SEMIFINAL');
    expect(sfs[0]!.matchNumber).toBe(29);
    expect(sfs[0]!.homeTeamId).toBe('team_1');
    expect(sfs[0]!.awayTeamId).toBe('team_4');
    expect(sfs[0]!.isUserMatch).toBe(true);

    expect(sfs[1]!.fixtureId).toBe('sf_2');
    expect(sfs[1]!.stage).toBe('SEMIFINAL');
    expect(sfs[1]!.matchNumber).toBe(30);
    expect(sfs[1]!.homeTeamId).toBe('team_2');
    expect(sfs[1]!.awayTeamId).toBe('team_3');
    expect(sfs[1]!.isUserMatch).toBe(false);
  });

  it('creates final fixture correctly from semifinal winners', () => {
    const finalFix = generateFinalFixture(
      { id: 'team_1', name: 'Team 1' },
      { id: 'team_2', name: 'Team 2' },
      'team_1',
      999,
      31,
    );

    expect(finalFix.fixtureId).toBe('final');
    expect(finalFix.stage).toBe('FINAL');
    expect(finalFix.matchNumber).toBe(31);
    expect(finalFix.homeTeamId).toBe('team_1');
    expect(finalFix.awayTeamId).toBe('team_2');
    expect(finalFix.isUserMatch).toBe(true);
  });
});
