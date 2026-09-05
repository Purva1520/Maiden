/** Delivery-level types: outcomes, context and result. */
import type { PlayerContext } from './player.js';

export type CricketFormat = 'ODI' | 'T20';
export type MatchPhase = 'POWERPLAY' | 'MIDDLE' | 'DEATH';

/** The simplified v1 delivery outcome space (§8). Extras can be added later. */
export type DeliveryOutcome = 'DOT' | 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'SIX' | 'WICKET';

/** Canonical outcome order — also the order of a probability vector. */
export const OUTCOMES: readonly DeliveryOutcome[] = [
  'DOT',
  'ONE',
  'TWO',
  'THREE',
  'FOUR',
  'SIX',
  'WICKET',
] as const;

/** Batter runs contributed by each non-wicket outcome. */
export const OUTCOME_RUNS: Record<DeliveryOutcome, number> = {
  DOT: 0,
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  SIX: 6,
  WICKET: 0,
};

/** Probabilities indexed by outcome. */
export type OutcomeProbabilities = Record<DeliveryOutcome, number>;

export interface WicketResult {
  /** Player dismissed (the striker in v1). */
  readonly playerOut: string;
  /** v1 attributes every wicket to the bowler; structured for future kinds. */
  readonly dismissalKind: 'bowler';
  readonly bowler: string;
}

export interface DeliveryResult {
  readonly outcome: DeliveryOutcome;
  readonly batterRuns: number;
  readonly totalRuns: number;
  /** v1 deliveries are always legal; field reserved for future extras. */
  readonly legalDelivery: boolean;
  readonly wicket: WicketResult | null;
}

/** Chase / match-state context available to the delivery engine (§19/§54). */
export interface MatchState {
  readonly legalBalls: number;
  readonly wicketsLost: number;
  readonly maxBalls: number;
  /** Present only in the second innings. */
  readonly target: number | null;
  readonly runsRequired: number | null;
  readonly ballsRemaining: number | null;
}

/** Minimal input the delivery engine needs — nothing more (§9). */
export interface DeliveryContext {
  readonly batter: PlayerContext;
  readonly bowler: PlayerContext;
  readonly phase: MatchPhase;
  readonly format: CricketFormat;
  readonly matchState: MatchState;
}
