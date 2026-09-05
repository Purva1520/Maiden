/** Load + validate an external SimulationConfig JSON (§55/§57). */
import { OUTCOMES } from '../models/delivery.js';
import { InvalidFormatError } from '../errors.js';
import type { CricketFormat } from '../models/delivery.js';
import type { ProbabilityModel, SimulationConfig } from './models.js';

const FORMATS: readonly CricketFormat[] = ['ODI', 'T20'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function validateModel(fmt: string, m: unknown): ProbabilityModel {
  if (!isRecord(m)) throw new InvalidFormatError(`Model for ${fmt} is not an object`);
  const base = m['base'];
  if (!isRecord(base)) throw new InvalidFormatError(`${fmt}.base missing`);
  let sum = 0;
  for (const o of OUTCOMES) {
    const v = base[o];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
      throw new InvalidFormatError(`${fmt}.base.${o} invalid: ${String(v)}`);
    }
    sum += v;
  }
  if (Math.abs(sum - 1) > 0.02) {
    throw new InvalidFormatError(`${fmt}.base must sum to ~1 (got ${sum.toFixed(3)})`);
  }
  for (const key of ['phaseMultipliers', 'skill', 'style', 'matchState'] as const) {
    if (!isRecord(m[key])) throw new InvalidFormatError(`${fmt}.${key} missing`);
  }
  if (typeof m['parRunRate'] !== 'number') {
    throw new InvalidFormatError(`${fmt}.parRunRate missing`);
  }
  return m as unknown as ProbabilityModel;
}

export function loadSimulationConfig(raw: unknown): SimulationConfig {
  if (!isRecord(raw)) throw new InvalidFormatError('Config is not an object');
  if (typeof raw['simulationVersion'] !== 'string') {
    throw new InvalidFormatError('simulationVersion missing');
  }
  if (typeof raw['calibrationVersion'] !== 'string') {
    throw new InvalidFormatError('calibrationVersion missing');
  }
  const formats = raw['formats'];
  if (!isRecord(formats)) throw new InvalidFormatError('formats missing');
  const parsed = {} as Record<CricketFormat, ProbabilityModel>;
  for (const fmt of FORMATS) {
    if (!(fmt in formats)) throw new InvalidFormatError(`formats.${fmt} missing`);
    parsed[fmt] = validateModel(fmt, formats[fmt]);
  }
  return {
    simulationVersion: raw['simulationVersion'],
    calibrationVersion: raw['calibrationVersion'],
    formats: parsed,
  };
}
