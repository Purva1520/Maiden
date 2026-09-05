/** Build, normalize, validate and sample outcome probability distributions. */
import type { SeededRandom } from '../core/random.js';
import type { DeliveryOutcome, OutcomeProbabilities } from '../models/delivery.js';
import { OUTCOME_RUNS, OUTCOMES } from '../models/delivery.js';
import { SimulationInvariantError } from '../errors.js';

/** Clamp negatives to 0 and rescale so the vector sums to 1 (§79/§80). */
export function normalize(p: OutcomeProbabilities): OutcomeProbabilities {
  const out = {} as OutcomeProbabilities;
  let sum = 0;
  for (const o of OUTCOMES) {
    const v = p[o] < 0 ? 0 : p[o];
    out[o] = v;
    sum += v;
  }
  if (sum <= 0) {
    throw new SimulationInvariantError('Outcome probabilities sum to zero after clamping');
  }
  for (const o of OUTCOMES) out[o] /= sum;
  return out;
}

/** Assert a valid probability distribution (§15). */
export function validateDistribution(p: OutcomeProbabilities): void {
  let sum = 0;
  for (const o of OUTCOMES) {
    const v = p[o];
    if (!Number.isFinite(v) || v < 0) {
      throw new SimulationInvariantError(`Invalid probability for ${o}: ${v}`);
    }
    sum += v;
  }
  if (Math.abs(sum - 1) > 1e-6) {
    throw new SimulationInvariantError(`Probabilities sum to ${sum}, expected 1`);
  }
}

/** Weighted categorical sample using a single RNG draw (§81). */
export function sample(p: OutcomeProbabilities, rng: SeededRandom): DeliveryOutcome {
  const draw = rng.next();
  let cumulative = 0;
  for (const o of OUTCOMES) {
    cumulative += p[o];
    if (draw < cumulative) return o;
  }
  return 'DOT'; // numerical safety net (cumulative ≈ 1)
}

export function expectedRuns(p: OutcomeProbabilities): number {
  let e = 0;
  for (const o of OUTCOMES) e += p[o] * OUTCOME_RUNS[o];
  return e;
}
