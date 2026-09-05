# Simulation Configuration (Phase 6, v1)

All tunable parameters live in `packages/simulator/src/config/` and are consumed
by the engine — changing behaviour never requires touching engine architecture
(§76/§77/§107). Bump `SIMULATION_VERSION` / `CONFIG_VERSION` (`config/version.ts`)
when a parameter changes materially (§108).

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

**Baseline distributions** (average batter vs average bowler, middle over):

| Outcome | ODI   | T20   |
| ------- | ----- | ----- |
| DOT     | 0.425 | 0.360 |
| ONE     | 0.330 | 0.330 |
| TWO     | 0.070 | 0.060 |
| THREE   | 0.006 | 0.004 |
| FOUR    | 0.115 | 0.150 |
| SIX     | 0.024 | 0.050 |
| WICKET  | 0.030 | 0.046 |

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
pnpm simulate                         # ODI, default seed, summary
pnpm --filter @maiden/simulator exec tsx src/cli.ts --format t20 --seed 42 --full
```

> These are **model hypotheses**, deliberately simple and interpretable. Phase 7
> will fit them to historical World Cup scoring distributions.
