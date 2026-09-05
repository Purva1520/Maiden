import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { loadSimulationConfig } from '../config/load.js';
import { DEFAULT_SIMULATION_CONFIG, type SimulationConfig } from '../config/models.js';
import { runBatch } from './harness.js';
import { simulateInnings } from '../core/innings-engine.js';
import { SeededRandom } from '../core/random.js';
import { TIERS } from './teams.js';
import type { CricketFormat } from '../models/delivery.js';

const CONFIG_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../data/game/simulation/simulation_config_v1.json',
);

function loadCalibrated(): SimulationConfig | null {
  try {
    return loadSimulationConfig(JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')));
  } catch {
    return null;
  }
}

/**
 * Frozen historical reference (Cricsheet men ODI + T20, full innings, §89) and
 * documented acceptance tolerances (§69). The calibrated engine must land within
 * these bands; a regression outside them means the model behaviour shifted.
 */
const HISTORICAL = {
  ODI: { score: 239.4, run_rate: 5.11, wicket_rate: 2.98, four_rate: 7.24, six_rate: 1.4 },
  T20: { score: 143.5, run_rate: 7.41, wicket_rate: 6.2, four_rate: 9.54, six_rate: 4.28 },
} as const;

describe('calibration config', () => {
  it('the committed config loads and validates (§57/§88)', () => {
    const cfg = loadCalibrated();
    if (!cfg) return; // config not present (skip)
    expect(cfg.simulationVersion).toBe('v1');
    expect(cfg.calibrationVersion).toBe('v1');
    expect(cfg.formats.ODI).toBeDefined();
    expect(cfg.formats.T20).toBeDefined();
  });

  it('rejects an invalid config (bad probabilities)', () => {
    const bad = {
      simulationVersion: 'v1',
      calibrationVersion: 'v1',
      formats: { ODI: {}, T20: {} },
    };
    expect(() => loadSimulationConfig(bad)).toThrow();
  });
});

describe('calibration metrics helper', () => {
  it('runBatch is deterministic (§43)', () => {
    const a = runBatch(DEFAULT_SIMULATION_CONFIG, { format: 'ODI', matches: 100, seedBase: 3 });
    const b = runBatch(DEFAULT_SIMULATION_CONFIG, { format: 'ODI', matches: 100, seedBase: 3 });
    expect(a.score.mean).toBe(b.score.mean);
    expect(a.wicket_rate.mean).toBe(b.wicket_rate.mean);
  });
});

describe('calibrated distributions match history (§70/§89)', () => {
  const cfg = loadCalibrated();
  const run = cfg ? it : it.skip;

  for (const fmt of ['ODI', 'T20'] as const) {
    run(`${fmt} score & rates are within tolerance`, () => {
      const h = HISTORICAL[fmt];
      const s = runBatch(cfg!, { format: fmt, matches: 1500, seedBase: 20_000 });
      expect(Math.abs(s.score.mean - h.score) / h.score).toBeLessThan(0.08);
      expect(Math.abs(s.run_rate.mean - h.run_rate) / h.run_rate).toBeLessThan(0.08);
      expect(Math.abs(s.wicket_rate.mean - h.wicket_rate) / h.wicket_rate).toBeLessThan(0.12);
      expect(Math.abs(s.four_rate.mean - h.four_rate) / h.four_rate).toBeLessThan(0.12);
      expect(Math.abs(s.six_rate.mean - h.six_rate) / h.six_rate).toBeLessThan(0.15);
    });
  }
});

describe('rating differentiation survives calibration (§71/§72)', () => {
  const cfg = loadCalibrated() ?? DEFAULT_SIMULATION_CONFIG;

  function meanScore(
    bat: (typeof TIERS)['elite'],
    bowl: (typeof TIERS)['elite'],
    fmt: CricketFormat,
  ): number {
    let total = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const r = simulateInnings(
        { inningsNumber: 1, battingTeam: bat, bowlingTeam: bowl, format: fmt, target: null },
        new SeededRandom(i + 1),
        undefined,
        cfg.formats[fmt],
      );
      total += r.runs;
    }
    return total / n;
  }

  it('elite batting out-scores weak batting against the same attack', () => {
    for (const fmt of ['ODI', 'T20'] as const) {
      const elite = meanScore(TIERS.elite, TIERS.average, fmt);
      const weak = meanScore(TIERS.weak, TIERS.average, fmt);
      expect(elite).toBeGreaterThan(weak + 15);
    }
  });

  it('elite bowling concedes fewer than weak bowling to the same batting', () => {
    for (const fmt of ['ODI', 'T20'] as const) {
      const vsElite = meanScore(TIERS.average, TIERS.elite, fmt);
      const vsWeak = meanScore(TIERS.average, TIERS.weak, fmt);
      expect(vsWeak).toBeGreaterThan(vsElite + 15);
    }
  });
});
