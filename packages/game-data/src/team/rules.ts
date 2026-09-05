import type { CricketFormat } from './types.js';

export interface TeamRules {
  readonly xiSize: number;
  readonly minWicketkeepers: number;
  readonly minBowlingOptions: number;
  readonly minTopOrder: number;
  readonly defaultRollCount: number;
  readonly allowDuplicateHistoricalTeam: boolean;
  readonly allowDuplicateCanonicalPlayer: boolean;
}

export const BASE_TEAM_RULES: TeamRules = {
  xiSize: 11,
  minWicketkeepers: 1,
  minBowlingOptions: 5,
  minTopOrder: 2,
  defaultRollCount: 3,
  allowDuplicateHistoricalTeam: false,
  allowDuplicateCanonicalPlayer: false,
};

export const ODI_TEAM_RULES: TeamRules = {
  ...BASE_TEAM_RULES,
};

export const T20_TEAM_RULES: TeamRules = {
  ...BASE_TEAM_RULES,
};

export function getTeamRules(format: CricketFormat): TeamRules {
  switch (format) {
    case 'ODI':
      return ODI_TEAM_RULES;
    case 'T20':
      return T20_TEAM_RULES;
    default:
      return BASE_TEAM_RULES;
  }
}

export const ERROR_CODES = {
  XI_TOO_SMALL: 'XI_TOO_SMALL',
  XI_TOO_LARGE: 'XI_TOO_LARGE',
  NO_WICKETKEEPER: 'NO_WICKETKEEPER',
  INSUFFICIENT_BOWLING_OPTIONS: 'INSUFFICIENT_BOWLING_OPTIONS',
  INSUFFICIENT_TOP_ORDER: 'INSUFFICIENT_TOP_ORDER',
  DUPLICATE_PLAYER: 'DUPLICATE_PLAYER',
  INVALID_CAPTAIN: 'INVALID_CAPTAIN',
  INVALID_BATTING_ORDER: 'INVALID_BATTING_ORDER',
  PLAYER_NOT_IN_POOL: 'PLAYER_NOT_IN_POOL',
  PLAYER_ALREADY_SELECTED: 'PLAYER_ALREADY_SELECTED',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_ROLL: 'INVALID_ROLL',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
} as const;
