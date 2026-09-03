/**
 * @maiden/game-data — access to curated, game-ready Maiden datasets.
 *
 * Phase 0 status: STRUCTURAL PLACEHOLDER ONLY.
 *
 * No player, tournament, squad or rating data exists yet. Cricsheet is NOT
 * downloaded and no database is populated in Phase 0. Curated data will be
 * produced by the Python data pipeline (see data-pipeline/) in later phases and
 * consumed here via a stable, typed access layer.
 */

/** Package identifier, used by smoke tests to confirm the package is importable. */
export const GAME_DATA_PACKAGE = '@maiden/game-data' as const;

/** Trivial smoke-test helper. Returns an empty dataset placeholder. */
export function listDatasets(): readonly string[] {
  return [];
}
