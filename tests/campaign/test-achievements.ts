import { describe, expect, it } from 'vitest';
import { evaluateCampaignAchievements, isMatchThrashing } from '../../campaign/achievements.js';
import { createTestMatchRecord } from './fixtures.js';
import type { CampaignMatchRecord, FormatCampaignRules } from '../../campaign/types.js';

describe('Campaign Achievements (§48–§58, §76)', () => {
  const odiRules: FormatCampaignRules = {
    groupTeams: 8,
    qualifiers: 4,
    matchesPerTeam: 7,
    thrashing: {
      winByRuns: 50,
      winByWickets: 6,
      minBallsRemaining: 30,
    },
  };

  const t20Rules: FormatCampaignRules = {
    groupTeams: 8,
    qualifiers: 4,
    matchesPerTeam: 7,
    thrashing: {
      winByRuns: 30,
      winByWickets: 6,
      minBallsRemaining: 24,
    },
  };

  it('evaluates Champion and Invincible when user wins every match', () => {
    const userMatches: CampaignMatchRecord[] = [];
    // 7 group matches + 1 SF + 1 Final = 9 matches
    for (let r = 1; r <= 7; r++) {
      userMatches.push(
        createTestMatchRecord({
          fixtureId: `grp_r${r}_m1`,
          matchNumber: r,
          userWon: true,
          isTie: false,
          marginType: 'RUNS',
          marginValue: 20, // narrow win
          isThrashing: false,
        }),
      );
    }
    userMatches.push(
      createTestMatchRecord({
        fixtureId: 'sf1',
        stage: 'SEMIFINAL',
        matchNumber: 29,
        userWon: true,
        isTie: false,
        marginType: 'RUNS',
        marginValue: 15,
        isThrashing: false,
      }),
    );
    userMatches.push(
      createTestMatchRecord({
        fixtureId: 'final',
        stage: 'FINAL',
        matchNumber: 31,
        userWon: true,
        isTie: false,
        marginType: 'RUNS',
        marginValue: 10,
        isThrashing: false,
      }),
    );

    const result = evaluateCampaignAchievements(userMatches, odiRules, true);

    expect(result.champion).toBe(true);
    expect(result.invincible).toBe(true);
    expect(result.goldenInvincible).toBe(false); // not all thrashings
    expect(result.achievements.find((a) => a.id === 'champion')?.unlocked).toBe(true);
    expect(result.achievements.find((a) => a.id === 'invincible')?.unlocked).toBe(true);
    expect(result.achievements.find((a) => a.id === 'golden_invincible')?.unlocked).toBe(false);
  });

  it('evaluates Golden Invincible when all 9 matches are won with thrashings', () => {
    const userMatches: CampaignMatchRecord[] = [];
    for (let r = 1; r <= 7; r++) {
      userMatches.push(
        createTestMatchRecord({
          fixtureId: `grp_r${r}_m1`,
          matchNumber: r,
          userWon: true,
          isTie: false,
          marginType: 'RUNS',
          marginValue: 60,
          isThrashing: true,
        }),
      );
    }
    userMatches.push(
      createTestMatchRecord({
        fixtureId: 'sf1',
        stage: 'SEMIFINAL',
        matchNumber: 29,
        userWon: true,
        isTie: false,
        marginType: 'WICKETS',
        marginValue: 8,
        ballsRemaining: 45,
        isThrashing: true,
      }),
    );
    userMatches.push(
      createTestMatchRecord({
        fixtureId: 'final',
        stage: 'FINAL',
        matchNumber: 31,
        userWon: true,
        isTie: false,
        marginType: 'RUNS',
        marginValue: 75,
        isThrashing: true,
      }),
    );

    const result = evaluateCampaignAchievements(userMatches, odiRules, true);

    expect(result.champion).toBe(true);
    expect(result.invincible).toBe(true);
    expect(result.goldenInvincible).toBe(true);
    expect(result.achievements.find((a) => a.id === 'golden_invincible')?.unlocked).toBe(true);
  });

  it('fails Invincible if user loses any group match', () => {
    const userMatches: CampaignMatchRecord[] = [];
    for (let r = 1; r <= 6; r++) {
      userMatches.push(
        createTestMatchRecord({
          fixtureId: `grp_r${r}_m1`,
          matchNumber: r,
          userWon: true,
          isTie: false,
          isThrashing: true,
        }),
      );
    }
    // Round 7 loss
    userMatches.push(
      createTestMatchRecord({
        fixtureId: 'grp_r7_m1',
        matchNumber: 7,
        userWon: false,
        winnerId: 'opp_aus_2007',
        isTie: false,
        isThrashing: false,
      }),
    );
    userMatches.push(
      createTestMatchRecord({
        fixtureId: 'sf1',
        stage: 'SEMIFINAL',
        matchNumber: 29,
        userWon: true,
        isTie: false,
        isThrashing: true,
      }),
    );
    userMatches.push(
      createTestMatchRecord({
        fixtureId: 'final',
        stage: 'FINAL',
        matchNumber: 31,
        userWon: true,
        isTie: false,
        isThrashing: true,
      }),
    );

    const result = evaluateCampaignAchievements(userMatches, odiRules, true);

    expect(result.champion).toBe(true);
    expect(result.invincible).toBe(false);
    expect(result.goldenInvincible).toBe(false);
  });

  it('evaluates not champion if user loses Final', () => {
    const userMatches: CampaignMatchRecord[] = [];
    for (let r = 1; r <= 7; r++) {
      userMatches.push(
        createTestMatchRecord({
          fixtureId: `grp_r${r}_m1`,
          matchNumber: r,
          userWon: true,
          isTie: false,
        }),
      );
    }
    userMatches.push(
      createTestMatchRecord({
        fixtureId: 'sf1',
        stage: 'SEMIFINAL',
        matchNumber: 29,
        userWon: true,
        isTie: false,
      }),
    );
    // Final loss
    userMatches.push(
      createTestMatchRecord({
        fixtureId: 'final',
        stage: 'FINAL',
        matchNumber: 31,
        userWon: false,
        isTie: false,
      }),
    );

    const result = evaluateCampaignAchievements(userMatches, odiRules, false);

    expect(result.champion).toBe(false);
    expect(result.invincible).toBe(false);
    expect(result.goldenInvincible).toBe(false);
  });

  it('correctly calculates thrashing criteria for ODI and T20', () => {
    // ODI: win by >= 50 runs
    expect(
      isMatchThrashing(
        { userWon: true, marginType: 'RUNS', marginValue: 50, ballsRemaining: 0 },
        odiRules.thrashing,
      ),
    ).toBe(true);
    expect(
      isMatchThrashing(
        { userWon: true, marginType: 'RUNS', marginValue: 49, ballsRemaining: 0 },
        odiRules.thrashing,
      ),
    ).toBe(false);

    // ODI: win by >= 6 wickets AND >= 30 balls remaining
    expect(
      isMatchThrashing(
        { userWon: true, marginType: 'WICKETS', marginValue: 6, ballsRemaining: 30 },
        odiRules.thrashing,
      ),
    ).toBe(true);
    expect(
      isMatchThrashing(
        { userWon: true, marginType: 'WICKETS', marginValue: 5, ballsRemaining: 35 },
        odiRules.thrashing,
      ),
    ).toBe(false);
    expect(
      isMatchThrashing(
        { userWon: true, marginType: 'WICKETS', marginValue: 6, ballsRemaining: 29 },
        odiRules.thrashing,
      ),
    ).toBe(false);

    // T20: win by >= 30 runs
    expect(
      isMatchThrashing(
        { userWon: true, marginType: 'RUNS', marginValue: 30, ballsRemaining: 0 },
        t20Rules.thrashing,
      ),
    ).toBe(true);
    expect(
      isMatchThrashing(
        { userWon: true, marginType: 'RUNS', marginValue: 29, ballsRemaining: 0 },
        t20Rules.thrashing,
      ),
    ).toBe(false);

    // T20: win by >= 6 wickets AND >= 24 balls remaining
    expect(
      isMatchThrashing(
        { userWon: true, marginType: 'WICKETS', marginValue: 6, ballsRemaining: 24 },
        t20Rules.thrashing,
      ),
    ).toBe(true);
    expect(
      isMatchThrashing(
        { userWon: true, marginType: 'WICKETS', marginValue: 6, ballsRemaining: 20 },
        t20Rules.thrashing,
      ),
    ).toBe(false);

    // If user lost, is never a thrashing
    expect(
      isMatchThrashing(
        { userWon: false, marginType: 'RUNS', marginValue: 100, ballsRemaining: 0 },
        odiRules.thrashing,
      ),
    ).toBe(false);
  });
});
