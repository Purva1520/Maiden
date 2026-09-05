/**
 * Centralized cricket formatting (§57). Never scatter numeric formatting through
 * components. Legal-ball counts render as cricket overs ("67.4"), not decimals.
 */

export function formatOvers(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

export function formatScore(runs: number, wickets: number): string {
  return wickets >= 10 ? `${runs}` : `${runs}/${wickets}`;
}

export function formatStrikeRate(runs: number, balls: number): string {
  if (balls <= 0) return '—';
  return ((runs / balls) * 100).toFixed(1);
}

export function formatEconomy(runs: number, balls: number): string {
  if (balls <= 0) return '—';
  return ((runs / balls) * 6).toFixed(2);
}

export function formatRunRate(runs: number, balls: number): string {
  if (balls <= 0) return '0.00';
  return ((runs / balls) * 6).toFixed(2);
}

/** Bowling figures like "8.0-1-42-3". */
export function formatBowlingFigures(
  balls: number,
  maidens: number,
  runs: number,
  wickets: number,
): string {
  return `${formatOvers(balls)}-${maidens}-${runs}-${wickets}`;
}

export function formatRating(value: number | null): string {
  return value === null ? '—' : String(value);
}
