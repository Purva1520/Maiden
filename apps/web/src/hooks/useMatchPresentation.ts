import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MatchResult } from '../lib/domain.js';
import { deriveMatchView, extractBalls, type BallItem, type MatchView } from '../lib/matchView.js';
import { deliveryFeedback, type DeliveryFeedback } from '../presentation/match/eventText.js';
import { ballHold, ballIntensity, phaseHold, PHASE_MS } from '../presentation/match/timing.js';
import {
  advanceCursor,
  manualNext,
  type Cursor,
  type Stage,
} from '../presentation/match/cursor.js';

export type Speed = 0.5 | 1 | 2 | 4;
export type { Stage };

export interface MatchPresentation {
  view: MatchView;
  ball: BallItem | null;
  feedback: DeliveryFeedback | null;
  stage: Stage;
  index: number;
  balls: BallItem[];
  isPlaying: boolean;
  isComplete: boolean;
  speed: Speed;
  hasEvents: boolean;
  next: () => void;
  play: () => void;
  pause: () => void;
  setSpeed: (s: Speed) => void;
  skipToEnd: () => void;
}

/**
 * One presentation state machine over the immutable delivery timeline (§4–§6,
 * §57). It reveals each ball, holds for an event-aware duration, and inserts
 * over / innings / match-complete transitions. The match result is never
 * re-derived — the controller only moves a cursor. A single timer drives
 * auto-play and is always cleared on unmount, pause, or speed change (§59).
 */
export function useMatchPresentation(match: MatchResult | null): MatchPresentation {
  const balls = useMemo(() => (match ? extractBalls(match) : []), [match]);
  const hasEvents = balls.length > 0;

  const [cursor, setCursor] = useState<Cursor>({ stage: 'INTRO', index: 0 });
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<Speed>(1);
  const [prevMatch, setPrevMatch] = useState(match);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when the match changes (adjust-state-during-render).
  if (match !== prevMatch) {
    setPrevMatch(match);
    setCursor({ stage: hasEvents ? 'INTRO' : 'COMPLETE', index: 0 });
    setIsPlaying(hasEvents);
  }

  const holdMs = (cur: Cursor): number => {
    switch (cur.stage) {
      case 'INTRO':
        return phaseHold(PHASE_MS.matchIntro, speed);
      case 'OVER_BREAK':
        return phaseHold(PHASE_MS.overBreak, speed);
      case 'INNINGS_BREAK':
        return phaseHold(PHASE_MS.inningsBreak, speed);
      case 'BALL':
        return ballHold(ballIntensity(balls[cur.index]?.outcome ?? 'DOT'), speed);
      default:
        return 0;
    }
  };

  useEffect(() => {
    if (!isPlaying || !hasEvents || cursor.stage === 'COMPLETE') return;
    timer.current = setTimeout(() => setCursor((c) => advanceCursor(balls, c)), holdMs(cursor));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // holdMs is derived from cursor/speed/balls, all listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, isPlaying, speed, hasEvents, balls]);

  const isComplete = cursor.stage === 'COMPLETE';

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const next = useCallback(() => {
    setIsPlaying(false);
    setCursor((c) => manualNext(balls, c));
  }, [balls]);
  const skipToEnd = useCallback(() => {
    setIsPlaying(false);
    setCursor({ stage: 'COMPLETE', index: Math.max(0, balls.length - 1) });
  }, [balls.length]);

  const index = cursor.index;
  const view = useMemo(
    () => (match ? deriveMatchView(match, balls, index) : EMPTY_VIEW),
    [match, balls, index],
  );
  const ball = balls[index] ?? null;
  const feedback = useMemo(
    () =>
      ball && cursor.stage === 'BALL' ? deliveryFeedback(ball, view.striker, view.bowler) : null,
    [ball, cursor.stage, view.striker, view.bowler],
  );

  return {
    view,
    ball,
    feedback,
    stage: cursor.stage,
    index,
    balls,
    isPlaying: isPlaying && !isComplete,
    isComplete,
    speed,
    hasEvents,
    next,
    play,
    pause,
    setSpeed,
    skipToEnd,
  };
}

const EMPTY_VIEW: MatchView = {
  inningsNumber: 1,
  battingTeamName: '',
  bowlingTeamName: '',
  runs: 0,
  wickets: 0,
  legalBalls: 0,
  target: null,
  runsRequired: null,
  ballsRemaining: null,
  crr: 0,
  rrr: null,
  striker: null,
  nonStriker: null,
  bowler: null,
  feed: [],
  complete: true,
  totalBalls: 0,
};
