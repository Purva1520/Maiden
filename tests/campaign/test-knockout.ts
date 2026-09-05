import { describe, expect, it } from 'vitest';
import {
  determineSemifinalPairings,
  resolveKnockoutWinner,
  isUserQualified,
} from '../../campaign/knockout.js';
import { createMockStanding, createTestMatchRecord } from './fixtures.js';
import type { Standings } from '../../campaign/types.js';

describe('Campaign Knockout (§36–§42, §75)', () => {
  const standings: Standings = {
    table: [
      createMockStanding('team_1', 'Team 1', { position: 1, points: 12, qualified: true }),
      createMockStanding('team_2', 'Team 2', { position: 2, points: 10, qualified: true }),
      createMockStanding('team_3', 'Team 3', { position: 3, points: 8, qualified: true }),
      createMockStanding('team_4', 'Team 4', { position: 4, points: 6, qualified: true }),
      createMockStanding('team_5', 'Team 5', { position: 5, points: 4, qualified: false }),
      createMockStanding('team_6', 'Team 6', { position: 6, points: 4, qualified: false }),
      createMockStanding('team_7', 'Team 7', { position: 7, points: 2, qualified: false }),
      createMockStanding('team_8', 'Team 8', { position: 8, points: 0, qualified: false }),
    ],
    recalculatedAtFixtureIndex: 28,
  };

  it('checks whether user is qualified', () => {
    expect(isUserQualified(standings, 'team_1')).toBe(true);
    expect(isUserQualified(standings, 'team_4')).toBe(true);
    expect(isUserQualified(standings, 'team_5')).toBe(false);
  });

  it('determines semifinal pairings: 1v4 and 2v3', () => {
    const pairings = determineSemifinalPairings(standings);

    expect(pairings.sf1.home.teamId).toBe('team_1');
    expect(pairings.sf1.away.teamId).toBe('team_4');

    expect(pairings.sf2.home.teamId).toBe('team_2');
    expect(pairings.sf2.away.teamId).toBe('team_3');
  });

  it('determines clean winner when match is not tied', () => {
    const homeStanding = standings.table[0]!;
    const awayStanding = standings.table[3]!;

    const matchRecord = createTestMatchRecord({
      fixtureId: 'sf1',
      stage: 'SEMIFINAL',
      matchNumber: 29,
      homeTeamId: 'team_1',
      awayTeamId: 'team_4',
      winnerId: 'team_1',
      winnerName: 'Team 1',
      isTie: false,
    });

    const result = resolveKnockoutWinner(matchRecord, homeStanding, awayStanding);
    expect(result.winnerId).toBe('team_1');
    expect(result.winnerName).toBe('Team 1');
    expect(result.tiedDecidedByStanding).toBe(false);
  });

  it('resolves knockout tie by group standing rank in favor of higher seed (§41)', () => {
    const homeStanding = standings.table[0]!; // position 1
    const awayStanding = standings.table[3]!; // position 4

    const tiedRecord = createTestMatchRecord({
      fixtureId: 'sf1',
      stage: 'SEMIFINAL',
      matchNumber: 29,
      homeTeamId: 'team_1',
      awayTeamId: 'team_4',
      winnerId: null,
      winnerName: null,
      isTie: true,
      marginType: 'TIE',
      marginValue: 0,
    });

    const result = resolveKnockoutWinner(tiedRecord, homeStanding, awayStanding);
    // Team 1 is position 1, Team 4 is position 4 -> Team 1 advances
    expect(result.winnerId).toBe('team_1');
    expect(result.winnerName).toBe('Team 1');
    expect(result.tiedDecidedByStanding).toBe(true);
  });
});
