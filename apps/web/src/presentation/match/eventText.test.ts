import { describe, it, expect } from 'vitest';
import { deliveryFeedback, dismissalText, overSequence } from './eventText.js';
import type { BallItem, BatterLive, BowlerLive } from '../../lib/matchView.js';

function ball(outcome: BallItem['outcome'], runs: number): BallItem {
  return {
    key: 'k',
    inningsNumber: 1,
    over: 4,
    ball: 5,
    batter: 'Tendulkar',
    bowler: 'Warne',
    outcome,
    runs,
    scoreAfter: '151/4',
  };
}
const bat = (runs: number, balls: number): BatterLive => ({
  name: 'Tendulkar',
  runs,
  balls,
  fours: 0,
  sixes: 0,
});
const bowl = (wickets: number): BowlerLive => ({ name: 'Warne', balls: 30, runs: 40, wickets });

describe('deliveryFeedback (§9, §10)', () => {
  it('labels a dot ball with low intensity', () => {
    const f = deliveryFeedback(ball('DOT', 0), bat(20, 15), bowl(1));
    expect(f.headline).toBe('DOT');
    expect(f.intensity).toBe('low');
    expect(f.isWicket).toBe(false);
  });

  it('labels a four and a six with rising emphasis', () => {
    expect(deliveryFeedback(ball('FOUR', 4), bat(24, 15), bowl(1)).headline).toBe('FOUR!');
    const six = deliveryFeedback(ball('SIX', 6), bat(26, 15), bowl(1));
    expect(six.headline).toBe('SIX!');
    expect(six.intensity).toBe('high');
    expect(six.isBoundary).toBe(true);
  });

  it('gives a wicket critical intensity with a factual dismissal', () => {
    const f = deliveryFeedback(ball('WICKET', 0), bat(84, 71), bowl(3));
    expect(f.headline).toBe('WICKET!');
    expect(f.intensity).toBe('critical');
    expect(f.isWicket).toBe(true);
    expect(f.detail).toBe('Tendulkar b Warne');
  });

  it('detects a fifty as the batter crosses 50', () => {
    // Was 49 before a two → now 51.
    const f = deliveryFeedback(ball('TWO', 2), bat(51, 43), bowl(1));
    expect(f.milestone?.kind).toBe('FIFTY');
    expect(f.intensity).toBe('high');
  });

  it('detects a five-wicket haul on the wicket ball', () => {
    const f = deliveryFeedback(ball('WICKET', 0), bat(10, 8), bowl(5));
    expect(f.milestone?.kind).toBe('FIVE_WICKETS');
  });
});

describe('helpers', () => {
  it('formats a factual dismissal', () => {
    expect(dismissalText(ball('WICKET', 0))).toBe('Tendulkar b Warne');
  });
  it('renders an over sequence with W for wickets', () => {
    expect(overSequence([ball('ONE', 1), ball('WICKET', 0), ball('FOUR', 4)])).toEqual([
      '1',
      'W',
      '4',
    ]);
  });
});
