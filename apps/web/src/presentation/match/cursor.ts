/**
 * Pure presentation cursor transitions (§4, §6, §83). No timers, no React —
 * just where the reveal is and what comes next. The hook wraps this with a
 * single scheduler; tests drive it directly.
 */
import type { BallItem } from '../../lib/matchView.js';

export type Stage = 'INTRO' | 'BALL' | 'OVER_BREAK' | 'INNINGS_BREAK' | 'COMPLETE';

export interface Cursor {
  stage: Stage;
  index: number;
}

/** Auto-play transition: reveal → over/innings break → next ball → complete. */
export function advanceCursor(balls: readonly BallItem[], cur: Cursor): Cursor {
  const last = balls.length - 1;
  switch (cur.stage) {
    case 'INTRO':
      return { stage: 'BALL', index: 0 };
    case 'OVER_BREAK':
    case 'INNINGS_BREAK':
      return { stage: 'BALL', index: Math.min(cur.index + 1, last) };
    case 'BALL': {
      if (cur.index >= last) return { stage: 'COMPLETE', index: last };
      const here = balls[cur.index]!;
      const nxt = balls[cur.index + 1]!;
      if (nxt.inningsNumber !== here.inningsNumber)
        return { stage: 'INNINGS_BREAK', index: cur.index };
      if (nxt.over !== here.over) return { stage: 'OVER_BREAK', index: cur.index };
      return { stage: 'BALL', index: cur.index + 1 };
    }
    default:
      return cur;
  }
}

/** Manual "next ball": jump straight to the next delivery, skipping breaks. */
export function manualNext(balls: readonly BallItem[], cur: Cursor): Cursor {
  const last = balls.length - 1;
  if (cur.stage === 'INTRO') return { stage: 'BALL', index: 0 };
  if (cur.stage === 'OVER_BREAK' || cur.stage === 'INNINGS_BREAK')
    return { stage: 'BALL', index: Math.min(cur.index + 1, last) };
  if (cur.index >= last) return { stage: 'COMPLETE', index: last };
  return { stage: 'BALL', index: cur.index + 1 };
}
