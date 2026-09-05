import { describe, it, expect } from 'vitest';
import { formatOvers, formatScore, formatStrikeRate, formatEconomy } from './format.js';

describe('cricket formatting (§57)', () => {
  it('formats legal balls as overs, not decimals', () => {
    expect(formatOvers(0)).toBe('0.0');
    expect(formatOvers(6)).toBe('1.0');
    expect(formatOvers(29)).toBe('4.5');
    expect(formatOvers(300)).toBe('50.0');
  });

  it('hides the wicket count when all out', () => {
    expect(formatScore(142, 4)).toBe('142/4');
    expect(formatScore(112, 10)).toBe('112');
  });

  it('computes strike rate and economy', () => {
    expect(formatStrikeRate(74, 61)).toBe('121.3');
    expect(formatStrikeRate(0, 0)).toBe('—');
    expect(formatEconomy(42, 48)).toBe('5.25');
  });
});
