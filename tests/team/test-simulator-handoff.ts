import { describe, expect, it } from 'vitest';
import { australiaXI, simulateMatch } from '@maiden/simulator';
import {
  createGame,
  finalizeXI,
  selectPlayerInDraft,
  setCaptainInDraft,
} from '../../team/gameState.js';
import { toSimulatorTeam } from '../../team/adapter.js';
import { createValidTestXI } from './fixtures.js';

describe('Simulator Handoff Integration (§46, §86, §87)', () => {
  it('hands off a finalized Maiden team cleanly to Phase 6 simulateMatch() without engine errors', () => {
    const validXI = createValidTestXI();
    let state = createGame('ODI', 849273);
    state = {
      ...state,
      availablePool: validXI,
      status: 'DRAFTING',
    };

    // Draft the 11 players
    for (const player of validXI) {
      state = selectPlayerInDraft(state, player.cardId);
    }
    state = setCaptainInDraft(state, 'ms_dhoni__ODI_WC_2011');

    // Finalize XI
    const { team } = finalizeXI(state, 'Dream XI');
    expect(team.validation.valid).toBe(true);

    // Convert via simulation adapter
    const simTeamA = toSimulatorTeam(team);
    expect(simTeamA.players).toHaveLength(11);
    expect(simTeamA.players.every((p) => p.batRating >= 0 && p.batRating <= 99)).toBe(true);

    // Run simulateMatch with Phase 6 simulator
    const matchResult = simulateMatch({
      format: 'ODI',
      teamA: simTeamA,
      teamB: australiaXI,
      seed: 42,
    });

    expect(matchResult).toBeDefined();
    expect(matchResult.toss).toBeDefined();
    expect(matchResult.innings1).toBeDefined();
    expect(matchResult.innings2).toBeDefined();
    expect(matchResult.result).toBeDefined();
    expect(matchResult.innings1.legalBalls).toBeGreaterThan(0);
    expect(matchResult.innings2.legalBalls).toBeGreaterThan(0);
    expect(matchResult.result.text).toBeTruthy();
  });
});
