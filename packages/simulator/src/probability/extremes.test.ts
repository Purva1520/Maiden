/**
 * Extreme-rating boundary tests (Phase 12 §24). The probability model must stay
 * valid at the corners of the rating space — no NaN, no negatives, no > 1, and
 * the seven outcomes must still sum to 1.
 */
import { describe, it, expect } from 'vitest';
import { buildProbabilities, simulateDelivery } from '../core/delivery-engine.js';
import { validateDistribution } from './outcome.js';
import { SeededRandom } from '../core/random.js';
import type { CricketFormat, DeliveryContext, MatchPhase, MatchState } from '../models/delivery.js';
import type { PlayerContext } from '../models/player.js';

const STATE: MatchState = {
  legalBalls: 60,
  wicketsLost: 2,
  maxBalls: 300,
  target: null,
  runsRequired: null,
  ballsRemaining: null,
};

function ctx(
  batRating: number,
  bowlRating: number,
  phase: MatchPhase,
  format: CricketFormat,
): DeliveryContext {
  const batter: PlayerContext = { id: 'b', name: 'B', batRating, bowlRating: null };
  const bowler: PlayerContext = { id: 'w', name: 'W', batRating: 20, bowlRating };
  return { batter, bowler, phase, format, matchState: STATE };
}

const CORNERS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, 99],
  [99, 0],
  [99, 99],
];

describe('extreme ratings (§24)', () => {
  it('produce a valid distribution at every corner, phase and format', () => {
    for (const format of ['ODI', 'T20'] as const) {
      for (const phase of ['POWERPLAY', 'MIDDLE', 'DEATH'] as const) {
        for (const [b, w] of CORNERS) {
          const p = buildProbabilities(ctx(b, w, phase, format)) as Record<string, number>;
          const values = Object.values(p);
          for (const v of values) {
            expect(Number.isFinite(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
          }
          expect(values.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
          expect(() => validateDistribution(p as never)).not.toThrow();
        }
      }
    }
  });

  it('sample a legal outcome at every corner without NaN', () => {
    for (const [b, w] of CORNERS) {
      const rng = new SeededRandom(12345);
      for (let i = 0; i < 50; i++) {
        const res = simulateDelivery(ctx(b, w, 'MIDDLE', 'ODI'), rng);
        expect(['DOT', 'ONE', 'TWO', 'THREE', 'FOUR', 'SIX', 'WICKET']).toContain(res.outcome);
        expect(Number.isFinite(res.totalRuns)).toBe(true);
      }
    }
  });
});
