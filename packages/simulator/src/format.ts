/** Presentation formatting helpers, kept separate from engine state (§82/§89). */

/** Legal balls -> cricket over notation. 29 -> "4.5" (§7). */
export function formatOvers(balls: number): string {
  const over = Math.floor(balls / 6);
  const ball = balls % 6;
  return `${over}.${ball}`;
}

/** "274/8", or "251" when all out. */
export function formatScore(runs: number, wickets: number): string {
  return wickets >= 10 ? `${runs}` : `${runs}/${wickets}`;
}

/** Strike rate to 2dp, or null when no balls faced (never NaN, §46). */
export function formatStrikeRate(runs: number, balls: number): string | null {
  return balls > 0 ? ((runs / balls) * 100).toFixed(2) : null;
}

/** Economy from balls (runs*6/balls) to 2dp, or null when no balls (§47). */
export function formatEconomy(runs: number, balls: number): string | null {
  return balls > 0 ? ((runs * 6) / balls).toFixed(2) : null;
}
