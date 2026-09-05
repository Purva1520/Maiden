import { describe, it, expect } from 'vitest';
import { buildProbabilities, simulateDelivery } from '../core/delivery-engine.js';
import { SeededRandom } from '../core/random.js';
import { expectedRuns, validateDistribution } from './outcome.js';
import type { CricketFormat, DeliveryContext, MatchPhase, MatchState } from '../models/delivery.js';
import type { PlayerContext } from '../models/player.js';

const NO_CHASE: MatchState = {
  legalBalls: 60,
  wicketsLost: 2,
  maxBalls: 300,
  target: null,
  runsRequired: null,
  ballsRemaining: null,
};

function bat(batRating: number): PlayerContext {
  return { id: 'b', name: 'Batter', batRating, bowlRating: null };
}
function bowl(bowlRating: number): PlayerContext {
  return { id: 'w', name: 'Bowler', batRating: 20, bowlRating };
}
function ctx(
  batRating: number,
  bowlRating: number,
  phase: MatchPhase = 'MIDDLE',
  format: CricketFormat = 'ODI',
  matchState: MatchState = NO_CHASE,
): DeliveryContext {
  return { batter: bat(batRating), bowler: bowl(bowlRating), phase, format, matchState };
}

describe('probability model', () => {
  it('distributions are valid and sum to 1 (§15)', () => {
    for (const format of ['ODI', 'T20'] as const) {
      for (const phase of ['POWERPLAY', 'MIDDLE', 'DEATH'] as const) {
        for (const [b, w] of [
          [90, 80],
          [50, 50],
          [30, 88],
        ] as const) {
          const p = buildProbabilities(ctx(b, w, phase, format));
          expect(() => validateDistribution(p)).not.toThrow();
        }
      }
    }
  });

  it('a better batter has a more favourable distribution (§66)', () => {
    const strong = expectedRuns(buildProbabilities(ctx(92, 80)));
    const weak = expectedRuns(buildProbabilities(ctx(60, 80)));
    expect(strong).toBeGreaterThan(weak);
  });

  it('a better bowler suppresses scoring and raises wicket chance (§66)', () => {
    const vsWeakBowler = buildProbabilities(ctx(80, 55));
    const vsStrongBowler = buildProbabilities(ctx(80, 92));
    expect(expectedRuns(vsWeakBowler)).toBeGreaterThan(expectedRuns(vsStrongBowler));
    expect(vsStrongBowler.WICKET).toBeGreaterThan(vsWeakBowler.WICKET);
  });

  it('every outcome stays possible regardless of skill gap (§13/§23)', () => {
    const mismatch = buildProbabilities(ctx(72, 95));
    expect(mismatch.FOUR).toBeGreaterThan(0);
    expect(mismatch.SIX).toBeGreaterThan(0);
    const elite = buildProbabilities(ctx(95, 60));
    expect(elite.WICKET).toBeGreaterThan(0);
    expect(elite.DOT).toBeGreaterThan(0);
  });

  it('death overs are more explosive than middle overs (§67)', () => {
    const middle = buildProbabilities(ctx(80, 80, 'MIDDLE'));
    const death = buildProbabilities(ctx(80, 80, 'DEATH'));
    expect(death.SIX).toBeGreaterThan(middle.SIX);
    expect(death.FOUR).toBeGreaterThan(middle.FOUR);
  });

  it('desperate chase raises aggression vs a comfortable one (§68)', () => {
    const desperate = ctx(80, 80, 'DEATH', 'ODI', {
      ...NO_CHASE,
      target: 300,
      runsRequired: 120,
      ballsRemaining: 30,
    });
    const comfortable = ctx(80, 80, 'DEATH', 'ODI', {
      ...NO_CHASE,
      target: 300,
      runsRequired: 10,
      ballsRemaining: 60,
    });
    const pd = buildProbabilities(desperate);
    const pc = buildProbabilities(comfortable);
    expect(pd.FOUR + pd.SIX).toBeGreaterThan(pc.FOUR + pc.SIX);
    expect(pd.WICKET).toBeGreaterThan(pc.WICKET);
  });

  it('a delivery is deterministic for a fixed seed (§25)', () => {
    const c = ctx(85, 82);
    const a = simulateDelivery(c, new SeededRandom(555)).outcome;
    const b = simulateDelivery(c, new SeededRandom(555)).outcome;
    expect(a).toBe(b);
  });
});
