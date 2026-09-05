/** Match-level types: input, toss, result. */
import type { CricketFormat } from './delivery.js';
import type { InningsResult, MatchEvent } from './innings.js';
import type { Team } from './player.js';

export interface MatchInput {
  readonly format: CricketFormat;
  readonly teamA: Team;
  readonly teamB: Team;
  readonly seed: number;
}

export interface TossResult {
  readonly winnerId: string;
  readonly winnerName: string;
  readonly decision: 'bat' | 'field';
}

export type ResultType = 'WIN_BY_RUNS' | 'WIN_BY_WICKETS' | 'TIE';

export interface MatchResultDetail {
  readonly type: ResultType;
  readonly winnerId: string | null;
  readonly winnerName: string | null;
  readonly marginRuns: number | null;
  readonly marginWickets: number | null;
  readonly ballsRemaining: number | null;
  readonly text: string;
}

export interface MatchResult {
  readonly format: CricketFormat;
  readonly teamA: { readonly id: string; readonly name: string };
  readonly teamB: { readonly id: string; readonly name: string };
  readonly toss: TossResult;
  readonly innings1: InningsResult;
  readonly innings2: InningsResult;
  readonly result: MatchResultDetail;
  readonly events: readonly MatchEvent[];
  readonly seed: number;
  readonly simulationVersion: string;
  readonly configVersion: string;
}
