import { describe, it, expect } from 'vitest';
import { simulateMatch } from './core/match-engine.js';
import { australiaXI, indiaXI } from './fixtures.js';
import { shouldRotateOnRuns } from './rules/strike.js';

describe('strike rotation rule (§30)', () => {
  it('rotates on odd runs, holds on even', () => {
    expect(shouldRotateOnRuns(1)).toBe(true);
    expect(shouldRotateOnRuns(3)).toBe(true);
    expect(shouldRotateOnRuns(0)).toBe(false);
    expect(shouldRotateOnRuns(2)).toBe(false);
    expect(shouldRotateOnRuns(4)).toBe(false);
    expect(shouldRotateOnRuns(6)).toBe(false);
  });
});

/**
 * Frozen v1 regression fixtures (§74). Generated from the reviewed v1 engine +
 * TEST FIXTURE teams. A change here means the model behaviour shifted — bump the
 * simulation version deliberately rather than editing these values casually.
 */
describe('v1 regression (frozen results)', () => {
  const cases = [
    {
      format: 'ODI' as const,
      seed: 849273,
      i1r: 242,
      i1w: 10,
      i2r: 246,
      i2w: 6,
      type: 'WIN_BY_WICKETS',
      text: 'Australia XI won by 4 wickets with 34 balls remaining',
    },
    {
      format: 'T20' as const,
      seed: 12345,
      i1r: 136,
      i1w: 10,
      i2r: 139,
      i2w: 4,
      type: 'WIN_BY_WICKETS',
      text: 'India XI won by 6 wickets with 7 balls remaining',
    },
  ];

  for (const c of cases) {
    it(`${c.format} seed ${c.seed} reproduces the frozen result`, () => {
      const m = simulateMatch({
        format: c.format,
        teamA: indiaXI,
        teamB: australiaXI,
        seed: c.seed,
      });
      expect(m.innings1.runs).toBe(c.i1r);
      expect(m.innings1.wickets).toBe(c.i1w);
      expect(m.innings2.runs).toBe(c.i2r);
      expect(m.innings2.wickets).toBe(c.i2w);
      expect(m.result.type).toBe(c.type);
      expect(m.result.text).toBe(c.text);
      expect(m.simulationVersion).toBe('v1');
    });
  }
});
