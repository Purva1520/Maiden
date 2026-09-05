import { describe, expect, it } from 'vitest';
import {
  createCampaign,
  playEntireCampaign,
  playNextMatch,
  startCampaign,
  serializeCampaign,
  deserializeCampaign,
} from '../../campaign/campaign.js';
import { createValidTestMaidenTeam } from './fixtures.js';

describe('Campaign Determinism & Serialization Replay (§64–§69, §77)', () => {
  it('guarantees identical campaign outcomes from identical seeds (determinism)', () => {
    const seed = 88888;
    const userTeam1 = createValidTestMaidenTeam('ODI');
    const userTeam2 = createValidTestMaidenTeam('ODI');

    const campaign1 = playEntireCampaign(createCampaign(userTeam1, 'ODI', seed));
    const campaign2 = playEntireCampaign(createCampaign(userTeam2, 'ODI', seed));

    expect(campaign1.result?.champion).toBe(campaign2.result?.champion);
    expect(campaign1.result?.invincible).toBe(campaign2.result?.invincible);
    expect(campaign1.result?.goldenInvincible).toBe(campaign2.result?.goldenInvincible);
    expect(campaign1.result?.qualificationStageReached).toBe(
      campaign2.result?.qualificationStageReached,
    );

    expect(campaign1.standings.table.map((e) => e.teamId)).toEqual(
      campaign2.standings.table.map((e) => e.teamId),
    );
    expect(campaign1.standings.table.map((e) => e.points)).toEqual(
      campaign2.standings.table.map((e) => e.points),
    );

    // Verify individual match scores match exactly
    expect(campaign1.completedMatches.length).toBe(campaign2.completedMatches.length);
    for (let i = 0; i < campaign1.completedMatches.length; i++) {
      const m1 = campaign1.completedMatches[i]!;
      const m2 = campaign2.completedMatches[i]!;
      expect(m1.fixtureId).toBe(m2.fixtureId);
      expect(m1.winnerId).toBe(m2.winnerId);
      expect(m1.homeScore.runs).toBe(m2.homeScore.runs);
      expect(m1.awayScore.runs).toBe(m2.awayScore.runs);
    }
  });

  it('preserves complete state across JSON serialization and deserialization', () => {
    const userTeam = createValidTestMaidenTeam('ODI');
    let state = startCampaign(createCampaign(userTeam, 'ODI', 7777));

    // Play 3 rounds (12 matches total)
    state = playNextMatch(state);
    state = playNextMatch(state);
    state = playNextMatch(state);

    const jsonStr = serializeCampaign(state);
    const restored = deserializeCampaign(jsonStr);

    expect(restored.campaignId).toBe(state.campaignId);
    expect(restored.seed).toBe(state.seed);
    expect(restored.status).toBe(state.status);
    expect(restored.currentFixtureIndex).toBe(state.currentFixtureIndex);
    expect(restored.completedMatches).toHaveLength(state.completedMatches.length);
    expect(restored.standings.table).toHaveLength(state.standings.table.length);

    // Play round 4 on both original and restored
    const nextState1 = playNextMatch(state);
    const nextState2 = playNextMatch(restored);

    expect(nextState1.currentFixtureIndex).toBe(nextState2.currentFixtureIndex);
    expect(nextState1.completedMatches.length).toBe(nextState2.completedMatches.length);
    const latest1 = nextState1.completedMatches[nextState1.completedMatches.length - 1]!;
    const latest2 = nextState2.completedMatches[nextState2.completedMatches.length - 1]!;
    expect(latest1.winnerId).toBe(latest2.winnerId);
    expect(latest1.homeScore.runs).toBe(latest2.homeScore.runs);
    expect(latest1.awayScore.runs).toBe(latest2.awayScore.runs);
  });
});
