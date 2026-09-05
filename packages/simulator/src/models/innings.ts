/** Innings-level types: scorecards, events, results. */
import type { CricketFormat, DeliveryOutcome } from './delivery.js';
import type { PlayerContext, Team } from './player.js';

export interface BatterScore {
  readonly playerId: string;
  readonly name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissed: boolean;
  /** Bowler credited with the dismissal, or null if not out. */
  dismissalBowler: string | null;
  /** Whether the batter came to the crease. */
  batted: boolean;
}

export interface BowlerScore {
  readonly playerId: string;
  readonly name: string;
  balls: number;
  runs: number;
  wickets: number;
  maidens: number;
}

export interface FallOfWicket {
  readonly wicketNumber: number;
  readonly score: number;
  readonly legalBalls: number;
  readonly batterId: string;
  readonly batterName: string;
}

export type MatchEventType =
  | 'MATCH_START'
  | 'TOSS'
  | 'INNINGS_START'
  | 'OVER_START'
  | 'DELIVERY'
  | 'WICKET'
  | 'OVER_END'
  | 'INNINGS_END'
  | 'MATCH_END';

export interface MatchEvent {
  readonly type: MatchEventType;
  readonly [key: string]: unknown;
}

export interface DeliveryEvent extends MatchEvent {
  readonly type: 'DELIVERY';
  readonly inningsNumber: number;
  readonly over: number;
  readonly ball: number;
  readonly batter: string;
  readonly bowler: string;
  readonly outcome: DeliveryOutcome;
  readonly runs: number;
  readonly scoreAfter: string;
}

export interface InningsInput {
  readonly inningsNumber: number;
  readonly battingTeam: Team;
  readonly bowlingTeam: Team;
  readonly format: CricketFormat;
  /** Chase target (runs to win); null in the first innings. */
  readonly target: number | null;
}

export interface InningsResult {
  readonly inningsNumber: number;
  readonly battingTeamId: string;
  readonly battingTeamName: string;
  readonly bowlingTeamId: string;
  readonly runs: number;
  readonly wickets: number;
  readonly legalBalls: number;
  readonly allOut: boolean;
  readonly targetReached: boolean;
  readonly battingCard: readonly BatterScore[];
  readonly bowlingCard: readonly BowlerScore[];
  readonly fallOfWickets: readonly FallOfWicket[];
  readonly events: readonly MatchEvent[];
}

/** A delivery simulator can be injected for deterministic testing (§72). */
export type DeliverySimulator = (
  context: import('./delivery.js').DeliveryContext,
  rng: import('../core/random.js').SeededRandom,
) => import('./delivery.js').DeliveryResult;

export type { PlayerContext };
