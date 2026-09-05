/**
 * Achievement-boundary regressions (Phase 12 §151, §153). Champion, Invincible
 * and Golden Invincible are three intentionally different things — these lock in
 * the cases where they diverge.
 */
import { describe, expect, it } from 'vitest';
import { evaluateCampaignAchievements } from '../../campaign/achievements.js';
import { createTestMatchRecord } from './fixtures.js';
import type { CampaignMatchRecord, FormatCampaignRules } from '../../campaign/types.js';

const odiRules: FormatCampaignRules = {
  groupTeams: 8,
  qualifiers: 4,
  matchesPerTeam: 7,
  thrashing: { winByRuns: 50, winByWickets: 6, minBallsRemaining: 30 },
};

function nineMatches(
  mut: (i: number, base: Partial<CampaignMatchRecord>) => Partial<CampaignMatchRecord>,
): CampaignMatchRecord[] {
  const out: CampaignMatchRecord[] = [];
  for (let r = 1; r <= 7; r++)
    out.push(createTestMatchRecord(mut(r, { fixtureId: `grp_r${r}_m1`, matchNumber: r })));
  out.push(
    createTestMatchRecord(mut(8, { fixtureId: 'sf1', stage: 'SEMIFINAL', matchNumber: 29 })),
  );
  out.push(createTestMatchRecord(mut(9, { fixtureId: 'final', stage: 'FINAL', matchNumber: 31 })));
  return out;
}

describe('achievement boundaries (§151, §153)', () => {
  it('a Champion who lost a group match is NOT Invincible', () => {
    const matches = nineMatches((i, base) => ({
      ...base,
      // Lose group match 3; win everything else including the final.
      userWon: i !== 3,
      isTie: false,
      marginType: 'RUNS',
      marginValue: 40,
      isThrashing: false,
    }));
    const r = evaluateCampaignAchievements(matches, odiRules, true);
    expect(r.champion).toBe(true);
    expect(r.invincible).toBe(false);
    expect(r.goldenInvincible).toBe(false);
  });

  it('one narrow win breaks Golden Invincible but not Invincible', () => {
    const matches = nineMatches((i, base) => ({
      ...base,
      userWon: true,
      isTie: false,
      marginType: 'RUNS',
      // All thrashings (>= 50) except match 4, a narrow 20-run win.
      marginValue: i === 4 ? 20 : 60,
    }));
    const r = evaluateCampaignAchievements(matches, odiRules, true);
    expect(r.champion).toBe(true);
    expect(r.invincible).toBe(true);
    expect(r.goldenInvincible).toBe(false);
  });

  it('a single tie prevents Invincible even for the Champion', () => {
    const matches = nineMatches((i, base) => ({
      ...base,
      userWon: i !== 2, // match 2 is a tie (not a win)
      isTie: i === 2,
      marginType: i === 2 ? 'TIE' : 'RUNS',
      marginValue: i === 2 ? 0 : 60,
    }));
    const r = evaluateCampaignAchievements(matches, odiRules, true);
    expect(r.champion).toBe(true);
    expect(r.invincible).toBe(false);
  });
});
