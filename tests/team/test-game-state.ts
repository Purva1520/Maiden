import { describe, expect, it } from 'vitest';
import {
  createGame,
  deserializeGameState,
  finalizeXI,
  removePlayerInDraft,
  resetDraft,
  rollTeams,
  selectPlayerInDraft,
  serializeGameState,
  setCaptainInDraft,
  validateDraft,
} from '../../team/gameState.js';
import { createValidTestXI } from './fixtures.js';

describe('Game State & Lifecycle (§6, §48–§50, §78–§80)', () => {
  it('follows the valid lifecycle: ROLL_PENDING -> DRAFTING -> XI_IN_PROGRESS -> READY', () => {
    let state = createGame('ODI', 849273);
    expect(state.status).toBe('ROLL_PENDING');
    expect(state.format).toBe('ODI');
    expect(state.seed).toBe(849273);

    // Roll teams
    state = rollTeams(state);
    expect(state.status).toBe('DRAFTING');
    expect(state.rolledTeams).toHaveLength(3);
    expect(state.availablePool.length).toBeGreaterThanOrEqual(25);

    // Select first player
    const firstCard = state.availablePool[0]!;
    state = selectPlayerInDraft(state, firstCard.cardId);
    expect(state.status).toBe('XI_IN_PROGRESS');
    expect(state.selectedPlayerIds).toContain(firstCard.cardId);
  });

  it('rejects invalid state transitions', () => {
    const state = createGame('ODI', 849273);
    // Cannot select player while status is ROLL_PENDING
    expect(() => selectPlayerInDraft(state, 'card_1')).toThrow(/Cannot select player/);
  });

  it('serializes and deserializes game state to and from JSON losslessly', () => {
    let state = createGame('ODI', 849273);
    state = rollTeams(state);
    const card = state.availablePool[0]!;
    state = selectPlayerInDraft(state, card.cardId);
    state = setCaptainInDraft(state, card.cardId);

    const json = serializeGameState(state);
    const restored = deserializeGameState(json);

    expect(restored.schemaVersion).toBe(state.schemaVersion);
    expect(restored.gameId).toBe(state.gameId);
    expect(restored.format).toBe(state.format);
    expect(restored.seed).toBe(state.seed);
    expect(restored.status).toBe(state.status);
    expect(restored.captainId).toBe(state.captainId);
    expect(restored.selectedPlayerIds).toEqual(state.selectedPlayerIds);
    expect(restored.rolledTeams).toEqual(state.rolledTeams);
  });

  it('removes a selected player and resets captain if that player was captain', () => {
    let state = createGame('ODI', 849273);
    state = rollTeams(state);
    const card = state.availablePool[0]!;
    state = selectPlayerInDraft(state, card.cardId);
    state = setCaptainInDraft(state, card.cardId);
    expect(state.captainId).toBe(card.cardId);

    state = removePlayerInDraft(state, card.cardId);
    expect(state.selectedPlayerIds).not.toContain(card.cardId);
    expect(state.captainId).toBeNull();
  });

  it('resets the draft state cleanly', () => {
    let state = createGame('ODI', 849273);
    state = rollTeams(state);
    const card = state.availablePool[0]!;
    state = selectPlayerInDraft(state, card.cardId);
    state = setCaptainInDraft(state, card.cardId);

    state = resetDraft(state);
    expect(state.selectedPlayerIds).toHaveLength(0);
    expect(state.captainId).toBeNull();
    expect(state.battingOrder).toHaveLength(0);
    expect(state.status).toBe('DRAFTING');
  });

  it('finalizes a valid XI and locks it into an immutable MaidenTeam', () => {
    const validXI = createValidTestXI();
    let state = createGame('ODI', 11111);
    // Inject the valid XI into availablePool
    state = {
      ...state,
      availablePool: validXI,
      status: 'DRAFTING',
    };

    for (const player of validXI) {
      state = selectPlayerInDraft(state, player.cardId);
    }
    state = setCaptainInDraft(state, 'ms_dhoni__ODI_WC_2011');

    const validation = validateDraft(state);
    expect(validation.valid).toBe(true);

    const { team, state: readyState } = finalizeXI(state, 'Test XI');
    expect(readyState.status).toBe('READY');
    expect(team.name).toBe('Test XI');
    expect(team.players).toHaveLength(11);
    expect(team.captainId).toBe('ms_dhoni__ODI_WC_2011');
    expect(team.formation.wicketkeepers).toContain('ms_dhoni__ODI_WC_2011');
    expect(team.bowlingOptions.length).toBeGreaterThanOrEqual(5);
  });
});
