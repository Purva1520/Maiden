/**
 * Probability model parameters (§16/§76/§77). These are model HYPOTHESES to be
 * calibrated in Phase 7 — the engine consumes them; it does not embed them.
 *
 * Base distributions describe an average batter vs average bowler on a middle-
 * over delivery. Phase, skill, batting-style and chase-pressure modifiers scale
 * individual outcome weights; the engine renormalizes afterwards.
 */
import type {
  CricketFormat,
  DeliveryOutcome,
  MatchPhase,
  OutcomeProbabilities,
} from '../models/delivery.js';
import type { BattingStyle } from '../models/player.js';

export type OutcomeMultipliers = Partial<Record<DeliveryOutcome, number>>;

export interface ProbabilityConfig {
  readonly base: Record<CricketFormat, OutcomeProbabilities>;
  readonly phaseMultipliers: Record<MatchPhase, OutcomeMultipliers>;
  readonly skill: {
    /** exp(k·s) on boundaries; s = (batRating − bowlRating)/100. */
    readonly boundaryK: number;
    /** exp(−k·s) on wickets. */
    readonly wicketK: number;
    /** exp(−k·s) on dots. */
    readonly dotK: number;
  };
  readonly style: Record<BattingStyle, OutcomeMultipliers>;
  readonly matchState: {
    /** Aggression = clamp((requiredRR − parRR)/scale, −max, max). */
    readonly scale: number;
    readonly maxAggression: number;
    readonly boundaryResponse: number;
    readonly wicketResponse: number;
    readonly dotResponse: number;
  };
}

export const PROBABILITY_CONFIG: ProbabilityConfig = {
  base: {
    ODI: { DOT: 0.425, ONE: 0.33, TWO: 0.07, THREE: 0.006, FOUR: 0.115, SIX: 0.024, WICKET: 0.03 },
    T20: { DOT: 0.36, ONE: 0.33, TWO: 0.06, THREE: 0.004, FOUR: 0.15, SIX: 0.05, WICKET: 0.046 },
  },
  phaseMultipliers: {
    POWERPLAY: { DOT: 0.95, FOUR: 1.15, SIX: 1.15, WICKET: 1.1 },
    MIDDLE: { DOT: 1.05, ONE: 1.05, FOUR: 0.9, SIX: 0.85 },
    DEATH: { DOT: 0.9, ONE: 0.95, FOUR: 1.3, SIX: 1.6, WICKET: 1.5 },
  },
  skill: { boundaryK: 0.9, wicketK: 1.1, dotK: 0.4 },
  style: {
    ANCHOR: { DOT: 1.1, ONE: 1.05, FOUR: 0.95, SIX: 0.8, WICKET: 0.9 },
    AGGRESSOR: { DOT: 0.92, ONE: 0.98, FOUR: 1.15, SIX: 1.2, WICKET: 1.15 },
  },
  matchState: {
    scale: 3.0,
    maxAggression: 2.5,
    boundaryResponse: 0.35,
    wicketResponse: 0.25,
    dotResponse: 0.3,
  },
};
