/** Player and team models consumed by the engine (kept DB-agnostic, §105). */

export type BattingStyle = 'ANCHOR' | 'AGGRESSOR';

/**
 * The clean player model passed into the engine. Ratings are on the Maiden
 * 0–99 scale (Phase 5). `batStyle` is optional metadata (§20/§35).
 */
export interface PlayerContext {
  readonly id: string;
  readonly name: string;
  /** Batting rating (0–99). Every player in the order must have one. */
  readonly batRating: number;
  /** Bowling rating (0–99), or null if the player is not a bowler. */
  readonly bowlRating: number | null;
  readonly batStyle?: BattingStyle;
}

export interface Team {
  readonly id: string;
  readonly name: string;
  /** Batting order (index 0 opens). */
  readonly players: readonly PlayerContext[];
}

export function isBowler(p: PlayerContext): boolean {
  return p.bowlRating !== null;
}
