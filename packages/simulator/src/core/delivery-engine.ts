/**
 * Delivery engine (§5 Layer 1 / §14). rating + phase + format + match-state ->
 * probability distribution -> RNG sample -> structured delivery result.
 * Consumes a per-format ProbabilityModel (calibratable, §55).
 */
import type { SeededRandom } from './random.js';
import type { DeliveryContext, DeliveryResult, OutcomeProbabilities } from '../models/delivery.js';
import { OUTCOME_RUNS } from '../models/delivery.js';
import { DEFAULT_SIMULATION_CONFIG, type ProbabilityModel } from '../config/models.js';
import { normalize, sample, validateDistribution } from '../probability/outcome.js';
import {
  applyMultipliers,
  matchStateMultipliers,
  skillMultipliers,
  styleMultipliers,
} from '../probability/modifiers.js';

/** Compose the normalized outcome distribution for a delivery. */
export function buildProbabilities(
  ctx: DeliveryContext,
  model: ProbabilityModel = DEFAULT_SIMULATION_CONFIG.formats[ctx.format],
): OutcomeProbabilities {
  const bowlRating = ctx.bowler.bowlRating ?? 50;
  let p: OutcomeProbabilities = { ...model.base };
  p = applyMultipliers(p, model.phaseMultipliers[ctx.phase]);
  p = applyMultipliers(p, skillMultipliers(ctx.batter.batRating, bowlRating, model.skill));
  p = applyMultipliers(p, styleMultipliers(ctx.batter.batStyle, model.style));
  p = applyMultipliers(
    p,
    matchStateMultipliers(ctx.matchState, model.parRunRate, model.matchState),
  );
  return normalize(p);
}

/** Simulate a single delivery. */
export function simulateDelivery(
  ctx: DeliveryContext,
  rng: SeededRandom,
  model: ProbabilityModel = DEFAULT_SIMULATION_CONFIG.formats[ctx.format],
): DeliveryResult {
  const p = buildProbabilities(ctx, model);
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
export function debugProbabilities(
  ctx: DeliveryContext,
  model: ProbabilityModel = DEFAULT_SIMULATION_CONFIG.formats[ctx.format],
): { base: OutcomeProbabilities; adjusted: OutcomeProbabilities } {
  return { base: model.base, adjusted: buildProbabilities(ctx, model) };
}
