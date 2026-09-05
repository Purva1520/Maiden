import { describe, it, expect } from 'vitest';
import { formatOvers, formatScore, formatStrikeRate, formatEconomy } from './format.js';

describe('formatting (§82/§89)', () => {
  it('formatOvers uses legal balls, not decimals', () => {
    expect(formatOvers(0)).toBe('0.0');
    expect(formatOvers(29)).toBe('4.5');
    expect(formatOvers(300)).toBe('50.0');
    expect(formatOvers(287)).toBe('47.5'); // 47 overs + 5 balls
  });

  it('formatScore shows /wickets unless all out', () => {
    expect(formatScore(274, 8)).toBe('274/8');
    expect(formatScore(251, 10)).toBe('251');
  });

  it('strike rate is null (not NaN) with 0 balls', () => {
    expect(formatStrikeRate(0, 0)).toBeNull();
    expect(formatStrikeRate(71, 54)).toBe('131.48');
  });

  it('economy uses balls, null with 0 balls', () => {
    expect(formatEconomy(40, 0)).toBeNull();
    expect(formatEconomy(37, 30)).toBe('7.40'); // 37*6/30
  });
});
