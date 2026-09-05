/**
 * Concise, game-like event copy derived from the real delivery event (§7, §9,
 * §10, §95, §96). No commentary, no invented fielders or dismissal types — only
 * what the simulator actually produced.
 */
import type { BallItem, BatterLive, BowlerLive } from '../../lib/matchView.js';
import { ballIntensity, type Intensity } from './timing.js';

export interface Milestone {
  kind: 'FIFTY' | 'CENTURY' | 'FIVE_WICKETS';
  name: string;
  runs?: number;
  balls?: number;
}

export interface DeliveryFeedback {
  /** Big outcome word: DOT, +1, FOUR!, SIX!, WICKET! */
  headline: string;
  /** Supporting line: batter progress or the factual dismissal. */
  detail: string | null;
  intensity: Intensity;
  isWicket: boolean;
  isBoundary: boolean;
  milestone: Milestone | null;
}

/** Factual dismissal text — bowler-credited only, as the v1 engine models it. */
export function dismissalText(ball: BallItem): string {
  return `${ball.batter} b ${ball.bowler}`;
}

function detectMilestone(
  ball: BallItem,
  striker: BatterLive | null,
  bowler: BowlerLive | null,
): Milestone | null {
  if (ball.outcome === 'WICKET') {
    if (bowler && bowler.wickets === 5) return { kind: 'FIVE_WICKETS', name: bowler.name };
    return null;
  }
  if (!striker) return null;
  // No extras in v1, so the batter's runs on this ball equal ball.runs.
  const before = striker.runs - ball.runs;
  if (before < 50 && striker.runs >= 50 && striker.runs < 100) {
    return { kind: 'FIFTY', name: striker.name, runs: striker.runs, balls: striker.balls };
  }
  if (before < 100 && striker.runs >= 100) {
    return { kind: 'CENTURY', name: striker.name, runs: striker.runs, balls: striker.balls };
  }
  return null;
}

export function deliveryFeedback(
  ball: BallItem,
  striker: BatterLive | null,
  bowler: BowlerLive | null,
): DeliveryFeedback {
  const isWicket = ball.outcome === 'WICKET';
  const isBoundary = ball.outcome === 'FOUR' || ball.outcome === 'SIX';
  const milestone = detectMilestone(ball, striker, bowler);

  let headline: string;
  if (isWicket) headline = 'WICKET!';
  else if (ball.outcome === 'FOUR') headline = 'FOUR!';
  else if (ball.outcome === 'SIX') headline = 'SIX!';
  else if (ball.runs === 0) headline = 'DOT';
  else headline = `+${ball.runs}`;

  let detail: string | null = null;
  if (isWicket) detail = dismissalText(ball);
  else if (striker) detail = `${striker.name} ${striker.runs} (${striker.balls})`;

  const intensity = milestone ? 'high' : ballIntensity(ball.outcome);
  return { headline, detail, intensity, isWicket, isBoundary, milestone };
}

/** Compact per-over run/wicket sequence, e.g. "1 0 4 W 0 6". */
export function overSequence(overBalls: readonly BallItem[]): string[] {
  return overBalls.map((b) => (b.outcome === 'WICKET' ? 'W' : String(b.runs)));
}
