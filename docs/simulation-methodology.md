# Simulation Methodology (Phase 6, v1)

Maiden's standalone limited-overs cricket simulation engine
(`packages/simulator`). It plays a complete ODI or T20 match offline, driven by
Phase 5 ratings and a seeded RNG, and emits structured state + events for a
future UI. **The model is not yet statistically calibrated — Phase 7 will
calibrate it against historical distributions.**

`simulationVersion = "v1"`, `configVersion = "v1"`.

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

- Not statistically calibrated: mean scores are plausible (batch smoke: ODI ≈
  295/8.7, T20 ≈ 175/5.8) but Phase 7 owns real calibration against historical
  distributions.
- No extras, run-outs, or multiple dismissal kinds; no Super Over; no pitch/weather.
- Fixture ratings in `fixtures.ts` are **TEST FIXTURES, not Maiden ratings** (§64).

## Phase 7 handoff

`simulateMatch({ format, teamA, teamB, seed })` is pure and side-effect-free, so
Phase 7 can run large batches over seeds and collect scores/run-rates/wickets/
margins without modifying the engine (§123). Parameters live in config and are
versioned, so calibration changes only the numbers, not the architecture.
