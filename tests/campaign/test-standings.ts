import { describe, expect, it } from 'vitest';
import {
  createInitialStandings,
  updateStandings,
  sortStandings,
} from '../../campaign/standings.js';
import { createTestMatchRecord } from './fixtures.js';
import type { Standing } from '../../campaign/types.js';

describe('Campaign Standings (§29–§35, §74)', () => {
  const teams = [
    { id: 'team_1', name: 'Team 1', isUser: true },
    { id: 'team_2', name: 'Team 2', isUser: false },
    { id: 'team_3', name: 'Team 3', isUser: false },
    { id: 'team_4', name: 'Team 4', isUser: false },
    { id: 'team_5', name: 'Team 5', isUser: false },
    { id: 'team_6', name: 'Team 6', isUser: false },
    { id: 'team_7', name: 'Team 7', isUser: false },
    { id: 'team_8', name: 'Team 8', isUser: false },
  ];

  const pointsConfig = { win: 2, tie: 1, loss: 0 };

  it('initializes clean 0-state standings for 8 teams', () => {
    const standings = createInitialStandings(teams);

    expect(standings.table).toHaveLength(8);
    for (const entry of standings.table) {
      expect(entry.played).toBe(0);
      expect(entry.wins).toBe(0);
      expect(entry.losses).toBe(0);
      expect(entry.ties).toBe(0);
      expect(entry.points).toBe(0);
      expect(entry.runsFor).toBe(0);
      expect(entry.runsAgainst).toBe(0);
      expect(entry.runDifferential).toBe(0);
      expect(entry.qualified).toBe(false);
    }
  });

  it('awards 2 points for a win and 0 points for a loss with run differential', () => {
    let standings = createInitialStandings(teams);

    const match = createTestMatchRecord({
      homeTeamId: 'team_1',
      awayTeamId: 'team_2',
      winnerId: 'team_1',
      isTie: false,
      homeScore: { runs: 300, wickets: 5, balls: 300 },
      awayScore: { runs: 240, wickets: 10, balls: 288 },
    });

    standings = updateStandings(standings, match, pointsConfig, 4);

    const t1 = standings.table.find((e) => e.teamId === 'team_1')!;
    const t2 = standings.table.find((e) => e.teamId === 'team_2')!;

    expect(t1.played).toBe(1);
    expect(t1.wins).toBe(1);
    expect(t1.losses).toBe(0);
    expect(t1.points).toBe(2);
    expect(t1.runsFor).toBe(300);
    expect(t1.runsAgainst).toBe(240);
    expect(t1.runDifferential).toBe(60);

    expect(t2.played).toBe(1);
    expect(t2.wins).toBe(0);
    expect(t2.losses).toBe(1);
    expect(t2.points).toBe(0);
    expect(t2.runsFor).toBe(240);
    expect(t2.runsAgainst).toBe(300);
    expect(t2.runDifferential).toBe(-60);
  });

  it('awards 1 point each for a tie', () => {
    let standings = createInitialStandings(teams);

    const match = createTestMatchRecord({
      homeTeamId: 'team_1',
      awayTeamId: 'team_2',
      winnerId: null,
      winnerName: null,
      isTie: true,
      homeScore: { runs: 250, wickets: 9, balls: 300 },
      awayScore: { runs: 250, wickets: 8, balls: 300 },
    });

    standings = updateStandings(standings, match, pointsConfig, 4);

    const t1 = standings.table.find((e) => e.teamId === 'team_1')!;
    const t2 = standings.table.find((e) => e.teamId === 'team_2')!;

    expect(t1.points).toBe(1);
    expect(t1.ties).toBe(1);
    expect(t1.runDifferential).toBe(0);

    expect(t2.points).toBe(1);
    expect(t2.ties).toBe(1);
    expect(t2.runDifferential).toBe(0);
  });

  it('orders standings by tie-breakers: Points -> Run Differential -> Wins -> Team ID', () => {
    const rawEntries: Standing[] = [
      {
        position: 0,
        teamId: 'team_b',
        teamName: 'Team B',
        isUser: false,
        played: 7,
        wins: 4,
        losses: 3,
        ties: 0,
        points: 8,
        runsFor: 1500,
        runsAgainst: 1450,
        wicketsFor: 50,
        wicketsAgainst: 50,
        ballsFor: 2100,
        ballsAgainst: 2100,
        runDifferential: 50,
        qualified: false,
      },
      {
        position: 0,
        teamId: 'team_a',
        teamName: 'Team A',
        isUser: false,
        played: 7,
        wins: 4,
        losses: 3,
        ties: 0,
        points: 8,
        runsFor: 1600,
        runsAgainst: 1450,
        wicketsFor: 50,
        wicketsAgainst: 50,
        ballsFor: 2100,
        ballsAgainst: 2100,
        runDifferential: 150, // higher diff
        qualified: false,
      },
      {
        position: 0,
        teamId: 'team_top',
        teamName: 'Team Top',
        isUser: true,
        played: 7,
        wins: 6,
        losses: 1,
        ties: 0,
        points: 12,
        runsFor: 1800,
        runsAgainst: 1400,
        wicketsFor: 60,
        wicketsAgainst: 40,
        ballsFor: 2100,
        ballsAgainst: 2100,
        runDifferential: 400,
        qualified: false,
      },
      {
        position: 0,
        teamId: 'team_c',
        teamName: 'Team C',
        isUser: false,
        played: 7,
        wins: 3,
        losses: 2,
        ties: 2,
        points: 8,
        runsFor: 1500,
        runsAgainst: 1450,
        wicketsFor: 50,
        wicketsAgainst: 50,
        ballsFor: 2100,
        ballsAgainst: 2100,
        runDifferential: 50, // same diff as B, but wins=3 vs B wins=4
        qualified: false,
      },
    ];

    const sorted = sortStandings(rawEntries, 4);

    expect(sorted[0]!.teamId).toBe('team_top'); // 12 pts
    expect(sorted[1]!.teamId).toBe('team_a'); // 8 pts, +150 diff
    expect(sorted[2]!.teamId).toBe('team_b'); // 8 pts, +50 diff, 4 wins
    expect(sorted[3]!.teamId).toBe('team_c'); // 8 pts, +50 diff, 3 wins

    // Positions assigned 1..4
    expect(sorted.map((e) => e.position)).toEqual([1, 2, 3, 4]);
  });

  it('marks top 4 as qualified and bottom 4 as not qualified', () => {
    const rawEntries: Standing[] = teams.map((t, index) => ({
      position: 0,
      teamId: t.id,
      teamName: t.name,
      isUser: t.isUser,
      played: 7,
      wins: 7 - index,
      losses: index,
      ties: 0,
      points: (7 - index) * 2,
      runsFor: 1500,
      runsAgainst: 1400,
      wicketsFor: 50,
      wicketsAgainst: 50,
      ballsFor: 2100,
      ballsAgainst: 2100,
      runDifferential: 100 - index * 20,
      qualified: false,
    }));

    const sorted = sortStandings(rawEntries, 4);

    expect(sorted.slice(0, 4).every((e) => e.qualified)).toBe(true);
    expect(sorted.slice(4).every((e) => !e.qualified)).toBe(true);
  });
});
