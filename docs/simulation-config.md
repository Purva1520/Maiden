# Simulation Configuration (v1)

All tunable parameters live in `packages/simulator/src/config/` and are consumed
by the engine — changing behaviour never requires touching engine architecture
(§76/§77/§107). Bump `SIMULATION_VERSION` / `CONFIG_VERSION` (`config/version.ts`)
when a parameter changes materially (§108).

## Where the numbers come from

There are two sources of the probability model, both shaped as `ProbabilityModel`
(`config/models.ts`):

- **`DEFAULT_SIMULATION_CONFIG`** — the Phase 6 baseline, assembled in code from
  `config/formats.ts` + `config/probabilities.ts` (the tables below). This is the
  fallback when no calibrated file is present, and it reproduces Phase 6 exactly so
  the frozen regression tests still hold.
- **`data/game/simulation/simulation_config_v1.json`** — the **calibrated** config
  written by Phase 7 (`pnpm --filter @maiden/simulator calibrate`). The CLI and any
  caller that passes it load it via `loadSimulationConfig()`, which validates every
  base distribution (7 outcomes, each in [0,1], summing to ~1) and the presence of
  phase/skill/style/match-state/parRunRate before use. **Calibrated numbers are not
  hardcoded into engine source** (§55) — the engine only ever reads a
  `SimulationConfig`.

Validate a config file with:

```bash
python scripts/validate_simulation_config.py
```

## Format config (`config/formats.ts`)

|                                | ODI      | T20      |
| ------------------------------ | -------- | -------- |
| Overs / max legal balls        | 50 / 300 | 20 / 120 |
| Max overs per bowler           | 10       | 4        |
| Powerplay overs (first N)      | 10       | 6        |
| Death overs (last M)           | 10       | 4        |
| Toss: P(elect to bat)          | 0.55     | 0.50     |
| Par run rate (chase reference) | 5.5      | 8.2      |

`phaseForOver(format, overIndex)` → POWERPLAY / MIDDLE / DEATH.

## Probability config (`config/probabilities.ts`)

**Baseline distributions** (average batter vs average bowler, middle over). The
Phase 6 hypothesis and the Phase 7 calibrated values (from
`simulation_config_v1.json`), side by side:

| Outcome | ODI (P6) | ODI (calibrated) | T20 (P6) | T20 (calibrated) |
| ------- | -------- | ---------------- | -------- | ---------------- |
| DOT     | 0.425    | 0.4994           | 0.360    | 0.2822           |
| ONE     | 0.330    | 0.3076           | 0.330    | 0.4601           |
| TWO     | 0.070    | 0.0748           | 0.060    | 0.0645           |
| THREE   | 0.006    | 0.0064           | 0.004    | 0.0043           |
| FOUR    | 0.115    | 0.0715           | 0.150    | 0.0932           |
| SIX     | 0.024    | 0.0139           | 0.050    | 0.0398           |
| WICKET  | 0.030    | 0.0263           | 0.046    | 0.0558           |

Calibration lowered ODI boundary rates sharply (the Phase 6 hypothesis over-scored
by ~55 runs) and rebalanced T20 toward more ones and fewer dots. Only the base
vector was fitted; the modifiers below are inherited unchanged.

**Phase multipliers** (applied to the baseline, then renormalized):

|           | DOT  | ONE  | FOUR | SIX  | WICKET |
| --------- | ---- | ---- | ---- | ---- | ------ |
| POWERPLAY | 0.95 | —    | 1.15 | 1.15 | 1.10   |
| MIDDLE    | 1.05 | 1.05 | 0.90 | 0.85 | —      |
| DEATH     | 0.90 | 0.95 | 1.30 | 1.60 | 1.50   |

**Skill** (`s = (batRating − bowlRating)/100`): FOUR & SIX × `exp(0.9·s)`,
WICKET × `exp(−1.1·s)`, DOT × `exp(−0.4·s)`.

**Batting style**: ANCHOR `{DOT×1.1, ONE×1.05, FOUR×0.95, SIX×0.8, WICKET×0.9}`;
AGGRESSOR `{DOT×0.92, ONE×0.98, FOUR×1.15, SIX×1.2, WICKET×1.15}`.

**Chase pressure**: `aggression = clamp((requiredRR − parRR)/3.0, ±2.5)`; then
FOUR & SIX × `exp(aggression·0.35)`, WICKET × `exp(aggression·0.25)`, DOT ×
`exp(−aggression·0.3)`.

## Sampling

After all multipliers, the vector is clamped to ≥ 0 and rescaled to sum to 1, then
sampled with a single RNG draw over the cumulative distribution (§79/§81).

## Commands

```bash
pnpm simulate                         # ODI, default seed, summary (loads calibrated config)
pnpm --filter @maiden/simulator exec tsx src/cli.ts --format t20 --seed 42 --full
pnpm --filter @maiden/simulator calibrate   # re-fit config from historical targets
python scripts/validate_simulation_config.py
```

## Calibrated config file (`simulation_config_v1.json`)

```jsonc
{
  "simulationVersion": "v1",
  "calibrationVersion": "v1",
  "calibratedAgainst": "Cricsheet (men ODI + T20, full innings)",
  "description": "...",
  "formats": {
    "ODI": { "base": { /* 7 outcomes */ }, "phaseMultipliers": {…},
             "skill": {…}, "style": {…}, "matchState": {…}, "parRunRate": 5.5 },
    "T20": { … }
  }
}
```

The base tables above are **hypotheses** for Phase 6; the calibrated column and the
JSON file are what the engine actually runs. See
[`simulation-methodology.md`](simulation-methodology.md#calibration-phase-7) for the
calibration method, before/after distributions and parameter sensitivity.
