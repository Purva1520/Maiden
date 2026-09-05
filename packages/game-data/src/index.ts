/**
 * @maiden/game-data — access to curated, game-ready Maiden datasets and XI building mechanics.
 */

export const GAME_DATA_PACKAGE = '@maiden/game-data' as const;

export function listDatasets(): readonly string[] {
  return [];
}

export * from './team/index.js';
export * from './campaign/index.js';
