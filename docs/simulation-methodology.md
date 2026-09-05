# Simulation Methodology (v1)

Maiden's standalone limited-overs cricket simulation engine
(`packages/simulator`). It plays a complete ODI or T20 match offline, driven by
Phase 5 ratings and a seeded RNG, and emits structured state + events for a
future UI. The delivery model (Phase 6) is **statistically calibrated** in
Phase 7 so its aggregate ODI and T20 distributions match the project's own
Cricsheet history — see [Calibration (Phase 7)](#calibration-phase-7) below.

`simulationVersion = "v1"`, `configVersion = "v1"`. The engine loads its
calibrated numbers from `data/game/simulation/simulation_config_v1.json`; the
Phase 6 baseline lives in `config/` as `DEFAULT_SIMULATION_CONFIG` and is what
the engine falls back to when no config file is present.

## Architecture

Three layers, each independently testable (§4/§40/§72):

```
ratings + phase + format + match state
        ↓  delivery engine  (probability → RNG sample)
delivery result
        ↓  innings engine   (score, strike, wickets, bowler rotation, termination)
innings result
        ↓  match engine      (toss, two innings, chase, result)
match result
```

The engine is separated from its parameters (§77): engine code applies/normalizes/
samples distributions; `packages/simulator/src/config/` holds the numbers.

## Delivery outcomes

v1 outcome space: `DOT, ONE, TWO, THREE, FOUR, SIX, WICKET` (§8). Extras (WD/NB/
BYE/LB) are **not** implemented but the `DeliveryResult`/`WicketResult` shapes are
designed so they can be added without rewriting the engine (§11/§119).

## Delivery probability model

For each legal ball a normalized distribution over the 7 outcomes is built by
composing multiplicative modifiers on a format baseline, then sampling with one
RNG draw (§81):

1. **Baseline** — format-specific average-vs-average middle-over distribution.
2. **Phase** — POWERPLAY / MIDDLE / DEATH multipliers (§17).
3. **Skill matchup** — `s = (batRating − bowlRating)/100`; boundaries scale by
   `exp(k·s)`, wickets by `exp(−k·s)`, dots by `exp(−k·s)` (§13). Continuous, so a
   weaker player can still hit a boundary and a stronger one can still get out
   (§13/§23) — skill shifts distributions, never dictates outcomes.
4. **Batting style** — optional ANCHOR/AGGRESSOR bias, kept moderate so it never
   overwhelms rating (§20/§21).
5. **Chase pressure** — in the 2nd innings, aggression rises with the required run
   rate: `aggression = clamp((RRR − parRR)/scale, ±max)`, boosting boundaries and
   wicket risk, reducing dots (§19/§54). Desperate chases differ from comfortable
   ones — probabilistically, not scripted.

Probabilities are clamped non-negative and renormalized to sum to 1 (§79/§80); a
validation utility asserts this every ball (§15).

## Matchup uses Phase 5 ratings

The engine consumes `batRating` / `bowlRating` (0–99); it never computes ratings.
The dependency is strictly ratings → simulation (§12/§91). Ratings outside 0–99
throw `InvalidRatingError` (never silently clamped, §117).

## Seeded RNG

`SeededRandom` (mulberry32) is the only source of randomness — no `Math.random()`
(§24). One stream is created from the match seed and threaded through the toss and
every delivery (§26), so `(teams, format, seed, version)` reproduces a match
exactly (§3/§25/§31/§113).

## Innings rules

- Overs are counted in **legal balls** internally; `formatOvers(29) → "4.5"` for
  display only (§7/§89). No floating-point overs as canonical state.
- Strike rotates on odd runs and at the end of each over (§30/§37).
- On a WICKET the striker is dismissed (bowler-credited in v1) and the next batter
  enters; the innings ends when the lineup is exhausted (10 wickets) (§29/§31/§93).
- Per-batter and per-bowler state feed the scorecards (§32/§33).
- Termination: max overs reached, all out, or (2nd innings) target reached (§42/§55).

## Bowling rotation

Automatic: a bowl-capable player (has a `bowlRating`) with overs remaining who did
not bowl the previous over, chosen least-used-first (deterministic). ODI caps a
bowler at 10 overs, T20 at 4 (format config) and the limit is never exceeded — if
no legal bowler exists a `NoEligibleBowlerError` is thrown (§34/§35/§92). A team
with too little bowling capacity is rejected up front (`InvalidTeamError`, §118).

## Match & chase

Toss (seeded) sets the batting order; `target = firstInnings + 1` (§53). The chase
tracks required runs / balls / RRR (§54). Results (§59/§60):

- `WIN_BY_WICKETS` — target reached; margin = `10 − wicketsLost`, plus balls
  remaining.
- `WIN_BY_RUNS` — defended; margin = `firstInnings − secondInnings`.
- `TIE` — level scores (no Super Over in v1, §58).

## Events

Every match produces a structured event stream (`MATCH_START, TOSS,
INNINGS_START, OVER_START, DELIVERY, WICKET, OVER_END, INNINGS_END, MATCH_END`)
from which the final score is derivable (§62/§98). The engine never prints; the
CLI formats the structured result (§40/§112).

## Simplifications (v1)

- No extras (so `Σ batter runs = team total`, `Σ bowler wickets = team wickets`).
- Every wicket is a striker dismissal credited to the bowler.
- Automatic (non-tactical) bowling; format-weighted random toss.
- Parameters are hypotheses, **not calibrated** — see below.

## Known limitations

- No extras, run-outs, or multiple dismissal kinds; no Super Over; no pitch/weather.
  Because the sim has no extras, calibration folds extras into the scoring outcomes
  so simulated **total** runs match historical **total** runs (see below).
- Fixture ratings in `fixtures.ts` are **TEST FIXTURES, not Maiden ratings** (§64).
- Chase success rate is calibrated only as a secondary metric and remains a few
  points above history (see the calibration limitations).

## Calibration (Phase 7)

Phase 7 tunes the delivery model's **per-format base outcome distribution** so the
simulator's aggregate scoring distributions match real cricket, without overfitting
to any individual match and without hardcoding any historical result. The engine is
unchanged; only the numbers in `simulation_config_v1.json` change (§55/§77).

### Dataset & population

Targets are computed from the project's own Cricsheet database (`maiden.sqlite`),
not from World-Cup matches only — a broad men's ODI + T20 population
(`data-pipeline/calibration/historical.py`, materialized by
`scripts/build_historical_calibration.py`). A **full innings** is one that faced
≥ 80 % of its legal balls **or** was bowled out, so rain-shortened/abandoned
fragments do not bias the means. Score is the innings total (**including extras**);
legal balls exclude wides and no-balls; rates are per-100-legal-balls; run rate is
`runs / legal_balls × 6`. The simulated side uses the **identical** definitions
(`packages/simulator/src/calibration/harness.ts`), so history and sim are compared
like for like.

### Metrics & neutral teams

Calibration matches are played between two **flat, equally-rated neutral teams**
(72/72, skill signal `s = 0`), so the realized distribution reflects the config,
not a team-skill gap. Headline metrics: mean score, run rate, wicket rate (/100),
four rate (/100), six rate (/100); secondary: chase success, win margins.

### Method

Iterative proportional fitting (§44 — simplest method that works): each iteration
runs a batch, scales `FOUR / SIX / WICKET` toward their target rates, shifts
`ONE ↔ DOT` toward the target run rate, renormalizes the 7-outcome vector, and
repeats (6 iterations). Phase/skill/style/match-state modifiers are inherited from
the Phase 6 baseline unchanged. ODI and T20 are calibrated **separately** into
distinct parameter sets.

### Baseline → calibrated (12,000 innings/format, neutral teams)

**ODI**

| Metric      | Historical | Baseline (P6) | Calibrated |
| ----------- | ---------: | ------------: | ---------: |
| Mean score  |     239.40 |        295.39 |     240.14 |
| Run rate    |       5.11 |          6.54 |       5.09 |
| Wicket /100 |       2.98 |          3.42 |       2.98 |
| Four /100   |       7.24 |         11.43 |       7.17 |
| Six /100    |       1.40 |          2.42 |       1.44 |
| Chase %     |      48.01 |         60.80 |      55.00 |

Aggregate relative error: **1.967 → 0.047**.

**T20**

| Metric      | Historical | Baseline (P6) | Calibrated |
| ----------- | ---------: | ------------: | ---------: |
| Mean score  |     143.46 |        165.86 |     143.72 |
| Run rate    |       7.41 |          8.37 |       7.38 |
| Wicket /100 |       6.20 |          5.15 |       6.29 |
| Four /100   |       9.54 |         15.47 |       9.56 |
| Six /100    |       4.28 |          5.32 |       4.19 |
| Chase %     |      48.72 |         69.40 |      53.40 |

Aggregate relative error: **1.319 → 0.044**.

### Parameter sensitivity

`+10 %` on each calibrated base outcome (renormalized), 4,000 innings, showing
change in mean score / run rate:

| Param  | ODI Δscore | ODI Δrr | T20 Δscore | T20 Δrr |
| ------ | ---------: | ------: | ---------: | ------: |
| ONE    |      +3.07 |   +0.03 |      −0.38 |   −0.06 |
| FOUR   |      +6.79 |   +0.13 |      +3.24 |   +0.16 |
| SIX    |      +2.11 |   +0.04 |      +2.39 |   +0.12 |
| WICKET |      −8.00 |   −0.03 |      −3.39 |   −0.07 |
| DOT    |      −8.48 |   −0.23 |      −3.29 |   −0.20 |

Score is most sensitive to `WICKET` and `DOT` (they end/waste deliveries) and to
`FOUR`; boundary rates move with their own parameters as expected. This confirms
the calibration levers are the right ones and none is pathologically dominant.

### Rating differentiation preserved

Calibration tunes the neutral baseline only; the skill matchup is untouched, so
elite batting still out-scores weak batting against the same attack and elite
bowling still concedes less (asserted in `calibration.test.ts`, §71/§72). Player
ratings are **not** modified by calibration.

### Reproduce

```bash
python scripts/build_historical_calibration.py            # compute targets from maiden.sqlite
pnpm --filter @maiden/simulator calibrate                 # fit + write config + reports
python scripts/validate_simulation_config.py              # sanity-check the config
```

Outputs: `data/game/simulation/simulation_config_v1.json` (tracked, loaded by the
engine), `data/processed/calibration_report_v1.{json,txt}`,
`calibration_summary_v1.json`, `calibration_sensitivity_v1.json`.

### Calibration limitations (v1)

- The sim has no extras, so extras are folded into scoring outcomes to match
  **total** runs; per-outcome rates therefore absorb a small extras component.
- Chase success is a secondary metric and stays a few points high (ODI 55 %,
  T20 53 % vs ~48 %) — the neutral-team chase model is slightly too likely to
  overhaul par. Not counted in the aggregate error; a candidate for v2.
- Targets are a whole-history population, not era- or venue-specific (out of scope,
  §per-era runtime params excluded).

## Phase 8 handoff

`simulateMatch({ format, teamA, teamB, seed }, deliverySim, config)` is pure and
side-effect-free and loads its calibrated numbers from config, so later phases can
run large batches over seeds and collect scores/run-rates/wickets/margins without
modifying the engine. Parameters live in config and are versioned, so re-calibration
changes only the numbers, not the architecture.
