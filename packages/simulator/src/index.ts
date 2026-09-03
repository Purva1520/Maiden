/**
 * @maiden/simulator — the cricket simulation engine.
 *
 * Phase 0 status: ARCHITECTURAL PLACEHOLDER ONLY.
 *
 * No cricket logic exists yet. Deliveries, wickets, probabilities, innings,
 * scorecards, batting/bowling models, RNG and Monte Carlo simulation are all
 * out of scope for Phase 0 and will be implemented in Phase 6 (Cricket
 * Simulation Engine) onward.
 *
 * When randomness is introduced it MUST be seeded and reproducible (see
 * Principle 6, Deterministic foundations, in the roadmap). This placeholder is
 * kept side-effect-free and dependency-light so that boundary is easy to honour.
 */

/** Package identifier, used by smoke tests to confirm the package is importable. */
export const SIMULATOR_PACKAGE = '@maiden/simulator' as const;

/** Trivial smoke-test helper. Not part of any real simulation API. */
export function simulatorReady(): boolean {
  return true;
}
