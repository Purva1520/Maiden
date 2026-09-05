import { describe, it, expect } from 'vitest';
import { simulateInnings } from './innings-engine.js';
import { SeededRandom } from './random.js';
import { australiaXI, indiaXI } from '../fixtures.js';
import { FORMAT_CONFIG } from '../config/formats.js';
import { OUTCOME_RUNS } from '../models/delivery.js';
import type {
  CricketFormat,
  DeliveryContext,
  DeliveryOutcome,
  DeliveryResult,
} from '../models/delivery.js';
import type { DeliverySimulator, InningsInput } from '../models/innings.js';
import type { PlayerContext, Team } from '../models/player.js';
import { InvalidRatingError, InvalidTeamError } from '../errors.js';

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
const fixedSim =
  (o: DeliveryOutcome): DeliverySimulator =>
  (ctx) =>
    mk(o, ctx);
const seqSim = (os: DeliveryOutcome[]): DeliverySimulator => {
  let i = 0;
  return (ctx) => mk(os[i++ % os.length]!, ctx);
};
const byBall =
  (fn: (legalBalls: number) => DeliveryOutcome): DeliverySimulator =>
  (ctx) =>
    mk(fn(ctx.matchState.legalBalls), ctx);

function inningsInput(format: CricketFormat, target: number | null = null): InningsInput {
  return { inningsNumber: 1, battingTeam: indiaXI, bowlingTeam: australiaXI, format, target };
}
const rng = () => new SeededRandom(1);

describe('innings termination (§42/§69)', () => {
  it('ends at 10 wickets (all out)', () => {
    const r = simulateInnings(inningsInput('ODI'), rng(), fixedSim('WICKET'));
    expect(r.wickets).toBe(10);
    expect(r.allOut).toBe(true);
    expect(r.legalBalls).toBe(10);
    expect(r.runs).toBe(0);
  });

  it('ends at max overs (ODI 300 balls, T20 120 balls)', () => {
    const odi = simulateInnings(inningsInput('ODI'), rng(), fixedSim('DOT'));
    expect(odi.legalBalls).toBe(300);
    expect(odi.allOut).toBe(false);
    const t20 = simulateInnings(inningsInput('T20'), rng(), fixedSim('DOT'));
    expect(t20.legalBalls).toBe(120);
  });

  it('ends when the target is reached (§55)', () => {
    const r = simulateInnings(inningsInput('ODI', 5), rng(), seqSim(['FOUR', 'TWO']));
    expect(r.targetReached).toBe(true);
    expect(r.runs).toBe(6);
    expect(r.legalBalls).toBe(2);
  });
});

describe('innings rules (§30/§37)', () => {
  it('a new batter enters after a wicket', () => {
    const r = simulateInnings(
      inningsInput('ODI'),
      rng(),
      byBall((b) => (b === 0 ? 'WICKET' : 'DOT')),
    );
    expect(r.battingCard[0]!.dismissed).toBe(true);
    expect(r.battingCard[0]!.balls).toBe(1);
    expect(r.battingCard[1]!.dismissed).toBe(false); // non-striker unaffected
    expect(r.battingCard[2]!.batted).toBe(true); // next batter came in
  });

  it('swaps strike at the end of each over (§37)', () => {
    // All dots: no run rotation; only over-end swaps. Openers alternate overs.
    const r = simulateInnings(inningsInput('T20'), rng(), fixedSim('DOT'));
    expect(r.battingCard[0]!.balls).toBe(60); // faced overs 1,3,...,19
    expect(r.battingCard[1]!.balls).toBe(60); // faced overs 2,4,...,20
  });

  it('never lets a bowler exceed the over limit (§92)', () => {
    const max = FORMAT_CONFIG.T20.maxOversPerBowler * FORMAT_CONFIG.T20.ballsPerOver;
    const r = simulateInnings(inningsInput('T20'), rng(), fixedSim('DOT'));
    for (const b of r.bowlingCard) expect(b.balls).toBeLessThanOrEqual(max);
  });
});

describe('scorecard reconciliation (§95/§96/§97)', () => {
  it('runs, wickets and bowler figures reconcile', () => {
    const r = simulateInnings(
      inningsInput('ODI'),
      rng(),
      seqSim(['ONE', 'FOUR', 'DOT', 'WICKET', 'SIX', 'TWO']),
    );
    const batRuns = r.battingCard.reduce((s, b) => s + b.runs, 0);
    const bowlRuns = r.bowlingCard.reduce((s, b) => s + b.runs, 0);
    const bowlWkts = r.bowlingCard.reduce((s, b) => s + b.wickets, 0);
    expect(batRuns).toBe(r.runs); // no extras in v1
    expect(bowlRuns).toBe(r.runs);
    expect(bowlWkts).toBe(r.wickets);
    expect(r.fallOfWickets.length).toBe(r.wickets);
  });
});

describe('validation (§117/§118)', () => {
  it('rejects out-of-range ratings', () => {
    const bad: Team = {
      id: 'bad',
      name: 'Bad',
      players: indiaXI.players.map((p, i) => (i === 0 ? { ...p, batRating: 150 } : p)),
    };
    expect(() => simulateInnings({ ...inningsInput('ODI'), battingTeam: bad }, rng())).toThrow(
      InvalidRatingError,
    );
  });

  it('rejects a team with no bowlers', () => {
    const noBowlers: Team = {
      id: 'nb',
      name: 'No Bowlers',
      players: indiaXI.players.map((p): PlayerContext => ({ ...p, bowlRating: null })),
    };
    expect(() =>
      simulateInnings({ ...inningsInput('ODI'), bowlingTeam: noBowlers }, rng()),
    ).toThrow(InvalidTeamError);
  });
});

describe('property invariants over many innings (§100)', () => {
  it('holds structural invariants across 300 real-engine innings', () => {
    for (const format of ['ODI', 'T20'] as const) {
      const max = FORMAT_CONFIG[format].maxBalls;
      const bowlerMax =
        FORMAT_CONFIG[format].maxOversPerBowler * FORMAT_CONFIG[format].ballsPerOver;
      for (let i = 0; i < 150; i++) {
        const r = simulateInnings(inningsInput(format), new SeededRandom(i + 1));
        expect(r.runs).toBeGreaterThanOrEqual(0);
        expect(r.wickets).toBeGreaterThanOrEqual(0);
        expect(r.wickets).toBeLessThanOrEqual(10);
        expect(r.legalBalls).toBeLessThanOrEqual(max);
        expect(r.battingCard.reduce((s, b) => s + b.runs, 0)).toBe(r.runs);
        expect(r.bowlingCard.reduce((s, b) => s + b.wickets, 0)).toBe(r.wickets);
        for (const b of r.bowlingCard) expect(b.balls).toBeLessThanOrEqual(bowlerMax);
      }
    }
  });
});
