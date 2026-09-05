#!/usr/bin/env node
/**
 * Maiden deep validation (Phase 12 §183) — heavier, pre-release checks:
 * large simulation batches (calibration regression) and a campaign smoke batch.
 * Slower than validate:production; run before a major release.
 *
 *   pnpm validate:deep
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const STEPS = [
  {
    name: 'Calibration regression (12k innings/format vs Phase 7 envelope)',
    cmd: 'pnpm -s --filter @maiden/simulator calibrate',
    // The driver prints STATUS: PASS/REVIEW and always exits 0; we assert on PASS.
    assert: (out) => /STATUS:\s*PASS/.test(out),
  },
  {
    name: 'Campaign smoke batch (100 deterministic campaigns)',
    cmd: 'pnpm -s exec tsx scripts/run_campaign_batch.ts',
    assert: (out) => /Completed 100 campaigns/.test(out),
  },
];

let failed = false;
console.log('\n=== MAIDEN DEEP VALIDATION ===\n');
for (const step of STEPS) {
  process.stdout.write(`▶ ${step.name} … `);
  try {
    const out = execSync(step.cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    if (step.assert && !step.assert(out)) {
      console.log('FAIL (assertion)');
      console.error(out.slice(-1200));
      failed = true;
      break;
    }
    console.log('PASS');
  } catch (err) {
    console.log('FAIL');
    console.error(err.stdout?.toString()?.slice(-1200) ?? '');
    console.error(err.stderr?.toString()?.slice(-1200) ?? '');
    failed = true;
    break;
  }
}

console.log('\n==============================');
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS — deep validation green');
process.exit(failed ? 1 : 0);
