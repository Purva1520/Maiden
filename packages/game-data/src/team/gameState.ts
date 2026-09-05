import type {
  CricketFormat,
  MaidenGameState,
  MaidenTeam,
  PlayerCard,
  RollConfig,
  XIValidationResult,
} from './types.js';
import { getTeamRules } from './rules.js';
import {
  DEFAULT_ROLL_CONFIG,
  buildPlayerPool,
  removePlayer,
  replacePlayer,
  rollHistoricalTeams,
  selectPlayer,
} from './squadBuilder.js';
import {
  createDefaultBattingOrder,
  setBattingOrder,
  swapPlayers,
  movePlayer,
} from './battingOrder.js';
import { getBowlingOptions } from './bowlingOptions.js';
import { buildFormation } from './formation.js';
import { validateXI } from './xiValidator.js';

export const GAME_SCHEMA_VERSION = 1;

/**
 * Initializes a new Maiden game session (§6, §7, §48–§50).
 */
export function createGame(
  format: CricketFormat,
  seed: number,
  customRollConfig?: Partial<RollConfig>,
): MaidenGameState {
  if (format !== 'ODI' && format !== 'T20') {
    throw new Error(`Format must be 'ODI' or 'T20'; received: ${format}`);
  }

  const rollConfig: RollConfig = {
    ...DEFAULT_ROLL_CONFIG,
    ...customRollConfig,
  };

  return {
    schemaVersion: GAME_SCHEMA_VERSION,
    gameId: `game_${format.toLowerCase()}_${seed}`,
    format,
    seed,
    rollConfig,
    rolledTeams: [],
    availablePool: [],
    selectedPlayerIds: [],
    captainId: null,
    battingOrder: [],
    status: 'ROLL_PENDING',
  };
}

/**
 * Executes the historical roll transition: ROLL_PENDING -> DRAFTING.
 */
export function rollTeams(state: MaidenGameState): MaidenGameState {
  if (state.status !== 'ROLL_PENDING') {
    throw new Error(`Cannot roll teams in status: ${state.status} (expected ROLL_PENDING)`);
  }

  const rolledTeams = rollHistoricalTeams(state.format, state.seed, state.rollConfig);
  const availablePool = buildPlayerPool(rolledTeams);

  return {
    ...state,
    rolledTeams,
    availablePool,
    status: 'DRAFTING',
  };
}

function getSelectedCards(state: MaidenGameState): PlayerCard[] {
  const cardMap = new Map(state.availablePool.map((c) => [c.cardId, c]));
  const cards: PlayerCard[] = [];
  for (const id of state.selectedPlayerIds) {
    const c = cardMap.get(id);
    if (c) cards.push(c);
  }
  return cards;
}

/**
 * Selects a player card into the draft.
 */
export function selectPlayerInDraft(state: MaidenGameState, cardId: string): MaidenGameState {
  if (state.status !== 'DRAFTING' && state.status !== 'XI_IN_PROGRESS') {
    throw new Error(`Cannot select player in status: ${state.status}`);
  }

  const currentSelected = getSelectedCards(state);
  const updatedSelected = selectPlayer(currentSelected, state.availablePool, cardId);
  const updatedIds = updatedSelected.map((c) => c.cardId);

  // Auto-generate sensible default batting order with the new player
  const newOrder = createDefaultBattingOrder(updatedSelected);

  return {
    ...state,
    selectedPlayerIds: updatedIds,
    battingOrder: newOrder,
    status: 'XI_IN_PROGRESS',
  };
}

/**
 * Removes a player card from the draft.
 */
export function removePlayerInDraft(state: MaidenGameState, cardId: string): MaidenGameState {
  if (
    state.status !== 'DRAFTING' &&
    state.status !== 'XI_IN_PROGRESS' &&
    state.status !== 'READY'
  ) {
    throw new Error(`Cannot remove player in status: ${state.status}`);
  }

  const currentSelected = getSelectedCards(state);
  const updatedSelected = removePlayer(currentSelected, cardId);
  const updatedIds = updatedSelected.map((c) => c.cardId);

  const updatedCaptain = state.captainId === cardId ? null : state.captainId;
  const updatedOrder = state.battingOrder.filter((id) => id !== cardId);

  return {
    ...state,
    selectedPlayerIds: updatedIds,
    captainId: updatedCaptain,
    battingOrder: updatedOrder,
    status: updatedIds.length === 0 ? 'DRAFTING' : 'XI_IN_PROGRESS',
  };
}

/**
 * Replaces one selected player with another.
 */
export function replacePlayerInDraft(
  state: MaidenGameState,
  outCardId: string,
  inCardId: string,
): MaidenGameState {
  if (state.status !== 'DRAFTING' && state.status !== 'XI_IN_PROGRESS') {
    throw new Error(`Cannot replace player in status: ${state.status}`);
  }

  const currentSelected = getSelectedCards(state);
  const updatedSelected = replacePlayer(currentSelected, state.availablePool, outCardId, inCardId);
  const updatedIds = updatedSelected.map((c) => c.cardId);

  const updatedCaptain = state.captainId === outCardId ? inCardId : state.captainId;
  const updatedOrder = state.battingOrder.map((id) => (id === outCardId ? inCardId : id));

  return {
    ...state,
    selectedPlayerIds: updatedIds,
    captainId: updatedCaptain,
    battingOrder: updatedOrder,
    status: 'XI_IN_PROGRESS',
  };
}

/**
 * Designates the playing XI captain.
 */
export function setCaptainInDraft(state: MaidenGameState, cardId: string): MaidenGameState {
  if (!state.selectedPlayerIds.includes(cardId)) {
    throw new Error(`Captain ${cardId} must be one of the selected XI players.`);
  }

  return {
    ...state,
    captainId: cardId,
  };
}

/**
 * Updates the batting order with a newly specified array.
 */
export function setBattingOrderInDraft(
  state: MaidenGameState,
  newOrder: readonly string[],
): MaidenGameState {
  const verifiedOrder = setBattingOrder(newOrder, state.selectedPlayerIds);
  return {
    ...state,
    battingOrder: verifiedOrder,
  };
}

/**
 * Swaps two players in the batting order.
 */
export function swapBattingOrderPositions(
  state: MaidenGameState,
  cardIdA: string,
  cardIdB: string,
): MaidenGameState {
  const swapped = swapPlayers(state.battingOrder, cardIdA, cardIdB);
  return {
    ...state,
    battingOrder: swapped,
  };
}

/**
 * Moves a player in the batting order from one index to another.
 */
export function moveBattingOrderPosition(
  state: MaidenGameState,
  fromIndex: number,
  toIndex: number,
): MaidenGameState {
  const moved = movePlayer(state.battingOrder, fromIndex, toIndex);
  return {
    ...state,
    battingOrder: moved,
  };
}

/**
 * Runs full structured validation on the current draft state (§31, §62).
 */
export function validateDraft(state: MaidenGameState): XIValidationResult {
  const selectedCards = getSelectedCards(state);
  const rules = getTeamRules(state.format);
  return validateXI(selectedCards, state.captainId, state.battingOrder, rules);
}

/**
 * Finalizes the XI and returns an immutable MaidenTeam (§84, §85).
 */
export function finalizeXI(
  state: MaidenGameState,
  teamName: string = 'Maiden XI',
): { state: MaidenGameState; team: MaidenTeam } {
  const validation = validateDraft(state);
  if (!validation.valid) {
    throw new Error(`Cannot finalize invalid XI: ${validation.errors.join('; ')}`);
  }

  const selectedCards = getSelectedCards(state);
  const formation = buildFormation(selectedCards, state.battingOrder);
  const bowlingOpts = getBowlingOptions(selectedCards);

  const team: MaidenTeam = {
    teamId: state.gameId,
    name: teamName,
    format: state.format,
    players: Object.freeze([...selectedCards]),
    captainId: state.captainId!,
    battingOrder: Object.freeze([...state.battingOrder]),
    bowlingOptions: Object.freeze(bowlingOpts.all.map((b) => b.cardId)),
    formation: Object.freeze({ ...formation }),
    validation: Object.freeze({ ...validation }),
  };

  const nextState: MaidenGameState = {
    ...state,
    status: 'READY',
  };

  return {
    state: nextState,
    team,
  };
}

/**
 * Resets the draft state (§50).
 */
export function resetDraft(state: MaidenGameState): MaidenGameState {
  return {
    ...state,
    selectedPlayerIds: [],
    captainId: null,
    battingOrder: [],
    status: state.rolledTeams.length > 0 ? 'DRAFTING' : 'ROLL_PENDING',
  };
}

/**
 * Serializes the game state to JSON (§6, §79).
 */
export function serializeGameState(state: MaidenGameState): string {
  return JSON.stringify(state, null, 2);
}

/**
 * Deserializes a game state from JSON (§6, §79).
 */
export function deserializeGameState(json: string): MaidenGameState {
  const obj = JSON.parse(json);
  if (!obj || typeof obj !== 'object') {
    throw new Error('Invalid game state JSON');
  }
  if (obj.schemaVersion !== GAME_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema version: ${obj.schemaVersion} (current: ${GAME_SCHEMA_VERSION})`,
    );
  }
  return obj as MaidenGameState;
}
