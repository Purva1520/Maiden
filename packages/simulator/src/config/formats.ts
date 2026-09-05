/** Format configuration: overs, bowler limits, phase boundaries, toss (§6). */
import type { CricketFormat, MatchPhase } from '../models/delivery.js';

export interface FormatConfig {
  readonly overs: number;
  readonly ballsPerOver: number;
  readonly maxBalls: number;
  readonly maxOversPerBowler: number;
  /** Probability the toss winner elects to bat (§51). */
  readonly batFirstProbability: number;
  /** Powerplay = first N overs; death = last M overs; middle is the rest. */
  readonly powerplayOvers: number;
  readonly deathOvers: number;
  /** Reference run rate used by chase-pressure modifiers (§54). */
  readonly parRunRate: number;
}

export const FORMAT_CONFIG: Record<CricketFormat, FormatConfig> = {
  ODI: {
    overs: 50,
    ballsPerOver: 6,
    maxBalls: 300,
    maxOversPerBowler: 10,
    batFirstProbability: 0.55,
    powerplayOvers: 10,
    deathOvers: 10,
    parRunRate: 5.5,
  },
  T20: {
    overs: 20,
    ballsPerOver: 6,
    maxBalls: 120,
    maxOversPerBowler: 4,
    batFirstProbability: 0.5,
    powerplayOvers: 6,
    deathOvers: 4,
    parRunRate: 8.2,
  },
};

/** Resolve the match phase for a 0-based over index (§17). */
export function phaseForOver(format: CricketFormat, overIndex: number): MatchPhase {
  const cfg = FORMAT_CONFIG[format];
  if (overIndex < cfg.powerplayOvers) return 'POWERPLAY';
  if (overIndex >= cfg.overs - cfg.deathOvers) return 'DEATH';
  return 'MIDDLE';
}
