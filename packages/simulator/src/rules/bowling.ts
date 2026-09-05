/** Bowling rotation & eligibility (§34/§35/§92). */
import type { BowlerScore } from '../models/innings.js';
import { NoEligibleBowlerError } from '../errors.js';

/**
 * Choose the next bowler: a bowl-capable player who has overs remaining and did
 * not bowl the previous over. Deterministic — least-used first, ties broken by
 * squad order. Throws if no legal bowler is available (never exceeds the limit).
 */
export function chooseBowler(
  bowlers: readonly BowlerScore[],
  maxBallsPerBowler: number,
  lastBowlerId: string | null,
): BowlerScore {
  let best: BowlerScore | null = null;
  for (const b of bowlers) {
    if (b.balls >= maxBallsPerBowler) continue;
    if (b.playerId === lastBowlerId) continue;
    if (best === null || b.balls < best.balls) best = b;
  }
  if (best === null) {
    throw new NoEligibleBowlerError('No eligible bowler available (all at over limit)');
  }
  return best;
}

/** Whether the supplied bowlers can cover an innings of `maxBalls` (§118). */
export function hasBowlingCapacity(
  bowlerCount: number,
  maxBallsPerBowler: number,
  maxBalls: number,
): boolean {
  return bowlerCount * maxBallsPerBowler >= maxBalls;
}
