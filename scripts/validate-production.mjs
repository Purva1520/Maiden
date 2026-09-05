#!/usr/bin/env node
/**
 * Maiden production release gate (Phase 12 §182).
 *
 * Runs the critical checks in a deterministic order and exits non-zero on the
 * first failure. Heavy Monte-Carlo / balance runs live in validate:deep, not
 * here, so this stays fast enough for CI.
 *
 *   pnpm validate:production
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENV_PY = resolve(ROOT, '.venv/bin/python');
// Quote for the shell — the repo path may contain spaces.
const PY = JSON.stringify(VENV_PY);

/** @type {{name: string, cmd: string, optional?: boolean, skipIf?: () => boolean}[]} */
const STEPS = [
  { name: 'Typecheck', cmd: 'pnpm -s typecheck' },
  { name: 'Lint', cmd: 'pnpm -s lint' },
  { name: 'Format check', cmd: 'pnpm -s format:check' },
  { name: 'Unit / integration / simulation tests', cmd: 'pnpm -s test' },
  {
    name: 'Python data + ratings tests',
    cmd: `${PY} -m pytest -q`,
    skipIf: () => !existsSync(VENV_PY),
  },
  {
    name: 'Database integrity',
    cmd: `${PY} scripts/validate_database.py`,
    skipIf: () =>
      !existsSync(resolve(ROOT, 'data/processed/maiden.sqlite')) || !existsSync(VENV_PY),
  },
  {
    name: 'Simulation config validation',
    cmd: `${PY} scripts/validate_simulation_config.py`,
    skipIf: () => !existsSync(VENV_PY),
  },
  { name: 'Production build', cmd: 'pnpm -s build' },
];

let failed = false;
console.log('\n=== MAIDEN PRODUCTION VALIDATION ===\n');
for (const step of STEPS) {
  if (step.skipIf?.()) {
    console.log(`↷ SKIP  ${step.name} (prerequisite missing)`);
    continue;
  }
  process.stdout.write(`▶ ${step.name} … `);
  try {
    execSync(step.cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('PASS');
  } catch (err) {
    console.log('FAIL');
    console.error(`\n--- ${step.name} output ---`);
    console.error(err.stdout?.toString() ?? '');
    console.error(err.stderr?.toString() ?? '');
    failed = true;
    break;
  }
}

console.log('\n===================================');
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS — release gate green');
process.exit(failed ? 1 : 0);
