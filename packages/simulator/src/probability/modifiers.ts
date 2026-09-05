/** Outcome-probability modifiers: phase, skill, batting style, chase pressure. */
import type { CricketFormat, MatchState, OutcomeProbabilities } from '../models/delivery.js';
import { OUTCOMES } from '../models/delivery.js';
import type { BattingStyle } from '../models/player.js';
import { FORMAT_CONFIG } from '../config/formats.js';
import type { OutcomeMultipliers, ProbabilityConfig } from '../config/probabilities.js';

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Multiply outcome weights by per-outcome multipliers (missing = 1). */
export function applyMultipliers(
  p: OutcomeProbabilities,
  m: OutcomeMultipliers,
): OutcomeProbabilities {
  const out = {} as OutcomeProbabilities;
  for (const o of OUTCOMES) out[o] = p[o] * (m[o] ?? 1);
  return out;
}

/** Batter-vs-bowler skill signal, s = (batRating − bowlRating)/100 (§13). */
export function skillMultipliers(
  batRating: number,
  bowlRating: number,
  skill: ProbabilityConfig['skill'],
): OutcomeMultipliers {
  const s = (batRating - bowlRating) / 100;
  const boundary = Math.exp(skill.boundaryK * s);
  return {
    FOUR: boundary,
    SIX: boundary,
    WICKET: Math.exp(-skill.wicketK * s),
    DOT: Math.exp(-skill.dotK * s),
  };
}

export function styleMultipliers(
  style: BattingStyle | undefined,
  cfg: ProbabilityConfig['style'],
): OutcomeMultipliers {
  return style ? cfg[style] : {};
}

/** Chase-pressure aggression from the required run rate (§19/§54). */
export function matchStateMultipliers(
  state: MatchState,
  format: CricketFormat,
  cfg: ProbabilityConfig['matchState'],
): OutcomeMultipliers {
  if (state.runsRequired === null || state.ballsRemaining === null || state.ballsRemaining <= 0) {
    return {};
  }
  const requiredRunRate = (state.runsRequired * 6) / state.ballsRemaining;
  const parRunRate = FORMAT_CONFIG[format].parRunRate;
  const aggression = clamp(
    (requiredRunRate - parRunRate) / cfg.scale,
    -cfg.maxAggression,
    cfg.maxAggression,
  );
  const boundary = Math.exp(aggression * cfg.boundaryResponse);
  return {
    FOUR: boundary,
    SIX: boundary,
    WICKET: Math.exp(aggression * cfg.wicketResponse),
    DOT: Math.exp(-aggression * cfg.dotResponse),
  };
}
