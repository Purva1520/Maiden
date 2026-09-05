/**
 * @maiden/simulator — Maiden cricket simulation engine (Phase 6).
 *
 * Public API: simulate a delivery, an innings, or a whole match. The engine is
 * deterministic given (teams, ratings, format, seed, version), offline, and
 * emits structured state + events for a future UI. See docs/simulation-methodology.md.
 */

// -- public engine API --
export {
  simulateDelivery,
  buildProbabilities,
  debugProbabilities,
} from './core/delivery-engine.js';
export { simulateInnings, validatePlayerRatings } from './core/innings-engine.js';
export { simulateMatch } from './core/match-engine.js';
export { SeededRandom } from './core/random.js';

// -- configuration --
export { FORMAT_CONFIG, phaseForOver } from './config/formats.js';
export { PROBABILITY_CONFIG } from './config/probabilities.js';
export { SIMULATION_VERSION, CONFIG_VERSION } from './config/version.js';
export { DEFAULT_SIMULATION_CONFIG } from './config/models.js';
export type { SimulationConfig, ProbabilityModel } from './config/models.js';
export { loadSimulationConfig } from './config/load.js';

// -- formatting & errors --
export { formatOvers, formatScore, formatStrikeRate, formatEconomy } from './format.js';
export * from './errors.js';

// -- fixtures (TEST FIXTURE teams for CLI/tests) --
export { indiaXI, australiaXI } from './fixtures.js';

// -- types --
export type {
  CricketFormat,
  MatchPhase,
  DeliveryOutcome,
  DeliveryResult,
  DeliveryContext,
  MatchState,
  WicketResult,
  OutcomeProbabilities,
} from './models/delivery.js';
export type { PlayerContext, Team, BattingStyle } from './models/player.js';
export type {
  InningsInput,
  InningsResult,
  BatterScore,
  BowlerScore,
  FallOfWicket,
  MatchEvent,
  DeliverySimulator,
} from './models/innings.js';
export type {
  MatchInput,
  MatchResult,
  MatchResultDetail,
  TossResult,
  ResultType,
} from './models/match.js';

// -- Phase 0 compatibility markers --
export const SIMULATOR_PACKAGE = '@maiden/simulator' as const;
export function simulatorReady(): boolean {
  return true;
}
