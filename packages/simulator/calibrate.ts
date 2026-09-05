/**
 * Phase 7 calibration driver (run: `pnpm --filter @maiden/simulator calibrate`).
 *
 * Reads the historical summary (from build_historical_calibration.py), records
 * the Phase 6 baseline, tunes per-format base outcome probabilities toward the
 * historical ODI/T20 targets, validates on a large sample, and writes:
 *   data/game/simulation/simulation_config_v1.json   (tracked, calibrated model)
 *   data/processed/calibration_report_v1.{json,txt}  (before/after comparison)
 *   data/processed/calibration_summary_v1.json
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SIMULATION_CONFIG, type SimulationConfig } from './src/config/models.js';
import {
  calibrateFormat,
  runBatch,
  type FormatSummary,
  type Targets,
} from './src/calibration/harness.js';
import type { CricketFormat } from './src/models/delivery.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const P = (rel: string): string => resolve(ROOT, rel);

const VALIDATION_MATCHES = 12000; // >= 10,000 innings per format (§21)
const FORMATS: readonly CricketFormat[] = ['ODI', 'T20'];

interface HistFmt {
  run_rate: { mean: number };
  wicket_rate: { mean: number };
  four_rate: { mean: number };
  six_rate: { mean: number };
  score: { mean: number };
  chase: { success_rate: number };
}

function targets(h: HistFmt): Targets {
  return {
    run_rate: h.run_rate.mean,
    wicket_rate: h.wicket_rate.mean,
    four_rate: h.four_rate.mean,
    six_rate: h.six_rate.mean,
  };
}

function relErr(sim: number, hist: number): number {
  return hist === 0 ? 0 : Math.abs(sim - hist) / hist;
}

function aggError(sim: FormatSummary, h: HistFmt): number {
  return (
    relErr(sim.score.mean, h.score.mean) +
    relErr(sim.run_rate.mean, h.run_rate.mean) +
    relErr(sim.wicket_rate.mean, h.wicket_rate.mean) +
    relErr(sim.four_rate.mean, h.four_rate.mean) +
    relErr(sim.six_rate.mean, h.six_rate.mean)
  );
}

function main(): void {
  const hist = JSON.parse(
    readFileSync(P('data/processed/historical_calibration_summary.json'), 'utf-8'),
  ) as { formats: Record<CricketFormat, HistFmt> };

  const baselineSummary: Record<string, FormatSummary> = {};
  const calibratedSummary: Record<string, FormatSummary> = {};
  const calibratedFormats = {} as SimulationConfig['formats'];

  for (const fmt of FORMATS) {
    const h = hist.formats[fmt];
    // Baseline (Phase 6 defaults).
    baselineSummary[fmt] = runBatch(DEFAULT_SIMULATION_CONFIG, {
      format: fmt,
      matches: VALIDATION_MATCHES,
      seedBase: 0,
    });
    // Tune.
    const tuned = calibrateFormat(DEFAULT_SIMULATION_CONFIG.formats[fmt], fmt, targets(h));
    calibratedFormats[fmt] = tuned;
  }

  const calibratedConfig: SimulationConfig = {
    simulationVersion: 'v1',
    calibrationVersion: 'v1',
    formats: calibratedFormats,
  };

  for (const fmt of FORMATS) {
    calibratedSummary[fmt] = runBatch(calibratedConfig, {
      format: fmt,
      matches: VALIDATION_MATCHES,
      seedBase: 5_000_000,
    });
  }

  // --- write the calibrated config (self-describing, §54) ---
  const configOut = {
    ...calibratedConfig,
    calibratedAgainst: 'Cricsheet (men ODI + T20, full innings)',
    description:
      'Phase 7 v1 calibration. Per-format base outcome probabilities fitted to historical ODI/T20 run-rate, wicket, four and six rates. Phase/skill/style/match-state modifiers inherited from the Phase 6 baseline.',
  };
  mkdirSync(P('data/game/simulation'), { recursive: true });
  writeFileSync(
    P('data/game/simulation/simulation_config_v1.json'),
    JSON.stringify(configOut, null, 2) + '\n',
  );

  // --- reports ---
  const report = { formats: {} as Record<string, unknown> };
  const lines: string[] = [
    'MAIDEN SIMULATION CALIBRATION — V1',
    '===================================',
  ];
  for (const fmt of FORMATS) {
    const h = hist.formats[fmt];
    const b = baselineSummary[fmt]!;
    const c = calibratedSummary[fmt]!;
    report.formats[fmt] = {
      historical: h,
      baseline: b,
      calibrated: c,
      baseline_error: aggError(b, h),
      calibrated_error: aggError(c, h),
    };
    const row = (name: string, hv: number, bv: number, cv: number): string =>
      `  ${name.padEnd(14)} ${hv.toFixed(2).padStart(8)} ${bv.toFixed(2).padStart(9)} ${cv.toFixed(2).padStart(11)}`;
    lines.push(
      '',
      fmt,
      '-'.repeat(fmt.length),
      `Historical innings: ${h.score.mean ? '(full pop.)' : ''}`,
      `Simulated innings: ${c.innings_count}`,
      '',
      `  ${'Metric'.padEnd(14)} ${'Historical'.padStart(8)} ${'Baseline'.padStart(9)} ${'Calibrated'.padStart(11)}`,
      row('Mean score', h.score.mean, b.score.mean, c.score.mean),
      row('Run rate', h.run_rate.mean, b.run_rate.mean, c.run_rate.mean),
      row('Wicket/100', h.wicket_rate.mean, b.wicket_rate.mean, c.wicket_rate.mean),
      row('Four/100', h.four_rate.mean, b.four_rate.mean, c.four_rate.mean),
      row('Six/100', h.six_rate.mean, b.six_rate.mean, c.six_rate.mean),
      row(
        'Chase %',
        h.chase.success_rate * 100,
        b.chase.success_rate * 100,
        c.chase.success_rate * 100,
      ),
      '',
      `  Aggregate rel. error: baseline ${aggError(b, h).toFixed(3)} -> calibrated ${aggError(c, h).toFixed(3)}`,
    );
  }
  const status = FORMATS.every((f) => aggError(calibratedSummary[f]!, hist.formats[f]) < 0.15)
    ? 'PASS'
    : 'REVIEW';
  lines.push('', `STATUS: ${status}`);

  writeFileSync(
    P('data/processed/calibration_report_v1.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  writeFileSync(P('data/processed/calibration_report_v1.txt'), lines.join('\n') + '\n');
  writeFileSync(
    P('data/processed/calibration_summary_v1.json'),
    JSON.stringify({ baseline: baselineSummary, calibrated: calibratedSummary }, null, 2) + '\n',
  );

  console.log(lines.join('\n'));
}

main();
