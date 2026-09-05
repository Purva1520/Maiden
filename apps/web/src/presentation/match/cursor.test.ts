import { describe, it, expect } from 'vitest';
import { advanceCursor, manualNext, type Cursor } from './cursor.js';
import type { BallItem } from '../../lib/matchView.js';

function ball(inn: number, over: number, b: number): BallItem {
  return {
    key: `${inn}-${over}-${b}`,
    inningsNumber: inn,
    over,
    ball: b,
    batter: 'A',
    bowler: 'Z',
    outcome: 'DOT',
    runs: 0,
    scoreAfter: '0/0',
  };
}

// Innings 1: over 0 (6 balls) + over 1 (2 balls); innings 2: over 0 (2 balls).
const balls: BallItem[] = [
  ...[1, 2, 3, 4, 5, 6].map((b) => ball(1, 0, b)),
  ball(1, 1, 1),
  ball(1, 1, 2),
  ball(2, 0, 1),
  ball(2, 0, 2),
];

describe('advanceCursor (§6, §83)', () => {
  const step = (c: Cursor): Cursor => advanceCursor(balls, c);

  it('starts INTRO then reveals the first ball', () => {
    expect(step({ stage: 'INTRO', index: 0 })).toEqual({ stage: 'BALL', index: 0 });
  });

  it('inserts an over break at the end of an over', () => {
    expect(step({ stage: 'BALL', index: 5 })).toEqual({ stage: 'OVER_BREAK', index: 5 });
    expect(step({ stage: 'OVER_BREAK', index: 5 })).toEqual({ stage: 'BALL', index: 6 });
  });

  it('inserts an innings break when the innings changes', () => {
    expect(step({ stage: 'BALL', index: 7 })).toEqual({ stage: 'INNINGS_BREAK', index: 7 });
    expect(step({ stage: 'INNINGS_BREAK', index: 7 })).toEqual({ stage: 'BALL', index: 8 });
  });

  it('completes after the last ball', () => {
    expect(step({ stage: 'BALL', index: 9 })).toEqual({ stage: 'COMPLETE', index: 9 });
    expect(step({ stage: 'COMPLETE', index: 9 })).toEqual({ stage: 'COMPLETE', index: 9 });
  });

  it('advances ball-to-ball within an over', () => {
    expect(step({ stage: 'BALL', index: 2 })).toEqual({ stage: 'BALL', index: 3 });
  });
});

describe('manualNext (§85)', () => {
  it('skips breaks and jumps straight to the next delivery', () => {
    expect(manualNext(balls, { stage: 'BALL', index: 5 })).toEqual({ stage: 'BALL', index: 6 });
    expect(manualNext(balls, { stage: 'BALL', index: 7 })).toEqual({ stage: 'BALL', index: 8 });
  });

  it('does not overrun the final ball', () => {
    expect(manualNext(balls, { stage: 'BALL', index: 9 })).toEqual({ stage: 'COMPLETE', index: 9 });
  });
});
