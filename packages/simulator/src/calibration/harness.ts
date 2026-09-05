/**
 * Calibration harness: run the engine at scale, measure simulated distributions
 * (definitions identical to the historical side, §65), and tune the per-format
 * base outcome probabilities toward historical targets by iterative proportional
 * fitting (§44 — a simple, transparent method). Deterministic given the seed set.
 */
import { simulateMatch } from '../core/match-engine.js';
import { simulateDelivery } from '../core/delivery-engine.js';
import type { CricketFormat } from '../models/delivery.js';
import type { InningsResult } from '../models/innings.js';
import type { Team } from '../models/player.js';
import type { ProbabilityModel, SimulationConfig } from '../config/models.js';
import { DEFAULT_SIMULATION_CONFIG } from '../config/models.js';
import { NEUTRAL_A, NEUTRAL_B } from './teams.js';

export interface DistSummary {
  count: number;
  mean: number;
  median: number;
  std: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
}

export interface FormatSummary {
  innings_count: number;
  score: DistSummary;
  run_rate: DistSummary;
  wicket_rate: DistSummary;
  four_rate: DistSummary;
  six_rate: DistSummary;
  economy: number;
  chase: { attempts: number; success_rate: number };
  margin_runs: DistSummary;
  margin_wickets: DistSummary;
  balls_remaining: DistSummary;
}

function dist(values: number[]): DistSummary {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) {
    return { count: 0, mean: 0, median: 0, std: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0 };
  }
  const mean = v.reduce((s, x) => s + x, 0) / n;
  const variance = n > 1 ? v.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0;
  const q = (p: number): number => {
    const idx = (n - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return v[lo]! + (v[hi]! - v[lo]!) * (idx - lo);
  };
  return {
    count: n,
    mean: round(mean),
    median: round(q(0.5)),
    std: round(Math.sqrt(variance)),
    p10: round(q(0.1)),
    p25: round(q(0.25)),
    p50: round(q(0.5)),
    p75: round(q(0.75)),
    p90: round(q(0.9)),
    p95: round(q(0.95)),
  };
}

const round = (x: number): number => Math.round(x * 1000) / 1000;

function inningsMetrics(inn: InningsResult): {
  score: number;
  legalBalls: number;
  runRate: number;
  wicketRate: number;
  fourRate: number;
  sixRate: number;
  fours: number;
  sixes: number;
} {
  const fours = inn.battingCard.reduce((s, b) => s + b.fours, 0);
  const sixes = inn.battingCard.reduce((s, b) => s + b.sixes, 0);
  const lb = inn.legalBalls;
  return {
    score: inn.runs,
    legalBalls: lb,
    runRate: lb > 0 ? (inn.runs / lb) * 6 : 0,
    wicketRate: lb > 0 ? (inn.wickets / lb) * 100 : 0,
    fourRate: lb > 0 ? (fours / lb) * 100 : 0,
    sixRate: lb > 0 ? (sixes / lb) * 100 : 0,
    fours,
    sixes,
  };
}

export interface BatchOptions {
  format: CricketFormat;
  matches: number;
  seedBase?: number;
  teamA?: Team;
  teamB?: Team;
}

export function runBatch(config: SimulationConfig, opts: BatchOptions): FormatSummary {
  const seedBase = opts.seedBase ?? 0;
  const teamA = opts.teamA ?? NEUTRAL_A;
  const teamB = opts.teamB ?? NEUTRAL_B;

  const scores: number[] = [];
  const runRates: number[] = [];
  const wicketRates: number[] = [];
  const fourRates: number[] = [];
  const sixRates: number[] = [];
  const marginRuns: number[] = [];
  const marginWickets: number[] = [];
  const ballsRemaining: number[] = [];
  let totalRuns = 0;
  let totalBalls = 0;
  let chaseWins = 0;

  for (let i = 0; i < opts.matches; i++) {
    const m = simulateMatch(
      { format: opts.format, teamA, teamB, seed: seedBase + i },
      simulateDelivery,
      config,
    );
    // First innings is always full (bats out overs or all out) -> comparable
    // to the historical "full innings" population.
    const im = inningsMetrics(m.innings1);
    scores.push(im.score);
    runRates.push(im.runRate);
    wicketRates.push(im.wicketRate);
    fourRates.push(im.fourRate);
    sixRates.push(im.sixRate);
    totalRuns += im.score;
    totalBalls += im.legalBalls;

    if (m.result.type === 'WIN_BY_WICKETS') {
      chaseWins += 1;
      marginWickets.push(m.result.marginWickets ?? 0);
      ballsRemaining.push(m.result.ballsRemaining ?? 0);
    } else if (m.result.type === 'WIN_BY_RUNS') {
      marginRuns.push(m.result.marginRuns ?? 0);
    }
  }

  return {
    innings_count: opts.matches,
    score: dist(scores),
    run_rate: dist(runRates),
    wicket_rate: dist(wicketRates),
    four_rate: dist(fourRates),
    six_rate: dist(sixRates),
    economy: totalBalls > 0 ? round((totalRuns / totalBalls) * 6) : 0,
    chase: { attempts: opts.matches, success_rate: round(chaseWins / opts.matches) },
    margin_runs: dist(marginRuns),
    margin_wickets: dist(marginWickets),
    balls_remaining: dist(ballsRemaining),
  };
}

/** Historical per-format targets consumed by the calibrator. */
export interface Targets {
  run_rate: number;
  wicket_rate: number;
  four_rate: number;
  six_rate: number;
}

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

function normalizeBase(base: Record<string, number>): void {
  let sum = 0;
  for (const k of Object.keys(base)) sum += base[k]!;
  for (const k of Object.keys(base)) base[k] = base[k]! / sum;
}

/**
 * Iterative proportional fitting: scale FOUR/SIX/WICKET toward their target
 * rates and shift ONE<->DOT toward the target run rate; renormalize; repeat.
 */
export function calibrateFormat(
  model: ProbabilityModel,
  format: CricketFormat,
  targets: Targets,
  iterations = 6,
  matchesPerIter = 1500,
): ProbabilityModel {
  const tuned: ProbabilityModel = JSON.parse(JSON.stringify(model));
  const base = tuned.base as unknown as Record<string, number>;
  const cfg: SimulationConfig = {
    simulationVersion: 'v1',
    calibrationVersion: 'tuning',
    formats: {
      ...DEFAULT_SIMULATION_CONFIG.formats,
      [format]: tuned,
    } as SimulationConfig['formats'],
  };

  for (let it = 0; it < iterations; it++) {
    const s = runBatch(cfg, {
      format,
      matches: matchesPerIter,
      seedBase: 1_000_000 + it * 100_000,
    });
    base['FOUR'] = clamp(
      base['FOUR']! * (targets.four_rate / Math.max(0.01, s.four_rate.mean)),
      0.001,
      0.4,
    );
    base['SIX'] = clamp(
      base['SIX']! * (targets.six_rate / Math.max(0.01, s.six_rate.mean)),
      0.001,
      0.4,
    );
    base['WICKET'] = clamp(
      base['WICKET']! * (targets.wicket_rate / Math.max(0.01, s.wicket_rate.mean)),
      0.001,
      0.2,
    );
    // Run-rate gap -> shift ONE <-> DOT (each ONE adds ~1 run/ball).
    const dRunsPerBall = (targets.run_rate - s.run_rate.mean) / 6;
    base['ONE'] = clamp(base['ONE']! + dRunsPerBall, 0.05, 0.75);
    base['DOT'] = clamp(base['DOT']! - dRunsPerBall, 0.05, 0.75);
    normalizeBase(base);
  }
  return tuned;
}
