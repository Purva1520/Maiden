import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_SIMULATION_CONFIG,
  loadSimulationConfig,
  type SimulationConfig,
} from '@maiden/simulator';

/**
 * Loads the Phase 7 calibrated simulation config (`simulation_config_v1.json`) for use
 * in game and campaign match execution, so drafted/campaign matches run on the
 * calibrated ODI/T20 model rather than the uncalibrated Phase 6 baseline. Falls back to
 * `DEFAULT_SIMULATION_CONFIG` when the file is absent or invalid.
 */
let cached: SimulationConfig | null = null;

function findConfigFile(): string | null {
  let curr = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(curr, 'data', 'game', 'simulation', 'simulation_config_v1.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return null;
}

export function loadCalibratedConfig(): SimulationConfig {
  if (cached) return cached;
  const file = findConfigFile();
  if (file) {
    try {
      cached = loadSimulationConfig(JSON.parse(fs.readFileSync(file, 'utf-8')));
      return cached;
    } catch {
      // Fall back to the baseline below.
    }
  }
  cached = DEFAULT_SIMULATION_CONFIG;
  return cached;
}

/** Test/tooling helper to reset the memoized config. */
export function resetCalibratedConfig(): void {
  cached = null;
}
