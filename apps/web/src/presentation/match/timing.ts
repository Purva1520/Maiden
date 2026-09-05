/**
 * Event-aware presentation timing (§53, §56, §60, §81). Pure functions — no
 * state, no scheduling. The controller multiplies these by the playback speed
 * and compresses ordinary events harder than major ones at high speed.
 */
import type { DeliveryOutcome } from '../../lib/domain.js';

export type Intensity = 'low' | 'medium' | 'high' | 'critical';

/** Base hold, in ms at 1×, for how long a revealed delivery lingers. */
const HOLD_MS: Record<Intensity, number> = {
  low: 620,
  medium: 940,
  high: 1220,
  critical: 1650,
};

/** Base hold for the ceremonial transitions between phases. */
export const PHASE_MS = {
  matchIntro: 2100,
  overBreak: 1500,
  inningsBreak: 3000,
  matchComplete: 2000,
} as const;

const MIN_MS = 110;

export function ballIntensity(outcome: DeliveryOutcome): Intensity {
  if (outcome === 'WICKET') return 'critical';
  if (outcome === 'SIX') return 'high';
  if (outcome === 'FOUR') return 'medium';
  return 'low';
}

/**
 * How long to hold a revealed delivery before auto-advancing. Low-intensity
 * events compress more aggressively as speed rises so fast-forward skims the
 * dots but still lets boundaries and wickets breathe (§56).
 */
export function ballHold(intensity: Intensity, speed: number): number {
  const extra = intensity === 'low' ? 1.5 : intensity === 'medium' ? 1.15 : 1;
  return Math.max(MIN_MS, Math.round(HOLD_MS[intensity] / (speed * extra)));
}

/** Ceremonial phase durations shrink with speed but never below a readable floor. */
export function phaseHold(base: number, speed: number, floor = 500): number {
  return Math.max(floor, Math.round(base / Math.min(speed, 2)));
}
