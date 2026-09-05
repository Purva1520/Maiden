/**
 * Delivery engine (§5 Layer 1): rating + phase + format + match-state ->
 * probability distribution -> RNG sample -> structured delivery result (§14).
 * Probabilistic, never deterministic around the skill gap (§13/§23).
 */
import type { SeededRandom } from './random.js';
import type { DeliveryContext, DeliveryResult, OutcomeProbabilities } from '../models/delivery.js';
import { OUTCOME_RUNS } from '../models/delivery.js';
import { PROBABILITY_CONFIG, type ProbabilityConfig } from '../config/probabilities.js';
import { normalize, sample, validateDistribution } from '../probability/outcome.js';
import {
  applyMultipliers,
  matchStateMultipliers,
  skillMultipliers,
  styleMultipliers,
} from '../probability/modifiers.js';

/** Compose the outcome distribution for a delivery (normalized). */
export function buildProbabilities(
  ctx: DeliveryContext,
  config: ProbabilityConfig = PROBABILITY_CONFIG,
): OutcomeProbabilities {
  const bowlRating = ctx.bowler.bowlRating ?? 50;
  let p: OutcomeProbabilities = { ...config.base[ctx.format] };
  p = applyMultipliers(p, config.phaseMultipliers[ctx.phase]);
  p = applyMultipliers(p, skillMultipliers(ctx.batter.batRating, bowlRating, config.skill));
  p = applyMultipliers(p, styleMultipliers(ctx.batter.batStyle, config.style));
  p = applyMultipliers(p, matchStateMultipliers(ctx.matchState, ctx.format, config.matchState));
  return normalize(p);
}

/** Simulate a single delivery. */
export function simulateDelivery(ctx: DeliveryContext, rng: SeededRandom): DeliveryResult {
  const p = buildProbabilities(ctx);
  validateDistribution(p);
  const outcome = sample(p, rng);
  const batterRuns = OUTCOME_RUNS[outcome];
  return {
    outcome,
    batterRuns,
    totalRuns: batterRuns,
    legalDelivery: true,
    wicket:
      outcome === 'WICKET'
        ? { playerOut: ctx.batter.id, dismissalKind: 'bowler', bowler: ctx.bowler.id }
        : null,
  };
}

/** Debug view of a delivery's probability pipeline (§78). Not used by default. */
export function debugProbabilities(ctx: DeliveryContext): {
  base: OutcomeProbabilities;
  adjusted: OutcomeProbabilities;
} {
  return {
    base: PROBABILITY_CONFIG.base[ctx.format],
    adjusted: buildProbabilities(ctx),
  };
}
