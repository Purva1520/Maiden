/**
 * @maiden/shared — cross-application types and utilities.
 *
 * Phase 0 keeps this package deliberately minimal: it exists to prove that
 * workspace packages can be imported across apps. The full Maiden domain model
 * (players, tournaments, deliveries, innings, matches, campaigns, ratings) is
 * intentionally NOT defined yet — that arrives in later phases once the
 * requirements are finalized.
 */

/** Health status reported by services (e.g. the API health endpoint). */
export type ServiceStatus = 'ok' | 'degraded' | 'down';

/** Shape of a health/status response, shared between the API and its clients. */
export interface HealthResponse {
  status: ServiceStatus;
}

/** Build a well-formed health response. */
export function createHealthResponse(status: ServiceStatus = 'ok'): HealthResponse {
  return { status };
}
