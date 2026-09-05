import { describe, expect, it } from 'vitest';
import {
  createCampaign,
  startCampaign,
  playNextMatch,
  playEntireCampaign,
  validateCampaign,
} from '../../campaign/campaign.js';
import { CampaignAlreadyStartedError, CampaignCompletedError } from '../../campaign/rules.js';
import { createValidTestMaidenTeam } from './fixtures.js';

describe('Campaign State Machine & Orchestrator (§43–§47, §71)', () => {
  it('creates and initializes a campaign in ready state', () => {
    const userTeam = createValidTestMaidenTeam('ODI');
    const state = createCampaign(userTeam, 'ODI', 100);

    expect(state.campaignId).toBeDefined();
    expect(state.status).toBe('NOT_STARTED');
    expect(state.format).toBe('ODI');
    expect(state.opponents).toHaveLength(0);
    expect(state.fixtures).toHaveLength(0);
    expect(state.currentFixtureIndex).toBe(0);
    expect(state.completedMatches).toHaveLength(0);
    expect(state.result).toBeNull();
  });

  it('transitions from NOT_STARTED to GROUP_STAGE on start', () => {
    const userTeam = createValidTestMaidenTeam('ODI');
    const readyState = createCampaign(userTeam, 'ODI', 101);
    const inProgressState = startCampaign(readyState);

    expect(inProgressState.status).toBe('GROUP_STAGE');
    expect(inProgressState.opponents).toHaveLength(7);
    expect(inProgressState.fixtures).toHaveLength(28);
    expect(inProgressState.standings.table).toHaveLength(8);
  });

  it('throws error when trying to start an already started campaign', () => {
    const userTeam = createValidTestMaidenTeam('ODI');
    const readyState = createCampaign(userTeam, 'ODI', 102);
    const started = startCampaign(readyState);

    expect(() => startCampaign(started)).toThrow(CampaignAlreadyStartedError);
  });

  it('plays step-by-step through round 1 successfully', () => {
    const userTeam = createValidTestMaidenTeam('ODI');
    let state = createCampaign(userTeam, 'ODI', 103);

    // playNextMatch automatically starts campaign if NOT_STARTED
    state = playNextMatch(state);

    // After round 1: 4 group matches recorded (3 background + 1 user)
    expect(state.completedMatches).toHaveLength(4);
    expect(state.fixtures.filter((f) => f.status === 'COMPLETED')).toHaveLength(4);

    // Each team has played 1 match in standings
    for (const entry of state.standings.table) {
      expect(entry.played).toBe(1);
    }
  });

  it('plays entire campaign to completion via playEntireCampaign()', () => {
    const userTeam = createValidTestMaidenTeam('ODI');
    const state = createCampaign(userTeam, 'ODI', 2024);
    const finalState = playEntireCampaign(state);

    expect(finalState.status === 'COMPLETED' || finalState.status === 'ELIMINATED').toBe(true);
    expect(finalState.result).not.toBeNull();
    expect(typeof finalState.result?.champion).toBe('boolean');
    expect(typeof finalState.result?.invincible).toBe('boolean');
    expect(typeof finalState.result?.goldenInvincible).toBe('boolean');

    // All 28 group matches played
    const groupMatches = finalState.completedMatches.filter((m) => m.stage === 'GROUP');
    expect(groupMatches).toHaveLength(28);

    // Validate campaign state
    const validation = validateCampaign(finalState);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Verify standings reconciliation
    for (const entry of finalState.standings.table) {
      expect(entry.played).toBe(7);
      expect(entry.wins + entry.losses + entry.ties).toBe(7);
      expect(entry.points).toBe(entry.wins * 2 + entry.ties * 1);
    }
  });

  it('rejects playing match on an already terminated campaign', () => {
    const userTeam = createValidTestMaidenTeam('ODI');
    const state = createCampaign(userTeam, 'ODI', 2025);
    const completedState = playEntireCampaign(state);

    expect(() => playNextMatch(completedState)).toThrow(CampaignCompletedError);
  });
});
