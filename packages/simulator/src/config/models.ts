/**
 * Externalizable per-format simulation model (§53/§55). The engine consumes a
 * `SimulationConfig`; the calibrated values live in a JSON file
 * (data/game/simulation/simulation_config_v1.json), not in source.
 *
 * `DEFAULT_SIMULATION_CONFIG` reproduces the Phase 6 (uncalibrated) baseline
 * exactly, so the engine works with no config and Phase 6 regression holds.
 */
import type { CricketFormat, MatchPhase, OutcomeProbabilities } from '../models/delivery.js';
import type { BattingStyle } from '../models/player.js';
import { FORMAT_CONFIG } from './formats.js';
import { PROBABILITY_CONFIG, type OutcomeMultipliers } from './probabilities.js';

export interface ProbabilityModel {
  readonly base: OutcomeProbabilities;
  readonly phaseMultipliers: Record<MatchPhase, OutcomeMultipliers>;
  readonly skill: { readonly boundaryK: number; readonly wicketK: number; readonly dotK: number };
  readonly style: Record<BattingStyle, OutcomeMultipliers>;
  readonly matchState: {
    readonly scale: number;
    readonly maxAggression: number;
    readonly boundaryResponse: number;
    readonly wicketResponse: number;
    readonly dotResponse: number;
  };
  /** Chase-pressure reference run rate (§54). */
  readonly parRunRate: number;
}

export interface SimulationConfig {
  readonly simulationVersion: string;
  readonly calibrationVersion: string;
  readonly formats: Record<CricketFormat, ProbabilityModel>;
}

function defaultModel(format: CricketFormat): ProbabilityModel {
  return {
    base: PROBABILITY_CONFIG.base[format],
    phaseMultipliers: PROBABILITY_CONFIG.phaseMultipliers,
    skill: PROBABILITY_CONFIG.skill,
    style: PROBABILITY_CONFIG.style,
    matchState: PROBABILITY_CONFIG.matchState,
    parRunRate: FORMAT_CONFIG[format].parRunRate,
  };
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  simulationVersion: 'v1',
  calibrationVersion: 'baseline',
  formats: { ODI: defaultModel('ODI'), T20: defaultModel('T20') },
};
