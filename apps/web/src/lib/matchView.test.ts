import { describe, it, expect } from 'vitest';
import { extractBalls, deriveMatchView } from './matchView.js';
import { tinyMatch } from '../dev-fixtures/index.js';

describe('deriveMatchView (§34)', () => {
  const balls = extractBalls(tinyMatch);

  it('extracts one item per legal delivery', () => {
    expect(balls).toHaveLength(2);
  });

  it('shows runs and the striker after the boundary ball', () => {
    const v = deriveMatchView(tinyMatch, balls, 0);
    expect(v.runs).toBe(4);
    expect(v.wickets).toBe(0);
    expect(v.striker?.name).toBe('Alpha');
    expect(v.striker?.fours).toBe(1);
  });

  it('counts the wicket on the all-out ball despite pre-wicket scoreAfter', () => {
    const v = deriveMatchView(tinyMatch, balls, 1);
    expect(v.runs).toBe(4);
    expect(v.wickets).toBe(1); // derived from dismissals, not scoreAfter
    expect(v.complete).toBe(true);
  });
});
