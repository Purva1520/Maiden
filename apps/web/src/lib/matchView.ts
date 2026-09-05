/**
 * Derives a live match view from the simulator's immutable event stream (§34,
 * §51). The engine already produced the whole match; this only reshapes the
 * ball-by-ball events for presentation — it never decides cricket outcomes.
 */
import type { MatchResult, DeliveryOutcome } from './domain.js';

export interface BallItem {
  key: string;
  inningsNumber: number;
  over: number;
  ball: number;
  batter: string;
  bowler: string;
  outcome: DeliveryOutcome;
  runs: number;
  scoreAfter: string;
}

export interface BatterLive {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
}
export interface BowlerLive {
  name: string;
  balls: number;
  runs: number;
  wickets: number;
}

export interface MatchView {
  inningsNumber: number;
  battingTeamName: string;
  bowlingTeamName: string;
  runs: number;
  wickets: number;
  legalBalls: number;
  target: number | null;
  runsRequired: number | null;
  ballsRemaining: number | null;
  crr: number;
  rrr: number | null;
  striker: BatterLive | null;
  nonStriker: BatterLive | null;
  bowler: BowlerLive | null;
  feed: BallItem[];
  complete: boolean;
  totalBalls: number;
}

/** All legal deliveries in order — the playback timeline. */
export function extractBalls(match: MatchResult): BallItem[] {
  const out: BallItem[] = [];
  let n = 0;
  for (const e of match.events) {
    if (e.type !== 'DELIVERY') continue;
    const d = e as unknown as BallItem & { over: number };
    out.push({
      key: `${d.inningsNumber}-${n++}`,
      inningsNumber: d.inningsNumber,
      over: d.over,
      ball: d.ball,
      batter: d.batter,
      bowler: d.bowler,
      outcome: d.outcome,
      runs: d.runs,
      scoreAfter: d.scoreAfter,
    });
  }
  return out;
}

function teamNameById(match: MatchResult, id: string): string {
  if (match.teamA.id === id) return match.teamA.name;
  if (match.teamB.id === id) return match.teamB.name;
  return id;
}

function parseScore(s: string): { runs: number; wickets: number } {
  const [r, w] = s.split('/');
  return { runs: Number(r) || 0, wickets: w === undefined ? 10 : Number(w) };
}

const MAX_BALLS: Record<string, number> = { ODI: 300, T20: 120 };

/**
 * Build the view as of ball index `through` (inclusive). Recomputed from the
 * immutable timeline — cheap for a single innings (≤300 balls).
 */
export function deriveMatchView(match: MatchResult, balls: BallItem[], through: number): MatchView {
  const idx = Math.min(Math.max(through, 0), balls.length - 1);
  const current = balls[idx];
  const complete = through >= balls.length - 1;

  const inningsNumber = current ? current.inningsNumber : 1;
  const innings = inningsNumber === 1 ? match.innings1 : match.innings2;
  const battingTeamName = innings.battingTeamName;
  const bowlingTeamName = teamNameById(match, innings.bowlingTeamId);

  // Balls in this innings up to idx.
  const inningsBalls = balls.filter((b, i) => i <= idx && b.inningsNumber === inningsNumber);
  const last = inningsBalls[inningsBalls.length - 1];

  // Runs from scoreAfter are current, but its wicket component is recorded
  // *before* the current ball's wicket increments — derive wickets from actual
  // dismissals so an all-out ball reads correctly.
  const runs = last ? parseScore(last.scoreAfter).runs : 0;
  const legalBalls = inningsBalls.length;

  // Batter pair tracking.
  const dismissed = new Set<string>();
  let pair: string[] = [];
  const batStats = new Map<string, BatterLive>();
  const bowlStats = new Map<string, BowlerLive>();
  for (const b of inningsBalls) {
    const bs = batStats.get(b.batter) ?? { name: b.batter, runs: 0, balls: 0, fours: 0, sixes: 0 };
    bs.runs += b.runs;
    bs.balls += 1;
    if (b.outcome === 'FOUR') bs.fours += 1;
    if (b.outcome === 'SIX') bs.sixes += 1;
    batStats.set(b.batter, bs);

    const ws = bowlStats.get(b.bowler) ?? { name: b.bowler, balls: 0, runs: 0, wickets: 0 };
    ws.balls += 1;
    ws.runs += b.runs;
    if (b.outcome === 'WICKET') ws.wickets += 1;
    bowlStats.set(b.bowler, ws);

    if (!pair.includes(b.batter)) {
      if (pair.length < 2) pair.push(b.batter);
      else {
        const replace = pair.findIndex((p) => dismissed.has(p));
        if (replace >= 0) pair[replace] = b.batter;
        else pair = [pair[1]!, b.batter];
      }
    }
    if (b.outcome === 'WICKET') dismissed.add(b.batter);
  }

  const wickets = dismissed.size;
  const strikerName = current ? current.batter : null;
  const striker = strikerName ? (batStats.get(strikerName) ?? null) : null;
  const nonStrikerName = pair.find((p) => p !== strikerName && !dismissed.has(p)) ?? null;
  const nonStriker = nonStrikerName ? (batStats.get(nonStrikerName) ?? null) : null;
  const bowler = current ? (bowlStats.get(current.bowler) ?? null) : null;

  const target = inningsNumber === 2 ? match.innings1.runs + 1 : null;
  const runsRequired = target !== null ? Math.max(0, target - runs) : null;
  const maxBalls = MAX_BALLS[match.format] ?? 300;
  const ballsRemaining = inningsNumber === 2 ? Math.max(0, maxBalls - legalBalls) : null;
  const crr = legalBalls > 0 ? (runs / legalBalls) * 6 : 0;
  const rrr = runsRequired !== null && ballsRemaining ? (runsRequired / ballsRemaining) * 6 : null;

  const feed = inningsBalls.slice(-9).reverse();

  return {
    inningsNumber,
    battingTeamName,
    bowlingTeamName,
    runs,
    wickets,
    legalBalls,
    target,
    runsRequired,
    ballsRemaining,
    crr,
    rrr,
    striker,
    nonStriker,
    bowler,
    feed,
    complete,
    totalBalls: balls.length,
  };
}
