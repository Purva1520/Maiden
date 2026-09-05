import { describe, it, expect } from 'vitest';
import { simulateMatch } from './match-engine.js';
import { australiaXI, indiaXI } from '../fixtures.js';
import { OUTCOME_RUNS } from '../models/delivery.js';
import type { DeliveryContext, DeliveryOutcome, DeliveryResult } from '../models/delivery.js';
import type { DeliverySimulator } from '../models/innings.js';
import type { MatchInput } from '../models/match.js';
import { InvalidFormatError } from '../errors.js';

function mk(o: DeliveryOutcome, ctx: DeliveryContext): DeliveryResult {
  const r = OUTCOME_RUNS[o];
  return {
    outcome: o,
    batterRuns: r,
    totalRuns: r,
    legalDelivery: true,
    wicket:
      o === 'WICKET'
        ? { playerOut: ctx.batter.id, dismissalKind: 'bowler', bowler: ctx.bowler.id }
        : null,
  };
}

const base: Omit<MatchInput, 'seed'> = { format: 'ODI', teamA: indiaXI, teamB: australiaXI };

describe('match result rules (§56/§57/§58/§60)', () => {
  it('defended total → WIN_BY_RUNS', () => {
    const sim: DeliverySimulator = (ctx) =>
      mk(ctx.matchState.target === null ? 'FOUR' : 'DOT', ctx);
    const m = simulateMatch({ ...base, seed: 1 }, sim);
    expect(m.result.type).toBe('WIN_BY_RUNS');
    expect(m.result.marginRuns).toBe(m.innings1.runs - m.innings2.runs);
    expect(m.innings2.runs).toBeLessThan(m.innings1.runs);
  });

  it('successful chase → WIN_BY_WICKETS with balls remaining', () => {
    const sim: DeliverySimulator = (ctx) =>
      mk(ctx.matchState.target === null ? 'DOT' : 'FOUR', ctx);
    const m = simulateMatch({ ...base, seed: 1 }, sim);
    expect(m.result.type).toBe('WIN_BY_WICKETS');
    expect(m.result.marginWickets).toBe(10 - m.innings2.wickets);
    expect(m.result.ballsRemaining).toBeGreaterThan(0);
  });

  it('level scores → TIE (no Super Over in v1, §58)', () => {
    const sim: DeliverySimulator = (ctx) =>
      mk(ctx.matchState.legalBalls < 10 ? 'ONE' : 'WICKET', ctx);
    const m = simulateMatch({ ...base, seed: 1 }, sim);
    expect(m.result.type).toBe('TIE');
    expect(m.innings1.runs).toBe(m.innings2.runs);
  });
});

describe('public API + reproducibility (§85/§111/§113)', () => {
  it('returns a structured result with seed and versions', () => {
    const m = simulateMatch({ ...base, seed: 849273 });
    expect(m.innings1).toBeDefined();
    expect(m.innings2).toBeDefined();
    expect(m.innings1.battingCard.length).toBeGreaterThan(0);
    expect(m.result.type === 'TIE' || m.result.winnerName).toBeTruthy();
    expect(m.events.length).toBeGreaterThan(0);
    expect(m.seed).toBe(849273);
    expect(m.simulationVersion).toBe('v1');
    expect(typeof m.configVersion).toBe('string'); // 'baseline' by default, 'v1' with the calibrated config
    expect(m.configVersion.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same seed', () => {
    const a = simulateMatch({ ...base, seed: 424242 });
    const b = simulateMatch({ ...base, seed: 424242 });
    expect(a.innings1.runs).toBe(b.innings1.runs);
    expect(a.innings2.runs).toBe(b.innings2.runs);
    expect(a.result.text).toBe(b.result.text);
  });

  it('different seeds can produce different matches', () => {
    const scores = [1, 2, 3, 4, 5].map((s) => simulateMatch({ ...base, seed: s }).innings1.runs);
    expect(new Set(scores).size).toBeGreaterThan(1);
  });

  it('rejects an invalid format', () => {
    // @ts-expect-error deliberately invalid format
    expect(() => simulateMatch({ ...base, format: 'TEST', seed: 1 })).toThrow(InvalidFormatError);
  });
});

describe('event stream (§62/§98)', () => {
  it('emits the required event types', () => {
    const m = simulateMatch({ ...base, seed: 77 });
    const types = new Set(m.events.map((e) => e.type));
    for (const t of [
      'MATCH_START',
      'TOSS',
      'INNINGS_START',
      'DELIVERY',
      'INNINGS_END',
      'MATCH_END',
    ]) {
      expect(types.has(t as never)).toBe(true);
    }
  });

  it('final score is derivable from the delivery events', () => {
    const m = simulateMatch({ ...base, seed: 909 });
    const inn2Deliveries = m.innings2.events.filter((e) => e.type === 'DELIVERY');
    const runs = inn2Deliveries.reduce((s, e) => s + (e['runs'] as number), 0);
    const wickets = m.innings2.events.filter((e) => e.type === 'WICKET').length;
    expect(runs).toBe(m.innings2.runs);
    expect(wickets).toBe(m.innings2.wickets);
  });
});
